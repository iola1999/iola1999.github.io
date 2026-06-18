// 一次性内容迁移：_posts/*.markdown → src/content/posts/*.md
// 可重跑。清理 Jekyll 残留、归一 frontmatter、修正图片路径。
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import matter from 'gray-matter';

const SRC = process.argv[2] ?? '_posts';
const FORCE_DRAFT = process.argv.includes('--draft');
const OUT = 'src/content/posts';
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith('.markdown') || f.endsWith('.md'));
let count = 0;

for (const file of files) {
  const raw = readFileSync(join(SRC, file), 'utf8');
  const { data, content } = matter(raw);

  // 文件名: YYYY-MM-DD-slug.markdown  → 保留大小写的 slug
  const m = basename(file).match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.(markdown|md)$/);
  if (!m) {
    console.warn('跳过(命名不符):', file);
    continue;
  }
  const [, , , , slug] = m;

  // tags 归一为数组
  let tags = data.tag ?? data.tags ?? [];
  if (typeof tags === 'string') tags = tags.trim() ? [tags.trim()] : [];
  if (!Array.isArray(tags)) tags = [];

  const fm = {
    title: data.title?.toString().trim() ?? slug,
    date: toISO(data.date),
    category: (data.category ?? data.categories ?? '未分类').toString().trim(),
    tags,
    ...(FORCE_DRAFT ? { draft: true } : {}),
  };

  let body = cleanBody(content);

  const out = matter.stringify('\n' + body.trimStart(), fm);
  writeFileSync(join(OUT, `${slug}.md`), out);
  count++;
}
console.log(`迁移完成: ${count}/${files.length} 篇 → ${OUT}`);

function toISO(d) {
  // 保留东八区偏移，避免 UTC 跨天导致 URL 年月日偏移
  if (d instanceof Date) {
    // gray-matter 已按本地解析为 Date；还原为 +08:00 字面量
    const t = new Date(d.getTime() + 8 * 3600 * 1000);
    return t.toISOString().replace(/\.\d{3}Z$/, '+08:00');
  }
  const s = String(d).trim().replace(/\s*\+0800$/, '+08:00');
  return /[+-]\d{2}:?\d{2}$/.test(s) ? s.replace(' ', 'T') : s.replace(' ', 'T') + '+08:00';
}

function cleanBody(s) {
  return s
    // 删除 Jekyll kramdown TOC 标记块
    .replace(/^\s*\*\s*content\s*\n\s*\{:toc\}\s*/m, '')
    // 剥离 {% raw %}/{% endraw %}/{% highlight x %}/{% endhighlight %}
    .replace(/\{%\s*end?(raw|highlight)[^%]*%\}/g, '')
    .replace(/\{%\s*highlight[^%]*%\}/g, '')
    // 老文图片: {{ '/styles/images/..' | prepend: site.baseurl }} → /styles/images/..
    .replace(/\{\{\s*'([^']+)'\s*\|\s*prepend:\s*site\.baseurl\s*\}\}/g, '$1')
    .trim();
}
