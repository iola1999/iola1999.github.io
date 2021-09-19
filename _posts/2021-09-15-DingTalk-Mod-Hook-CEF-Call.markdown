---
layout: post
title:  调戏钉钉 PC 客户端之 Hook CEF 函数调用
date:  2021-09-15 12:00:00 +0800
categories: 逆向与调试
tag: 
typora-root-url: ..
---

* content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.DingTalk-Mod-Hook-CEF-Call)
## 书接上回

在之前[调试钉钉 PC 客户端](https://678234.xyz/2021/01/21/DingTalk-mod/)中，文末提到了没能成功通过命令行参数启用 CEF 调试。昨天研究[调戏飞书 PC 客户端](https://678234.xyz/2021/09/14/Debug-Feishu-PC/)时，仔细看了一下 CEF 的调试开启方法，想到一个新的思路，趁午休测试一下记录下来。

## 准备

+ [钉钉PC版安装包](https://page.dingtalk.com/wow/dingtalk/act/download)
+ Frida

## 大致思路

查阅文档，初始化 CEF 时是调用 `libcef.cef_initialize`，源码位置`https://github.com/chromiumembedded/cef/blob/master/libcef_dll/libcef_dll.cc#L84`。

传入参数 `settings` 定义在：`https://github.com/chromiumembedded/cef/blob/master/include/internal/cef_types.h#L154`。

其中参数 `command_line_args_disabled` 可以禁用命令行参数，不过钉钉大概不是这种方式禁用的，可能是不向子进程传递参数来实现的。不过今天的重点不是这里，而是 `remote_debugging_port`参数，设置它即可启用远程调试。

今天的思路是尝试 Hook 钉钉对 `libcef.dll` 的调用，修改这个参数。这里选择 Frida 这个 Hook 框架来实现。

## 准备 Frida

依赖 Python 环境，`pip install frida frida-tools`

## 尝试 Hook CEF 初始化调用

使用 JavaScript 编写 Hook 脚本，俺也是中午现学现卖，以下仅供参考：

```javascript
let testA;
let timer = setInterval(() => {
    hookCEF();	// 只能想到这种方式了，及时 hook 到 CEF 的初始化调用
}, 10);

function hookCEF() {
    testA = Module.findExportByName("libcef.dll", "cef_initialize");
    if (!testA) {
        return;
    }
    clearInterval(timer);
    console.log("got testA", testA);
    Interceptor.attach(testA, {
        onEnter: function (args, state) {
            console.log("[+] testA onEnter");
            console.log("¦- context: ", JSON.stringify(this.context));
            // console.log("¦- _cef_main_args_t*: ", args[1]);
            // console.log("¦- _cef_settings_t*: ", args[2]);
            console.log("¦- testRead args[1]");
            console.log(Memory.readByteArray(args[1], 256));

            console.log("¦- modfiy debug port");
            let tryPortAddr = args[1].add(ptr("0x28"));
            Memory.writeInt(tryPortAddr, 9222);

            console.log("¦- testRead args[1]");
            console.log(Memory.readByteArray(args[1], 256));
        },

        onLeave: function () {
            console.log("[+] testA onLeave");
        },
    });
}
```

使用 `frida path-toDingTalk.exe -l path-to-hook.js --no-pause` 来启动。

惭愧，C++ 学艺不精，已经忘完了，中午的进展也仅限于此了，暂且记录一下。

![image-20210915171007267](/upload/images/2021-09-15-DingTalk-Mod-Hook-CEF-Call/hook-demo1.png)

20210919 update: 

又看了一下午，这个偏移量怎么这么难找......我真菜。

还想到一个方案：自行编译 CEF，硬编码这个调试端口。

## 套话

折腾仅因个人兴趣，记录分享仅为研究学习交流，请勿用于违法用途。

-END-
