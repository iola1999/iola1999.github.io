---
layout: post
title: 如何愉快地使用钉钉
date: 2023-05-27 19:00:00 +0800
categories: 折腾
tag:
typora-root-url: ..
---

- content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.How-to-ignore-unread-status-in-DingTalk)

忙太久没冒泡了，水一篇工作相关的吧。

标题有点科幻，不过最近确实解了钉钉上困扰我的两个问题：思考的间隙无意识点开钉钉看一眼，以及因为好奇谁没读我在群里发的消息而点击已读状态翻一翻。

靠掰正习惯、调整心态来解决它们难度有点高，最近找了些技术流的解法效果不错，记录一下万一能帮到谁呢~

## 如何避免无消息时看钉钉

这个很好解决，以下几种一起用：

- 不要设置弹出钉钉窗口的快捷键；

- 将钉钉的小图标收起来，Windows 上托盘区自带了，macOS 上可以用 [Hidden Bar](https://github.com/dwarvesf/hidden) 这个软件；

- Windows 能直接关掉钉钉窗口让它离开任务栏，而 macOS 上想隐藏 Dock 上的钉钉图标麻烦了些，查了些方案都有点高（比如得关 SIP 或者要借助些付费软件），对比下来还是 `sudo lsappinfo setinfo -app 钉钉 ApplicationType=UIElement` 这样一行命令搞定最为方便，虽然有些副作用（影响不大就不写了），也可以临时 set 回 `Foreground` 恢复；

- [可选]直接退出钉钉，隔久一点时间再打开看下或者单纯靠手机的通知被找。

## 如何不去看别人的已读状态

这个就略技术流了，其实前面也水过几篇「调戏」钉钉的文档，例如 [调戏钉钉 PC 客户端](/2021/01/21/DingTalk-mod/)、 [调戏钉钉 PC 客户端之 Hook CEF 函数调用](/2021/09/15/DingTalk-Mod-Hook-CEF-Call/)，针对该问题的解决方案是通过修改前端代码隐藏会话窗口内的「x 人未读」的 DOM 节点，看不到自然也不会想去点击了。

Windows 上需要参考前文找一下 webContents 压缩包密码，而 macOS 上的钉钉干脆直接没压缩 webContents ~~任人摆布~~（飞书：？）。

要修改的文件是 `webContents/assets/chatbox-index.[hash].js`（跟撤回的一样），文件中搜一下 `msg-unread-indicator` 可以看到几处 createElement，不用管具体都是啥场景，都将第三个参数改成空字符串即可。

不便拿公司电脑截图，本文就不附图了，效果完美到就跟钉钉没有已读回执这种 👻 东西一样。

## 如何不让别人看自己的已读状态

这个是突然想起来的，但不在本文范围内，也不是很礼貌就不写了，感兴趣请参考 https://www.freebuf.com/sectool/258385.html 或 https://blog.csdn.net/frozleaf/article/details/111569433。

## 套话

折腾仅因个人兴趣，记录分享仅为研究学习交流，请勿用于违法用途。
