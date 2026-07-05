---
title: 再谈如何愉快地使用钉钉
date: '2026-06-18T20:00:00+08:00'
category: 折腾
tags:
  - 钉钉
  - macOS
  - 逆向
  - ObjC
  - Hook
---

> **声明：本文包含 AI 辅助创作。**
>
> 折腾仅因个人兴趣，记录分享仅为研究学习交流，请勿用于违法用途。

> 2026-06-29 更新：修正了重签名步骤。初版里我图省事用了 `--deep`，它会把 app 内嵌的 framework 连带重签成 ad-hoc，系统更新后触发签名加载失败、整个客户端双击都打不开了。已改为只重签主可执行文件、补 `--options runtime`，详见方案 B。

## 起因

接着 [如何愉快地使用钉钉](/2023/05/27/How-to-use-DingTalk-happily/) 那篇往下写。上次留了个尾巴：「如何不让别人看自己的已读状态」那节，我偷懒只甩了俩链接没展开。这次把它补上。

直接的触发点是最近刷屏的《置身钉内》。里面有段话：

> 钉钉的基因，从诞生的第一天起，就是永远站在「发信人」立场……为什么卡片里的消息一定要算已读，为什么系统要主动把事推到用户面前，很多答案，都可以回到这个原点。

发消息的人那边，「已读」是省心；收消息的人这边，它有时候就是一只盯着你的眼睛。改不了产品站在哪边，那就只能从客户端这一侧想办法，给自己留一点「装没看见」的余地。遇到难回答的问题，至少还有不说话的机会。

## 原理

已读回执的流程很朴素：

```text
你点开消息 → 客户端调用 updateToRead 接口 → 服务器更新状态 → 对方看到「已读」
```

缺口在第一步和第二步之间，别让 `updateToRead` 这个请求发出去就行。下面两套方案，一套硬改二进制，一套运行时注入。

## 前置分析

主二进制是 `DingTalk.app/Contents/MacOS/DingTalk`，一个 Universal Binary（x86_64 + arm64）。先用 `strings` 摸一遍：

```bash
strings /Applications/DingTalk.app/Contents/MacOS/DingTalk | grep -i "updateToRead"
```

能定位到这些东西：

| 类型 | 内容 |
|------|------|
| API 路径 | `/r/IDLMessageStatus/updateToRead` |
| API 路径 | `/r/IDLMessageStatus/updateToReadV2` |
| ObjC 方法 | `-[DTMojoMessageService updateToRead:mids:uuid:completionHandler:]` |
| C++ 函数 | `dtbiz::im::DTMessageServiceImplStd::BatchUpdateToReadImplV2` |
| 日志字符串 | `DTMessage::BatchUpdateToReadImplV2, will call updateToRead, messageIds.size = ` |

理出来的调用链：

```text
用户点开消息
  → DTMojoMessageService -updateToRead:mids:uuid:completionHandler:   (ObjC 桥接层)
    → DTMessageServiceImplStd::BatchUpdateToReadImplV2                (C++ 业务逻辑)
      → HTTP POST /r/IDLMessageStatus/updateToReadV2                  (网络请求)
        → 服务器标记消息为已读
```

从上到下任意一刀切断都能达成目的，区别只是哪一刀更省事、更不容易被察觉。

再看一眼 entitlements：

```bash
codesign -d --entitlements :- /Applications/DingTalk.app 2>&1
```

跟本文相关的两条：

| Entitlement | 值 | 含义 |
|---|---|---|
| `allow-dyld-environment-variables` | `true` | 允许 DYLD 环境变量注入（方案 B 的前提） |
| `disable-library-validation` | `false` | 库校验没关，要重签名才能塞第三方 dylib |

方案 B 会用到，先记下。顺手把原始 entitlements 导出存成文件，后面两个方案重签都要用：

```bash
codesign -d --entitlements :- /Applications/DingTalk.app > entitlements.plist 2>/dev/null
```

这份文件别手敲。钉钉的 entitlements 有二十多项，漏一项都可能让某些功能哑掉。直接从官方签名导出来用，改动越少越稳。方案 A 重签原样用这份；方案 B 只需把 `com.apple.security.cs.disable-library-validation` 一项翻成 `true`，其余不动：

```bash
plutil -replace com.apple.security.cs.disable-library-validation -bool true entitlements.plist
```

---

## 方案 A：Patch 二进制

