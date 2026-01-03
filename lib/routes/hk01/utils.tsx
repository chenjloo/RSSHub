import { renderToString } from 'hono/jsx/dom/server';

import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import { load } from 'cheerio';

const rootUrl = 'https://hk01.com';
const apiRootUrl = 'https://web-data.api.hk01.com';

const renderDescription = ({ image, teasers, blocks }) =>
    renderToString(
        <>
            {image ? <img src={image} /> : null}
            {teasers?.length ? (
                <backquote>
                    {teasers.map((teaser) => (
                        <p>{teaser}</p>
                    ))}
                </backquote>
            ) : null}
            {blocks?.length
                ? blocks.map((block) => {
                      if (block.blockType === 'summary') {
                          return (
                              <backquote>
                                  {block.summary?.map((summary) => (
                                      <p>{summary}</p>
                                  ))}
                              </backquote>
                          );
                      }

                      if (block.blockType === 'text') {
                          return block.htmlTokens?.map((tokens) =>
                              tokens.map((token) => {
                                  if (token.type === 'text') {
                                      return <p>{token.content}</p>;
                                  }

                                  if (token.type === 'link') {
                                      return <a href={token.link}>{token.content}</a>;
                                  }

                                  if (token.type === 'boldText') {
                                      return <b>{token.content}</b>;
                                  }

                                  if (token.type === 'boldLink') {
                                      return (
                                          <a href={token.link}>
                                              <b>{token.content}</b>
                                          </a>
                                      );
                                  }

                                  return null;
                              })
                          );
                      }

                      if (block.blockType === 'quote') {
                          return (
                              <q>
                                  {block.message} —— {block.author}
                              </q>
                          );
                      }

                      if (block.blockType === 'image') {
                          const { image: blockImage } = block;

                          return blockImage ? (
                              <figure>
                                  <figurecaption>{blockImage.caption}</figurecaption>
                                  <img src={blockImage.cdnUrl} alt={blockImage.caption} height={blockImage.originalHeight} width={blockImage.originalWidth} />
                              </figure>
                          ) : null;
                      }

                      if (block.blockType === 'gallery') {
                          return block.images?.map((blockImage) => (
                              <figure>
                                  <figurecaption>{blockImage.caption}</figurecaption>
                                  <img src={blockImage.cdnUrl} alt={blockImage.caption} height={blockImage.originalHeight} width={blockImage.originalWidth} />
                              </figure>
                          ));
                      }

                      return null;
                  })
                : null}
        </>
    );

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
