---
layout: post
title: 王者荣耀 GM 调试面板入口验证记录
date: 2026-06-14 20:55:00 +0800
categories: 折腾
tag: [王者荣耀, Android, 逆向, 调试]
---

* content
{:toc}


> **声明：本文仅记录个人设备、本地安装包和授权调试环境下的分析结论。本文完全为 AI 创作。**

## 结论

当前测试对象是王者荣耀 Android 版 `11.3.1.1`。结论如下：

- 当前版本仍保留 GM/Cheat 相关入口。
- 入口需要在启动阶段通过隐藏触摸暗码触发。
- 暗码命中后先进入“设备未登记”检查。
- root 环境早期 patch 设备登记检查后，可以拉起当前版本的 `CheatCode` 调试面板。
- `CheatCode` 偏配置/环境切换；旧截图里的完整 `GM指令` 命令列表仍需继续定位。

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

- `CheatCode` 面板和旧截图 `GM指令` 面板之间的跳转关系。
- `CCheatSystem.OpenCheatForm()` 是否还可单独强拉旧版命令列表。
- `GM_IsEnableGM`、`IsEnableGM()`、`IsAutoOpenCheatForm()` 等开关的最终判定路径。
- 当前版本 GM 命令资源和旧截图命令列表的差异。
