---
layout: post
title:  在安卓设备上运行 Ubuntu
date:   2019-05-04 17:00:00 +0800
categories: 折腾
tag: 
---

* content
{:toc}


手上闲置的安卓设备有点多，一直在考虑怎样利用起来。挺久之前就尝试了 [Linux Deploy](https://github.com/meefik/linuxdeploy) 这个应用，只是一直没有仔细地配置过。这里写篇博文记录下今天的折腾。（凑数）



准备			{#one}
====================================

+ 从[此处](https://github.com/meefik/linuxdeploy/releases)下载 Linux Deploy
+ 从[此处](https://github.com/meefik/busybox/releases)下载 busybox 安装器

+ 设备需要先获取 root 权限，以使用 chroot（该软件上 Linux 系统的运行原理） 和安装 busybox。似乎还有一种 proot 的实现不需要权限，但我目前没有测试过两者区别。

+ 设备运行内存最好有 2G 或更大




安装			{#two}
====================================
1. 将 busybox 安装到 /system/xbin
2. 打开 Linux Deploy，点右下角设置，做以下修改：
   - 发行版：Ubuntu，版本我选择的是 Xenial（16.04）
   - 架构：视 CPU 选择，一般建议 32 位选 armhf，64 位选 arm64
   - 源地址：`https://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports/`
   - 安装类型：Linux 系统的存放位置，这个网络上很多建议用“镜像文件”，也就是提前建立一个固定大小的磁盘。我个人觉得这样既浪费空间，又不能扩容，实在想不到什么好处。所以我用的是“目录”，实际位置是：`/data/user/0/ru.meefik.linuxdeploy/env（这部分在应用左上角抽屉菜单里设置）/rootfs/linux（配置名）`
   - 本地化：看喜好，zh-cn 是简中。
   - SSH：勾选
   - 图形界面：这里不用管。需要的话安装后可以系统里自己装。
3. 应用左上角抽屉菜单里 设置：

   - 常亮、锁定 WiFi、持续唤醒 CPU
   
   - PATH 需要修改为 /system/xbin
4. 点击首页右上角，选择安装，然后等待几分钟。
5. 显示 `<<< deploy`后点一下底部”启动“即可。




系统配置、使用			{#three}
====================================

### 连接

ip:22，这没啥好说的。用 android（或者自定的）连上去。

### 账户

~~上去先`sudo passwd root`重置一下 root 密码。虽然用 root 账户比较危险......~~

~~可能默认配置不允许用 root 登录，那就`apt-get install vim` 装个 vim，然后`vim /etc/ssh/sshd_config`，找到`PermitRootLogin`改成 yes。~~

`sudo apt-get install fish` fish shell 安排上

`chsh -s /usr/bin/fish` 设置为默认 shell

### 图形界面

有时候图形还是方便一点点......

`apt-get install xfce4 xfce4-goodies tightvncserver` 装 Xfce（也可以考虑 Ubuntu Mate 或者 Gnome2）、vnc

`apt-get install ttf-wqy-zenhei` 中文

`vncserver`启动，设置个密码，连上去看看（vnc viewer 用两百多k的那种绿色版就可以了，不必安装完整版），应该是一片白，就一个终端框。

`vim ~/.vnc/xstartup` 修改 vnc 配置：

```shell
#! /bin/bash
xrdb $HOME/.Xresources
startxfce4 &
```

`chmod +x ~/.vnc/xstartup`改下权限。

然后再启动应该就可以了。另外，vncserver 可以带参数，比如`vncserver -geometry 1280x720`设置分辨率。

`vncserver -kill :1` 关闭 vnc

### screen 的使用

通过 screen 可以实现进程后台运行（且能够随时恢复交互）。

`sudo apt-get install -y screen` 安装

`screen -S 自定义名称` 新建窗口

`Ctrl + A + D` 离开当前窗口

`screen -r 窗口名称或者进程 id` 回到该窗口

`kill -9` 关闭窗口

`screen -wipe` 清理窗口（内部进程自动结束了的）

### 使用 pm2 管理进程

最近一直在用这机器跑些后台任务，screen 用起来似乎并不是很方便，这里考虑使用 pm2 来管理后台的进程。
此文过长了些，放到另一篇博文中： [https://iola1999.github.io/2019/06/02/Use-pm2-To-Manage-Process](https://iola1999.github.io/2019/06/02/Use-pm2-To-Manage-Process)
