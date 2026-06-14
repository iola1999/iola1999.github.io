---
layout: post
title: 王者荣耀 GM 调试面板入口初步记录
date: 2026-06-14 19:20:00 +0800
categories: 折腾
tag: [王者荣耀, Android, 逆向, 调试]
---

* content
{:toc}


> **声明：本文仅记录个人设备、本地安装包和授权调试环境下的分析结论。**
>
> 本文不包含绕过账号鉴权、攻击服务端或访问他人设备的内容。

## 结论

当前测试对象是王者荣耀 Android 版 `11.3.1.1`。初步结论如下：

- 当前版本仍保留 GM/Cheat 相关入口。
- 入口需要在启动阶段通过隐藏触摸暗码触发。
- 触发后没有直接进入旧截图中的完整 `GM指令` 面板，而是先出现“设备未登记”弹窗。
- 未登记状态下，点击确认后会回到正常加载流程，暂未看到旧版完整面板。

也就是说：**入口还在，但当前设备会被设备登记状态拦在完整面板之前。**

## 触发方式

触发点在启动阶段的开场视频/启动 Dialog 上。暗码大致是按屏幕四角和中心区域组合点击：

```text
左上 -> 右上 -> 右上 -> 右下 -> 左下 -> 中心
```

暗码触发成功后，内部开关会被置为开启状态，随后进入 Unity 层的 GM/Cheat 显示逻辑。

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

## 当前表现

触发成功后，当前设备显示以下弹窗：

```text
设备未登记
请使用下列ID登记设备
否则未来会无法登录
点击确定复制
```

点击“复制”后，弹窗关闭，游戏继续走正常加载流程。当前未登记状态下，没有直接显示旧截图里的完整 GM 指令面板。

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

这说明 Java 暗码只是第一层入口，真正的面板打开逻辑在 Unity 的 `CCheatSystem` 里。直接强拉完整面板，后续需要解决 `CCheatSystem` 实例获取、GM 开关返回值，以及设备登记状态这几层条件。

## 资源痕迹

当前版本仍能看到 GM/Cheat 系统、GM 命令注册、命令历史、GM 面板资源等相关痕迹。资源包中也还保留了 `GM指令`、`GM_IsEnableGM` 等字符串。

不过，旧截图中的部分具体命令文案没有在当前版本里直接命中，说明这个面板相比旧版本应该已经调整过，或者有一部分命令资源只在特定环境下加载。

此外，简单创建调试开关文件或 GM 目录不能直接拉起完整面板，说明入口不是单纯由本地明文开关控制。

## 后续待补充

- 设备登记状态的判定方式。
- GM 面板真正打开前的条件。
- 登记后是否能进入旧截图中的完整 `GM指令` 面板。
- 当前版本 GM 命令资源和旧截图命令列表的差异。
