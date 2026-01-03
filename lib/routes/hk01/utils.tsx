import { renderToString } from 'hono/jsx/dom/server';

import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';

const rootUrl = 'https://hk01.com';
const apiRootUrl = 'https://web-data.api.hk01.com';

const ProcessItems = (items, limit, tryGet) =>
    Promise.all(
        items
            .filter((item) => item.type !== 2)
            .slice(0, limit ? Number.parseInt(limit) : 50)
            .map((item) => ({
                title: item.data.title,
                link: `${rootUrl}/sns/article/${item.data.articleId}`,
                pubDate: parseDate(item.data.publishTime * 1000),
                category: item.data.tags.map((t) => t.tagName),
                author: item.data.authors.map((a) => a.publishName).join(', '),
            }))
            .map((item) =>
                tryGet(item.link, async () => {
                    const detailResponse = await got({
                        method: 'get',
                        url: item.link,
                    });

                    const content = load(detailResponse.data);

                    const articleContent = content('#article-content-section')
                                               .children('div').remove().end()
                                               .find('div.cmp-icon').remove().end()
                                               .html();


                    item.description = articleContent;
                    
                    return item;
                })
            )
    );

export { apiRootUrl, ProcessItems, rootUrl };
