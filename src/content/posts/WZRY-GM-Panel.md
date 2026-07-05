---
title: 王者荣耀 GM 调试面板入口验证记录
date: '2026-06-14T20:55:00+08:00'
category: 折腾
tags:
  - 王者荣耀
  - Android
  - 逆向
  - 调试
  - cheatcode
---

> **声明：本文仅记录个人设备、本地安装包下的分析结论。本文完全为 AI 创作。**

## 结论

> **更新于 2026-06-17**：已成功在训练营中唤起 `CheatCommandBattleEntry._GMDesignDebugCommand` → 「策划属性调试」面板。

当前测试对象是王者荣耀 Android 版 `11.3.1.1`。核心发现：

- 当前版本存在**两条独立的调试入口**：
  1. 外层 `CheatCode` 配置面板 — 通过隐藏触摸暗码触发，需 patch 设备登记检查
  2. 深层「策划属性调试」面板 — 需要对局上下文 + TP 绕过 + `_GMDesignDebugCommand`
- TP (TerSafe) 反外挂可通过在选服页 patch libtprt 线程创建函数绕过，对局内不产生 crash/tombstone
- 旧截图中的 `GM指令`/`DldGMPanel`/`OpenGM` 资源链在当前版本中仍然存在（与体验服字节级同构），目前尚未成功在大厅中直接打开

---

## 一、外层 CheatCode 面板

### 触发方式

触发点在启动阶段的开场视频/启动 Dialog 上，通过屏幕四角和中心区域的隐藏触摸暗码触发：

```text
左上 -> 右上 -> 右上 -> 右下 -> 左下 -> 中心
```

暗码由 Java 层的触摸事件处理器识别。命中后内部开关置为 true，随后进入 Unity 层的 GM/Cheat 显示逻辑。

### 设备登记拦截

暗码命中后，原始流程会先进入设备登记检查并显示弹窗：

![设备未登记弹窗](/upload/images/2026-06-14-WZRY-GM-Panel/device-unregistered.png)

```text
设备未登记
请使用下列ID登记设备
否则未来会无法登录
点击确定复制
```

背后是 IL2CPP 侧的设备登记检查异步状态机，会向服务端发起 HTTP 请求验证当前设备是否在白名单中。

### 运行时 Patch

设备登记检查的异步状态机中有一个关键条件分支。在进程启动后、暗码触发前，通过 root 权限修改当前进程内存，将该分支 `nop` 掉即可绕过设备登记检查。失败路径会继续显示"设备未登记"弹窗；nop 后走成功侧清理路径，进入 CheatCode 面板。

运行时 patch 必须落在当前 PID；若应用重启，需要在新 PID 重新写入。

### 验证日志

暗码命中时，日志中出现 0~4 的区域序列以及 `m_bOpenCheat true`、`java IsShowCheatWindow true` 等开关状态变化。patch 前后的 PID 保持一致，说明 patch 和触发发生在同一进程。

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

Java 层存在用于识别隐藏触摸暗码的事件处理器和显示开关。Unity/IL2CPP 层暴露了完整的 Cheat 系统骨架，包含 `IsEnableGM()`、`OpenCheatForm()` 等关键方法。Java 暗码是第一层入口，真正的面板打开逻辑在 Unity 侧。

---

## 二、策划属性调试面板

旧截图中的完整 `GM指令`/`GM 命令列表` 界面与 CheatCode 面板属于不同分支。通过 metadata 解析发现 `CheatCommandBattleEntry` 类共 23 个方法，其中 `_GMDesignDebugCommand` 即为对局内调试面板的入口。该面板需要在对局/训练营上下文中调用（大厅中回调未注册，不会渲染 UI）。

但在对局中使用动态调试工具会被腾讯 TerSafe 反外挂检测。稳定唤起该面板需要先解决 TP 检测问题。

### TP 反外挂绕过

对局中 TerSafe（`libtersafe.so` + `libtprt.so`）会检测动态调试工具并触发进程崩溃。

**绕过思路**：TP 检测工作线程由 `libtprt.so` 中的线程创建函数启动。在选服页面通过 ptrace 冻结游戏进程，修改该创建函数的入口指令为 RET（4 字节），使检测线程永不启动。整个写入过程目标进程处于冻结状态，TP 无感知。对局中不再产生 crash/tombstone。

### 唤起方式

早期通过短时 Frida 调用验证了该面板存在，但 Frida 方案多次触发封号。根因为：

- **Frida 本身是 TP 的检测目标**：frida-agent.so（~8MB）注入后驻留进程、frida-server 监听端口，TP 存在多条独立的检测路径
- 封号链路：TP 检测到异常 → 触发进程崩溃 → tombstone 上报 → 服务器标记

最终改为**原生探针注入**：编译一个微型 .so（9KB），通过 ptrace 注入到游戏进程，constructor 中调用 IL2CPP 的 `runtime_invoke` 唤起面板后立即退出。无后台进程、无网络端口、无长期内存驻留。

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

目前未能在大厅中直接打开该资源链——需要 UGC/Pandora app exposure 或特定对局上下文，是独立于 CheatCode 和策划属性调试面板的第三条面板分支。

---

## 三、工具与后续

### 关键脚本

分析过程中产出的关键脚本，均位于 `tools/runtime/`：

| 脚本 | 用途 |
|------|------|
| `open_sgame_cheatcode_panel_root.sh` | 启动阶段 patch + 暗码触发 CheatCode 面板 |
| `sgame_tp_race_patch.sh` | ptrace 安全 patch libtprt，阻止 TP 检测线程启动 |
| `sgame_frida_cheatbattle_invoke.py` | Frida 短时调用 CheatCommandBattleEntry 方法 |
| `sgame_ptrace_memrw.cpp` | ptrace 安全内存读写（编译为 ARM64 设备二进制） |
| `sgame_metadata_index.py` | global-metadata.dat 解析，方法/类型/token 索引 |
| `sgame_qtsvfs_gm_blocks.py` | QtsVFS 资源块解析 |
| `sgame_qtsvfs_compare_blocks.py` | 正式服/体验服资源块字节级对比 |

设备侧工具路径：`/data/adb/.sgame_diag/`。

### 后续待补充

- [x] 训练营中唤起「策划属性调试」面板 ✅
- [x] TP 反外挂绕过（libtprt patch + ptrace 安全写入）✅
- [ ] `_GMBluePrintFrameCommand`（5 参数）蓝图调试面板
- [ ] `SendCommand`（7 参数）对局内调试命令发送
- [ ] 「策划属性调试」面板 Canvas 缩放适配（当前 UI 偏小）
- [ ] 旧截图 `DldGMPanel` / `OpenGM` 资源链的完整唤起路径
- [ ] `CCheatSystem.OpenCheatForm()` 是否还可单独强拉旧版命令列表
- [ ] 当前版本 GM 命令资源和旧截图命令列表的差异
