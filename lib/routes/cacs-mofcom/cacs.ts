import type { Route } from '@/types';
import { fetchList, fetchArticle } from './utils';

// 支持的类型映射
const TYPE_MAP: Record<string, { path: string; title: string }> = {
  import: {
    path: '/cacscms/jkdc/index.html',
    title: '进口调查公告',
  },
  export: {
    path: '/cacscms/ckydc/index.html',
    title: '出口应对公告',
  },
  wto: {
    path: '/cacscms/wtojf/index.html',
    title: 'WTO争端解决',
  },
};

export const route: Route = {
  path: '/cacs/:type?',
  categories: ['government'],
  example: '/mofcom/cacs/import',
  parameters: {
    type: '公告类型：`import`（进口调查，默认）、`export`（出口应对）、`wto`（WTO争端）',
  },
  name: '贸易救济公告',
  maintainers: ['your-github-username'],
  handler,
  url: 'cacs.mofcom.gov.cn',
  description: `
| 参数值  | 说明         |
| ------- | ------------ |
| import  | 进口调查公告 |
| export  | 出口应对公告 |
| wto     | WTO争端解决  |
  `,
};

async function handler(ctx) {
  const type = ctx.req.param('type') ?? 'import';
  const config = TYPE_MAP[type] ?? TYPE_MAP.import;

  const list = await fetchList(config.path);

  const items = await Promise.all(
    list.map((item) =>
      fetchArticle(item.link)
        .then((description) => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          description,
        }))
        .catch(() => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          description: '（正文抓取失败，请点击原链接查看）',
        }))
    )
  );

  return {
    title: `中国贸易救济信息网 - ${config.title}`,
    link: `https://cacs.mofcom.gov.cn`,
    description: `自动追踪商务部贸易救济相关${config.title}`,
    item: items,
  };
}
