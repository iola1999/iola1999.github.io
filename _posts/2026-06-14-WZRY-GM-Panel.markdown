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

当前测试对象是王者荣耀 Android 版 `11.3.1.1`。结论如下：

- 当前版本存在两条调试入口：外层 `CheatCode` 配置面板（通过隐藏触摸暗码触发）和深层「策划属性调试」面板（`CheatCommandBattleEntry._GMDesignDebugCommand`）。
- `CheatCode` 面板需要在启动阶段 patch 设备登记检查后才能进入。
- 「策划属性调试」面板**需要在训练营/对局上下文中才能唤起**（大厅中回调未注册，不会渲染 UI）。
- TP (TerSafe) 反外挂可在对局中通过 ptrace + 内存 patch 绕过，不产生 crash/tombstone。

## 触发方式

触发点在启动阶段的开场视频/启动 Dialog 上。暗码大致是按屏幕四角和中心区域组合点击：

```text
左上 -> 右上 -> 右上 -> 右下 -> 左下 -> 中心
```

暗码触发成功后，内部开关会被置为开启状态，随后进入 Unity 层的 GM/Cheat 显示逻辑。

## 设备登记拦截

原始流程中，暗码命中后会显示设备登记弹窗：

![设备未登记弹窗](/upload/images/2026-06-14-WZRY-GM-Panel/device-unregistered.png)

弹窗文案如下：

```text
设备未登记
请使用下列ID登记设备
否则未来会无法登录
点击确定复制
```

点击“复制”后，弹窗关闭，游戏继续走正常加载流程。

运行时抓到的请求路径是：

```text
POST /api/checkauth HTTP/1.1
Host: sgame-test.native.qq.com
```

请求头中会带上当前设备的 `macaddr`、`token`、`nonce`、`version` 等字段。这个检查对应 IL2CPP 侧的 `CheckMacAddressInWhiteList` 异步状态机。

## 运行时 Patch

设备登记检查对应的关键函数是：

```text
<CheckMacAddressInWhiteList>d__9.MoveNext
```

复现方式是在进程启动后、暗码触发前，用 root 权限直接改当前进程内存。关键分支位于 `libil2cpp.so` 基址加 `0x5f6a334`：

```text
RVA: 0x5f6a334
原始指令: 75 04 00 36   ; tbz w21,#0, failure
Patch:    1f 20 03 d5   ; nop
```

该分支的失败路径会继续显示“设备未登记”弹窗；patch 为 `nop` 后会走成功侧的清理路径，从而进入 Cheat 窗口显示流程。

这里有一个容易踩坑的点：运行时 patch 必须落在当前 PID；脚本若重启应用，需要在新 PID 重新写入 patch。稳定复现流程是：

```text
启动应用
等待 libil2cpp.so 映射完成
计算 patch_addr = libil2cpp_base + 0x5f6a334
写入 NOP
在开场视频阶段输入隐藏触摸暗码
```

## 验证日志

暗码命中时，启动日志里能看到 0 到 4 的区域序列，以及 Java 层开关被打开：

```text
screen width= ... height=... delta=... y=...
ShowVideo
print 0
print 1
print 1
print 2
print 3
print 4
m_bOpenCheat true
java IsShowCheatWindow true
```

这里的 `print 0/1/2/3/4` 对应暗码区域，`m_bOpenCheat true` 表示暗码完整命中，`java IsShowCheatWindow true` 表示 Java 层显示 GM/Cheat 窗口的开关已被置位。

本次成功复现时的运行时 patch 输出类似这样：

```text
patch addr=0x74249bb334 len=4 before=75 04 00 36 after=1f 20 03 d5
pid_before: 29286
pid_after:  29286
base:       0x741ea51000
patch:      0x74249bb334
```

`pid_before` 和 `pid_after` 一致，说明 patch 和触发发生在同一进程；后续日志出现 `java IsShowCheatWindow true`，界面进入 `CheatCode` 面板。

