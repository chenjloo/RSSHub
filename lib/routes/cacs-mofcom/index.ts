import { type CheerioAPI, load } from 'cheerio';
import type { Route, DataItem } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';

const CATEGORIES: Record<string, { name: string; section: string; slug: string }> = {
    jkdc:    { name: '进口调查',       section: 'ajycs',   slug: 'jkdc'   },
    ckyy:    { name: '出口应诉',       section: 'ajycs',   slug: 'ckyy'   },
    myhz:    { name: '贸易伙伴间案件', section: 'ajycs',   slug: 'myhz'   },
    smzd:    { name: '世贸争端',       section: 'ajycs',   slug: 'smzd'   },
    '337dc': { name: '337调查',        section: 'ajycs',   slug: '337dc'  },
    hhtb:    { name: '召回通报',       section: 'ajycs',   slug: 'hhtb'   },
    jn:      { name: '境内动态',       section: 'jnwjmdt', slug: 'jn'     },
    jw:      { name: '境外动态',       section: 'jnwjmdt', slug: 'jw'     },
    df:      { name: '地方动态',       section: 'jnwjmdt', slug: 'df'     },
    gzyw:    { name: '工作要闻',       section: 'zxjj',    slug: 'gzyw'   },
    zjgd:    { name: '专家观点',       section: 'zxjj',    slug: 'zjgd'   },
    ald:     { name: '案例导读',       section: 'zxjj',    slug: 'ald'    },
    myjy:    { name: '贸易救济政策',   section: 'zcfl',    slug: 'myjy'   },
    xgzc:    { name: '相关政策',       section: 'zcfl',    slug: 'xgzc'   },
};

const BASE_URL = 'https://cacs.mofcom.gov.cn';

// curl 测试证明不需要 Cookie，直接请求即可
async function fetchPage(url: string): Promise<string> {
    const resp = await got(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Referer: BASE_URL + '/',
        },
    });
    return resp.body;
}

async function fetchList(section: string, slug: string, page = 1): Promise<DataItem[]> {
    const url = `${BASE_URL}/list/${section}/${slug}/${page}/cateinfo.html`;
    const html = await fetchPage(url);
    const $: CheerioAPI = load(html);
    const items: DataItem[] = [];

    $('#infoList li').each((_, el) => {
        const $el = $(el);
        const $a = $el.find('a').first();
        const title = $a.text().trim();
        let link = $a.attr('href') ?? '';
        if (link && !link.startsWith('http')) {
            link = `${BASE_URL}${link}`;
        }
        const dateStr = $el.find('span').first().text().trim();
        if (title && link) {
            items.push({
                title,
                link,
                pubDate: dateStr ? parseDate(dateStr) : undefined,
            });
        }
    });

    return items;
}

interface ArticleDetail {
    description: string;
    pubDate?: Date;
    author?: string;
}

async function fetchContent(link: string): Promise<ArticleDetail> {
    try {
        const html = await fetchPage(link);
        const $ = load(html);
        const timeText = $('#show_time').text().trim();
        const timeParts = timeText.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*(.*)/);
        const pubDate = timeParts ? parseDate(timeParts[1]) : undefined;
        const author = timeParts?.[2]?.trim() || undefined;
        const $article = $('section.article');
        $article.find('.lawShow, #show_title, #show_time, h3').remove();
        const description = $article.html() ?? '';
        return { description, pubDate, author };
    } catch {
        return { description: '' };
    }
}

async function handler(ctx: any) {
    const category = ctx.req.param('category') ?? 'jkdc';
    const meta = CATEGORIES[category];
    if (!meta) {
        throw new Error(`未知栏目 "${category}"，可用值：${Object.keys(CATEGORIES).join(', ')}`);
    }

    const items = await fetchList(meta.section, meta.slug);
    const enriched = await Promise.all(
        items.slice(0, 10).map(async (item) => {
            if (!item.link) return item;
            const { description, pubDate, author } = await fetchContent(item.link);
            return { ...item, description, pubDate: pubDate ?? item.pubDate, author };
        })
    );

    return {
        title: `中国贸易救济信息网 - ${meta.name}`,
        link: `${BASE_URL}/list/${meta.section}/${meta.slug}/1/cateinfo.html`,
        description: `商务部贸易救济信息网 ${meta.name} 栏目`,
        language: 'zh-cn',
        item: enriched,
    };
}

export const route: Route = {
    path: '/:category?',
    name: '中国贸易救济信息网',
    url: 'cacs.mofcom.gov.cn',
    maintainers: [],
    example: '/cacs-mofcom/jkdc',
    parameters: {
        category: {
            description: '栏目代码，默认为进口调查 (jkdc)',
            options: Object.entries(CATEGORIES).map(([value, { name }]) => ({
                label: name,
                value,
            })),
            default: 'jkdc',
        },
    },
    categories: ['government'],
    radar: [
        {
            source: ['cacs.mofcom.gov.cn/list/:section/:slug/*'],
            target: (params) => {
                const found = Object.entries(CATEGORIES).find(([, v]) => v.slug === params.slug);
                return found ? `/${found[0]}` : '/jkdc';
            },
        },
    ],
    handler,
};
