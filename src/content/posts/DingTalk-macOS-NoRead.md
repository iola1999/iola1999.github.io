---
title: 再谈如何愉快地使用钉钉
seoTitle: macOS 钉钉客户端拦截已读回执上报：fishhook 动态库注入实现
date: '2026-06-18T20:00:00+08:00'
description: 分析 macOS 版钉钉客户端 GaeaMac.framework 的 LWP RPC 消息状态上报链路，使用 fishhook 重绑定 sendRequest 符号按需拦截 updateToReadV2 与 updateToViewV2 已读回执。
category: 折腾
tags:
  - 钉钉
  - macOS
  - 逆向
  - Objective-C++
  - Hook
---

> **声明：本文包含 AI 辅助创作。**
>
> 折腾仅因个人兴趣，记录分享仅为研究学习交流，请勿用于违法用途。

## 前言

这篇接着三年前那篇 [如何愉快地使用钉钉](/2023/05/27/How-to-use-DingTalk-happily/) 往下写。当时聊到「如何不让别人看自己的已读状态」这一节时，我只在文末留了几个移动端模块的参考链接，没有展开桌面端的处理办法。趁着最近重新梳理了一下新版本的二进制结构，这次把 macOS 客户端上的完整实现补齐。

前段时间网上传播很广的那篇《置身钉内》里有一段话让我印象很深。

> 钉钉的基因，从诞生的第一天起，就是永远站在「发信人」立场……为什么卡片里的消息一定要算已读，为什么系统要主动把事推到用户面前，很多答案，都可以回到这个原点。

平心而论，我自己作为发消息的人时，也挺喜欢盯着那个「已读」状态看；可一旦反过来轮到自己收消息，这两个字带来的催促感就让人不太自在。既然没法改变软件的产品取向，我就只能从本地客户端这一侧动手，给自己留一点点看消息但暂时不表态的缓冲余地。遇到一时半会儿不好直接回复的问题，至少可以先点进去把上下文看完，构思好怎么答复之后再切回正常模式。

## 钉钉消息已读上报的调用链与拦截点

钉钉的消息已读状态完全由客户端在用户点开会话时主动向服务端上报。我们在界面上点进一个带有未读红点的会话窗口后，客户端会生成对应的消息状态变更 RPC 请求发给服务器，服务器落库更新状态后，再把「已读」回执同步给发送方以及同一账号下的其他在线设备。

只要不在磁盘上直接修改应用程序本体，最干净的方案就是做运行时的按需动态库注入。平时通过专门的启动脚本拉起钉钉进程时自动挂载拦截逻辑；需要恢复正常已读上报时，直接退出进程并从系统的 Dock 栏或 `Applications` 目录重新点开图标即可，两种模式互不干扰。

在当前的 macOS 版本里，点开一个未读会话会先后触发 `/r/IDLMessageStatus/updateToViewV2` 和 `/r/IDLMessageStatus/updateToReadV2` 两类状态请求，发送顺序固定是先上报 `View` 再上报 `Read`。顺着二进制里的符号引用链往下追，整条上报路径非常清晰。

```text
用户点开会话
  -> 业务层生成消息状态 Request
  -> wukong::lwp::UserAgent::sendRequest
  -> GaeaMac LWP RPC
  -> /r/IDLMessageStatus/updateToViewV2
  -> /r/IDLMessageStatus/updateToReadV2
  -> 服务器更新消息状态
```

客户端内部所有这类业务请求走的都是钉钉自研的 LWP RPC 通道，最终统一汇总进底层的 `GaeaMac.framework`。翻看主程序的动态符号导入表可以看到，主二进制直接从 `GaeaMac.framework` 动态导入了 `wukong::lwp::UserAgent::sendRequest` 这个核心发送函数。

```text
wukong::lwp::UserAgent::sendRequest(
    std::shared_ptr<wukong::lwp::Request>,
    std::shared_ptr<wukong::lwp::RequestContext>)
```