## 当前面板

成功绕过设备登记检查后，当前版本拉起的是 `CheatCode` 面板：

![CheatCode 面板](/upload/images/2026-06-14-WZRY-GM-Panel/cheatcode-panel.png)

可见项目包括：

- `TVersion`
- `废弃 Tdir(mtcls)`
- `清空缓存`
- `清空Prefs`
- `清空Http缓存`
- `离线云控配置`
- `显示缓存目录`
- `显示出错文件`
- `CachePatchSwitch`
- `QtsLibVerboseLog`
- `关闭所有SDK`
- `启用网络诊断工具`
- `启用网络加速`
- `pandora测试环境`
- `强制使用Limited声音`
- `禁用FormPreload`
- `Wwise不hookQts`
- `启用AudioService`

该面板偏配置/环境调试。旧截图中 `GM指令`、`ROOT / 工具 /`、大量 GM 命令按钮等界面，应属于另一条面板分支。

## TP 反外挂绕过

训练营场景下，腾讯 TerSafe 反外挂（`libtersafe.so` + `libtprt.so`）会在大约 59 秒内检测到 Frida server 并触发进程崩溃（SIGBUS/SIGSEGV 跳近空地址）。

### 检测机制

TP 在运行时会解包一个 RWX 匿名内存页（称为 anon_03，大小 `0x37000` = 220KB），包含完整的检测引擎代码。检测内容包括：

- `/proc/self/maps` 扫描（查 libinput.so 注入、Magisk 等）
- XLua/Xposed hook 检测
- 模拟器检测（libhoudini）
- Frida 相关检测（Agent 字符串特征）

### 绕过方式

anon_03 页**没有完整性自校验**。将代码段全部覆盖为 RET 指令即可使所有检测线程立即返回，不会触发崩溃：

```bash
# 准备 RET 数据文件
python3 -c "open('/tmp/rf','wb').write(b'\xc0\x03\x5f\xd6'*(0x36000//4))"
adb push /tmp/rf /data/adb/.sgame_diag/.ret

# 在训练营中通过 ptrace 安全写入（目标进程冻结期间写入，TP 无感知）
/data/adb/.sgame_diag/.ksafed64 full <PID> <anon_03_code_addr> /data/adb/.sgame_diag/.ret
```

ptrace ATTACH → pwrite64 写入 → ptrace DETACH 的方式参考了社区 injtool 的安全写内存模式，进程在写入期间完全冻结，规避了直接 `dd` 写 `/proc/pid/mem` 可能触发的检测。

## 「策划属性调试」面板

### 唤起方式

通过 Frida 调用 `CheatCommandBattleEntry._GMDesignDebugCommand`（argc=0）：

```python
# 在训练营中执行
import frida
session = frida.get_usb_device().attach(PID)
# 通过 il2cpp_runtime_invoke 调用 CheatCommandBattleEntry._GMDesignDebugCommand
```

短时 Frida（启动 → 调用 → 杀 server，<30 秒）+ 已完成的 TP 补丁 = 安全唤起。

### 面板截图

![策划属性调试面板](/upload/images/2026-06-14-WZRY-GM-Panel/design-attribute-debug.png)

标题为「策划属性调试」，包含大量分类按钮菜单。该面板偏对局内属性/数值调试，UI 使用独立的 Canvas 渲染，可能在非标准分辨率下缩放偏小。

### 方法列表

通过 metadata 解析确认 `CheatCommandBattleEntry` 共有 23 个方法，已测试的关键方法：

| 方法 | argc | 大厅 | 训练营 |
|------|------|------|--------|
| `_GMDesignDebugCommand` | 0 | 返回对象，无 UI | **弹出「策划属性调试」面板** |
| `_GMBluePrintFrameCommand` | 5 | — | 蓝图调试（待测试） |
| `SendCommand` | 7 | — | 发送调试命令（待测试） |
| `StartHighlightAutoToolFunc` | 0 | **异常** | 返回正常 |
| `IsPVECoop` | 0 | true | true |
| `SetKillNotifyText` | 1 | 正常执行 | — |
| `RemoveAll` | 0 | void | void |
| `ResetSkinIds` | 0 | — | void |

