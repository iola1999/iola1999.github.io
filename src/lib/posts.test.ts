import { describe, it, expect } from 'vitest';
import { postPermalink, formatDate, formatMonthDay, byDateDesc } from './posts';
import type { CollectionEntry } from 'astro:content';

// 构造一个最小可用的 post mock（只用到 date 和 id）
function mockPost(dateISO: string, id: string): CollectionEntry<'posts'> {
  return { data: { date: new Date(dateISO) }, id } as unknown as CollectionEntry<'posts'>;
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
