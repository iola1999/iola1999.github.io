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

/** 复刻 Jekyll 永久链接 /:year/:month/:day/:slug/（slug = 文件名，保留大小写）。
 *  纯函数版本供 astro.config（sitemap lastmod）等无 CollectionEntry 的场景复用 */
export function permalinkFor(id: string, date: Date): string {
  const { y, m, d } = cstParts(date);
  return `/${y}/${m}/${d}/${id}/`;
}

export function postPermalink(post: CollectionEntry<'posts'>): string {
  return permalinkFor(post.id, post.data.date);
}

export function formatDate(date: Date): string {
  const { y, m, d } = cstParts(date);
  return `${y}-${m}-${d}`;
}

/** 月-日（首页列表用，年份已由分组标题展示） */
export function formatMonthDay(date: Date): string {
  const { m, d } = cstParts(date);
  return `${m}-${d}`;
}

/** 按发布时间倒序 */
export function byDateDesc(a: CollectionEntry<'posts'>, b: CollectionEntry<'posts'>) {
  return b.data.date.getTime() - a.data.date.getTime();
}

export type Post = CollectionEntry<'posts'>;

function pushInto<K>(map: Map<K, Post[]>, key: K, post: Post): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(post);
  else map.set(key, [post]);
}

/** 按东八区年份分组，年倒序；组内保持入参顺序 */
export function groupByYear(posts: Post[]): Array<[number, Post[]]> {
  const groups = new Map<number, Post[]>();
  for (const post of posts) pushInto(groups, cstParts(post.data.date).y, post);
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

/** 按分类分组；保持入参顺序 */
export function groupByCategory(posts: Post[]): Map<string, Post[]> {
  const groups = new Map<string, Post[]>();
  for (const post of posts) pushInto(groups, post.data.category, post);
  return groups;
}

/** 按标签分组；一篇多标签会重复计入各自分组 */
export function groupByTag(posts: Post[]): Map<string, Post[]> {
  const groups = new Map<string, Post[]>();
  for (const post of posts) for (const tag of post.data.tags) pushInto(groups, tag, post);
  return groups;
}

/** Map<key, 文章数>，按数量倒序（分类/标签云用） */
export function countsBySize(groups: Map<string, Post[]>): Array<[string, number]> {
  return [...groups.entries()].map(([key, items]) => [key, items.length] as [string, number])
    .sort((a, b) => b[1] - a[1]);
}
