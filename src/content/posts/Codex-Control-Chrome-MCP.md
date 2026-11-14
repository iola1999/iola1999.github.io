---
title: Codex Control Chrome MCP：把 Chrome 控制能力开放给其他 Agent
seoTitle: Codex Control Chrome MCP：复用日常 Chrome 登录态控制浏览器
date: '2026-06-26T23:20:00+08:00'
description: 拆解 Codex Chrome Extension 的 Native Messaging 通信链路并封装为开源 MCP 服务 codex-control-chrome-mcp，让 Claude Code 与 Cursor 直接复用日常 Chrome 登录态、Cookie 与已打开标签页。
category: 折腾
tags:
  - Codex
  - Claude Code
  - MCP
  - Chrome
  - AI
---

> **声明：本文包含 AI 辅助创作。**

## 前言

最近研究了一下 OpenAI 的 Codex App 是怎么在本地控制 Chrome 浏览器的。平时我们用常见的浏览器自动化方案（比如早期的 Chrome DevTools MCP 或 Puppeteer），默认都会另起炉灶开一个全新的空白 Chrome Profile，或者要求在启动浏览器时手动挂上 `--remote-debugging-port` 参数。这种隔离环境拿来跑纯粹的前端自动化测试很合适，但一旦放到日常的通用 Agent 场景里，体验就会非常割裂。

最直观的麻烦在于环境断层。平时在主力浏览器里早就登录好的内部系统或常用网站，到了隔离的新 Profile 里全得重新输密码、过双因素认证；日常高频依赖的浏览器扩展在新环境里一个都没有；有时候自己明明已经在浏览器里打开了一个页面，想让 Agent 接着看一眼或者点两下，它却接管不过来；更别提不少风控严格的网站一旦检测到空白环境或新设备指纹，还会额外弹出一堆人机校验。

而 Codex App 走的是另一条路子。它直接通过官方的 Codex Chrome Extension 驻留在用户平时正在使用的默认 Chrome Profile 里，现有的登录态与 Cookie、已经打开的标签页以及安装好的扩展全都能原样复用。只不过这套能力原本只服务于 Codex App 自己，于是我花了点时间把它的底层通信链路拆出来，外面包了一层标准 MCP 服务，做成了开源项目 [codex-control-chrome-mcp](https://github.com/iola1999/codex-control-chrome-mcp)，让 Claude Code、Cursor 等其他支持 MCP 的 Agent 工具也能直接复用这套现成的浏览器环境。

## 为什么看上 Codex Chrome Extension 的通信链路

动手之前我先把 Codex App 和浏览器之间的通信过程拆开看了一遍。它并没有去碰外部的 CDP 远程调试端口（remote debugging port），整条控制链路完全建立在 Chrome Extension 配合 Native Messaging 的机制之上。

```text
Codex Chrome Extension
  -> chrome.runtime.connectNative("com.openai.codexextension")
  -> native messaging host
  -> chrome.debugger.attach / chrome.debugger.sendCommand
  -> CDP
```

整个调用流向非常清晰。扩展程序直接安装在用户日常使用的 Chrome Profile 内部，启动后通过 `chrome.runtime.connectNative("com.openai.codexextension")` 拉起本地注册好的 Native Messaging 宿主进程；外部需要操作页面或抓取数据时，指令通过这条本地管道传回扩展，再由扩展在内部调用 `chrome.debugger.attach` 和 `chrome.debugger.sendCommand` 向目标标签页发送标准的 CDP（Chrome DevTools Protocol）命令。因为真正的控制入口始终留在扩展内部，不需要重启浏览器加特殊启动参数，日常积攒的登录态和扩展环境自然也就全部保留了下来。

## 代理 Native Messaging 与封装 MCP 服务

摸清这条链路之后，`codex-control-chrome-mcp` 要做的事情就很明确了。核心思路是在不破坏 Codex App 原有功能的前提下，在 Native Messaging 宿主这一层做一个透明中间层，并对外暴露标准 MCP 接口。项目的名字也直接沿用了 Codex 官方 skill 里的 `control-chrome` 叫法，只在后面加上了 `-mcp` 后缀表明身份。

具体实现上分成了五步。首先是接管 `com.openai.codexextension` 对应的 Native Messaging host 注册配置；为了避免装上这个工具后导致原本的 Codex App 无法控制浏览器，程序在安装时会把 Codex 原有的 `extension-host` 路径保存下来并做一层透明转发代理，让 Codex App 和外部 MCP 客户端能够共用同一个扩展入口。接着，宿主进程会在本地开一个 Bridge Socket，供按需启动的 MCP Server 通过 JSON-RPC 协议收发指令。在此之上，MCP Server 把底层的通信能力封装成了标签页列举与认领（claim）、页面导航和原始 CDP 指令发送，以及页面截图与网络、控制台事件读取等一组基础工具，并发布到了 npm 上，平时直接通过 `npx` 就能拉起。

如果要在自己的环境里跑起来，前置条件是先从 Chrome 应用商店装好官方的 [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg)。装好扩展后，按照仓库 README 的说明执行一次 native host 注册，再往常用的 Agent 工具里添一段标准 `stdio` 类型的 MCP 配置就可以开始用了。

## 为什么要专门配一份 Skill 约束调用顺序

在仓库的 `skills/codex-control-chrome-mcp` 目录下，我还专门附带了一份配套的 Agent Skill。之所以要多加这一层说明，是因为在实际使用中发现，如果只把十几个底层 MCP 工具直接丢给大模型，模型自己临场发挥时非常容易搞错操作顺序。

比如有些模型上来不查当前有哪些标签页，自己凭空编造一个 `tabId` 就往里发指令；或者在发送原始 CDP 命令前忘了先执行 `attach`；又或者想抓网络包和控制台报错，却忘了提前调用 CDP 把对应的 `Network`、`Runtime` 或 `Page` 域（domain）开启（enable），结果读回来的事件流永远是空的。

有了这份配套 Skill 之后，Agent 会按照明确的状态机顺序去调工具。先检查本地 MCP Bridge 和浏览器扩展的握手状态；需要接手用户已打开的页面时，先列出当前标签页再显式认领（claim）目标标签页；发 CDP 命令前确保已完成 `attach`，读事件前确保已 `enable` 对应域；任务结束退出前还会调一次 `finalize tabs`，交代清楚哪些临时新建的标签页要关掉、哪些需要留给用户继续看。这几条规则虽然写起来很短，但加进去之后能省掉大量模型自己试错和重来的时间。

## 尾声

目前这个版本的 `codex-control-chrome-mcp` 已经能稳定处理标签页的读取和认领、新建与导航，原始 CDP 指令透传、网络与页面事件监听以及截屏也都跑通了。我最近还在继续看 Codex 内部 `browser-client` 的高层实现，不过眼下先把标签页生命周期和底层 CDP 通道做稳，就已经能解决日常绝大多数浏览器接管需求了。

平时我主要拿这套工具处理那些已经登录好的后台系统，或者让 Agent 直接接手我看到一半的网页继续查网络请求和看控制台报错，以及分析性能与 DOM 结构，省去了维护第二套浏览器环境的麻烦。需要留意的边界也很清楚，整个方案依赖官方扩展以及本地的 `com.openai.codexextension` 清单注册，而且由于接入的是每天自用的真实浏览器 Profile，里面包含大量个人登录凭证与隐私数据，建议大家只在自己完全掌控的个人设备和明确授权的任务中使用。
