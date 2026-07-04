import rss from '@astrojs/rss';
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { SITE } from '../config';
import { getPublishedPosts } from '../lib/content';
import { postPermalink } from '../lib/posts';
import { absolutizeHtml } from '../lib/seo';

export async function GET(context) {
  const posts = (await getPublishedPosts()).slice(0, 10);
  const container = await AstroContainer.create();

  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      // 阅读器里相对路径的图片/链接会挂：统一绝对化
      const content = absolutizeHtml(await container.renderToString(Content));
      return {
        title: post.data.title,
        pubDate: post.data.date,
        link: postPermalink(post),
        categories: [post.data.category, ...post.data.tags],
        content,
      };
    })
  );

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items,
    customData:
      `<follow_challenge><feedId>${SITE.follow.feedId}</feedId>` +
      `<userId>${SITE.follow.userId}</userId></follow_challenge>`,
  });
}
