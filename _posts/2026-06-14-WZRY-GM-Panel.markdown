---
layout: post
title: 王者荣耀 GM 调试面板入口验证记录
date: 2026-06-14 20:55:00 +0800
categories: 折腾
tag: [王者荣耀, Android, 逆向, 调试, cheatcode]
---

* content
{:toc}


> **声明：本文仅记录个人设备、本地安装包和授权调试环境下的分析结论。本文完全为 AI 创作。**

## 结论

> **更新于 2026-06-17**：已成功在训练营中唤起 `CheatCommandBattleEntry._GMDesignDebugCommand` → 「策划属性调试」面板。

当前测试对象是王者荣耀 Android 版 `11.3.1.1`。核心发现：

- 当前版本存在**两条独立的调试入口**：
  1. 外层 `CheatCode` 配置面板 — 通过隐藏触摸暗码触发，需 patch 设备登记检查
  2. 深层「策划属性调试」面板 — 需要对局上下文 + TP 绕过 + `_GMDesignDebugCommand`
- TP (TerSafe) 反外挂可在对局中通过 ptrace + anon_03 内存 patch 绕过，不产生 crash/tombstone
- 旧截图中的 `GM指令`/`DldGMPanel`/`OpenGM` 资源链在当前版本中仍然存在（与体验服字节级同构），目前尚未成功在大厅中直接打开

---

## 一、外层 CheatCode 面板

### 触发方式

触发点在启动阶段的开场视频/启动 Dialog 上，通过屏幕四角和中心区域的隐藏触摸暗码触发：

```text
左上 -> 右上 -> 右上 -> 右下 -> 左下 -> 中心
```

暗码由 Java 层 `com.tencent.tmgp.Common.SmobaEx.TestEvent` 识别。命中后内部开关 `m_bOpenCheat` 置为 true，随后进入 Unity 层的 GM/Cheat 显示逻辑。

### 设备登记拦截

暗码命中后，原始流程会先进入设备登记检查并显示弹窗：

![设备未登记弹窗](/upload/images/2026-06-14-WZRY-GM-Panel/device-unregistered.png)

```text
设备未登记
请使用下列ID登记设备
否则未来会无法登录
点击确定复制
```

背后是 IL2CPP 侧的 `CheckMacAddressInWhiteList` 异步状态机，对应请求：

```text
POST /api/checkauth HTTP/1.1
Host: sgame-test.native.qq.com
```

请求头中带 `macaddr`、`token`、`nonce`、`version` 等字段。

### 运行时 Patch

关键分支位于 `<CheckMacAddressInWhiteList>d__9.MoveNext`，RVA `0x5f6a334`：

```text
RVA: 0x5f6a334
原始指令: 75 04 00 36   ; tbz w21,#0, failure
Patch:    1f 20 03 d5   ; nop
```

失败路径会继续显示"设备未登记"弹窗；nop 后走成功侧清理路径，进入 CheatCode 面板。

稳定复现流程：

```text
启动应用
等待 libil2cpp.so 映射完成
计算 patch_addr = libil2cpp_base + 0x5f6a334
写入 NOP
在开场视频阶段输入隐藏触摸暗码
```

注意：运行时 patch 必须落在当前 PID；脚本若重启应用，需要在新 PID 重新写入。

### 验证日志

暗码命中时，日志中出现 0~4 的区域序列以及开关状态：

```text
print 0
print 1
print 1
print 2
print 3
print 4
m_bOpenCheat true
java IsShowCheatWindow true
```

成功复现时的 patch 输出：

```text
patch addr=0x74249bb334 len=4 before=75 04 00 36 after=1f 20 03 d5
pid_before: 29286
pid_after:  29286
base:       0x741ea51000
```

`pid_before` 和 `pid_after` 一致，说明 patch 和触发发生在同一进程。

### CheatCode 面板

![CheatCode 面板](/upload/images/2026-06-14-WZRY-GM-Panel/cheatcode-panel.png)

该面板偏配置/环境调试，可见项目包括：

- `TVersion` / `废弃 Tdir(mtcls)`
- `清空缓存` / `清空Prefs` / `清空Http缓存`
- `离线云控配置` / `显示缓存目录` / `显示出错文件`
- `CachePatchSwitch` / `QtsLibVerboseLog` / `关闭所有SDK`
- `启用网络诊断工具` / `启用网络加速`
- `pandora测试环境` / `强制使用Limited声音`
- `禁用FormPreload` / `Wwise不hookQts` / `启用AudioService`

