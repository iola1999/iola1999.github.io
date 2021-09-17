---
layout: post
title:  调戏飞书 PC 客户端
date:  2021-09-14 23:00:00 +0800
categories: 逆向与调试
tag: 
typora-root-url: ..
---

* content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.Debug-Feishu-PC)
## 闲聊

之前一直尝试[调试钉钉 PC 客户端](https://678234.xyz/2021/01/21/DingTalk-mod/)，奈何钉钉捂得紧，除了解开 `web_content` 改改前端代码外没有更多进展了。今天因为一些需求下载了飞书 PC 客户端，不得不说比钉钉好看的多（可能是天天看钉钉烦了）。

看了下应用目录，哦嚯直接把 `webcontent` 亮出来了~~任我玩弄~~（划掉）。

![image-20210914231709252](/upload/images/2021-09-14-Debug-Feishu-PC/web-content.png)

暂且不看其内容吧，迫不及待地试试看能否通过 CEF 的调试参数开启调试，发现果然可以。先简单记录一下过程，待日后仔细查看有什么好玩的。

## 准备

+ [飞书PC版安装包](https://sf3-cn.feishucdn.com/obj/ee-appcenter/dd1363/Feishu-win32_ia32-4.8.4-signed.exe)

## 启用调试

定位到飞书安装目录，找到 `app` 目录下的 `Feishu.exe`

关闭已打开的飞书进程

执行 `path-to-app/Feishu.exe  --remote-debugging-port=9222`

使用 Chrome 打开 `chrome://inspect` 即可看到飞书乖乖地躺在那里

![image-20210914232039033](/upload/images/2021-09-14-Debug-Feishu-PC/chrome-inspect.png)

点击 inspect 即可弹出调试工具窗口

![image-20210914232303599](/upload/images/2021-09-14-Debug-Feishu-PC/inpect-window.png)

## 先来个简单的消息撤回调试

怎样定位消息撤回时客户端前端做的处理呢？一个简单的方案是在代码中搜索类似“此消息已撤回”的字符串，然后阅读代码逻辑。

只是，我们都能调试它了，何不换个更优雅的思路：

先在手机上发送一条消息给自己，然后在消息区域 DOM 右键 `Break on - subtree modificiations`。

![image-20210914232939856](/upload/images/2021-09-14-Debug-Feishu-PC/dom-breakpoint.png)

在手机端撤回该消息，可以看到前端断点生效。

查看调用栈，顶部的都是 React 的行为，翻到底部则是 `emit...`  <-   `NativeCallJS`，大致了解飞书前端与原生端的通信方式是这种基于事件的模式。那么向上找到第一个脱离了事件调度中心的地方：

![image-20210914235525501](/upload/images/2021-09-14-Debug-Feishu-PC/paused-on-breakpoint.png)

在 `receivePushMessagesEntities` -> `onlyUpdateMessageItemsAndSave`下断点，重新发一条消息试试。

在 `receivePushMessagesEntities` 的入参 `e` 中，找到 `e.message[messageId].content.richText.elements[0].property.text.content` 看到了消息内容：

![image-20210915000110522](/upload/images/2021-09-14-Debug-Feishu-PC/show-text-content.png)

而消息是否撤回，肯定不在 `e.message[messageId].content` 里了，应该是某个状态标志存着。

撤回它，再看一下入参：

![image-20210915000522118](/upload/images/2021-09-14-Debug-Feishu-PC/compare-objects.png)

发现 `e.message[messageId].isRecalled` 发生了变化，尝试修改它为 false，消息变成了：

![image-20210915001113103](/upload/images/2021-09-14-Debug-Feishu-PC/fail-on-modify-directly.png)

尴尬，猜测是 `e.message[messageId].content` 里消息内容为空所致，那能不能避免这条已撤回的消息影响会话展示呢？

去修改 `webcontent` 里的代码，一番调试后我这样写道：

![image-20210915002557977](/upload/images/2021-09-14-Debug-Feishu-PC/modify-code-to-anti-recall.png)

看一下效果：

![image-20210915002435920](/upload/images/2021-09-14-Debug-Feishu-PC/FeishuAntiRecall.gif)


完美。

## 套话

折腾仅因个人兴趣，记录分享仅为研究学习交流，请勿用于违法用途。

-END-
