// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import sharp from 'sharp';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, 'public');
const dimensionCache = new Map();
const webpCache = new Map();

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

function webPathForPublicFile(filePath) {
  const relativePath = path.relative(publicDir, filePath).split(path.sep).join('/');
  return `/${relativePath}`;
}

// 正文列宽 760px：1x(768) 覆盖移动端，2x(1536) 覆盖高密度桌面；超宽原图据此降采样
const VARIANT_WIDTHS = [768, 1536];
const WEBP_QUALITY = 82;

/**
 * 为一张公共图片生成多宽度 webp 变体（不超过原图宽、去重升序）。
 * 返回 [{ width, src }]（升序）；若无可用变体则 undefined（退回原始 <img>）。
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
  return async (tree) => {
    let imageIndex = 0;
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

          if (!parent || typeof index !== 'number') return;

          const variants = await ensureWebpVariants(filePath, dimensions?.width);
          if (!variants) return;

          const srcset = variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ');

          parent.children[index] = {
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

// https://astro.build/config
export default defineConfig({
  site: 'https://678234.xyz',
  // 目录式输出 + 末尾斜杠：复刻 Jekyll /:y/:m/:d/:slug/ 的 index.html 产物
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [sitemap()],
  markdown: {
    rehypePlugins: [rehypeImagePerformance],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
