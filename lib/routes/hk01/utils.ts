import { getCurrentPath } from '@/utils/helpers';
const __dirname = getCurrentPath(import.meta.url);

import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { art } from '@/utils/render';
import path from 'node:path';

const rootUrl = 'https://hk01.com';
const apiRootUrl = 'https://web-data.api.hk01.com';

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

                    // remove unwanted elements
                    //content('#ad_popup').remove();
                    //content('[class^=ad-]').remove();
                    //content('[id^=ad-]').remove();
                    //content('[id^=div-gpt-ad-]').remove();
                    //content('.view-tracker').remove();
                    //content('.w-screen').remove();
                    //content('.grid').remove();

                    item.description = art(path.join(__dirname, 'templates/description.art'), {
                        articleImg: item.articleImg,
                        content: content('div#article-content').find('p').map((_, el) => content(el).html()).get(),
                    });


                    return item;
                })
            )
    );

export { rootUrl, apiRootUrl, ProcessItems };
