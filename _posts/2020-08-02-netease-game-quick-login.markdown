---
layout: post
title:  周末写一个网易游戏PC端快捷扫码登录工具
date:  2020-08-02 21:00:00 +0800
categories: 折腾
tag: 
---

* content
{:toc}
网易的不少端游都是由手游转制来的，还不给账号密码的登录方式，只能用手机扫码。有人提出需求：养了一堆小号，每次要上号都很麻烦，能不能弄个PC端的扫码登录工具。额......趁周末实现了一个。

## 先放图

![朴实无华的首页]({{ '/styles/images/netease-game-quick-login/netease-game-quick-login-home.png' | prepend: site.baseurl  }})

![账号管理页面]({{ '/styles/images/netease-game-quick-login/netease-game-quick-login-accountlist.png' | prepend: site.baseurl  }})

![大致开发进程]({{ '/styles/images/netease-game-quick-login/netease-game-quick-login-git.png' | prepend: site.baseurl  }})

录屏动图等下再发。


## 主要技术

经历过上上个月用`Python + tkinter`那痛苦的布局体验后，这次我尝试了一下`Vue.js + Electron`的实现方式，果然是好看、现代得多。

`Electron`分主进程和渲染进程两部分，简单理解的话就是`Node.js端`和`Web端`（吧）。要做一个扫码工具，容易想到的思路是前端点一下按钮通知主进程对屏幕截图（使用`ipcRenderer`通信），Node.js端截图解析二维码返回给前端（`ipcMain`通信）。实际操作上，这个Node.js对系统屏幕的截图实在是难以操作，遇到的坑一个接一个。多种fix无果后还是掏出了老本行，Python使用Windows原生Api对指定窗口截图（还能实现后台截图呢，窗口挡住了也没事），然后解析，Node.js拿到二维码内容返回给前端处理。

比较庆幸的是，在登录协议上倒是没花多少时间。网易提供了`网易手游管家`这一微信小程序，而众所周知微信小程序能看到源码哈哈。分析了一波账号登录、扫码、确认登录的请求后，拿来用用很简单就搞定了协议部分嘿嘿。


## 后记

然后就是，我不玩网易游戏啊。



-END-