import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

/**
 * 从磁盘直读文章 frontmatter。给构建前置脚本（generate-brand-assets）和
 * astro.config（sitemap lastmod）用——这两处运行时 astro:content 还不可用。
 * 字段口径与 src/content.config.ts 的 schema 对齐。
 * @param {string} postsDir
 * @returns {Promise<Array<{
 *   id: string,
 *   title: string,
 *   date: Date,
 *   updatedDate: Date | undefined,
 *   category: string,
 *   tags: string[],
 *   draft: boolean,
 * }>>}
 */
export async function readPostsFromDisk(postsDir) {
  const posts = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(filePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const raw = await fs.readFile(filePath, 'utf8');
      const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
      const data = match ? parse(match[1]) : {};

      posts.push({
        id: path
          .relative(postsDir, filePath)
          .replace(/\.md$/, '')
          .split(path.sep)
          .join('/'),
        title: data.title,
        date: new Date(data.date),
        updatedDate: data.updatedDate ? new Date(data.updatedDate) : undefined,
        category: data.category ?? '未分类',
        tags: data.tags ?? [],
        draft: data.draft ?? false,
      });
    }
  }

  await walk(postsDir);
  return posts;
}
