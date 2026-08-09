import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
// Node ≥22.18 默认支持 type stripping，可直接 import .ts（站点信息单一来源）
import { SITE } from '../src/config.ts';
import { excerptFromMarkdown, truncateDescription } from '../src/lib/markdown-summary.ts';
import { readPostsFromDisk } from './lib/read-posts.mjs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(rootDir, 'public');
const postsDir = path.join(rootDir, 'src/content/posts');
const ogPostsDir = path.join(publicDir, 'og/posts');

/** 卡片上展示的域名（去协议） */
const displayUrl = new URL(SITE.url).host;

const CARD = {
  left: 74,
  right: 1126,
  width: 1052,
};

// OG 卡片固定使用白色主题；橙色沿用站点品牌色。
const COLORS = {
  accent: '#c2410c',
  white: '#ffffff',
  ink: '#1f1d1b',
  body: '#34312e',
  muted: '#77716b',
  line: '#ebe7e3',
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanSvg(svg) {
  return svg.replace(/[ \t]+$/gm, '').trimStart();
}

function isWideChar(char) {
  return /[\u1100-\u11ff\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/u.test(char);
}

function charUnits(char) {
  if (/\s/u.test(char)) return 0.36;
  if (/[A-Z0-9]/u.test(char)) return 0.7;
  if (/[a-z]/u.test(char)) return 0.58;
  if (/[-_.,:;()[\]/]/u.test(char)) return 0.34;
  return isWideChar(char) ? 1 : 0.72;
}

function normalizeText(text) {
  return String(text ?? '').replace(/\s+/gu, ' ').trim();
}

function measureText(text) {
  return [...text].reduce((sum, char) => sum + charUnits(char), 0);
}

export function wrapText(text, maxUnits, maxLines, { ellipsis = true } = {}) {
  const source = normalizeText(text);
  const lines = [];
  let line = '';
  let units = 0;
  let lastBreak = -1;
  let truncated = false;

  for (const char of source) {
    const nextUnits = units + charUnits(char);
    if (/\s/u.test(char)) lastBreak = line.length;

    if (nextUnits > maxUnits && line) {
      if (lastBreak > 0) {
        const head = line.slice(0, lastBreak).trim();
        const tail = line.slice(lastBreak).trimStart();
        lines.push(head);
        line = tail + char;
        units = [...line].reduce((sum, c) => sum + charUnits(c), 0);
      } else {
        lines.push(line.trim());
        line = char.trimStart();
        units = charUnits(char);
      }
      lastBreak = -1;

      if (lines.length === maxLines) {
        truncated = true;
        line = '';
        break;
      }
      continue;
    }

    line += char;
    units = nextUnits;
  }

  if (line && lines.length < maxLines) lines.push(line.trim());

  if (!truncated && lines.length === maxLines) {
    const consumed = lines.join('').replace(/\s/g, '').length;
    const total = source.replace(/\s/g, '').length;
    truncated = consumed < total;
  }

  if (truncated && ellipsis && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[，。,.!！?？、；;:\s]+$/u, '')}…`;
  }

  return { lines: lines.filter(Boolean), truncated };
}

export function titleLayout(title) {
  const source = normalizeText(title);
  if (measureText(source) <= 16.2) {
    return { lines: [source], fontSize: 64, lineHeight: 76, truncated: false };
  }

  const chars = [...source];
  let best;
  for (let index = 1; index < chars.length; index += 1) {
    const left = chars.slice(0, index).join('').trim();
    const right = chars.slice(index).join('').trim();
    if (!left || !right) continue;

    const leftUnits = measureText(left);
    const rightUnits = measureText(right);
    if (leftUnits > 18.2 || rightUnits > 18.2) continue;

    const previous = chars[index - 1];
    const next = chars[index];
    let score = Math.abs(leftUnits - rightUnits);
    if (/[A-Za-z0-9]/u.test(previous) && /[A-Za-z0-9]/u.test(next)) score += 100;
    if (/[，。,.!！?？、；;:：)\]】》」』]/u.test(next)) score += 40;
    if (/[(\[【《「『]/u.test(previous)) score += 40;
    if (/\s/u.test(previous) || /\s/u.test(next)) score -= 0.4;

    if (!best || score < best.score) best = { lines: [left, right], score };
  }

  if (best) {
    return { lines: best.lines, fontSize: 56, lineHeight: 68, truncated: false };
  }

  const wrapped = wrapText(source, 18.2, 2);
  return { ...wrapped, fontSize: 54, lineHeight: 66 };
}

// 单曲线引号标记（呼应 iolaSay / 言）。在 512 基准坐标系绘制，按 size 等比缩放。
function quoteMarkPath(cx, cy, r, fill = '#fff7ed') {
  return `<path d="M${cx - r} ${cy}a${r} ${r} 0 1 1 ${2 * r} 0c0 ${r * 1.25} ${-r * 0.45} ${r * 2} ${-r * 1.75} ${r * 2.55}c${r * 0.35} ${-r * 0.95} ${r * 0.3} ${-r * 1.5} ${-r * 0.25} ${-r * 1.95}z" fill="${fill}"/>`;
}

function brandMarkSvg({ size = 72 } = {}) {
  const k = size / 512;
  return `
    <g>
      <rect width="${size}" height="${size}" rx="${size * 0.226}" fill="${COLORS.accent}"/>
      ${quoteMarkPath(256 * k, 196 * k, 86 * k)}
    </g>`;
}

function brandHeaderSvg() {
  return `<g transform="translate(${CARD.left} 54)">${brandMarkSvg({ size: 48 })}</g>
  <text x="138" y="91" fill="${COLORS.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-weight="700" letter-spacing="0">${escapeHtml(SITE.title)}</text>`;
}

export function defaultSocialSvg() {
  const [headline, ...descriptionParts] = SITE.description.split('·').map((part) => part.trim());
  const description = [...descriptionParts, SITE.author].filter(Boolean).join(' · ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">iolaSay social card</title>
  <desc id="desc">Default social sharing image for iolaSay.</desc>
  <rect width="1200" height="630" fill="${COLORS.white}"/>
  ${brandHeaderSvg()}
  <text x="${CARD.left}" y="310" fill="${COLORS.ink}" font-family="'Noto Serif CJK SC', 'Songti SC', 'STSong', Georgia, serif" font-size="96" font-weight="700" letter-spacing="0">${escapeHtml(headline)}</text>
  <text x="78" y="382" fill="${COLORS.body}" font-family="'Noto Sans CJK SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="38" letter-spacing="0">${escapeHtml(description)}</text>
  <path d="M${CARD.left} 548H${CARD.right}" stroke="${COLORS.line}" stroke-width="2"/>
  <text x="${CARD.left}" y="590" fill="${COLORS.muted}" font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace" font-size="22" letter-spacing="0">${displayUrl}</text>
  <text x="${CARD.right}" y="590" text-anchor="end" fill="${COLORS.muted}" font-family="'Noto Sans CJK SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="22" letter-spacing="0">${escapeHtml(SITE.author)}</text>
</svg>`;
}

export function postCardSummary(post) {
  const explicitDescription = normalizeText(post.description);
  if (explicitDescription) return truncateDescription(explicitDescription);
  return excerptFromMarkdown(post.body) ?? SITE.description;
}

export function postCardSvg(post) {
  const title = titleLayout(post.title);
  const titleFirstY = title.lines.length === 1 ? 220 : 190;
  const titleLastY = titleFirstY + (title.lines.length - 1) * title.lineHeight;
  const summaryFirstY = titleLastY + (title.lines.length === 1 ? 98 : 88);
  const summaryLineHeight = 51;
  const summaryMaxLines = title.lines.length === 1 ? 5 : 4;
  const summary = wrapText(postCardSummary(post), 28.5, summaryMaxLines, { ellipsis: false });
  const summaryTop = summaryFirstY - 36;
  const summaryBottom = Math.min(536, summaryFirstY + (summary.lines.length - 1) * summaryLineHeight + 28);
  const fadeStart = summaryFirstY + Math.max(1, summary.lines.length - 2) * summaryLineHeight - 14;
  const fadeOffset = Math.max(0, Math.min(100, ((fadeStart - summaryTop) / (summaryBottom - summaryTop)) * 100));
  const tags = (post.tags ?? []).slice(0, 3).map((tag) => `#${tag}`);
  const metaTail = tags.length > 0 ? ` · ${tags.join(' · ')}` : '';
  const metaText = wrapText(`${post.category}${metaTail}`, 38, 1).lines[0] ?? post.category;
  const date = new Date(post.date).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(post.title)}</title>
  <desc id="desc">${escapeHtml(SITE.title)} article card.</desc>
  <rect width="1200" height="630" fill="${COLORS.white}"/>
  ${summary.truncated ? `<defs>
    <linearGradient id="summaryFade" gradientUnits="userSpaceOnUse" x1="0" y1="${summaryTop}" x2="0" y2="${summaryBottom}">
      <stop offset="0%" stop-color="#fff"/>
      <stop offset="${fadeOffset.toFixed(1)}%" stop-color="#fff"/>
      <stop offset="${(fadeOffset + (100 - fadeOffset) * 0.44).toFixed(1)}%" stop-color="#d4d4d4"/>
      <stop offset="${(fadeOffset + (100 - fadeOffset) * 0.76).toFixed(1)}%" stop-color="#707070"/>
      <stop offset="100%" stop-color="#000"/>
    </linearGradient>
    <mask id="summaryMask" maskUnits="userSpaceOnUse" x="${CARD.left}" y="${summaryTop}" width="${CARD.width}" height="${summaryBottom - summaryTop}">
      <rect x="${CARD.left}" y="${summaryTop}" width="${CARD.width}" height="${summaryBottom - summaryTop}" fill="url(#summaryFade)"/>
    </mask>
  </defs>` : ''}
  ${brandHeaderSvg()}
  ${title.lines.map((line, index) => `<text x="${CARD.left}" y="${titleFirstY + index * title.lineHeight}" fill="${COLORS.ink}" font-family="'Noto Sans CJK SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="${title.fontSize}" font-weight="700" letter-spacing="0">${escapeHtml(line)}</text>`).join('\n  ')}
  <g${summary.truncated ? ' mask="url(#summaryMask)"' : ''}>
    ${summary.lines.map((line, index) => `<text x="${CARD.left}" y="${summaryFirstY + index * summaryLineHeight}" fill="${COLORS.body}" font-family="'Noto Sans CJK SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="35" font-weight="400" letter-spacing="0">${escapeHtml(line)}</text>`).join('\n    ')}
  </g>
  <path d="M${CARD.left} 548H${CARD.right}" stroke="${COLORS.line}" stroke-width="2"/>
  <text x="${CARD.left}" y="590" fill="${COLORS.muted}" font-family="'Noto Sans CJK SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="22" letter-spacing="0">${escapeHtml(metaText)}</text>
  <text x="${CARD.right}" y="590" text-anchor="end" fill="${COLORS.muted}" font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace" font-size="22" letter-spacing="0">${escapeHtml(date)}</text>
</svg>`;
}

function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="${SITE.title}">
  <defs><linearGradient id="iolaBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e0591b"/><stop offset="1" stop-color="${COLORS.accent}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="116" fill="url(#iolaBg)"/>
  ${quoteMarkPath(256, 196, 86)}
</svg>`;
}

async function renderPng(svg, outputPath, options = {}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg))
    .resize(options.width, options.height, { fit: 'cover' })
    .png()
    .toFile(outputPath);
}

