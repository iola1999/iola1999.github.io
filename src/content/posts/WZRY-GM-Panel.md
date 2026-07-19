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

> 声明：本文只记录个人设备和本地安装包上的分析结果，初稿由 AI 生成。

## 结论

> 2026-06-17 更新：训练营中已能通过 `CheatCommandBattleEntry._GMDesignDebugCommand` 唤起「策划属性调试」面板。

测试对象是王者荣耀 Android 版 `11.3.1.1`。目前确认了两条调试入口：

1. 外层 `CheatCode` 配置面板，通过隐藏触摸暗码触发，还要 patch 设备登记检查。
2. 对局内的「策划属性调试」面板，需要先处理 TP 检测，再调用 `_GMDesignDebugCommand`。

在选服页 patch `libtprt` 的线程创建函数后，进入对局没有再产生 crash 或 tombstone。旧截图里的 `GM指令`、`DldGMPanel` 和 `OpenGM` 资源也还在，内容与体验服字节级一致；大厅中的直接入口暂时没找到。

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

弹窗背后是 IL2CPP 侧的异步状态机。它会向服务端发 HTTP 请求，检查当前设备是否在白名单中。

### 运行时 Patch

设备登记状态机里有一个条件分支。进程启动后、输入暗码前，用 root 权限修改当前进程内存，把这个分支 `nop` 掉，流程就会走成功侧的清理路径并打开 CheatCode 面板。保留原指令时，流程会显示“设备未登记”弹窗。

运行时 patch 只对当前 PID 生效。应用重启后，要给新 PID 再写一次。

### 验证日志

暗码命中时，日志会打印 0~4 的区域序列，`m_bOpenCheat` 和 `java IsShowCheatWindow` 也会变成 `true`。patch 前后的 PID 一致，可以确认内存修改与暗码触发发生在同一进程。

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

Java 层负责识别触摸暗码并切换显示开关。Unity/IL2CPP 层能找到 `IsEnableGM()`、`OpenCheatForm()` 等 Cheat 方法，面板也由这一层真正打开。

---

## 二、策划属性调试面板

旧截图里的 `GM指令` / `GM 命令列表` 界面走另一条分支。解析 metadata 后，`CheatCommandBattleEntry` 类一共能找到 23 个方法，`_GMDesignDebugCommand` 会打开对局内调试面板。这个方法要在对局或训练营中调用；大厅没有注册回调，拿到返回对象也不会渲染 UI。

对局中使用动态调试工具会触发腾讯 TerSafe 检测，所以调用面板前还得先处理 TP。

### TP 反外挂绕过

对局中 TerSafe（`libtersafe.so` + `libtprt.so`）会检测动态调试工具并触发进程崩溃。

TP 检测线程由 `libtprt.so` 里的线程创建函数启动。我的做法是在选服页用 ptrace 冻结游戏进程，把该函数入口的 4 字节指令改成 RET。写入期间目标进程一直处于冻结状态，恢复运行后检测线程不会启动。这样进对局时没有再出现 crash 或 tombstone。

### 唤起方式

一开始我用短时 Frida 调用确认了面板存在，随后两次遇到封号。`frida-agent.so` 注入后会留在进程里，`frida-server` 还要监听端口，这些都是 TP 的检测目标。实际链路是 TP 发现异常、进程崩溃、tombstone 上报，最后由服务器标记账号。

后来换成了 9KB 的原生探针。它通过 ptrace 注入游戏进程，在 constructor 中调用 IL2CPP 的 `runtime_invoke`，面板唤起后立刻退出。全程没有常驻后台进程和监听端口，内存里也不会长期留着 agent。

| | Frida 方案 | 原生探针 |
|------|------|------|
| 注入物 | frida-agent.so (~8MB) | 自定义 .so (9KB) |
| 后台进程 | frida-server 常驻 | 无 |
| 网络端口 | 27042 | 无 |
| 内存驻留 | 长期 | constructor 执行完即退出 |
| 封号风险 | 高（已确认两次） | 仍待验证 |

### 面板截图

训练营：

![策划属性调试面板-训练营](/upload/images/2026-06-14-WZRY-GM-Panel/design-attribute-debug.png)

离线单机模式：

![策划属性调试面板-离线](/upload/images/2026-06-14-WZRY-GM-Panel/offline-design-debug.png)

面板标题是「策划属性调试」，下面排着大量分类按钮，内容以对局属性和数值调试为主。UI 用独立 Canvas 渲染，遇到非标准分辨率时会缩得很小。Canvas 的 `set_scaleFactor` 方法已经找到，适配还没做。

### 方法列表

metadata 中的 `CheatCommandBattleEntry` 一共有 23 个方法。下面这些已经逐个测过：

| 方法 | argc | 大厅 | 训练营 |
|------|------|------|--------|
| `_GMDesignDebugCommand` | 0 | 返回对象，无 UI | **弹出「策划属性调试」面板** |
| `_GMBluePrintFrameCommand` | 5 | 未测 | 蓝图调试面板（待测试） |
| `SendCommand` | 7 | 未测 | 发送调试命令（待测试） |
| `StartHighlightAutoToolFunc` | 0 | **异常** | 返回正常 |
| `IsPVECoop` | 0 | true | true |
| `SetKillNotifyText` | 1 | 正常执行 | 未测 |
| `RemoveAll` | 0 | void | void |
| `ResetSkinIds` | 0 | 未测 | void |

### 资源痕迹：旧 GM 命令列表

旧截图中包含 `GM指令`、`DldGMPanel`、`OpenGM` 等字符串。对应的资源块 `5165_0.db` 在当前版本中依然存在，内容与体验服字节级一致。当前版本里还能找到 GM/Cheat 系统、命令注册和命令历史等资源。

我还没在大厅里直接打开这组资源。它可能依赖 UGC/Pandora app exposure 或特定对局上下文，从资源关系看是第三条面板分支。

---

## 三、脚本与后续

### 脚本

分析时写的脚本都放在 `tools/runtime/`：

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

- [x] 训练营中唤起「策划属性调试」面板
- [x] TP 反外挂绕过（libtprt patch + ptrace 安全写入）
- [ ] `_GMBluePrintFrameCommand`（5 参数）蓝图调试面板
- [ ] `SendCommand`（7 参数）对局内调试命令发送
- [ ] 「策划属性调试」面板 Canvas 缩放适配（当前 UI 偏小）
- [ ] 旧截图 `DldGMPanel` / `OpenGM` 资源链的完整唤起路径
- [ ] `CCheatSystem.OpenCheatForm()` 是否还可单独强拉旧版命令列表
- [ ] 当前版本 GM 命令资源和旧截图命令列表的差异