### 方法暴露

Java 层入口：

- `SmobaEx.TestEvent(...)` — 识别隐藏触摸暗码
- `SGameUtility.g_ShowCheatWindow` — 显示开关
- `SGameUtility.IsShowCheatWindow()` — 被 Unity/Native 查询

Unity/IL2CPP 层：

- `CCheatSystem.IsEnableGM()` — `public static`
- `CCheatSystem.IsAutoOpenCheatForm()` — `public static`
- `CCheatSystem.OpenCheatTriggerForm(...)` — `public` 实例方法
- `CCheatSystem.CloseCheatTriggerForm()` — `public` 实例方法
- `CCheatSystem.OpenCheatForm()` — `public` 实例方法

Java 暗码是第一层入口，真正的面板打开逻辑在 Unity 的 `CCheatSystem` 里；设备登记状态是第一道明显 gate。

---

## 二、策划属性调试面板

旧截图中的完整 `GM指令`/`GM 命令列表` 界面与 CheatCode 面板属于不同分支。通过 metadata 解析发现 `CheatCommandBattleEntry` 类共 23 个方法，其中 `_GMDesignDebugCommand` 即为对局内调试面板的入口。该面板需要在对局/训练营上下文中调用（大厅中回调未注册，不会渲染 UI）。

但在对局中使用动态调试工具会被腾讯 TerSafe 反外挂检测。稳定唤起该面板需要先解决 TP 检测问题。

### TP 反外挂绕过

训练营场景下，TerSafe（`libtersafe.so` + `libtprt.so`）会在大约 59 秒内检测到 Frida server 并触发进程崩溃（SIGBUS/SIGSEGV，跳近空地址）。

**检测机制**：TP 在运行时会解包一个 RWX 匿名内存页（称为 anon_03，大小 `0x37000` = 220KB），包含完整的检测引擎代码：

- `/proc/self/maps` 扫描（查 libinput.so 注入、Magisk 等）
- XLua/Xposed hook 检测
- 模拟器检测（libhoudini）
- Frida 相关检测（Agent 字符串特征）

**绕过方式**：anon_03 页**没有完整性自校验**。将代码段全部覆盖为 RET 指令即可使所有检测线程立即返回：

```bash
# 准备 RET 数据文件
python3 -c "open('/tmp/rf','wb').write(b'\xc0\x03\x5f\xd6'*(0x36000//4))"
adb push /tmp/rf /data/adb/.sgame_diag/.ret

# 在对局中通过 ptrace 安全写入（目标进程冻结期间写入，TP 无感知）
/data/adb/.sgame_diag/.ksafed64 full <PID> <anon_03_code_addr> /data/adb/.sgame_diag/.ret
```

`ptrace ATTACH → pwrite64 → ptrace DETACH` 的方式参考了社区 injtool 的安全写内存模式，进程在写入期间完全冻结，规避了直接 `dd` 写 `/proc/pid/mem` 可能触发的检测。

### 唤起方式

早期通过短时 Frida 调用验证了该面板存在，但 Frida 方案多次触发封号。根因为：

- **Frida 本身是 TP 的检测目标**：frida-agent.so（~8MB）注入后驻留进程、frida-server 监听端口，TP 有独立于 anon_03 的检测路径
- 封号链路：TP 检测到异常 → 触发进程崩溃 → tombstone 上报 → 服务器标记

最终改为**原生探针注入**：编译一个微型 .so（9KB），通过 ptrace 注入到游戏进程，constructor 中调用 `il2cpp_runtime_invoke` 唤起面板后立即退出。无后台进程、无网络端口、无长期内存驻留：

```bash
# 编译
aarch64-linux-android30-clang++ -std=c++17 -O2 -shared \
    -o libcheatbattle_native.so sgame_cheatbattle_native_probe.cpp

# 注入（替换 <PID>）
adb push libcheatbattle_native.so /data/user/0/<pkg>/files/.qv/
adb shell "su -c 'vpost_injector --pid <PID> --lib /data/user/0/<pkg>/files/.qv/libcb_native.so'"
```

