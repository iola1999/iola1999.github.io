import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import sharp from 'sharp';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(rootDir, 'public');
const postsDir = path.join(rootDir, 'src/content/posts');
const ogPostsDir = path.join(publicDir, 'og/posts');

const SITE = {
  title: 'iolaSay',
  author: 'iola1999',
  url: '678234.xyz',
};

const COLORS = {
  accent: '#c2410c',
  paper: '#fcfcfb',
  surface: '#fffefd',
  ink: '#1f1d1b',
  muted: '#6b6660',
  border: '#eadfd1',
  teal: '#0f766e',
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

function wrapText(text, maxUnits, maxLines) {
  const lines = [];
  let line = '';
  let units = 0;
  let lastBreak = -1;

  for (const char of text) {
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

      if (lines.length === maxLines) break;
      continue;
    }

    line += char;
    units = nextUnits;
  }

  if (line && lines.length < maxLines) lines.push(line.trim());

  if (lines.length === maxLines) {
    const consumed = lines.join('').replace(/\s/g, '').length;
    const total = text.replace(/\s/g, '').length;
    if (consumed < total) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[，。,.!！?？、；;:\s]+$/u, '')}…`;
    }
  }

  return lines.filter(Boolean);
}

function brandMarkSvg({ size = 72, radius = 18 } = {}) {
  const scale = size / 72;
  return `
    <g>
      <rect width="${size}" height="${size}" rx="${radius}" fill="${COLORS.accent}"/>
      <path d="M${18 * scale} ${17 * scale}C${30 * scale} ${9 * scale} ${46 * scale} ${9 * scale} ${58 * scale} ${17 * scale}" fill="none" stroke="#fff7ed" stroke-width="${4.5 * scale}" stroke-linecap="round" opacity=".52"/>
      <circle cx="${36 * scale}" cy="${24 * scale}" r="${8 * scale}" fill="#fff7ed"/>
      <path d="M${36 * scale} ${38 * scale}V${54 * scale}" fill="none" stroke="#fff7ed" stroke-width="${8 * scale}" stroke-linecap="round"/>
      <path d="M${23 * scale} ${57 * scale}L${55 * scale} ${25 * scale}" fill="none" stroke="#ffd7c2" stroke-width="${4.5 * scale}" stroke-linecap="round" opacity=".72"/>
    </g>`;
}

function baseBackgroundSvg() {
  return `
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#fff7ed"/>
        <stop offset="48%" stop-color="${COLORS.paper}"/>
        <stop offset="100%" stop-color="#e7f0ff"/>
      </linearGradient>
      <radialGradient id="orb" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fb923c" stop-opacity=".55"/>
        <stop offset="100%" stop-color="#fb923c" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#7c2d12" flood-opacity=".14"/>
      </filter>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="1046" cy="112" r="252" fill="url(#orb)"/>
    <circle cx="128" cy="558" r="220" fill="${COLORS.teal}" opacity=".08"/>
    <path d="M86 104h1028v422H86z" fill="${COLORS.surface}" opacity=".80" filter="url(#shadow)"/>
    <path d="M86 104h1028v422H86z" fill="none" stroke="${COLORS.border}" stroke-width="2"/>`;
}

function defaultSocialSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">iolaSay social card</title>
  <desc id="desc">Default social sharing image for iolaSay.</desc>
  ${baseBackgroundSvg()}
  <g transform="translate(144 164)">${brandMarkSvg({ size: 74, radius: 16 })}</g>
  <text x="144" y="330" fill="${COLORS.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="96" font-weight="700" letter-spacing="-3">${SITE.title}</text>
  <text x="149" y="390" fill="${COLORS.muted}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="32" letter-spacing=".2">Personal blog by ${SITE.author}</text>
  <text x="149" y="458" fill="${COLORS.accent}" font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace" font-size="30">${SITE.url}</text>
</svg>`;
}

function postCardSvg(post) {
  const titleLines = wrapText(post.title, 14.4, 3);
  const fontSize = titleLines.length >= 3 ? 54 : 62;
  const lineHeight = fontSize * 1.17;
  const titleY = titleLines.length >= 3 ? 216 : 238;
  const categoryY = titleY + titleLines.length * lineHeight + 42;
  const meta = [post.category, ...(post.tags ?? []).slice(0, 3)].filter(Boolean).join(' / ');
  const date = new Date(post.date).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(post.title)}</title>
  <desc id="desc">${escapeHtml(SITE.title)} article card.</desc>
  <rect width="1200" height="630" fill="${COLORS.paper}"/>
  <circle cx="1010" cy="92" r="260" fill="#fb923c" opacity=".10"/>
  <circle cx="315" cy="315" r="250" fill="${COLORS.teal}" opacity=".035"/>
  <path d="M0 629.5H1200" stroke="${COLORS.border}" stroke-width="1"/>
  <g transform="translate(82 54)">${brandMarkSvg({ size: 48, radius: 24 })}</g>
  <text x="146" y="88" fill="${COLORS.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="30" letter-spacing="-1">${SITE.title}</text>
  <text x="82" y="${titleY + titleLines.length * lineHeight + 102}" fill="${COLORS.muted}" font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace" font-size="24">${escapeHtml(date)} · ${SITE.url}</text>
  ${titleLines.map((line, index) => `<text x="82" y="${titleY + index * lineHeight}" fill="${COLORS.ink}" font-family="'Noto Sans CJK SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="-1.6">${escapeHtml(line)}</text>`).join('\n  ')}
  <text x="82" y="${categoryY}" fill="${COLORS.muted}" font-family="'Noto Sans CJK SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" font-size="32">${escapeHtml(meta)}</text>
</svg>`;
}

function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="${SITE.title}">
  <rect width="512" height="512" rx="118" fill="${COLORS.accent}"/>
  <path d="M128 126C213 70 299 70 384 126" fill="none" stroke="#fff7ed" stroke-width="34" stroke-linecap="round" opacity=".56"/>
  <circle cx="256" cy="178" r="50" fill="#fff7ed"/>
  <path d="M256 272V386" fill="none" stroke="#fff7ed" stroke-width="58" stroke-linecap="round"/>
  <path d="M164 400L384 180" fill="none" stroke="#ffd7c2" stroke-width="34" stroke-linecap="round" opacity=".72"/>
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
      const { data } = matter(raw);
      if (data.draft) continue;

      const id = path
        .relative(postsDir, filePath)
        .replace(/\.md$/, '')
        .split(path.sep)
        .join('/');

      posts.push({
        id,
        title: data.title,
        date: data.date,
        category: data.category ?? '未分类',
        tags: data.tags ?? [],
      });
    }
  }

  await walk(postsDir);
  return posts;
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

const postCount = await generatePostCards();
await generateBrandAssets();

console.log(`Generated ${postCount} post OG cards and brand assets.`);
