import { type CheerioAPI, load } from 'cheerio';
import type { Route, DataItem } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

// ─── 栏目配置表 ──────────────────────────────────────────────
// URL 规律: https://cacs.mofcom.gov.cn/list/{section}/{slug}/{page}/cateinfo.html
// 其中首页汇总列表用 /cacscms/view/notice/{slug}
const CATEGORIES: Record<
    string,
    { name: string; section: string; slug: string }
> = {
    // 案件与措施
    jkdc: { name: '进口调查', section: 'ajycs', slug: 'jkdc' },
    ckyy: { name: '出口应诉', section: 'ajycs', slug: 'ckyy' },
    myhz: { name: '贸易伙伴间案件', section: 'ajycs', slug: 'myhz' },
    smzd: { name: '世贸争端', section: 'ajycs', slug: 'smzd' },
    '337dc': { name: '337调查', section: 'ajycs', slug: '337dc' },
    hhtb: { name: '召回通报', section: 'ajycs', slug: 'hhtb' },
    // 境内外经贸动态
    jn: { name: '境内动态', section: 'jnwjmdt', slug: 'jn' },
    jw: { name: '境外动态', section: 'jnwjmdt', slug: 'jw' },
    df: { name: '地方动态', section: 'jnwjmdt', slug: 'df' },
    // 资讯集锦
    gzyw: { name: '工作要闻', section: 'zxjj', slug: 'gzyw' },
    zjgd: { name: '专家观点', section: 'zxjj', slug: 'zjgd' },
    ald: { name: '案例导读', section: 'zxjj', slug: 'ald' },
    // 政策法律
    myjy: { name: '贸易救济政策', section: 'zcfl', slug: 'myjy' },
    xgzc: { name: '相关政策', section: 'zcfl', slug: 'xgzc' },
};

const BASE_URL = 'https://cacs.mofcom.gov.cn';

// ─── 抓取列表页 ──────────────────────────────────────────────
async function fetchList(section: string, slug: string, page = 1): Promise<DataItem[]> {
    const url = `${BASE_URL}/list/${section}/${slug}/${page}/cateinfo.html`;
    const html = await ofetch(url, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: BASE_URL,
        },
    });

    const $: CheerioAPI = load(html);
    const items: DataItem[] = [];

    // 实际结构：<ul class="list02 mt15" id="infoList">
    //   <li><a href="/article/...">标题</a><span>2026-03-13</span></li>
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

// ─── 抓取详情页正文 ──────────────────────────────────────────
interface ArticleDetail {
    description: string;
    pubDate?: Date;
    author?: string;
}

async function fetchContent(link: string): Promise<ArticleDetail> {
    try {
        const html = await ofetch(link, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                Referer: BASE_URL,
            },
        });
        const $ = load(html);

        // 实际结构：<section class="article">
        //   <h1 class="title01" id="show_title">标题</h1>
        //   <h2 class="title02" id="show_time">2026-03-13 16:51:29 商务部贸易救济调查局</h2>
        //   <p>正文...</p>
        //   <div class="lawShow">免责声明</div>

        // 提取精确发布时间和来源
        const timeText = $('#show_time').text().trim(); // "2026-03-13 16:51:29 商务部贸易救济调查局"
        const timeParts = timeText.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*(.*)/);
        const pubDate = timeParts ? parseDate(timeParts[1]) : undefined;
        const author = timeParts?.[2]?.trim() || undefined;

        // 移除免责声明，保留正文
        const $article = $('section.article');
        $article.find('.lawShow, #show_title, #show_time, h3').remove();
        const description = $article.html() ?? '';

        return { description, pubDate, author };
    } catch {
        return { description: '' };
    }
}

// ─── Route Handler ───────────────────────────────────────────
async function handler(ctx: any) {
    const category = ctx.req.param('category') ?? 'jkdc';
    const meta = CATEGORIES[category];

    if (!meta) {
        throw new Error(
            `未知栏目 "${category}"，可用值：${Object.keys(CATEGORIES).join(', ')}`
        );
    }

    const items = await fetchList(meta.section, meta.slug);

    // 并发抓取全文（最多 5 条，避免给服务器施压）
    const enriched = await Promise.all(
        items.slice(0, 10).map(async (item) => {
            if (!item.link) {
                return item;
            }
            const { description, pubDate, author } = await fetchContent(item.link);
            return {
                ...item,
                description,
                // 详情页时间更精确（含时分秒），优先使用
                pubDate: pubDate ?? item.pubDate,
                author,
            };
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

// ─── Route 定义 ──────────────────────────────────────────────
export const route: Route = {
    path: '/:category?',
    name: '中国贸易救济信息网',
    url: 'cacs.mofcom.gov.cn',
    maintainers: [],        // 填写你的 GitHub handle
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
                // 反查 slug → category
                const found = Object.entries(CATEGORIES).find(
                    ([, v]) => v.slug === params.slug
                );
                return found ? `/${found[0]}` : '/jkdc';
            },
        },
    ],
    handler,
};