| | Frida 方案 | 原生探针 |
|------|------|------|
| 注入物 | frida-agent.so (~8MB) | 自定义 .so (9KB) |
| 后台进程 | frida-server 常驻 | 无 |
| 网络端口 | 27042 | 无 |
| 内存驻留 | 长期 | constructor 执行完即退出 |
| 封号风险 | **高（已确认两次）** | 待验证，大幅降低 |

### 面板截图

**训练营**：

![策划属性调试面板-训练营](/upload/images/2026-06-14-WZRY-GM-Panel/design-attribute-debug.png)

**离线单机模式**：

![策划属性调试面板-离线](/upload/images/2026-06-14-WZRY-GM-Panel/offline-design-debug.png)

**原生探针注入**（无 Frida，9KB so，constructor 执行完即退出）：

![策划属性调试面板-原生探针](/upload/images/2026-06-14-WZRY-GM-Panel/native-probe-panel.png)

标题为「策划属性调试」，包含大量分类按钮菜单。该面板偏对局内属性/数值调试，UI 使用独立的 Canvas 渲染，在非标准分辨率下缩放偏小（已知问题，Canvas `set_scaleFactor` 方法已定位，待后续适配）。

### 方法列表

`CheatCommandBattleEntry` 通过 metadata 确认共 23 个方法，已测试的关键方法：

| 方法 | argc | 大厅 | 训练营 |
|------|------|------|--------|
| `_GMDesignDebugCommand` | 0 | 返回对象，无 UI | **弹出「策划属性调试」面板** |
| `_GMBluePrintFrameCommand` | 5 | — | 蓝图调试面板（待测试） |
| `SendCommand` | 7 | — | 发送调试命令（待测试） |
| `StartHighlightAutoToolFunc` | 0 | **异常** | 返回正常 |
| `IsPVECoop` | 0 | true | true |
| `SetKillNotifyText` | 1 | 正常执行 | — |
| `RemoveAll` | 0 | void | void |
| `ResetSkinIds` | 0 | — | void |

### 资源痕迹：旧 GM 命令列表

旧截图中包含 `GM指令`、`DldGMPanel`、`OpenGM` 等字符串的资源块（`5165_0.db`）在当前版本中**仍然存在且与体验服字节级同构**。当前版本能看到的 GM/Cheat 系统、GM 命令注册、命令历史等资源痕迹也佐证了这一点。

目前未能在大厅中直接打开该资源链——需要 UGC/Pandora app exposure 或特定对局上下文，属于独立于 CheatCode 和策划属性调试面板之外的第三条面板分支。

---

## 三、工具与后续

### 关键脚本

分析过程中产出的关键脚本，均位于 `tools/runtime/`：

| 脚本 | 用途 |
|------|------|
| `open_sgame_cheatcode_panel_root.sh` | 启动阶段 patch + 暗码触发 CheatCode 面板 |
| `sgame_tp_race_patch.sh` | 竞速等待 anon_03 出现并 ptrace 安全打补丁 |
| `sgame_frida_cheatbattle_invoke.py` | Frida 短时调用 CheatCommandBattleEntry 方法 |
| `sgame_ptrace_memrw.cpp` | ptrace 安全内存读写（编译为 ARM64 设备二进制） |
| `sgame_metadata_index.py` | global-metadata.dat 解析，方法/类型/token 索引 |
| `sgame_qtsvfs_gm_blocks.py` | QtsVFS 资源块解析 |
| `sgame_qtsvfs_compare_blocks.py` | 正式服/体验服资源块字节级对比 |

设备侧工具路径：`/data/adb/.sgame_diag/`。

### 后续待补充

- [x] 训练营中唤起「策划属性调试」面板 ✅
- [x] TP 反外挂绕过（ptrace + anon_03 补丁）✅
- [ ] `_GMBluePrintFrameCommand`（5 参数）蓝图调试面板
- [ ] `SendCommand`（7 参数）对局内调试命令发送
- [ ] 「策划属性调试」面板 Canvas 缩放适配（当前 UI 偏小）
- [ ] 旧截图 `DldGMPanel` / `OpenGM` 资源链的完整唤起路径
- [ ] `CCheatSystem.OpenCheatForm()` 是否还可单独强拉旧版命令列表
- [ ] 当前版本 GM 命令资源和旧截图命令列表的差异
