import type { CollectionEntry } from 'astro:content';
import { SITE } from '../config';
import { postPermalink } from './posts';
import { excerptFromMarkdown, truncateDescription } from './markdown-summary';

export { excerptFromMarkdown, stripMarkdown, truncateDescription } from './markdown-summary';

export type JsonLd = Record<string, unknown>;

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, SITE.url).href;
}

/** RSS 阅读器普遍不解析根相对路径（RSS 2.0 无标准 base URL 机制）：
 *  把 feed 全文 HTML 里的 src/href/srcset 绝对化到站点域名。
 *  只处理 `/...` 根相对地址；绝对地址、`//` 协议相对、`#` 锚点原样保留。 */
export function absolutizeHtml(html: string, base = SITE.url): string {
  return html
    .replace(
      /(\s(?:src|href)=")(\/(?!\/)[^"]*)(")/g,
      (_, prefix: string, url: string, suffix: string) =>
        `${prefix}${new URL(url, base).href}${suffix}`,
    )
    .replace(/(\ssrcset=")([^"]*)(")/g, (_, prefix: string, value: string, suffix: string) => {
      const rewritten = value
        .split(',')
        .map((candidate) => {
          const [url, ...descriptors] = candidate.trim().split(/\s+/);
          const absolute = url.startsWith('/') && !url.startsWith('//')
            ? new URL(url, base).href
            : url;
          return [absolute, ...descriptors].join(' ');
        })
        .join(', ');
      return `${prefix}${rewritten}${suffix}`;
    });
}

export function postSeoTitle(post: CollectionEntry<'posts'>): string {
  return post.data.seoTitle ?? post.data.title;
}

export function postDescription(post: CollectionEntry<'posts'>): string {
  return post.data.description
    ? truncateDescription(post.data.description)
    : excerptFromMarkdown(post.body) ?? SITE.description;
}

/** 提取正文 Markdown 图片（跳过围栏代码块），转为去重后的绝对 URL 供结构化数据使用 */
export function extractMarkdownImages(markdown = ''): string[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');
  const urls: string[] = [];
  const pattern = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of withoutCode.matchAll(pattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    if ((raw.startsWith('/') && !raw.startsWith('//')) || /^https?:\/\//i.test(raw)) {
      urls.push(absoluteUrl(raw));
    }
  }
  return [...new Set(urls)];
}

export function postOgImagePath(post: CollectionEntry<'posts'>): string {
  const encodedId = post.id.split('/').map(encodeURIComponent).join('/');
  return `/og/posts/${encodedId}.png`;
}

export function versionedImagePath(pathOrUrl: string): string {
  const separator = pathOrUrl.includes('?') ? '&' : '?';
  return `${pathOrUrl}${separator}v=${SITE.ogImageVersion}`;
}

export function postImage(post: CollectionEntry<'posts'>): string {
  return versionedImagePath(post.data.ogImage ?? post.data.image ?? postOgImagePath(post));
}

export function postKeywords(post: CollectionEntry<'posts'>): string[] {
  return [...new Set([post.data.category, ...post.data.tags].filter(Boolean))];
}

const AUTHOR_ID = `${SITE.url}/#author`;

export function personJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': AUTHOR_ID,
    name: SITE.author,
    url: SITE.url,
    sameAs: [SITE.github],
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.title,
    alternateName: SITE.tagline,
    description: SITE.description,
    url: SITE.url,
    inLanguage: SITE.locale,
    publisher: {
      '@type': 'Person',
      '@id': AUTHOR_ID,
      name: SITE.author,
      url: SITE.url,
    },
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };
}

export function postJsonLd(post: CollectionEntry<'posts'>): JsonLd {
  const permalink = postPermalink(post);
  const description = postDescription(post);
  const images = [...new Set([absoluteUrl(postImage(post)), ...extractMarkdownImages(post.body)])];
  const keywords = postKeywords(post);
  const dateModified = post.data.updatedDate ?? post.data.date;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(permalink),
    },
    headline: post.data.title,
    description,
    image: images,
    url: absoluteUrl(permalink),
    datePublished: post.data.date.toISOString(),
    dateModified: dateModified.toISOString(),
    author: {
      '@type': 'Person',
      '@id': AUTHOR_ID,
      name: SITE.author,
      url: SITE.url,
      sameAs: [SITE.github],
    },
    publisher: {
      '@type': 'Person',
      '@id': AUTHOR_ID,
      name: SITE.author,
      url: SITE.url,
    },
    articleSection: post.data.category,
    keywords,
    inLanguage: SITE.locale,
  };
}

export function collectionPageJsonLd(params: {
  name: string;
  description: string;
  url: string;
  items: CollectionEntry<'posts'>[];
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: params.name,
    description: params.description,
    url: absoluteUrl(params.url),
    inLanguage: SITE.locale,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: params.items.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(postPermalink(post)),
        name: post.data.title,
      })),
    },
  };
}

export function safeJsonLd(jsonLd: JsonLd): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}
