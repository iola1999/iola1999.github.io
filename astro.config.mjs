// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
// Astro 7 默认换用原生 Markdown 管线；显式走 unified()，
// 保留下方自定义 rehype 插件与 remark 时代的 heading slug / shiki 行为
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import sharp from 'sharp';
import { SITE } from './src/config';
import { permalinkFor } from './src/lib/posts';
import { readPostsFromDisk } from './scripts/lib/read-posts.mjs';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, 'public');
/** @type {Map<string, Promise<{ width: number, height: number } | undefined>>} */
const dimensionCache = new Map();
/** @type {Map<string, Promise<Array<{ width: number, src: string }> | undefined>>} */
const webpCache = new Map();

/** @param {string} filePath */
async function readImageDimensions(filePath) {
  if (dimensionCache.has(filePath)) return dimensionCache.get(filePath);

  const dimensions = sharp(filePath)
    .metadata()
    .then(({ width, height }) => (
      width && height ? { width, height } : undefined
    ))
    .catch(() => undefined);

  dimensionCache.set(filePath, dimensions);
  return dimensions;
}

/** @param {string} src */
function publicImagePath(src) {
  if (!src.startsWith('/')) return undefined;

  try {
    const pathname = decodeURIComponent(new URL(src, 'https://local.invalid').pathname);
    const filePath = path.join(publicDir, pathname);
    return filePath.startsWith(publicDir + path.sep) ? filePath : undefined;
  } catch {
    return undefined;
  }
}

/** @param {string} filePath */
function webPathForPublicFile(filePath) {
  const relativePath = path.relative(publicDir, filePath).split(path.sep).join('/');
  return `/${relativePath}`;
}

// 正文列宽 760px：1x(768) 覆盖移动端，2x(1536) 覆盖高密度桌面；超宽原图据此降采样
const VARIANT_WIDTHS = [768, 1536];
const WEBP_QUALITY = 92;

/**
 * 为一张公共图片生成多宽度 webp 变体（不超过原图宽、去重升序）。
 * 返回 [{ width, src }]（升序）；若无可用变体则 undefined（退回原始 <img>）。
 * @param {string} filePath
 * @param {number | undefined} originalWidth
 */
async function ensureWebpVariants(filePath, originalWidth) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') return undefined;
  if (!originalWidth) return undefined; // 读不到尺寸的图同样无法可靠转码，退回原图
  if (webpCache.has(filePath)) return webpCache.get(filePath);

  const promise = (async () => {
    const sourceStat = await fs.promises.stat(filePath);
    const relativeNoExt = path.relative(publicDir, filePath).replace(/\.(png|jpe?g)$/i, '');
    const widths = [...new Set(VARIANT_WIDTHS.map((w) => Math.min(w, originalWidth)))]
      .sort((a, b) => a - b);

    const variants = [];
    for (const width of widths) {
      const isFullSize = width >= originalWidth;
      const outputPath = path.join(publicDir, 'optimized', `${relativeNoExt}-${width}w.webp`);

      const existingStat = await fs.promises.stat(outputPath).catch(() => undefined);
      if (existingStat && existingStat.mtimeMs >= sourceStat.mtimeMs) {
        // 复用缓存：同尺寸仍要求比原图明显更小才值得用
        if (!isFullSize || existingStat.size < sourceStat.size * 0.95) {
          variants.push({ width, src: webPathForPublicFile(outputPath) });
        }
        continue;
      }

      const pipeline = sharp(filePath);
      if (!isFullSize) pipeline.resize({ width });
      const webp = await pipeline.webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer();
      // 同尺寸且没比原图小：转码无收益，跳过
      if (isFullSize && webp.length >= sourceStat.size * 0.95) continue;

      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, webp);
      variants.push({ width, src: webPathForPublicFile(outputPath) });
    }

    return variants.length ? variants : undefined;
  })();

  webpCache.set(filePath, promise);
  return promise;
}

/**
 * @typedef {{
 *   type?: string,
 *   tagName?: string,
 *   properties?: Record<string, unknown>,
 *   children?: HastNode[],
 * }} HastNode
 */

/**
 * @param {HastNode} node
 * @param {(node: HastNode, parent: HastNode | undefined, index: number | undefined) => void} visitor
 * @param {HastNode} [parent]
 * @param {number} [index]
 */
function visitImages(node, visitor, parent, index) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'element' && node.tagName === 'img') {
    visitor(node, parent, index);
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child, childIndex) => visitImages(child, visitor, node, childIndex));
  }
}

function rehypeImagePerformance() {
  /** @param {HastNode} tree */
  return async (tree) => {
    let imageIndex = 0;
    /** @type {Promise<void>[]} */
    const imageTasks = [];

    visitImages(tree, (node, parent, index) => {
      const properties = node.properties ??= {};
      const src = typeof properties.src === 'string' ? properties.src : '';

      properties.decoding ??= 'async';
      if (imageIndex > 0) {
        properties.loading ??= 'lazy';
        properties.fetchpriority ??= 'low';
      }

      const filePath = publicImagePath(src);
      if (filePath) {
        imageTasks.push((async () => {
          const dimensions = await readImageDimensions(filePath);
          if (dimensions) {
            properties.width ??= dimensions.width;
            properties.height ??= dimensions.height;
          }

          const siblings = parent?.children;
          if (!siblings || typeof index !== 'number') return;

          const variants = await ensureWebpVariants(filePath, dimensions?.width);
          if (!variants) return;

          const srcset = variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ');

          siblings[index] = {
            type: 'element',
            tagName: 'picture',
            properties: {},
            children: [
              {
                type: 'element',
                tagName: 'source',
                properties: {
                  type: 'image/webp',
                  srcset,
                  // 正文最宽 760px；窄屏满宽
                  sizes: '(max-width: 800px) 100vw, 760px',
                },
                children: [],
              },
              node,
            ],
          };
        })());
      }

      imageIndex += 1;
    });

    await Promise.all(imageTasks);
  };
}

// sitemap lastmod：文章页取 updatedDate ?? date；其余页面（首页/分类/标签）不标
const publishedPosts = (await readPostsFromDisk(path.join(rootDir, 'src/content/posts')))
  .filter((post) => !post.draft);
const lastmodByUrl = new Map(publishedPosts.map((post) => [
  new URL(permalinkFor(post.id, post.date), SITE.url).href,
  (post.updatedDate ?? post.date).toISOString(),
]));

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  // 目录式输出 + 末尾斜杠：复刻 Jekyll /:y/:m/:d/:slug/ 的 index.html 产物
  trailingSlash: 'always',
  // Astro 7 默认按 JSX 规则压缩空白，会吞行内元素间的空格；恢复 HTML 语义压缩
  compressHTML: true,
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = lastmodByUrl.get(item.url);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],
  markdown: {
    processor: unified(),
    rehypePlugins: [rehypeImagePerformance],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