既然这是一个跨 Mach-O 镜像的外部导入符号，我们根本不需要去动底层的机器码指令，直接用 `fishhook` 重绑定主程序里的动态导入表指针，就能在请求真正进入 `GaeaMac` 之前把它拦下来。在替换后的函数里，我们先调一次基类的 `requestLine()` 读出当前 RPC 的请求路径，一旦命中上述 `Read` 或 `View` 相关的状态更新接口就直接原地返回，其余正常的收发消息与业务 RPC 则原封不动地转交给原始的 `sendRequest` 函数继续执行。因为整个过程只改写了当前进程内存里的符号指针，既不触碰可执行文件的代码页，也不改动安装包里的任何框架文件，进程一退出修改就随之消失。

## 编写鱼钩注入动态库与启动脚本

整个工程目录的结构非常精简，一共只需要准备四个文件。其中 `fishhook.c` 和 `fishhook.h` 直接取自开源的 [facebook/fishhook](https://github.com/facebook/fishhook) 仓库，另外两个文件分别是负责符号重绑定的 `noread_hook.mm` 和负责自动编译、签名与拉起进程的 `launch_noread.sh`。

```text
dingtalk-read/
├── fishhook.c
├── fishhook.h
├── noread_hook.mm
└── launch_noread.sh
```

先来看核心的拦截代码 `noread_hook.mm`。在这份代码里，我们通过环境变量 `NOREAD_MODE` 区分了两种运行模式，设为 `observe` 时只把捕获到的消息状态 RPC 路径写进日志文件并照常放行，设为 `block` 时则会在记录日志的同时直接丢弃 `Read` 与 `View` 状态上报请求。完整源码如下。

```objective-c++
// noread_hook.mm
// Hook DingTalk's Wukong LWP request layer through its imported symbol.

#include "fishhook.h"

#include <dlfcn.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>

#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <utility>

namespace gaea::lwp {
class Request;
}

namespace wukong::lwp {
class UserAgent;
class Request;
class RequestContext;
}

namespace {

constexpr const char *kSendRequestSymbol =
    "_ZN6wukong3lwp9UserAgent11sendRequestENSt3__110shared_ptrINS0_7RequestEEENS3_INS0_14RequestContextEEE";
constexpr const char *kRequestLineSymbol =
    "_ZNK4gaea3lwp7Request11requestLineEv";

constexpr const char *kReadV1 = "/r/IDLMessageStatus/updateToRead";
constexpr const char *kReadV2 = "/r/IDLMessageStatus/updateToReadV2";
constexpr const char *kViewV1 = "/r/IDLMessageStatus/updateToView";
constexpr const char *kViewV2 = "/r/IDLMessageStatus/updateToViewV2";
constexpr const char *kViewByEntrance =
    "/r/IDLMessageStatus/updateToViewByEntranceCid";

using SendRequestFn = void (*)(
    wukong::lwp::UserAgent *,
    std::shared_ptr<wukong::lwp::Request>,
    std::shared_ptr<wukong::lwp::RequestContext>);
using RequestLineFn = const std::string &(*)(const gaea::lwp::Request *);

SendRequestFn gOriginalSendRequest = nullptr;
RequestLineFn gRequestLine = nullptr;
std::mutex gLogMutex;
std::atomic<unsigned long> gSeenCount{0};
std::atomic<unsigned long> gBlockedCount{0};
bool gBlockMode = false;

const char *logPath() {
    const char *path = getenv("NOREAD_LOG");
    return path && path[0] ? path : "/tmp/dingtalk-noread.log";
}

void logLine(const char *format, ...) {
    std::lock_guard<std::mutex> lock(gLogMutex);
    FILE *file = fopen(logPath(), "a");
    if (!file) return;

    va_list args;
    va_start(args, format);
    vfprintf(file, format, args);
    va_end(args);
    fflush(file);
    fclose(file);
}

bool isMessageStatusUpdate(const std::string &requestLine) {
    return requestLine == kReadV1 || requestLine == kReadV2 ||
           requestLine == kViewV1 || requestLine == kViewV2 ||
           requestLine == kViewByEntrance;
}

void hookedSendRequest(
    wukong::lwp::UserAgent *self,
    std::shared_ptr<wukong::lwp::Request> request,
    std::shared_ptr<wukong::lwp::RequestContext> context) {
    const char *requestLineText = "(unavailable)";
    bool shouldBlock = false;

    if (request && gRequestLine) {
        // wukong::lwp::Request derives from gaea::lwp::Request. The base
        // subobject is at offset zero in the current GaeaMac build.
        const auto *gaeaRequest =
            reinterpret_cast<const gaea::lwp::Request *>(request.get());
        const std::string &requestLine = gRequestLine(gaeaRequest);
        requestLineText = requestLine.c_str();
        shouldBlock = isMessageStatusUpdate(requestLine);

        if (requestLine.find("/r/IDLMessageStatus/") != std::string::npos) {
            const unsigned long seen = ++gSeenCount;
            logLine("[NoRead] SEEN #%lu %s\n", seen, requestLineText);
        }
    }

    if (gBlockMode && shouldBlock) {
        const unsigned long blocked = ++gBlockedCount;
        logLine("[NoRead] BLOCKED #%lu %s\n", blocked, requestLineText);
        return;
    }

    if (gOriginalSendRequest) {
        gOriginalSendRequest(self, std::move(request), std::move(context));
    }
}

}  // namespace

__attribute__((constructor)) static void initializeNoReadHook() {
    const char *mode = getenv("NOREAD_MODE");
    gBlockMode = mode && std::string(mode) == "block";

    gRequestLine = reinterpret_cast<RequestLineFn>(
        dlsym(RTLD_DEFAULT, kRequestLineSymbol));

    struct rebinding binding = {
        kSendRequestSymbol,
        reinterpret_cast<void *>(hookedSendRequest),
        reinterpret_cast<void **>(&gOriginalSendRequest),
    };
    const int result = rebind_symbols(&binding, 1);

    logLine(
        "[NoRead] loaded mode=%s rebind=%d original=%p requestLine=%p\n",
        gBlockMode ? "block" : "observe",
        result,
        reinterpret_cast<void *>(gOriginalSendRequest),
        reinterpret_cast<void *>(gRequestLine));
}
```

写好动态库源码后，再配一份启动脚本 `launch_noread.sh` 把编译、重签名和环境变量注入串起来。脚本在每次执行时会先对比源码与产物的时间戳，按需编译生成 `dingtalk_noread.dylib` 并完成 ad-hoc 签名；同时它还会检查当前 `/Applications/DingTalk.app` 的权限声明（entitlements），如果遇到钉钉客户端自动更新后官方签名把 `com.apple.security.cs.disable-library-validation` 重新关掉了，脚本会自动导出当前权限表、把这一项改成 `True`，再用保留 Hardened Runtime 且不动内嵌 Framework 官方签名的方式重签外层应用，最后通过 `DYLD_INSERT_LIBRARIES` 启动进程。

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

APP="/Applications/DingTalk.app"
BIN="$APP/Contents/MacOS/DingTalk"
DYLIB="$SCRIPT_DIR/dingtalk_noread.dylib"
SOURCE="$SCRIPT_DIR/noread_hook.mm"
FISHHOOK_C="$SCRIPT_DIR/fishhook.c"
FISHHOOK_H="$SCRIPT_DIR/fishhook.h"
ENTITLEMENTS="$SCRIPT_DIR/.entitlements.plist"
LOG="$SCRIPT_DIR/noread.log"
MODE="${1:-block}"

if [ "$MODE" != "observe" ] && [ "$MODE" != "block" ]; then
    echo "Usage: $0 [observe|block]" >&2
    exit 1
fi

for file in "$BIN" "$SOURCE" "$FISHHOOK_C" "$FISHHOOK_H"; do
    if [ ! -e "$file" ]; then
        echo "Missing: $file" >&2
        exit 1
    fi
done

command -v clang >/dev/null
command -v clang++ >/dev/null
command -v codesign >/dev/null

NEED_BUILD=0
if [ ! -f "$DYLIB" ]; then
    NEED_BUILD=1
elif [ "$SOURCE" -nt "$DYLIB" ] ||
     [ "$FISHHOOK_C" -nt "$DYLIB" ] ||
     [ "$FISHHOOK_H" -nt "$DYLIB" ]; then
    NEED_BUILD=1
fi

if [ "$NEED_BUILD" = "1" ]; then
    BUILD_DIR=$(mktemp -d)
    trap 'rm -rf "$BUILD_DIR"' EXIT

    clang -c -arch arm64 -O2 -Wall -Wextra \
        -o "$BUILD_DIR/fishhook.o" "$FISHHOOK_C"

    clang++ -dynamiclib -arch arm64 -std=c++17 \
        -framework Foundation \
        -O2 -Wall -Wextra -Wno-deprecated-declarations \
        -o "$DYLIB" "$SOURCE" "$BUILD_DIR/fishhook.o"

    rm -rf "$BUILD_DIR"
    trap - EXIT
fi

codesign --force --sign - "$DYLIB" >/dev/null 2>&1

# 钉钉更新后官方签名会恢复 disable-library-validation。启动脚本读取当前
# entitlements，只翻转这一项，然后按 hardened runtime 方式重签 App 主层。
CURRENT_ENTITLEMENTS=$(mktemp)
codesign -d --entitlements :- "$BIN" \
    > "$CURRENT_ENTITLEMENTS" 2>/dev/null || true

LIBRARY_VALIDATION=$(
    grep -oE 'com\.apple\.security\.cs\.disable-library-validation</key><(true|false)/>' \
        "$CURRENT_ENTITLEMENTS" |
    grep -oE '(true|false)/>' |
    tr -d '/' || true
)
rm -f "$CURRENT_ENTITLEMENTS"

if [ "$LIBRARY_VALIDATION" != "true" ]; then
    codesign -d --entitlements :- "$APP" \
        > "$ENTITLEMENTS" 2>/dev/null

    python3 - "$ENTITLEMENTS" <<'PY'
import plistlib
import sys

path = sys.argv[1]
with open(path, 'rb') as source:
    entitlements = plistlib.load(source)

entitlements['com.apple.security.cs.disable-library-validation'] = True

with open(path, 'wb') as target:
    plistlib.dump(entitlements, target)
PY

    codesign --force --sign - --options runtime \
        --entitlements "$ENTITLEMENTS" \
        "$APP"
fi

: > "$LOG"
{
    echo "[launch_noread] starting @ $(date '+%F %T')"
    echo "[launch_noread] app   = $APP"
    echo "[launch_noread] dylib = $DYLIB"
    echo "[launch_noread] mode  = $MODE"
} >> "$LOG"

(
    cd "$APP/Contents/MacOS"
    exec env \
        NOREAD_MODE="$MODE" \
        NOREAD_LOG="$LOG" \
        DYLD_INSERT_LIBRARIES="$DYLIB" \
        "$BIN"
) >> "$LOG" 2>&1 &

PID=$!
echo "[launch_noread] pid=$PID" >> "$LOG"
echo "DingTalk started: pid=$PID, mode=$MODE"
echo "Log: $LOG"
```

## 实机运行、日志判读与双端验证

第一次运行前先执行 `chmod +x launch_noread.sh` 赋好可执行权限。平时需要开启已读拦截时直接运行 `./launch_noread.sh`，如果只想观察请求路径而不拦截原生上报，则传参运行 `./launch_noread.sh observe`，另一个终端窗口里随时可以用 `tail -f noread.log` 盯着实时输出。

动态库成功注入进程后，日志文件开头会先打印一行初始化状态。

```text
[NoRead] loaded mode=block rebind=0 original=0x11f1fe158 requestLine=0x11f1bb374
```

这行日志里的三个关键字段都能直接用来判断挂载是否正常。`rebind=0` 代表 `fishhook` 完成了导入表重绑定，`original` 带有非空指针地址代表已经顺利拿到了原始的 `sendRequest` 函数入口，而 `requestLine` 非空则代表读取 LWP 请求路径的方法符号也解析无误。此时再去客户端界面随便点开一个带未读消息的会话，日志里就会成对刷出 `SEEN` 与 `BLOCKED` 记录，表明两条状态更新请求已经在进入 `GaeaMac` 之前被原地丢弃。

```text
[NoRead] SEEN #1 /r/IDLMessageStatus/updateToViewV2
[NoRead] BLOCKED #1 /r/IDLMessageStatus/updateToViewV2
[NoRead] SEEN #2 /r/IDLMessageStatus/updateToReadV2
[NoRead] BLOCKED #2 /r/IDLMessageStatus/updateToReadV2
```

为了进一步确认被拦截的请求确实没有漏进底层网络栈，我们还可以拿钉钉自身的原生 `gaea.log` 做交叉验证。先记录下注入进程的启动时间并点开一个新会话，然后通过 `lsof` 从当前钉钉进程打开的文件句柄里捞出 `gaea.log` 的实际路径，再用 `grep` 检索状态上报记录。

```bash
PID=$(pgrep -f '/Applications/.+\.app/Contents/MacOS/DingTalk' | head -1)
LOG=$(lsof -p "$PID" | awk '/gaea\.log/{print $9}' | tail -1)
echo "$LOG"

grep -E 'send request request_line=/r/IDLMessageStatus/updateTo(Read|View)' \
    "$LOG" | tail -20
```

只要我们的 `noread.log` 里持续增加 `BLOCKED` 计数，而原生 `gaea.log` 里的最后一条 `updateToRead` 或 `updateToView` 时间戳依然停留在注入启动之前，就说明请求确实在 `wukong::lwp::UserAgent::sendRequest` 这一层被彻底截停了。最直观的验收办法是同时在手机上登录同一个钉钉账号，当电脑端挨个点开未读会话把消息内容看完之后，手机端对应的会话列表依然稳稳地挂着未读红点。

## 尾声

平时用完拦截模式想要恢复正常已读回执时，直接退出当前进程，再通过 Dock 栏或者命令行 `open /Applications/DingTalk.app` 普通启动即可。遇到钉钉客户端大版本升级也不用手动重配，直接再跑一次 `./launch_noread.sh`，脚本就会自动重新提取权限表、补签并拉起新进程。

万一将来某个版本重构了 `GaeaMac` 的 C++ 命名空间或函数签名，启动日志里的 `original` 或 `requestLine` 指针就会变成 `0x0`。碰到这种情况，只需要对主程序和 `GaeaMac` 二进制跑一遍下面的 `nm` 检索命令，把新的修饰符号名更新回 `noread_hook.mm` 就能继续使用。

```bash
APP=/Applications/DingTalk.app
BIN="$APP/Contents/MacOS/DingTalk"
GAEA="$APP/Contents/Frameworks/GaeaMac.framework/Versions/A/GaeaMac"

nm -arch arm64 -m "$BIN" 2>/dev/null | c++filt |
    grep 'wukong::lwp::UserAgent::sendRequest'

nm -arch arm64 "$GAEA" 2>/dev/null |
    grep '__ZNK4gaea3lwp7Request11requestLineEv'
```

最后照例提醒一下，本文记录的所有逆向分析、符号重绑定与验证均在个人设备和个人账号以及官方安装的 macOS 客户端上完成。相关技术细节仅供安全研究与客户端机制交流，请勿用于修改他人数据或规避正常的工作协作要求。
