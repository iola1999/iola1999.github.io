import { describe, expect, it } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  excerptFromMarkdown,
  postDescription,
  postImage,
  postJsonLd,
  stripMarkdown,
  truncateDescription,
} from './seo';

function mockPost(overrides: Partial<CollectionEntry<'posts'>> = {}): CollectionEntry<'posts'> {
  return {
    id: 'Example-Post',
    collection: 'posts',
    body: '第一段正文，应该成为摘要。\n\n![图](/upload/example.png)',
    data: {
      title: '示例文章',
      date: new Date('2026-06-18T20:00:00+08:00'),
      category: '折腾',
      tags: ['SEO', 'Astro'],
      draft: false,
    },
    ...overrides,
  } as CollectionEntry<'posts'>;
}

describe('seo helpers', () => {
  it('normalizes absolute URLs against site URL', () => {
    expect(absoluteUrl('/a/b/')).toBe('https://678234.xyz/a/b/');
    expect(absoluteUrl('https://example.com/x')).toBe('https://example.com/x');
  });

  it('strips common markdown syntax for descriptions', () => {
    expect(stripMarkdown('## 标题\n\n这是 [链接](https://example.com) 和 `code`。'))
      .toBe('标题 这是 链接 和 code。');
  });

  it('skips disclaimer paragraphs when deriving excerpts', () => {
    const markdown = '> 声明：本文包含 AI 辅助创作。\n\n真正的正文从这里开始，应该用于 SEO 摘要。';
    expect(excerptFromMarkdown(markdown)).toBe('真正的正文从这里开始，应该用于 SEO 摘要。');
  });

  it('skips markdown headings when deriving excerpts', () => {
    const markdown = '> 声明：本文仅记录个人测试。\n\n## 结论\n\n这是一段足够完整的正文摘要，不应该被前面的标题替代。';
    expect(excerptFromMarkdown(markdown)).toBe('这是一段足够完整的正文摘要，不应该被前面的标题替代。');
  });

  it('truncates long descriptions', () => {
    expect(truncateDescription('a'.repeat(200))).toHaveLength(160);
  });

  it('prefers explicit post description and image', () => {
    const post = mockPost({
      data: {
        ...mockPost().data,
        description: '手写摘要',
        ogImage: '/custom-og.png',
      },
    });
    expect(postDescription(post)).toBe('手写摘要');
    expect(postImage(post)).toBe('/custom-og.png');
  });

  it('builds BlogPosting JSON-LD with canonical article URL', () => {
    const jsonLd = postJsonLd(mockPost());
    expect(jsonLd['@type']).toBe('BlogPosting');
    expect(jsonLd.url).toBe('https://678234.xyz/2026/06/18/Example-Post/');
    expect(jsonLd.keywords).toEqual(['折腾', 'SEO', 'Astro']);
  });

  it('builds BreadcrumbList JSON-LD', () => {
    const jsonLd = breadcrumbJsonLd([
      { name: '首页', href: '/' },
      { name: '文章', href: '/2026/06/18/Example-Post/' },
    ]);
    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(jsonLd.itemListElement).toHaveLength(2);
  });
});
