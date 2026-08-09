import { describe, expect, it } from 'vitest';
import {
  defaultSocialSvg,
  postCardSummary,
  postCardSvg,
  titleLayout,
  wrapText,
} from './generate-brand-assets.mjs';

const post = {
  id: 'Example-Post',
  title: '示例文章',
  date: new Date('2026-06-18T20:00:00+08:00'),
  category: '折腾',
  tags: ['Astro', 'SEO'],
  body: '第一段正文足够完整，可以直接作为社交分享图中的文章摘要。',
};

describe('social card content', () => {
  it('prefers a frontmatter description', () => {
    expect(postCardSummary({
      ...post,
      description: '  手写摘要优先显示。  ',
      body: '正文不会覆盖手写摘要。',
    })).toBe('手写摘要优先显示。');
  });

  it('falls back to cleaned article content', () => {
    expect(postCardSummary({
      ...post,
      body: '> **声明：本文包含 AI 辅助创作。**\n\n## 起因\n\n真正的正文从这里开始，应该进入分享图摘要。',
    })).toBe('真正的正文从这里开始，应该进入分享图摘要。');
  });

  it('reports truncation without adding an ellipsis when requested', () => {
    expect(wrapText('这是一段需要分成很多行的摘要内容', 5, 2, { ellipsis: false }))
      .toEqual({ lines: ['这是一段需', '要分成很多'], truncated: true });
  });
});

describe('social card layout', () => {
  it('balances long mixed-language titles across two lines', () => {
    const layout = titleLayout('Codex Control Chrome MCP：把 Chrome 控制能力借给其他 Agent');
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines.join('').replace(/\s/gu, ''))
      .toBe('CodexControlChromeMCP：把Chrome控制能力借给其他Agent');
    expect(layout.lines[0]).not.toMatch(/[A-Za-z0-9]$/u);
  });

  it('renders a white article card with a fading long summary and metadata', () => {
    const svg = postCardSvg({
      ...post,
      description: '这是一段较长的摘要内容，用来验证文字在分享图底部逐渐隐藏的效果。'.repeat(8),
    });

    expect(svg).toContain('<rect width="1200" height="630" fill="#ffffff"/>');
    expect(svg).toContain('id="summaryFade"');
    expect(svg).toContain('折腾 · #Astro · #SEO');
    expect(svg).toContain('2026-06-18');
    expect(svg).not.toContain('<circle');
  });

  it('keeps a short summary fully opaque', () => {
    expect(postCardSvg({ ...post, description: '简短摘要。' })).not.toContain('id="summaryFade"');
  });

  it('renders the default site card on the same white canvas', () => {
    const svg = defaultSocialSvg();
    expect(svg).toContain('<rect width="1200" height="630" fill="#ffffff"/>');
    expect(svg).toContain('影言');
    expect(svg).not.toContain('<circle');
  });
});
