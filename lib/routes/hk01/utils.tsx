import { renderToString } from 'hono/jsx/dom/server';

import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import { load } from 'cheerio';

const rootUrl = 'https://hk01.com';
const apiRootUrl = 'https://web-data.api.hk01.com';

const renderDescription = ({ image }) => {
    if (!image) return '';
    return renderToString(<img src={image} />);
};

const ProcessItems = (items, limit, tryGet) =>
    Promise.all(
        items
            .filter((item) => item.type !== 2)
            .slice(0, limit ? Number.parseInt(limit) : 50)
            .map((item) => ({
                title: item.data.title,
                link: item.data.publishUrl,
                pubDate: parseDate(item.data.publishTime * 1000),
                category: item.data.tags.map((t) => t.tagName),
                author: item.data.authors.map((a) => a.publishName).join(', '),
                articleImg: item.data.mainImage.cdnUrl,
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

                    const articleImg = renderDescription({
                        image: item.articleImg,
                    });

                    item.description = articleImg + articleContent;

                    return item;
                })
            )
    );

export { apiRootUrl, ProcessItems, rootUrl };
