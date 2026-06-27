import rss from '@astrojs/rss';
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { SITE } from '../config';
import { getPublishedPosts } from '../lib/content';
import { postPermalink } from '../lib/posts';

export async function GET(context) {
  const posts = (await getPublishedPosts()).slice(0, 10);
  const container = await AstroContainer.create();

  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      const content = await container.renderToString(Content);
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
