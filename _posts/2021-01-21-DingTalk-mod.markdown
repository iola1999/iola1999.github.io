---
layout: post
title:  调戏钉钉 PC 客户端
date:  2021-01-21 12:00:00 +0800
categories: 逆向与调试
tag: 
typora-root-url: ..
---

* content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.DingTalk-mod)
## 提前致谢

思路来源：[https://blog.csdn.net/cwg2552298/article/details/109260541](https://blog.csdn.net/cwg2552298/article/details/109260541)  [web archive](https://web.archive.org/web/20210121104923/https://blog.csdn.net/cwg2552298/article/details/109260541)，个人对逆向并不熟悉，写篇文章记录一下稍详细的折腾过程。

## 准备

+ [钉钉PC版安装包](https://page.dingtalk.com/wow/dingtalk/act/download)
+ [Ollydbg](https://down.52pojie.cn/Tools/Debuggers/吾爱破解专用版Ollydbg.rar)

## 大致折腾过程

已知钉钉是基于`Libcef`开发的，查看钉钉目录，有`DingDing\main\current\web_content.pak`文件，作为 zip 解压时需要提供密码。考虑钉钉运行时必然需要解压它，尝试动态调试获取解压密码。

### 获取解压密码

启动OD，选择`DingDing\main\current\DingTalk.exe`打开，注意不是`DingtalkLauncher.exe`，它在启动 DingTalk 后就结束了。

查看 -> 可执行模块。

![image-20210121185611533](/upload/images/2021-01-21-DingTalk-mod/image-20210121185611533.png)

按`F8`单步步过，直到可执行模块区域出现`libcef.dll`（一直按着即可，快到时，单步步过会执行数秒，这时松开就好）。

![image-20210121190437130](/upload/images/2021-01-21-DingTalk-mod/image-20210121190437130.png)

双击`libcef.dll`，按`Ctrl+B`搜索 `78 56 34 12`。定位到该行后，按`F4` 运行到选定位置，稍等片刻即可在此断下，在右上角寄存器区域看到一段字符串（看不到的话调整一下这个小窗口的宽度），即为`web_content.pak`的解压密码。

![image-20210121191306918](/upload/images/2021-01-21-DingTalk-mod/image-20210121191306918.png)

示例图的解压密码`272dcfc58`仅适用于`6.0.0-Release.11405`版本的PC钉钉。

PC钉钉`6.0.3.22302`版本的解压密码为`43c82c8a9`。

PC钉钉[DingTalk_v6.0.8.3010163](https://dtapp-pub.dingtalk.com/dingtalk-desktop/win_installer/Release/DingTalk_v6.0.8.3010163.exe)版本的解压密码为`68362a14c`。

PC钉钉[DingTalk_v6.0.8.3310263](https://dtapp-pub.dingtalk.com/dingtalk-desktop/win_installer/Release/DingTalk_v6.0.8.3310263.exe)版本的解压密码为`55b744249`。

PC钉钉[DingTalk_v6.0.9.4120187](https://dtapp-pub.dingtalk.com/dingtalk-desktop/win_installer/Release/DingTalk_v6.0.9.4120187.exe)版本的解压密码为`6c1b6b071`。

从上面这个版本开始，要在 `libcef_1.12345678` 上方的 `call` 处用 `F2` 下断点，然后看寄存器。之前的 `F4` 不合适。

![image-20210121191306918](/upload/images/2021-01-21-DingTalk-mod/Snipaste_2021-04-15_12-51-14.png)

PC钉钉`DingTalk_v6.0.12-Release.4190287`版本的解压密码为`7be631b49`。

有时候钉钉会静默自动升级，需要调试的则`DingDing\main\current_new\DingTalk.exe`，`web_content.pak`也是修改这个目录的。调试原来目录的的话，它启动后会退出。

感觉就像安卓双系统一样，两个版本互相升级......

PC钉钉`DingTalk_v6.0.15-Release.5080287`版本的解压密码为`8e979bfaa`。

PC钉钉`DingTalk_v6.0.15-Release.5170687`版本的解压密码为`0498ea61b`。

PC钉钉`DingTalk_v6.0.15-Release.6090287`版本的解压密码为`7bed4b395`。

PC钉钉`DingTalk_v6.0.15-Release.6110187`版本的解压密码为`72a9c5e6e`。

PC钉钉`DingTalk_v6.0.18-Release.6280687`版本的解压密码为`f0e8ba41f`。

PC钉钉`DingTalk_v6.0.26-Release.8200187`版本的解压密码为`9a6c3c5a8`。

PC钉钉`DingTalk_v6.0.26-Release.9039987`版本的解压密码为`7e8be02fb`。

### 魔改钉钉

使用上面拿到的密码解压`web_content.pak`，使用喜欢的代码编辑器打开项目。搜索`撤回了一条消息`找到`assets/chatbox-index.js`。

格式化一下代码，文件比较大，需要耐心等待一下。~~我的很大，你要忍一下~~

搜索`dt_message_recall_message_file_format`找到最后一处使用。参考原作者的方法，读取`a.baseMessage.content.textContent.text`拼接到撤回提示后即可看到撤回的文字消息。

![image-20210121192523369](/upload/images/2021-01-21-DingTalk-mod/image-20210121192523369.png)

对于图片，可以序列化`a.baseMessage.content`输出，能够看到`mediaId`等信息，使用`Everything`搜索，果然在本地找到了暂存的图片。

![image-20210121192832436](/upload/images/2021-01-21-DingTalk-mod/image-20210121192832436.png)

其实还有更简单粗暴的方法，参考上图，直接修改`a.baseMessage.recallStatus = 0;`（在`a.baseMessage.shieldStatus === ke.L.YES`这一行之上修改），即可实现完全的阻止撤回。该方案来源于代码中的 model 定义。

![image-20210121193046322](/upload/images/2021-01-21-DingTalk-mod/image-20210121193046322.png)

### 打包替换

修改好后，重新打包`web_content`，注意要跟原来的目录层级一致，不要包含外层目录，记得使用相同的解压密码。原文还强调了要使用`7zip`的`ZipCrypto`加密算法，未测试是否为必要的。

打包后命名为`web_content.pak`替换原文件，启动钉钉即可看到效果。

该防撤回的方案存在缺点：过一段时间后再看消息，就看不到撤回前的内容了，统一展示为已撤回。另外如果钉钉对 pak 进行校验，要绕过就复杂很多了。

不过这个主要还是因为好奇，魔改防撤回只是折腾的一部分。也还有许多未成功的尝试，例如添加`--remote-debugging-port`启动参数来调试等，后面再玩吧。

### 没啥用的笔记

```javascript
dingtalk.window.toast(Ln.ToastType.INFO, "recalled:"+a.baseMessage.content.textContent.text, (function () { }))

a.baseMessage.content.textContent.text = Object.keys(dingtalk).join(',')+'====\n===='+Object.keys(dingtalk.util).join(',')+'====\n===='+Object.keys(dingtalk.window).join(',');

a.baseMessage.content.textContent.text = "dingtalk.window.showDevTools.length:"+dingtalk.window.showDevTools.length+'====\n===='+"dingtalk.window.showDevTools.toString():"+dingtalk.window.showDevTools.toString();
```

## 套话

折腾仅因个人兴趣，记录分享仅为研究学习交流，请勿用于违法用途。

-END-
