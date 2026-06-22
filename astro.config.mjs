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

function readImageDimensions(filePath) {
  if (dimensionCache.has(filePath)) return dimensionCache.get(filePath);

  let dimensions;
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
      dimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    } else if (ext === '.gif' && buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
      dimensions = { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    } else if ((ext === '.jpg' || ext === '.jpeg') && buffer.readUInt16BE(0) === 0xffd8) {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        const isSof = (
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf)
        );
        if (isSof) {
          dimensions = { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
          break;
        }
        offset += 2 + length;
      }
    }
  } catch {
    dimensions = undefined;
  }

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

async function ensureWebpVariant(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') return undefined;
  if (webpCache.has(filePath)) return webpCache.get(filePath);

  const promise = (async () => {
    const sourceStat = await fs.promises.stat(filePath);
    const relativePath = path.relative(publicDir, filePath);
    const outputPath = path.join(
      publicDir,
      'optimized',
      relativePath.replace(/\.(png|jpe?g)$/i, '.webp'),
    );

    const existingStat = await fs.promises.stat(outputPath).catch(() => undefined);
    if (existingStat && existingStat.mtimeMs >= sourceStat.mtimeMs) {
      return existingStat.size < sourceStat.size * 0.95 ? webPathForPublicFile(outputPath) : undefined;
    }

    const webp = await sharp(filePath).webp({ quality: 88, effort: 6 }).toBuffer();
    if (webp.length >= sourceStat.size * 0.95) return undefined;

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, webp);
    return webPathForPublicFile(outputPath);
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
    const webpTasks = [];

    visitImages(tree, (node, parent, index) => {
      const properties = node.properties ??= {};
      const src = typeof properties.src === 'string' ? properties.src : '';

      properties.decoding ??= 'async';
      if (imageIndex > 0) {
        properties.loading ??= 'lazy';
        properties.fetchpriority ??= 'low';
      }

      const filePath = publicImagePath(src);
      const dimensions = filePath ? readImageDimensions(filePath) : undefined;
      if (dimensions) {
        properties.width ??= dimensions.width;
        properties.height ??= dimensions.height;
      }

      if (filePath && parent && typeof index === 'number') {
        webpTasks.push((async () => {
          const webpSrc = await ensureWebpVariant(filePath);
          if (!webpSrc) return;

          parent.children[index] = {
            type: 'element',
            tagName: 'picture',
            properties: {},
            children: [
              {
                type: 'element',
                tagName: 'source',
                properties: { type: 'image/webp', srcset: webpSrc },
                children: [],
              },
              node,
            ],
          };
        })());
      }

      imageIndex += 1;
    });

    await Promise.all(webpTasks);
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
