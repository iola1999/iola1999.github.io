---
title: Codex Control Chrome MCP：把 Chrome 控制能力借给其他 Agent
date: '2026-06-26T23:20:00+08:00'
category: 折腾
tags:
  - Codex
  - MCP
  - Chrome
  - AI
---

> **声明：本文包含 AI 辅助创作。**

最近研究了一下 Codex App 里的 Chrome 控制能力。它和常见的浏览器自动化方案不太一样：不是单独启动一个干净的 Chrome，也不是要求用户开启 `--remote-debugging-port`，而是通过 Codex Chrome Extension 控制用户正在使用的正常 Chrome Profile。

这带来一个很实际的好处：已有登录态、Cookie、打开的标签页、安装的扩展都可以复用。对于 Agent 来说，这比每次进入一个全新的浏览器环境更自然，也更接近日常使用浏览器的状态。

这个能力本身很好用，但目前主要服务于 Codex App。我想做的是把这套流程抽出来，以 MCP 的形式提供给其他 Agent 工具使用。

项目地址：

[https://github.com/iola1999/codex-control-chrome-mcp](https://github.com/iola1999/codex-control-chrome-mcp)

## 起因

之前使用 Chrome DevTools MCP 时，一个明显限制是浏览器环境通常和日常 Chrome Profile 分离。这样做对自动化测试很合理，但对通用 Agent 场景不一定理想。

典型问题包括：

- 正常 Chrome 里已经登录的网站，在新 Profile 里还需要重新登录；
- 用户平时依赖的浏览器扩展，在新环境里不存在；
- 当前已经打开的标签页无法直接接管；
- 部分网站对新设备、新环境或新登录态比较敏感。

Codex Chrome Extension 走的是另一条路线。它天然处在用户的正常 Chrome Profile 里，因此更适合需要复用真实浏览器状态的 Agent 场景。

## 关键机制

分析之后可以看到，核心链路不是外部 CDP remote debugging port，而是 Chrome Extension + Native Messaging。

大致结构如下：

```text
Codex Chrome Extension
  -> chrome.runtime.connectNative("com.openai.codexextension")
  -> native messaging host
  -> chrome.debugger.attach / chrome.debugger.sendCommand
  -> CDP
```

也就是说，扩展负责进入用户的真实 Chrome Profile，Native Messaging host 负责和本地进程通信，最终通过 `chrome.debugger` 发送 CDP 命令。

这也是它可以复用正常 Chrome Profile 的原因：控制入口在浏览器扩展内部，而不是从外部调试端口连接一个额外启动的浏览器实例。

## 做了什么

`codex-control-chrome-mcp` 做的是一层 MCP 封装：

1. 注册 `com.openai.codexextension` 对应的 Native Messaging host；
2. 保存并代理原始 Codex extension-host，尽量不影响 Codex App 自身使用；
3. 在本地开一个 bridge socket，供 MCP server 发送 JSON-RPC；
4. MCP server 暴露标签页、导航、CDP、截图、事件读取等基础工具；
5. 在仓库里附带一个 skill，说明 Agent 应该如何按正确顺序使用这些工具。

命名上使用 `codex-control-chrome-mcp`，主要是为了贴近 Codex 官方 skill 中的 `control-chrome`，同时明确这是一个 MCP server。

## 怎么用

前置条件是先装好 Codex Chrome Extension：

[https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg)

然后按仓库 README 里的说明安装 native host，并在支持 MCP 的 Agent 工具里加一个 stdio MCP 配置即可。

如果 Agent 支持 skill，也可以引用仓库里的 skill：

```text
skills/codex-control-chrome-mcp
```

这个 skill 主要约束 MCP 工具的使用顺序：

- 先检查 MCP bridge 和扩展连接状态；
- 需要复用已有页面时，先列出用户标签页，再 claim 对应 tab；
- 做 CDP 之前先 attach；
- 监听 Network/Runtime/Page 事件时，先 enable 对应 domain；
- 结束前 finalize tabs，明确哪些标签页需要保留。

这些步骤并不复杂，但如果完全依赖模型自己推断，容易出现工具顺序错误、tab id 猜测、事件读取遗漏等问题。因此 skill 文档是这个项目的一部分。

## 现在的状态

目前项目已经能跑通基础流程：

- 复用正常 Chrome Profile；
- 读取和 claim 用户已有标签页；
- 新建标签页并导航；
- 发送原始 CDP 命令；
- 读取网络、控制台和页面事件；
- 截图；
- 通过 npm + npx 分发；
- 自带 MCP 使用 skill。

后续可能会继续研究如何复用 Codex 自己的 `browser-client` 高层逻辑。目前版本更偏底层，主要提供直接的 tab/CDP 能力。

## 适用场景

这个项目适合这些场景：

- Agent 需要访问已经登录的网站；
- 任务依赖当前 Chrome 中已经打开的页面；
- 需要复用用户安装的 Chrome 扩展；
- 需要通过 CDP 做网络、控制台、性能或 DOM 调试；
- 不希望为每个 Agent 单独维护一套浏览器 Profile。

限制也很明确：它依赖 Codex Chrome Extension，也依赖 Native Messaging host 注册。同一时间 `com.openai.codexextension` 只有一个 manifest 生效，所以项目通过代理原始 extension-host 来尽量保持和 Codex App 共存。

## 结尾

Agent 能力不只取决于模型和工具数量，也取决于工具运行在什么上下文里。浏览器自动化尤其如此。复用真实 Chrome Profile，可以显著降低登录态、扩展、当前页面状态带来的割裂感。

`codex-control-chrome-mcp` 只是把 Codex Chrome Extension 的这条路径整理成一个可复用的 MCP server。实现并不复杂，但对实际体验有帮助。

项目地址：

[https://github.com/iola1999/codex-control-chrome-mcp](https://github.com/iola1999/codex-control-chrome-mcp)

本文仅记录个人设备和个人环境下的技术调研与实现。浏览器 Profile 中可能包含敏感数据，请只在自己拥有并明确授权的场景中使用。
