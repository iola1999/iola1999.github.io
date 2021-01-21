---
layout: post
title:  调戏钉钉PC客户端
date:  2021-01-21 12:00:00 +0800
categories: 折腾
tag: 
typora-root-url: ..
---

* content
{:toc}
## 提前致谢

思路来源：[https://blog.csdn.net/cwg2552298/article/details/109260541](https://blog.csdn.net/cwg2552298/article/details/109260541)  [web archive](https://web.archive.org/web/20210121104923/https://blog.csdn.net/cwg2552298/article/details/109260541)，个人对逆向并不熟悉，写篇文章记录一下稍详细的折腾过程。

## 准备

+ [钉钉PC版安装包](https://page.dingtalk.com/wow/dingtalk/act/download)
+ [Ollydbg](https://down.52pojie.cn/Tools/Debuggers/吾爱破解专用版Ollydbg.rar)

## 大致折腾过程

已知钉钉是基于`Libcef`开发的，查看钉钉目录，有`DingDing\main\current\web_content.pak`文件，作为 zip 解压时需要提供密码。考虑钉钉运行时必然需要解压它，尝试动态分析获取解压密码。

启动OD，选择`DingDing\main\current\DingTalk.exe`打开，注意不是`DingtalkLauncher.exe`，它在启动 DingTalk 后就结束了。

查看 -> 可执行模块。

![image-20210121185611533](/upload/images/2021-01-21-DingTalk-mod/image-20210121185611533.png)

按`F8`单步步过，直到可执行模块区域出现`libcef.dll`（一直按着即可，快到时，单步步过会执行数秒，这时松开就好）。

![image-20210121190437130](/upload/images/2021-01-21-DingTalk-mod/image-20210121190437130.png)





-END-