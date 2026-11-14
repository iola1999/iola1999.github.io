export const SITE = {
  title: 'iolaSay',
  tagline: '影言 · 个人博客',
  description: '记录 AI Coding Agent 工程实践、本地大模型推理、移动系统移植、客户端逆向分析与嵌入式硬件改造的个人技术博客。',
  author: 'iola1999',
  url: 'https://678234.xyz',
  locale: 'zh-CN',
  ogLocale: 'zh_CN',
  ogImageVersion: '20261114-titles',
  defaultImage: '/social-card.png?v=20261114-titles',
  github: 'https://github.com/iola1999',
  /** 标签页进入索引与 sitemap 的最少文章数 */
  minIndexableTagPosts: 3,
  /** 导航 */
  nav: [
    { label: '首页', href: '/' },
    { label: '分类', href: '/categories/' },
    { label: '标签', href: '/tags/' },
  ],
  /** Giscus 评论配置（关联仓库 GitHub Discussions） */
  giscus: {
    repo: 'iola1999/iola1999.github.io',
    repoId: 'MDEwOlJlcG9zaXRvcnkxNzkwNjY4ODE=',
    category: 'Announcements',
    categoryId: 'DIC_kwDOCqxYAc4DLIDX',
  },
  /** RSS follow 验证块 */
  follow: { feedId: '59899165476559872', userId: '59826467493052416' },
} as const;