### 原理

最暴力的思路。直接改二进制里的 `/r/IDLMessageStatus/updateToRead` 字符串，把 `Read` 里某个字母改掉（比如 `Read` → `Xead`），路径就变成一个不存在的地址。服务器路由匹配不上，已读状态纹丝不动。

### 优缺点

优点是简单粗暴，只动几个字节，不用额外文件。缺点：路径改坏之后服务器会返回错误响应，客户端收到异常可能误判成断线，连累正常消息收发。

### 步骤

#### 1. 备份原始二进制

```bash
cp /Applications/DingTalk.app/Contents/MacOS/DingTalk ./DingTalk.backup
```

这步千万别省，patch 错了还能救回来。

#### 2. 定位字符串偏移

```python
data = open('/Applications/DingTalk.app/Contents/MacOS/DingTalk', 'rb').read()
for pattern in [b'/r/IDLMessageStatus/updateToRead\x00',
                b'/r/IDLMessageStatus/updateToReadV2\x00']:
    start = 0
    while True:
        idx = data.find(pattern, start)
        if idx == -1: break
        print(f'Found at offset 0x{idx:08x}: {pattern[:-1].decode()}')
        start = idx + 1
```

因为是 Universal Binary，每个字符串都会出现两组，分别属于 x86_64 和 arm64：

```text
Found at offset 0x0980350e: /r/IDLMessageStatus/updateToRead
Found at offset 0x09803573: /r/IDLMessageStatus/updateToReadV2
Found at offset 0x1a6bc0d8: /r/IDLMessageStatus/updateToRead
Found at offset 0x1a6bc13d: /r/IDLMessageStatus/updateToReadV2
```

#### 3. Patch 字符串

把每处 `Read` 里的 `R`（`0x52`）改成 `X`（`0x58`），长度不变，不会破坏字符串表对齐：

```python
#!/usr/bin/env python3
"""patch_dingtalk.py - 修改钉钉已读回执 API 路径"""
import sys

target = '/Applications/DingTalk.app/Contents/MacOS/DingTalk'
needle = b'/r/IDLMessageStatus/updateToRead'

with open(target, 'rb') as f:
    data = bytearray(f.read())

count = 0
start = 0
while True:
    idx = data.find(needle, start)
    if idx == -1:
        break
    # 'R' in 'Read' is at offset 28 from string start
    r_pos = idx + 28
    if data[r_pos] == 0x52:  # 'R'
        data[r_pos] = 0x58   # 'X'
        count += 1
        tag = data[idx:idx+35].split(b'\x00')[0].decode()
        print(f'Patched offset 0x{r_pos:08x}: {tag}')
    start = idx + 1

if count == 0:
    print('No matching strings found. Already patched or wrong binary?')
    sys.exit(1)

with open(target, 'wb') as f:
    f.write(data)

print(f'\nDone. Patched {count} occurrence(s).')
print('Now run: codesign --force --sign - --options runtime --entitlements entitlements.plist /Applications/DingTalk.app')
```

#### 4. 重签名

改完二进制原签名就废了，重签一下。方案 A 不注入 dylib，不用动 `disable-library-validation`，直接用前置分析里导出的那份原始 `entitlements.plist`：

```bash
codesign --force --sign - --options runtime \
    --entitlements entitlements.plist \
    /Applications/DingTalk.app
```

同样别用 `--deep`，它会连带把内嵌 framework 改成 ad-hoc，某次系统更新后随时触发加载失败、整个客户端打不开。这条坑的细节见方案 B 的警告框。`--options runtime` 则是补回 hardened runtime 标志。

#### 5. 还原

```bash
cp ./DingTalk.backup /Applications/DingTalk.app/Contents/MacOS/DingTalk
codesign --force --sign - --options runtime \
    --entitlements entitlements.plist \
    /Applications/DingTalk.app
```

---

## 方案 B：DYLD 注入 Hook

这套比 A 干净，推荐。

### 原理

macOS 的 `DYLD_INSERT_LIBRARIES` 能在进程启动时塞一个自定义 dylib 进去。这个 dylib 在 constructor 里用 ObjC Runtime 的 `method_setImplementation`，把 `DTMojoMessageService` 的 `updateToRead:mids:uuid:completionHandler:` 换成自己的实现。新实现啥也不干，调一下 success callback 就 return，请求根本不发出去。

