import type { CollectionEntry } from 'astro:content';

/** 东八区日历日组件，避免本地时区差异 */
function cstParts(date: Date) {
  const t = new Date(date.getTime() + 8 * 3600 * 1000);
  return {
    y: t.getUTCFullYear(),
    m: String(t.getUTCMonth() + 1).padStart(2, '0'),
    d: String(t.getUTCDate()).padStart(2, '0'),
  };
}

/** 复刻 Jekyll 永久链接 /:year/:month/:day/:slug/（slug = 文件名，保留大小写） */
export function postPermalink(post: CollectionEntry<'posts'>): string {
  const { y, m, d } = cstParts(post.data.date);
  return `/${y}/${m}/${d}/${post.id}/`;
}

export function formatDate(date: Date): string {
  const { y, m, d } = cstParts(date);
  return `${y}-${m}-${d}`;
}

/** 按发布时间倒序 */
export function byDateDesc(a: CollectionEntry<'posts'>, b: CollectionEntry<'posts'>) {
  return b.data.date.getTime() - a.data.date.getTime();
}
