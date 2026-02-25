import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import parser from '@/utils/rss-parser';

// Channel ID map from https://www.cnbc.com/rss-feeds/
const CHANNEL_MAP: Record<string, string> = {
    'top-news': '100003114',
    'world-news': '100004095',
    business: '10000664',
    finance: '10001147',
    earnings: '15839135',
    investing: '15839069',
    tech: '19854910',
    politics: '10000113',
    entertainment: '10001397',
    health: '10000108',
    'real-estate': '21324812',
    energy: '19836768',
    media: '10000115',
    cybersecurity: '26094818',
    science: '15956632',
    sports: '10000116',
    'personal-finance': '21324812',
    travel: '10001781',
    climate: '44877279',
    retail: '10000116',
};

export const route: Route = {
    path: '/rss/:id?',
    categories: ['traditional-media'],
    example: '/cnbc/rss/top-news',
    parameters: {
        id: `Channel ID or channel name. Defaults to \`top-news\`. 
        
Supported names: ${Object.keys(CHANNEL_MAP).join(', ')}.

Or use numeric IDs from [CNBC RSS feeds](https://www.cnbc.com/rss-feeds/).`,
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.cnbc.com/id/:id/device/rss/rss.html'],
            target: '/rss/:id',
        },
    ],
    name: 'Full article RSS',
    maintainers: ['TonyRL'],
    handler,
    description: `Provides a better reading experience (full articles) over the official ones.

Supports all channels via numeric ID or named slug. See [CNBC RSS feeds](https://www.cnbc.com/rss-feeds/).

| Channel Name | Slug |
|---|---|
| Top News | \`top-news\` |
| World News | \`world-news\` |
| Business | \`business\` |
| Finance | \`finance\` |
| Earnings | \`earnings\` |
| Investing | \`investing\` |
| Technology | \`tech\` |
| Politics | \`politics\` |
| Entertainment | \`entertainment\` |
| Health | \`health\` |
| Real Estate | \`real-estate\` |
| Energy | \`energy\` |
| Media | \`media\` |
| Cybersecurity | \`cybersecurity\` |
| Science | \`science\` |`,
};

async function handler(ctx) {
    const { id = 'top-news' } = ctx.req.param();
    
    // Resolve named slug to numeric ID, or use as-is if already numeric
    const channelId = CHANNEL_MAP[id] ?? id;
    
    const feed = await parser.parseURL(`https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=${channelId}`);

    const items = await Promise.all(
        feed.items
            .filter((i) => i.link && !i.link.startsWith('https://www.cnbc.com/select/'))
            .map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link);
                    const $ = load(response);

                    delete item.content;
                    delete item.contentSnippet;
                    delete item.isoDate;

                    item.description = '';
                    if ($('.RenderKeyPoints-keyPoints').length) {
                        $('.RenderKeyPoints-keyPoints').html();
                    }
                    if ($('.FeaturedContent-articleBody').length) {
                        item.description += $('.FeaturedContent-articleBody').html();
                    }
                    if ($('.ArticleBody-articleBody').length) {
                        item.description += $('.ArticleBody-articleBody').html();
                    }
                    if ($('.LiveBlogBody-articleBody').length) {
                        item.description += $('.LiveBlogBody-articleBody').html();
                    }
                    if ($('.ClipPlayer-clipPlayer').length) {
                        item.description += $('.ClipPlayer-clipPlayer').html();
                    }

                    const meta = JSON.parse($('[type=application/ld+json]').last().text());
                    item.author = meta.author ? (meta.author.name ?? meta.author.map((a) => a.name).join(', ')) : null;
                    item.category = meta.keywords;

                    return item;
                })
            )
    );

    return {
        title: feed.title,
        link: feed.link,
        description: feed.description,
        item: items,
        language: feed.language,
    };
}