async function writeIco(outputPath, pngBuffers) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngBuffers.length, 4);

  const entries = [];
  let offset = 6 + pngBuffers.length * 16;
  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += buffer.length;
  }

  await fs.writeFile(outputPath, Buffer.concat([header, ...entries, ...pngBuffers.map(({ buffer }) => buffer)]));
}

async function readPosts() {
  return (await readPostsFromDisk(postsDir)).filter((post) => !post.draft);
}

function encodedPostPath(id) {
  return id.split('/').map(encodeURIComponent).join('/');
}

async function generateBrandAssets() {
  const mark = cleanSvg(faviconSvg());
  await fs.writeFile(path.join(publicDir, 'favicon.svg'), mark);
  await renderPng(mark, path.join(publicDir, 'favicon-16x16.png'), { width: 16, height: 16 });
  await renderPng(mark, path.join(publicDir, 'favicon-32x32.png'), { width: 32, height: 32 });
  await renderPng(mark, path.join(publicDir, 'apple-touch-icon.png'), { width: 180, height: 180 });
  await renderPng(mark, path.join(publicDir, 'icon-192.png'), { width: 192, height: 192 });
  await renderPng(mark, path.join(publicDir, 'icon-512.png'), { width: 512, height: 512 });

  const icoFrames = await Promise.all([16, 32].map(async (size) => ({
    size,
    buffer: await sharp(Buffer.from(mark)).resize(size, size).png().toBuffer(),
  })));
  await writeIco(path.join(publicDir, 'favicon.ico'), icoFrames);

  const social = cleanSvg(defaultSocialSvg());
  await fs.writeFile(path.join(publicDir, 'social-card.svg'), social);
  await renderPng(social, path.join(publicDir, 'social-card.png'), { width: 1200, height: 630 });
}

async function generatePostCards() {
  await fs.rm(ogPostsDir, { recursive: true, force: true });
  await fs.mkdir(ogPostsDir, { recursive: true });

  const posts = await readPosts();
  for (const post of posts) {
    const svg = cleanSvg(postCardSvg(post));
    const outputPath = path.join(ogPostsDir, `${encodedPostPath(post.id)}.png`);
    await renderPng(svg, outputPath, { width: 1200, height: 630 });
  }

  return posts.length;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const postCount = await generatePostCards();
  await generateBrandAssets();
  console.log(`Generated ${postCount} post OG cards and brand assets.`);
}
