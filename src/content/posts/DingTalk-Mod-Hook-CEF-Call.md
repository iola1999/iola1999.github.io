---
title: 调戏钉钉 PC 客户端之 Hook CEF 函数调用
date: '2021-09-15T12:00:00+08:00'
category: 逆向与调试
tags: []
---

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

## 多年后复盘：当年到底卡在哪了（2026）

翻到这篇，顺着那张 Frida dump 问「为什么没成功」。把当年的内存 dump 和 CEF 源码（[4638 分支，Chromium 90，和当时时间点最接近](https://github.com/chromiumembedded/cef/blob/4638/include/internal/cef_types.h)）对着重新捋了一遍，总算能把坑讲清楚了。

当年 hook 这一步其实是成的，问题全出在改的地方不对，外加一个那时压根没意识到的坑。

### Hook 本身是成的

图里 `got testA 0x100311d0` 和 `[+] testA onEnter`，说明符号解析到了、`cef_initialize` 也被调到了。拦截没问题，错在后面那个 `Memory.writeInt`。

### 偏移 `0x28` 是瞎猜的

翻 `cef_types.h` 里 `_cef_settings_t` 的定义就清楚了。`remote_debugging_port` 是个 `int`，但它排在好几个 `cef_string_t` 路径和字符串成员后面。拿 2021 同期的 4638 布局，按 Win32（`size_t` 占 4、`cef_string_t` 占 12）数一遍：

```
0x00 size
0x04 no_sandbox
0x08 browser_subprocess_path   (cef_string_t)
0x14 framework_dir_path
0x20 main_bundle_path
0x2C chrome_runtime
0x30 multi_threaded_message_loop
...
0x6C user_agent
0x78 user_agent_product
0x84 locale
0x90 log_file
...
0xB8 locales_dir_path
0xC4 pack_loading_disabled
0xC8 remote_debugging_port   ← 真正在这
```

真实偏移在 0xC8。当年写的 0x28，落在 `main_bundle_path` 这种字符串成员上，正好就是 dump 里 `0x04~0x27` 那一排 `0x081fxxxx`、`0x0820xxxx` 堆指针的位置。端口 `9222` 写进去，等于往字符串指针区里塞了个数，调试端口压根没被设上。不管哪个版本的 `cef_settings_t`，这个端口都在一堆字符串成员后面，不可能在 0x28。

参数标签也标反了。`cef_initialize` 的签名是 `(args, settings, application, windows_sandbox_info)`，Win32 cdecl 下 Frida 的 `args[1]` 就是 settings。可上图控制台中把 `args[1]` 标成了 `main_args`、`args[2]` 标成 settings，反了。好在脚本实际改的是 `args[1]`，盯的指针没错，纯粹是标签打反。

### 真正的拦路虎：`size` 字段

这才是「偏移怎么这么难找」的根本原因，当年根本没往这想。

CEF 结构体顶部那个 `size` 字段不是摆设。它配合一个 `CEF_MEMBER_EXISTS` 宏，给每个字段做版本判断（以 master 为例）：

```c
#define CEF_MEMBER_EXISTS(s, f)                                     \
  (reinterpret_cast<char*>(&((s)->f)) -                          \
       reinterpret_cast<char*>(&((s)->size)) + sizeof((s)->f) <= \
   (s)->size)
```

意思是只有当某个字段落在 `size` 声明的范围内，CEF 才认它存在，否则按默认值走（`remote_debugging_port` 默认是 0，等于关闭）。

再看 dump，`size`（offset 0）只有 `0x28`（40），可端口字段在 0xC8 附近：

```
offsetof(remote_debugging_port) + sizeof(int) = 0xC8 + 4 = 0xCC
0xCC <= 0x28 ?  → 否
```

也就是说，就算当年侥幸把偏移找对、写到了 0xC8，CEF 也会因为 `size=0x28` 判定「这版结构体里没这个字段」，直接忽略，用默认值。要让它生效，还得把 `settings->size` 一并抬到 ≥ 0xCC。光找偏移没用，这个坑当年也想不到。

### 正路其实不该这么走

兜了一大圈才发现，CEF 自己留了后门。`remote_debugging_port` 的注释里就写着：Also configurable using the "remote-debugging-port" command-line switch。而且就算钉钉把普通命令行参数禁了（`command_line_args_disabled`），`CefApp::OnBeforeCommandLineProcessing()` 这个回调照样能塞开关进去。hook 这个回调，往里加一个 `--remote-debugging-port=9222`，比在 `cef_initialize` 里抠结构体偏移省事一百倍。当年要是知道这条，一下午就搞定了，也不会有文章里那句「我真菜」。

## 套话

折腾仅因个人兴趣，记录分享仅为研究学习交流，请勿用于违法用途。

-END-
