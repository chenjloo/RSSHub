import type { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';

export const route: Route = {
    path: '/wsj/:category?',
    categories: ['news'],
    example: '/wsj/world',
    parameters: {
        category: '栏目，如 world, markets, business',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
    },
    name: 'WSJ Latest',
    maintainers: ['yourname'],
    handler: async (ctx) => {
        const category = ctx.req.param('category') ?? 'world';
        const rootUrl = 'https://www.wsj.com';
        const currentUrl = `${rootUrl}/news/${category}`;

        const { data } = await got({
            url: currentUrl,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': rootUrl,
            },
        });

        const $ = load(data);

        const items = $('article')
            .map((_, el) => {
                const title = $(el).find('h3 a').text().trim();
                const link = $(el).find('h3 a').attr('href');

                const image =
                    $(el).find('img').attr('src') ||
                    $(el).find('img').attr('data-src');

                if (!title || !link) {
                    return null;
                }

                return {
                    title,
                    link: link.startsWith('http')
                        ? link
                        : `${rootUrl}${link}`,
                    description: image
                        ? `<img src="${image}" />`
                        : '',
                };
            })
            .get()
            .filter(Boolean)
            .slice(0, 20);

        return {
            title: `WSJ - ${category}`,
            link: currentUrl,
            item: items,
        };
    },
};