比方案 A 好在三处：不 patch 二进制字节，改的是运行时内存（唯一动静是为放下 dylib，把主二进制重签一下——但只签这一层、不碰内嵌 framework，远没 A 的逐字节破坏那么重），不跑注入脚本就回到原生已读行为；请求没出门，服务器不会回错误；还能用 `NSLog` 把每次拦截打出来，心里有数。

调用链拦截点：

```text
用户点开消息
  → DTMojoMessageService -updateToRead:mids:uuid:completionHandler:
    ↑ 在这里拦住，直接 return，后面全部跳过
    ✗ DTMessageServiceImplStd::BatchUpdateToReadImplV2  (不会被调用)
      ✗ HTTP POST /r/IDLMessageStatus/updateToReadV2    (不会发出)
```

### 完整代码：noread_hook.m

```objc
// noread_hook.m
// DYLD 注入 hook：拦截钉钉已读回执，实现「偷看消息不已读」
// 编译：clang -dynamiclib -arch arm64 -framework Foundation -o noread_hook.dylib noread_hook.m
// 如果是 Intel Mac，将 arm64 改为 x86_64；也可以用 -arch arm64 -arch x86_64 编译通用版本
#import <Foundation/Foundation.h>
#import <objc/runtime.h>

static IMP sOriginalUpdateToRead = NULL;

// 替换后的方法实现：直接调用 success callback，跳过网络请求
static void HookedUpdateToRead(id self, SEL _cmd, id cid, id mids, id uuid,
                                id completionHandler) {
    NSLog(@"[NoRead] Blocked updateToRead — cid: %@, message count: %lu",
          cid, (unsigned long)[mids count]);

    // completionHandler 是 success block (void(^)(void))
    // 直接调用它，让调用方认为已读回执已成功发送
    if (completionHandler) {
        void (^successBlock)(void) = completionHandler;
        successBlock();
    }
}

__attribute__((constructor))
static void NoReadHookInit(void) {
    NSLog(@"[NoRead] Initializing hook...");

    // 1. 查找目标类
    Class cls = NSClassFromString(@"DTMojoMessageService");
    if (!cls) {
        // 子进程（如 prelaunch、Tblive）中没有这个类，属正常现象
        NSLog(@"[NoRead] DTMojoMessageService not found in this process, skipping.");
        return;
    }

    // 2. 查找目标方法
    SEL sel = NSSelectorFromString(@"updateToRead:mids:uuid:completionHandler:");
    Method method = class_getInstanceMethod(cls, sel);
    if (!method) {
        NSLog(@"[NoRead] Target method not found, skipping.");
        return;
    }

    // 3. 替换实现
    sOriginalUpdateToRead = method_setImplementation(method, (IMP)HookedUpdateToRead);
    NSLog(@"[NoRead] Hook installed. Original IMP: %p", sOriginalUpdateToRead);
}
```

那段「子进程里没有这个类属正常现象」的注释：钉钉会拉起一堆 `prelaunch`、`Tblive` 之类的辅助进程，它们压根没加载 `DTMojoMessageService`，hook 在它们里 return 掉就行，别让 constructor 抛异常。

### 编译

```bash
# Apple Silicon
clang -dynamiclib -arch arm64 -framework Foundation -o noread_hook.dylib noread_hook.m

# Intel Mac
clang -dynamiclib -arch x86_64 -framework Foundation -o noread_hook.dylib noread_hook.m

# 通用版本（两种架构都支持）
clang -dynamiclib -arch arm64 -arch x86_64 -framework Foundation -o noread_hook.dylib noread_hook.m
```

### 签名与注入准备

前面记下的 `disable-library-validation=false` 在这儿，钉钉默认不加载第三方签名的 dylib。得先把 App 重签，把这一项改成 `true`。

#### 1. 准备 entitlements.plist

就用前置分析里导出的那份 `entitlements.plist`，把 `disable-library-validation` 一项翻成 `true`，其余一律不动：

```bash
plutil -replace com.apple.security.cs.disable-library-validation -bool true entitlements.plist
```

还没导出的话，导出加翻转一步到位：

```bash
codesign -d --entitlements :- /Applications/DingTalk.app 2>/dev/null > entitlements.plist
plutil -replace com.apple.security.cs.disable-library-validation -bool true entitlements.plist
```

