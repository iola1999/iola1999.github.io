---
title: 再谈如何愉快地使用钉钉
date: '2026-06-18T20:00:00+08:00'
category: 折腾
tags:
  - 钉钉
  - macOS
  - Objective-C++
  - Hook
---

> **声明：本文包含 AI 辅助创作。**
>
> 折腾仅因个人兴趣，记录分享仅为研究学习交流，请勿用于违法用途。

## 起因

接着 [如何愉快地使用钉钉](/2023/05/27/How-to-use-DingTalk-happily/) 那篇往下写。上次留了个尾巴：「如何不让别人看自己的已读状态」那节，我只放了几个参考链接，这次把 macOS 客户端上的完整实现补上。

直接的触发点是最近刷屏的《置身钉内》。里面有段话：

> 钉钉的基因，从诞生的第一天起，就是永远站在「发信人」立场……为什么卡片里的消息一定要算已读，为什么系统要主动把事推到用户面前，很多答案，都可以回到这个原点。

发消息的人那边，「已读」是省心；收消息的人这边，它有时候就是一只盯着你的眼睛。改不了产品站在哪边，那就只能从客户端这一侧想办法，给自己留一点「装没看见」的余地。遇到难回答的问题，至少还有不说话的机会。

## 原理

钉钉的已读状态由客户端主动上报。点开会话后，客户端会发送消息状态 RPC，服务器更新状态，再把结果同步给其他设备和消息发送方。

本文采用运行时注入：只有通过启动脚本拉起的进程会加载 hook，普通启动保持原生行为。

## 真实调用链

当前版本会发送两类消息状态请求：

```text
/r/IDLMessageStatus/updateToViewV2
/r/IDLMessageStatus/updateToReadV2
```

一次点开会话通常先上报 View，再上报 Read。完整链路是：

```text
用户点开会话
  -> 业务层生成消息状态 Request
  -> wukong::lwp::UserAgent::sendRequest
  -> GaeaMac LWP RPC
  -> /r/IDLMessageStatus/updateToViewV2
  -> /r/IDLMessageStatus/updateToReadV2
  -> 服务器更新消息状态
```

这里使用钉钉自己的 LWP RPC，统一发送层位于 GaeaMac。

主程序从 `GaeaMac.framework` 动态导入下面这个函数：

```text
wukong::lwp::UserAgent::sendRequest(
    std::shared_ptr<wukong::lwp::Request>,
    std::shared_ptr<wukong::lwp::RequestContext>)
```

因此可以用 fishhook 替换主程序的导入指针，在请求进入 GaeaMac 之前读取 `requestLine`。命中 Read/View 状态路径时直接返回，其余 RPC 调回原函数继续发送。

这个 hook 修改的是当前进程里的动态导入指针，代码页和安装包内容保持原样。退出进程后，运行时修改自然消失。

## 文件结构

准备四个文件：

```text
dingtalk-read/
├── fishhook.c
├── fishhook.h
├── noread_hook.mm
└── launch_noread.sh
```

`fishhook.c` 和 `fishhook.h` 来自 [facebook/fishhook](https://github.com/facebook/fishhook)，本文项目目录中已经附带。

## Hook 源码

新建 `noread_hook.mm`：

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

这段代码有两个运行模式：

- `observe`：记录消息状态 RPC，再调用原函数发送。
- `block`：记录并丢弃 Read/View 状态 RPC，其余请求照常发送。

## 启动脚本

新建 `launch_noread.sh`：

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

脚本做四件事：

1. 根据源码时间自动编译 `dingtalk_noread.dylib`。
2. 给 dylib 做 ad-hoc 签名。
3. 应用更新后自动恢复注入所需的 entitlement。
4. 通过 `DYLD_INSERT_LIBRARIES` 启动并写入独立日志。

重签命令固定为：

```bash
codesign --force --sign - --options runtime \
    --entitlements .entitlements.plist \
    /Applications/DingTalk.app
```

这条命令保留 hardened runtime，并保持内嵌 framework 的官方签名。

## 使用方式

给脚本添加执行权限：

```bash
chmod +x launch_noread.sh
```

启动拦截模式：

```bash
./launch_noread.sh
```

查看请求但保留原生行为：

```bash
./launch_noread.sh observe
```

实时查看日志：

```bash
tail -f noread.log
```

## 日志判读

注入成功时首先出现：

```text
[NoRead] loaded mode=block rebind=0 original=0x11f1fe158 requestLine=0x11f1bb374
```

点开会话后会看到：

```text
[NoRead] SEEN #1 /r/IDLMessageStatus/updateToViewV2
[NoRead] BLOCKED #1 /r/IDLMessageStatus/updateToViewV2
[NoRead] SEEN #2 /r/IDLMessageStatus/updateToReadV2
[NoRead] BLOCKED #2 /r/IDLMessageStatus/updateToReadV2
```

其中：

- `rebind=0` 表示 fishhook 注册成功。
- `original` 有地址表示已拿到原始发送函数。
- `requestLine` 有地址表示可以读取 LWP 请求路径。
- `BLOCKED` 表示请求在进入 GaeaMac 之前已经被丢弃。

## 验证

先记录启动时间，然后在客户端点开一个新的未读会话。日志中应出现 Read/View 的 `BLOCKED` 记录。

从当前进程打开的文件中定位原生 `gaea.log`：

```bash
PID=$(pgrep -f '/Applications/.+\.app/Contents/MacOS/DingTalk' | head -1)
LOG=$(lsof -p "$PID" | awk '/gaea\.log/{print $9}' | tail -1)
echo "$LOG"
```

检查注入启动后的真实发送记录：

```bash
grep -E 'send request request_line=/r/IDLMessageStatus/updateTo(Read|View)' \
    "$LOG" | tail -20
```

注入日志记录 `BLOCKED`，原生 RPC 日志保持在启动前的最后一条，说明请求已经停在 `wukong::lwp::UserAgent::sendRequest` 这一层。

还可以用同账号的另一台设备做状态对照：电脑端点开新的未读会话后，另一台设备继续保留未读状态。

## 普通启动

退出当前注入进程后，直接从 Applications 或 Dock 启动钉钉，进程会按原生逻辑运行。

命令行方式：

```bash
open /Applications/DingTalk.app
```

## 版本更新

客户端更新后，继续运行同一个启动脚本。脚本会重新读取当前 entitlements、编译 dylib，并完成注入启动。

若 GaeaMac 的 C++ 符号在新版本中发生变化，启动日志里的 `original` 或 `requestLine` 会变成空地址。此时重新用 `nm` 确认两个导出符号即可：

```bash
APP=/Applications/DingTalk.app
BIN="$APP/Contents/MacOS/DingTalk"
GAEA="$APP/Contents/Frameworks/GaeaMac.framework/Versions/A/GaeaMac"

nm -arch arm64 -m "$BIN" 2>/dev/null | c++filt |
    grep 'wukong::lwp::UserAgent::sendRequest'

nm -arch arm64 "$GAEA" 2>/dev/null |
    grep '__ZNK4gaea3lwp7Request11requestLineEv'
```

## 套话

本文基于个人设备、个人账号和官方安装的 macOS 客户端。逆向、调试与 Hook 均用于研究客户端运行机制，请勿用于违法用途。

-END-
