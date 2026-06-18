# iola1999

[https://678234.xyz](https://678234.xyz)

个人博客，基于 [Astro](https://astro.build) 构建。

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 本地开发 http://localhost:4321
npm run build    # 构建到 dist/
npm run preview  # 预览构建产物
```

## 写文章

在 `src/content/posts/` 新建 `<slug>.md`，frontmatter：

```yaml
---
title: 标题
date: '2026-06-18T20:00:00+08:00'
category: 折腾
tags: [标签1, 标签2]
draft: false        # true 则仅本地可见、不发布
---
```

- 文章 URL 由 `日期 + 文件名` 决定：`/YYYY/MM/DD/<文件名>/`（保留大小写）
- 图片放 `public/upload/images/<slug>/`，正文用绝对路径 `/upload/images/...`
- 代码高亮、目录由 Astro 自动处理，无需 `{:toc}`

## 部署

push 到 `master` 即触发 GitHub Actions（`.github/workflows/deploy.yml`）自动构建并发布到 GitHub Pages。仓库 Settings → Pages → Source 需设为 **GitHub Actions**。

## 结构

```
src/
  config.ts            站点元信息 / 导航 / Disqus
  content.config.ts    内容集合 schema（zod 校验）
  content/posts/       文章 markdown
  layouts/             页面布局
  components/          组件
  pages/               路由
  lib/posts.ts         永久链接 / 日期工具
  styles/global.css    全部样式（设计令牌化，换肤改 :root 即可）
public/                静态资源（图片、CNAME、favicon）
```
