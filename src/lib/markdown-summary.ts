const DESCRIPTION_MAX_LENGTH = 160;
const SKIP_EXCERPT_PATTERNS = [
  /声明/,
  /本文.*AI/,
  /本文仅记录/,
  /请勿/,
];

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
