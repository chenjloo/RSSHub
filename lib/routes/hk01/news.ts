import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { rootUrl, apiRootUrl, ProcessItems } from './utils';

export const route: Route = {
    path: '/news',
    radar: [
        {
            source: ['hk01.com/channel', 'hk01.com/'],
        },
    ],
    name: 'Unknown',
    maintainers: [],
    handler,
};
async function handler(ctx) {
    const ids = [364, 19];  // Define the ids we want to fetch content for
    const currentUrl = (id) => `${rootUrl}/channel/${id}`;
    const apiUrl = (id) => `${apiRootUrl}/v2/feed/category/${id}`;
    
    // Create an array of promises for fetching data from both API URLs
    const responses = await Promise.all(ids.map(id => 
        got({
            method: 'get',
            url: apiUrl(id),
        })
    ));

    // Process the items for both responses
    const items = await Promise.all(responses.map((response, index) => 
        ProcessItems(response.data.items, ctx.req.query('limit'), cache.tryGet)
    ));

    // Merge all items from both ids
    const mergedItems = items.flat();  // Flatten the array of items

    // Generate title and image based on the response data
    const title = `${responses[0].data.category ? responses[0].data.category.publishName : `Channel: ${ids[0]}`} | 香港01`;
    const image = responses[0].data.category ? responses[0].data.category.icon : null;

    return {
        title: "新闻 | 香港01",
        link: currentUrl(ids[0]),  // Assuming the link is based on the first id
        item: mergedItems,
        image: image,
    };
}
