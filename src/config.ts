export const SITE = {
  title: 'iolaSay',
  description: '影言 · 个人博客',
  author: 'iola1999',
  url: 'https://678234.xyz',
  locale: 'zh-CN',
  ogLocale: 'zh_CN',
  ogImageVersion: '20260809-editorial',
  defaultImage: '/social-card.png?v=20260809-editorial',
  github: 'https://github.com/iola1999',
  email: 'fwl1998@foxmail.com',
  /** 导航 */
  nav: [
    { label: '首页', href: '/' },
    { label: '分类', href: '/categories/' },
    { label: '标签', href: '/tags/' },
  ],
  /** Disqus shortname（保持与旧站一致，评论延续） */
  disqus: 'iola1999',
  /** RSS follow 验证块 */
  follow: { feedId: '59899165476559872', userId: '59826467493052416' },
} as const;