### 与 CheatCode 面板的关系

两条入口相互独立：

- **CheatCode 面板**：配置/环境调试，在启动阶段通过隐藏触摸暗码触发
- **策划属性调试面板**：对局内属性/数值调试，需在训练营/对局上下文中通过 `_GMDesignDebugCommand` 唤起

旧截图中包含 `GM指令`、`DldGMPanel`、`OpenGM` 等字符串的资源块（5165_0.db）在当前版本中**仍然存在且与体验服字节级同构**，但目前未能在大厅中直接打开——该资源链需要 UGC/Pandora app exposure 或特定对局上下文，属于另一条独立的面板分支。


## 方法暴露

Java 层的入口比较清楚：

- `SmobaEx.TestEvent(...)` 负责识别启动阶段的隐藏触摸暗码。
- `SGameUtility.g_ShowCheatWindow` 是 Java 层的显示开关。
- `SGameUtility.IsShowCheatWindow()` 会读取这个开关，并被 Unity/Native 侧查询。

Unity/IL2CPP 层仍然暴露了完整的 Cheat 系统骨架：

- `Assets.Scripts.GameSystem.CCheatSystem`
- `CCheatSystem.IsEnableGM()`：`public static`
- `CCheatSystem.IsAutoOpenCheatForm()`：`public static`
- `CCheatSystem.OpenCheatTriggerForm(...)`：`public` 实例方法
- `CCheatSystem.CloseCheatTriggerForm()`：`public` 实例方法
- `CCheatSystem.OpenCheatForm()`：`public` 实例方法

这说明 Java 暗码只是第一层入口，真正的面板打开逻辑在 Unity 的 `CCheatSystem` 里。设备登记状态是第一道明显 gate；继续强拉旧版完整 `GM指令` 面板，需要继续确认 `CCheatSystem` 实例、GM 开关返回值和面板资源分支。

## 资源痕迹

当前版本仍能看到 GM/Cheat 系统、GM 命令注册、命令历史、GM 面板资源等相关痕迹。资源包中也还保留了 `GM指令`、`GM_IsEnableGM` 等字符串。

旧截图中的部分具体命令文案在当前版本里直接命中率较低，说明这个面板相比旧版本应该已经调整过，或者有一部分命令资源只在特定环境下加载。

简单创建调试开关文件或 GM 目录不足以拉起完整面板，说明入口并非单纯由本地明文开关控制。

## 工具记录

辅助工具侧主要做了三件事：

- 用进程内字符串扫描确认“设备未登记”文案只在 metadata 映射中直接命中，活跃 `Il2CppString` 引用不足以作为可靠 patch 点。
- 用指针范围扫描定位 `/api/checkauth` 请求块，确认设备登记检查实际发起过请求。
- 用 `pyelftools + capstone` 按 program header 做小窗口反汇编，定位 `MoveNext` 里的结果分支。

设备侧 patch 工具路径：`/data/adb/.sgame_diag/`。

## 后续待补充

- [x] 训练营中唤起「策划属性调试」面板（`_GMDesignDebugCommand`）✅
- [x] TP 反外挂绕过（ptrace + anon_03 补丁）✅
- [ ] `_GMBluePrintFrameCommand`（5 参数）蓝图调试面板
- [ ] `SendCommand`（7 参数）对局内调试命令发送
- [ ] 「策划属性调试」面板的 Canvas 缩放适配（当前 UI 偏小）
- [ ] 旧截图 `DldGMPanel` / `OpenGM` 资源链的完整唤起路径
- [ ] `CCheatSystem.OpenCheatForm()` 是否还可单独强拉旧版命令列表
- [ ] 当前版本 GM 命令资源和旧截图命令列表的差异
