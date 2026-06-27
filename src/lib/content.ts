import { getCollection } from 'astro:content';
import { byDateDesc, type Post } from './posts';

/**
 * 已发布文章，按发布时间倒序。
 * 草稿（draft: true）仅在生产构建中隐藏；`astro dev` 下可预览，与 README 承诺一致。
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', (post) =>
    import.meta.env.PROD ? !post.data.draft : true,
  );
  return posts.sort(byDateDesc);
}
