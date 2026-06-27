import { describe, it, expect } from 'vitest';
import {
  postPermalink,
  formatDate,
  formatMonthDay,
  byDateDesc,
  groupByYear,
  groupByCategory,
  groupByTag,
  countsBySize,
  type Post,
} from './posts';
import type { CollectionEntry } from 'astro:content';

// 构造一个最小可用的 post mock（只用到 date 和 id）
function mockPost(dateISO: string, id: string): CollectionEntry<'posts'> {
  return { data: { date: new Date(dateISO) }, id } as unknown as CollectionEntry<'posts'>;
}

// 带分类/标签的 mock（分组用）
function richPost(dateISO: string, category: string, tags: string[]): Post {
  return { id: dateISO, data: { date: new Date(dateISO), category, tags } } as unknown as Post;
}

describe('postPermalink', () => {
  it('复刻 Jekyll /:y/:m/:d/:slug/ 格式', () => {
    expect(postPermalink(mockPost('2026-05-18T10:00:00+08:00', 'Vibe-Coding-Toys')))
      .toBe('/2026/05/18/Vibe-Coding-Toys/');
  });

  it('保留 slug 大小写（UURC-Web 不被小写化）', () => {
    expect(postPermalink(mockPost('2026-05-18T20:00:00+08:00', 'UURC-Web')))
      .toBe('/2026/05/18/UURC-Web/');
  });

  it('补零：单数月/日', () => {
    expect(postPermalink(mockPost('2017-03-07T23:15:00+08:00', 'schoolmate')))
      .toBe('/2017/03/07/schoolmate/');
  });

  it('东八区午夜附近不跨天：23:15 +0800 仍属当天', () => {
    expect(postPermalink(mockPost('2017-03-07T23:15:00+08:00', 'x'))).toMatch(/^\/2017\/03\/07\//);
  });

  it('UTC 时间正确换算为东八区日历日', () => {
    // 2026-05-17T16:00:00Z = 2026-05-18T00:00:00+08:00
    expect(postPermalink(mockPost('2026-05-17T16:00:00Z', 'x'))).toBe('/2026/05/18/x/');
  });

  it('UTC 午夜前不跨天', () => {
    // 2026-05-17T15:59:00Z = 2026-05-17T23:59:00+08:00 → 仍是 17 日
    expect(postPermalink(mockPost('2026-05-17T15:59:00Z', 'x'))).toBe('/2026/05/17/x/');
  });
});

describe('formatDate', () => {
  it('YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-06-14T20:55:00+08:00'))).toBe('2026-06-14');
  });
});

describe('formatMonthDay', () => {
  it('MM-DD 去年', () => {
    expect(formatMonthDay(new Date('2026-06-14T20:55:00+08:00'))).toBe('06-14');
  });
  it('单数补零', () => {
    expect(formatMonthDay(new Date('2026-03-07T08:00:00+08:00'))).toBe('03-07');
  });
});

describe('byDateDesc', () => {
  it('倒序：晚的排前', () => {
    const a = mockPost('2026-01-01T00:00:00+08:00', 'a');
    const b = mockPost('2025-01-01T00:00:00+08:00', 'b');
    expect(byDateDesc(a, b)).toBeLessThan(0);
    expect(byDateDesc(b, a)).toBeGreaterThan(0);
  });
  it('同时刻返回 0（排序稳定）', () => {
    const a = mockPost('2026-06-14T10:00:00+08:00', 'a');
    const b = mockPost('2026-06-14T10:00:00+08:00', 'b');
    expect(byDateDesc(a, b)).toBe(0);
  });
  it('同日不同时刻：较晚者排前', () => {
    const earlier = mockPost('2026-06-14T10:00:00+08:00', 'a');
    const later = mockPost('2026-06-14T20:00:00+08:00', 'b');
    // byDateDesc(earlier, later) = later - earlier > 0 → earlier 应排在 later 之后
    expect(byDateDesc(earlier, later)).toBeGreaterThan(0);
    expect(byDateDesc(later, earlier)).toBeLessThan(0);
  });
});

describe('groupByYear', () => {
  it('按东八区年份分组并年倒序', () => {
    const groups = groupByYear([
      richPost('2026-01-01T08:00:00+08:00', '折腾', []),
      richPost('2025-06-01T08:00:00+08:00', '折腾', []),
      richPost('2026-12-31T08:00:00+08:00', '折腾', []),
    ]);
    expect(groups.map(([y]) => y)).toEqual([2026, 2025]);
    expect(groups[0][1]).toHaveLength(2);
  });

  it('UTC 跨年边界按东八区归属', () => {
    // 2025-12-31T16:00:00Z = 2026-01-01T00:00+08:00 → 归 2026
    const groups = groupByYear([richPost('2025-12-31T16:00:00Z', 'x', [])]);
    expect(groups[0][0]).toBe(2026);
  });
});

describe('groupByCategory / groupByTag', () => {
  const posts = [
    richPost('2026-03-01T08:00:00+08:00', '折腾', ['Astro', 'SEO']),
    richPost('2026-02-01T08:00:00+08:00', '折腾', ['Astro']),
    richPost('2026-01-01T08:00:00+08:00', '文字', ['随笔']),
  ];

  it('按分类聚合', () => {
    const byCat = groupByCategory(posts);
    expect(byCat.get('折腾')).toHaveLength(2);
    expect(byCat.get('文字')).toHaveLength(1);
  });

  it('一篇多标签重复计入各标签', () => {
    const byTag = groupByTag(posts);
    expect(byTag.get('Astro')).toHaveLength(2);
    expect(byTag.get('SEO')).toHaveLength(1);
    expect(byTag.get('随笔')).toHaveLength(1);
  });

  it('countsBySize 按数量倒序', () => {
    expect(countsBySize(groupByTag(posts))[0]).toEqual(['Astro', 2]);
  });
});
