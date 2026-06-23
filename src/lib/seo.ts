import type { CollectionEntry } from 'astro:content';
import { SITE } from '../config';
import { postPermalink } from './posts';

export type JsonLd = Record<string, unknown>;

export interface BreadcrumbItem {
  name: string;
  href: string;
}

const DESCRIPTION_MAX_LENGTH = 160;
const SKIP_EXCERPT_PATTERNS = [
  /声明/,
  /本文.*AI/,
  /本文仅记录/,
  /请勿/,
];

export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, SITE.url).href;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function truncateDescription(value: string, maxLength = DESCRIPTION_MAX_LENGTH): string {
  const text = compactWhitespace(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/[，。,.!！?？、；;:\s]+$/u, '')}…`;
}

export function stripMarkdown(markdown: string): string {
  return compactWhitespace(markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~#]/g, ' '));
}

export function excerptFromMarkdown(markdown = ''): string | undefined {
  const candidates = markdown
    .replace(/```[\s\S]*?```/g, '\n\n')
    .split(/\n{2,}/)
    .filter((block) => !/^#{1,6}\s+/u.test(block.trim()))
    .map(stripMarkdown)
    .filter(Boolean)
    .filter((paragraph) => !SKIP_EXCERPT_PATTERNS.some((pattern) => pattern.test(paragraph)));

  const excerpt = candidates.find((paragraph) => paragraph.length >= 24) ?? candidates[0];
  return excerpt ? truncateDescription(excerpt) : undefined;
}

export function postDescription(post: CollectionEntry<'posts'>): string {
  return post.data.description
    ? truncateDescription(post.data.description)
    : excerptFromMarkdown(post.body) ?? SITE.description;
}

export function postOgImagePath(post: CollectionEntry<'posts'>): string {
  const encodedId = post.id.split('/').map(encodeURIComponent).join('/');
  return `/og/posts/${encodedId}.png`;
}

export function postImage(post: CollectionEntry<'posts'>): string {
  return post.data.ogImage ?? post.data.image ?? postOgImagePath(post);
}

export function postKeywords(post: CollectionEntry<'posts'>): string[] {
  return [...new Set([post.data.category, ...post.data.tags].filter(Boolean))];
}

export function personJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: SITE.author,
    url: SITE.url,
    email: SITE.email,
    sameAs: [SITE.github],
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.title,
    alternateName: SITE.description,
    url: SITE.url,
    inLanguage: SITE.locale,
    publisher: {
      '@type': 'Person',
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
  const image = absoluteUrl(postImage(post));
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
    image: [image],
    url: absoluteUrl(permalink),
    datePublished: post.data.date.toISOString(),
    dateModified: dateModified.toISOString(),
    author: {
      '@type': 'Person',
      name: SITE.author,
      url: SITE.url,
    },
    publisher: {
      '@type': 'Person',
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