还是那句，别手敲。二十多项 entitlement，漏一项就可能让功能哑掉。从官方签名导出再改，最稳。

#### 2. 重签名 App

先给结论——**别用 `--deep`**，这条命令才是对的：

```bash
codesign --force --sign - --options runtime \
    --entitlements entitlements.plist \
    /Applications/DingTalk.app
```

> ⚠️ **关于 `--deep`，我踩过一个很痛的坑。**
> 文章初版我图省事写了 `codesign --force --deep --sign -`。`--deep` 会把 app 里二十多个内嵌 framework 连带 ad-hoc 重签，顺手抹掉它们原本的 Team ID 和公证信息。重签当天一切正常，十来天后系统更新收紧了对 ad-hoc loadable code 的 mmap 校验，`Masonry.framework`、`QtNetwork.framework` 一个接一个加载失败，`dyld` 报 `code signing blocked mmap()`——**整个钉钉双击都打不开了**，最后只能重装。
>
> 教训：注入第三方 dylib 只需要重签**主可执行文件**这一层、翻一个 entitlement 就够。内嵌 framework 的官方签名千万别碰，所以不用 `--deep`。`--options runtime` 是把 hardened runtime 标志补回来——原签名带这个标志，重签不补会丢。

重签完顺手验证一下：主二进制应是 `adhoc,runtime`，framework 仍是原厂的 `runtime` + Team ID（凡是 framework 被改成 ad-hoc，就是签错位置了）：

```bash
# 主二进制：adhoc + runtime
codesign -dvvv /Applications/DingTalk.app/Contents/MacOS/DingTalk 2>&1 | grep flags
# 期望：flags=0x10002(adhoc,runtime)

# framework：仍是官方签名，没被动过
codesign -dvvv /Applications/DingTalk.app/Contents/Frameworks/Masonry.framework 2>&1 | grep -E "flags|TeamIdentifier"
# 期望：flags=0x10000(runtime)，TeamIdentifier 仍有值
```

#### 3. 签名 dylib

```bash
codesign --force --sign - noread_hook.dylib
```

### 使用

#### 启动脚本 launch_noread.sh

```bash
#!/bin/bash
DYLIB_PATH="$(cd "$(dirname "$0")" && pwd)/noread_hook.dylib"

if [ ! -f "$DYLIB_PATH" ]; then
    echo "Error: dylib not found at $DYLIB_PATH"
    exit 1
fi

echo "Launching DingTalk with NoRead hook..."
DYLD_INSERT_LIBRARIES="$DYLIB_PATH" /Applications/DingTalk.app/Contents/MacOS/DingTalk
```

```bash
chmod +x launch_noread.sh
./launch_noread.sh
```

#### 预期日志输出

启动时：

```text
[NoRead] Initializing hook...
[NoRead] Hook installed. Original IMP: 0x1058e3b08
```

查看消息时：

```text
[NoRead] Blocked updateToRead — cid: cid1234567, message count: 3
```

子进程（正常，可忽略）：

```text
[NoRead] DTMojoMessageService not found in this process, skipping.
```

不想从终端启动也行，用 macOS 的 `log` 命令实时过滤：

```bash
log stream --predicate 'message contains "NoRead"'
```

### 还原

要分两层：

- **只关掉 hook**：不用终端注入脚本，正常双击启动即可，dylib 不会被加载，已读回执恢复原状。注入本身就是运行时行为，不跑就不生效。
- **恢复官方签名**：方案 B 为了放下 dylib 已经把主二进制 ad-hoc 重签、改了 entitlements。没有钉钉的开发者证书，没法手工签回官方签名——要么等钉钉自动更新覆盖（新版会带官方签名盖回去），要么干脆重装。在此之前 app 能正常用，只是签名栏变成了「自己签的」。

`hook` 这层随时能开关，底子干不干净取决于你介意不介意签名那栏。

## 套话

本文基于个人设备、个人账号、官方已安装的 macOS 钉钉客户端。不涉及破解软件分发、绕过账号鉴权，也没有攻击服务端或动别人数据。

逆向、调试、Hook 都只该在你自己拥有、收发双方都是你自己的设备上做。拦掉已读回执，改的是你自己这台机器上客户端的行为，别给组织或上级隐瞒本该知悉的工作信息，也别用来规避正常的工作协同。

折腾仅因个人兴趣，记录分享只为研究学习交流，请勿用于违法用途。

-END-
