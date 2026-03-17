import got from '@/utils/got';
import * as cheerio from 'cheerio';

const BASE = 'https://cacs.mofcom.gov.cn';

export async function fetchList(path: string) {
  const url = `${BASE}${path}`;
  const { data } = await got(url);
  const $ = cheerio.load(data);
  
  // 列表结构：tbody.delNotice > tr > td(链接) + td(日期)
  const items: Array<{ title: string; link: string; pubDate: string }> = [];
  
  $('tbody.delNotice tr').each((_, row) => {
    const a = $(row).find('td').eq(0).find('a');
    const date = $(row).find('td').eq(1).text().trim();
    const href = a.attr('href');
    if (!href) return;
    
    items.push({
      title: a.text().trim(),
      link: href.startsWith('http') ? href : `${BASE}${href}`,
      pubDate: date,
    });
  });
  
  return items;
}

export async function fetchArticle(url: string) {
  const { data } = await got(url);
  const $ = cheerio.load(data);
  
  // 正文：div.txtboxCon.article 内所有 <p>
  const content = $('div.txtboxCon.article').html() ?? '';
  
  return content;
}
