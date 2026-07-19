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

最近扒了扒 Codex App 控制 Chrome 的办法。它通过 Codex Chrome Extension 接管用户平时使用的 Chrome Profile，登录态、Cookie、打开的标签页和已安装扩展都在。常见的浏览器自动化方案会新开一个干净的 Profile，有些还要求开启 `--remote-debugging-port`。碰到需要登录的网站，重新收拾环境很麻烦。

这套能力目前主要给 Codex App 使用。我想把通信链路抽出来包成 MCP，交给其他 Agent 工具。

项目地址：

[https://github.com/iola1999/codex-control-chrome-mcp](https://github.com/iola1999/codex-control-chrome-mcp)

## 起因

我之前用 Chrome DevTools MCP 时，浏览器环境通常和日常 Chrome Profile 分开。隔离环境适合自动化测试。通用 Agent 经常卡在登录和环境配置上。

典型问题包括：

- 新 Profile 要重新登录网站；
- 平时依赖的浏览器扩展需要再装一遍；
- 当前打开的标签页接不过来；
- 有些网站会对新设备或新登录态多做一次校验。

Codex Chrome Extension 直接运行在用户日常的 Chrome Profile 里，可以复用真实登录态和扩展。

## 通信链路

扒完发现，链路走的是 Chrome Extension + Native Messaging。外部 CDP remote debugging port 没有参与。

大致结构如下：

```text
Codex Chrome Extension
  -> chrome.runtime.connectNative("com.openai.codexextension")
  -> native messaging host
  -> chrome.debugger.attach / chrome.debugger.sendCommand
  -> CDP
```

扩展运行在日常 Chrome Profile 中，通过 Native Messaging host 和本地进程通信，再调用 `chrome.debugger` 发送 CDP 命令。这样一来，现成的登录态和扩展都能直接用。

## 做了什么

`codex-control-chrome-mcp` 在这条链路外包了一层 MCP：

1. 注册 `com.openai.codexextension` 对应的 Native Messaging host；
2. 保存并代理 Codex 原有的 extension-host，让 Codex App 继续使用同一个入口；
3. 在本地开一个 bridge socket，供 MCP server 发送 JSON-RPC；
4. MCP server 提供标签页、导航、CDP、截图和事件读取等工具；
5. 仓库内附带一份 skill，约束 Agent 调用工具的顺序。

名字沿用了 Codex 官方 skill 里的 `control-chrome`，后缀说明它是 MCP server。

## 怎么用

前置条件是先装好 Codex Chrome Extension：

[https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg)

随后按仓库 README 安装 native host，再给支持 MCP 的 Agent 工具添加一份 stdio 配置。

如果 Agent 支持 skill，也可以引用仓库里的 skill：

```text
skills/codex-control-chrome-mcp
```

这份 skill 主要管调用顺序：

- 先检查 MCP bridge 和扩展连接状态；
- 复用已有页面时，先列出用户标签页，再 claim 对应 tab；
- 做 CDP 之前先 attach；
- 监听 Network/Runtime/Page 事件时，先 enable 对应 domain；
- 结束前 finalize tabs，明确哪些标签页需要保留。

步骤本身很短。模型自己猜时会搞错顺序、臆造 tab id，偶尔还会漏读事件。单独放一份 skill 能省下不少纠错时间。

## 现在的状态

目前版本已经能读取、claim、新建和导航标签页，也能发送原始 CDP 命令、读取网络与页面事件、截屏。包发在 npm 上，可以用 npx 启动；仓库里也带着配套 skill。

我还在研究 Codex 自己的 `browser-client`。眼下先把 tab 和 CDP 这些底层能力做稳，高层封装以后再说。

## 适用场景

我主要拿它处理已经登录的网站和当前打开的页面。任务要调用浏览器扩展，或者需要通过 CDP 查网络、控制台、性能与 DOM 时，也不用再维护另一套 Profile。

限制也很具体：项目依赖 Codex Chrome Extension 和 Native Messaging host 注册。同一时间，`com.openai.codexextension` 只有一个 manifest 生效。项目会代理原有的 extension-host，让 Codex App 和 MCP 共用这个入口。

浏览器自动化跑在哪个 Profile 里，很影响实际体验。日常 Agent 接手现成页面时，登录态和扩展都对得上，少了许多重复配置。这个项目把 Codex Chrome Extension 已有的控制链路接到 MCP 上，代码不算多，我自己用着挺省事。

本文仅记录个人设备和个人环境下的技术调研与实现。浏览器 Profile 中可能包含敏感数据，请只在自己拥有并明确授权的场景中使用。
