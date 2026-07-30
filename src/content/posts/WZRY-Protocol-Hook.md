---
title: 王者荣耀消息协议的一些研究
date: '2026-07-26T23:40:00+08:00'
category: 折腾
tags:
  - 王者荣耀
  - 王者荣耀私服
  - Android
  - 逆向
  - IL2CPP
  - Zygisk
description: 从区服列表的明文流量开始，我在游戏进程里拦截 CSPkg 收发，运行时导出 IL2CPP 符号和协议结构，并实现网页规则、字段改写与本地消息注入。
---

> 声明：本文只记录个人设备和本人账号上的分析过程，包含 AI 辅助创作，可能会带来一定的不适感，谨慎阅读。

起因很简单。登录页列着一千多个大区，我想确认这些名字来自实时响应还是本地缓存，再改一个看看。区服流量很快就抓到了，后面的工作主要花在进程内改写和协议对象解析上。

设备是一台 root 真机，HyperOS 3 / Android 16 / arm64，装了 KernelSU 和 Zygisk Next。游戏版本是国服 11.4.1.1，SO 构建日期为 2026-06-14。文中的函数地址都是这个版本的 RVA，具体数值记录在项目文档中。

## 现在能做什么

游戏进程里常驻一个 Zygisk 原生模块，分别拦截收包和发包。消息对象会通过 IL2CPP 反射转成 JSON，发送到主机上的工作台。规则在网页中配置，可以按字段路径改写消息，也可以构造一条本地消息交给客户端处理。

先看两个已经在屏幕上确认的例子。第一个是区服名，只改手Q1区：

![选择服务器界面，手Q1区的名字被替换](/upload/images/2026-07-26-WZRY-Protocol-Hook/zone-renamed.png)

第二个是大厅左上角的昵称。游戏内改名入口最多填写 6 个中文字，下面这张图显示了 8 个，后面的内容被控件截断：

![大厅左上角昵称显示为「任意长度改写验证」，后半截被控件宽度截断](/upload/images/2026-07-26-WZRY-Protocol-Hook/nickname-long.png)

规则只有一行，把登录响应 `SCID_CMD_GAMELOGINRSP` 里的 `szName` 换掉。实际塞进去的是 26 个中文字、78 字节，而 TDR schema 给这个字段的定长是 64 字节：

```text
I WzryZg: [route] r msgid=1003 szName : System.Byte[] OK -> 新 Byte[78](任意长)
```

这里修改的是 `unpack` 完成后的对象，发生在游戏逻辑读取之前。客户端改名界面的 6 字限制没有参与，收包对象也接受了超过 schema 定长的数组。

## 区服表是明文，改写放到进程内

tcpdump 直接抓到了明文区服流量，区服名和 `LogicWorldID` 都在响应里。帧结构也很简单：`55 00 00 00` 后面是一个字节的长度，再跟 UTF-8 名字。

顺着这份明文把整张表解了出来，1075 条，每条是 `<平台><编号>区<诗意名>` 加上 `LogicWorldID` 和一组 relay 地址。手Q 601 条、微信 458 条，剩下十来条是抢先服、测试服、提审服这类。诗意名基本取自英雄和皮肤词，落雪白狼、鲜血枭雄、电玩小子、长城防线都在里面。

游戏界面当时最多显示到手Q547区（落雪白狼，`LogicWorldID` 1557），ilink 响应已经包含手Q600区（戍鼓铭心，1610）。548 到 600 区的名字已经下发，界面只显示开服部分。编号和 ID 大致遵循手QN区对应 1000+N、微信N区对应 3010+N，中间有跳号；547 区对应 1557，1547 已被其他节点占用。

确认响应内容后，还需要找到合适的改写位置。我依次检查了 libc 收发函数、eBPF 和透明中继。

我先用 Frida 挂 `recv`、`read` 和 `recvfrom`。同一次 60 秒启动中，tcpdump 看到了两千多次区服相关字段，libc hook 的计数为零。诊断日志正常，确认这段流量使用了编号 207 的裸 `recvfrom` 系统调用。

eBPF 可以稳定看到完整流量，我也记录了 ilink flow 的特征。本次使用的探针只做观测，没有继续实现内核侧改写。

透明中继需要实现拆帧、TDR 解析、字段修改和重新组包，还要处理心跳与重传。这个工作量超出了区服名验证的需要。

我改在游戏进程内处理已经解包的对象。后续消息是否加密、走哪种传输协议，都由游戏原有网络层处理。

## Frida attach 会触发游戏崩溃

Frida 便于快速验证，但 attach 主进程后游戏会崩溃，注入的 gum 运行时无法继续运行。

我又把 gadget 放进 Zygisk 模块加载。主进程仍会退出，能存活的子进程没有目标协议对象。继续处理 Frida 特征需要覆盖多处检测点，这次没有沿用这条方案。

我改用纯 Zygisk 原生模块随 zygote 进入游戏进程。模块可以常驻，inline hook 需要自行实现。

## ShadowHook 无法在代码段附近分配跳板

我先试了 ShadowHook。它使用四字节相对跳转，需要在目标函数 ±128MB 内放置一小段跳板代码。`libil2cpp.so` 有 217MB，代码段占 155MB；扫描整个代码段只找到一处 12 字节零填充，附近也没有可用映射。

安装时报错 `errno=40`。源码里使用目标地址减 128MB 作为 mmap hint，这个地址落在库自身映射中，内核返回的地址超出了相对跳转范围。`MAP_FIXED` 也找不到稳定空闲区间；ASLR 生成的布局每次不同，有一次出现 9MB 间隙，重启后便消失了。

我改用 16 字节绝对跳转：目标函数开头写入 `LDR X17,#8; BR X17; .quad proxy`，原指令搬到另一块可执行内存，末尾再跳回目标函数加 16 的位置。And64InlineHook 也使用这种做法。被搬走的指令必须位置无关；当前目标函数以 `sub sp` 或 `stp` 开头，`adrp` 都在前 16 字节之外。

区服名相关函数只在登录期调用，可以在 gcloud 载入后、组网前一次性安装 16 字节跳转。

收发函数从启动起就被网络线程高频调用。16 字节写入不具备原子性，安装过程中执行到目标地址会读到新旧混合的指令，崩溃时间也不固定。

高频函数改用断点 hook。安装时原子写入一条 `BRK #0`（`0xD4200000`），SIGTRAP 处理函数在信号上下文中把 PC 改到 proxy。frida-gum 的 exceptor 也采用类似方式。安装过程无需暂停线程，每次命中会增加一次异常处理；首指令为 `adrp` 的函数仍需先完成重定位。

托管内存盲读统一使用 `process_vm_readv`，非法地址返回 EFAULT；写入前先用 `safe_read` 检查目标地址。实测读取速度约为 pipe 探测的四十倍。托管指针的顶字节还带有 TBI tag，解析前需要移除；日志中指针顶部的 `0xb4` 帮助确认了这个问题。

## 在运行时导出 IL2CPP 符号

在 IL2CPP 层安装 hook，需要先确定函数地址。这个版本的 `CodeRegistration` 和 `MetadataRegistration` 都是零，Il2CppDumper 的 auto 和 manual 模式均失败。几年前的游戏版本还能通过明文 metadata 和两个注册地址静态导出符号，这个方法已经无法使用。

IL2CPP 使用 AOT：C# 先转成 C++，再编译为 ARM64 机器码。`libil2cpp.so` 中没有统一的解释执行入口，每个 C# 方法对应一个原生函数。运行时 metadata 仍保留方法指针，函数逻辑则需要在 IDA 中查看反汇编。

模块可以从运行时 domain 枚举 assembly 和 class，再导出命名空间、父类、方法名、RVA、字段偏移与类型。结果包含 63,034 个类、412,674 个方法，共 69.8MB 文本，执行时间不到一秒。字段偏移来自当前进程中的实际布局。

## 收包拦截 HandleMsg，发包拦截 pack

拿到符号表后，我按消息覆盖范围选择 hook 点。

区服名最初挂在服务器 URL 构造函数上。每个区服节点调用一次，一次登录触发一千两百多次，名字位于参数节点下层的托管字符串中。这个位置只能处理区服列表。

协议封装层有出站序列化的 `CSPkg.pack` 和入站反序列化的 `unpack`。从这里可以拿到 `CSPkg` 对象：`+0x10` 是消息头，头里 `+0xc` 是路由键 `dwMsgID`，`+0x18` 是消息体，消息体的 `+0x10` 是实际消息对象。

大厅阶段还有部分消息不经过 `unpack`。继续查看调用关系后，收包分发入口确定为 `NetworkModule.HandleMsg`，参数布局与 `CSPkg` 一致，msgid 也能对应。最终收包拦截 `HandleMsg`，发包拦截 `pack`。登录重试阶段反复出现的 1014、1191 和 1193，分别对应重新登录通知、游戏服重定向通知和错误码通知，也与游戏日志中的方法名一致。

## 从等长字节替换改成字段路径

最早的实现会在消息体中搜索字节串，再原地替换成等长内容。「王者独尊」和「总裁牛逼」在 UTF-8 与 UTF-16LE 下长度相同，所以区服名验证能够成功。

这种方式无法修改长度，也无法直接确认目标字段。

我用反射 API 把消息对象递归写成 JSON：`il2cpp_object_get_class` 获取类，`il2cpp_class_get_parent` 遍历父类，再按 `il2cpp_type_get_name` 选择读取方式。实例字段需要通过 flags 排除 static；第一版没有过滤，输出里混入了 `BASEVERSION` 和 `CLASS_ID` 等类常量。单条记录如下：

```json
{"dir":"r","msgid":1193,"cmd":"SCID_NTF_ERRCODE","type":"SCPKG_NTF_ERRCODE","body":
 {"stResultInfo":{"iResultId":11014,"stArgList":{"iNum":0,"astArgs":{"classId":148,
 "jarrCount":5}},"m_classID":150},"m_classID":3338}}
```

字段名和嵌套结构导出后，规则可以直接使用 `stResultInfo.iResultId` 这样的路径。消息写入 JSONL 文件；logcat 会截断长行，消息量大时也会丢行，不适合保存几 KB 的消息。缓冲区写满时会补齐右括号并添加截断标记，保证每行仍可解析。

收包在 `unpack` 之后修改，对象会直接交给游戏逻辑；发包在 `pack` 之前修改，TDR 会重新计算长度前缀。对象层可以替换数组指针，收包侧已验证可以扩展长度，发包侧仍受 schema 定长约束。

8,868 个协议类中没有 `System.String` 字段，文本使用 `System.Byte[]`，共 1,155 处。文本改写需要用 `il2cpp_array_new` 创建新数组。

## 昵称空白来自 8 字节偏移

账号最初所在的区服达到注册上限，登录阶段只能收到 1014、1191 和 1193 三条通知，其中没有文本字段。换到可以进入大厅的区服后，收包消息从 3 种增至 282 种，其中 21 个字段是文本 `Byte[]`。

挑中的是 `SCID_CMD_GAMELOGINRSP`（1003）的 `szName`，TDR schema 里定长 64 字节，原值「饿了狂吃三碗」18 字节，大厅左上角直接显示它。

第一条规则我就写了个 78 字节的名字，故意超过 schema 的 64。logcat 里 `新 Byte[78](任意长)` 打出来了，切到大厅一看，昵称位置是空的：

![大厅左上角昵称位置空白，只剩等级](/upload/images/2026-07-26-WZRY-Protocol-Hook/nickname-blank.png)

我先怀疑 78 字节超过限制，于是换成 15 字节短名字，界面仍然空白。问题出在数组写入方式。

于是在改写之前，先把原数组从对象首地址起的 48 字节打出来：

```text
+0x00  e08cdd496f0000b4                  klass
+0x08  0000000000000000                  monitor
+0x10  4000000000000000                  max_length = 0x40 = 64
+0x18  e9a5bf e4ba86 e78b82 e59083 ...   数据 = 饿了狂吃三碗
```

标准 `Il2CppArray` 布局通常为 `+0x10` bounds、`+0x18` max_length、`+0x20` 数据。当前 SO 的长度位于 `+0x10`，数据从 `+0x18` 开始，整体相差 8 字节。旧代码读取时漏掉开头，写入时在数据前留下 8 个零，游戏将其识别为空串。

把偏移改成数据 `+0x18`、长度 `+0x10`，短名字立刻就出来了：

![大厅左上角昵称显示为「改写成功了」](/upload/images/2026-07-26-WZRY-Protocol-Hook/nickname-ok.png)

再使用 78 字节规则后，界面显示「任意长度改写验证」，后续内容被控件截断。本次收包对象成功读取并渲染了 78 字节数组，客户端改名界面的输入限制没有参与这条处理路径。

发包时换入 99 字节数组，对象可以正常创建，pack 仍按 schema 中的 N 读取 `char szXxx[N]`，超出部分不会发送。长度扩展目前只在收包侧验证成功。

## 协议表使用相邻版本的数据

拿到 msgid 还差一张表，得知道 1193 是什么、body 里都有哪些字段。

相邻小版本的协议项目已经整理了 4,015 条命令 ID 映射，以及按 C# 类还原的 proto 和 TDR 定义。我抽查心跳、登录、匹配、商城和聊天消息，编号、类名与命名空间都能对应当前运行时 dump，便直接用作路由表。RVA 仍按当前版本重新定位。

当前 dump 中筛出了 7,836 个协议消息类，并将字段名、类型和偏移导出为 JSON。相同协议名会同时出现在 `CSProtocol.*` 和 `CSProtocolWrapper.*` 中，前者是运行时引用类型，后者是 ValueType 镜像，字段偏移不同。索引最初使用短名，Wrapper 覆盖了运行时类型；改用全名并单独生成运行时索引后，字段偏移恢复正常。

## 在 curl_easy_perform 读取最终 URL

游戏还有一批 HTTP 请求，我也记录了它们的 URL。第一版按符号拦截 `libcrosCurl.so` 导出的 `cros_curl_easy_setopt`，只收到四次调用，option 都是 99（`CURLOPT_NOSIGNAL`），没有出现 `CURLOPT_URL`。

静态反汇编显示，导出层会转到库内的非导出变参 setopt，再进入 `Curl_vsetopt`。跳转表使用标准 curl option 编号，`CURLOPT_URL` 为 10002。我按地址拦截库内 setopt，触发次数与导出层一致，收到的仍然只有 `CURLOPT_NOSIGNAL`。

`libPluginCrosCurl.so` 是一个 18KB 的 GCloud 插件，导出 `CurlFuncQueryService::QueryCurlFuncs`。调用方通过函数指针表调用 curl，符号 hook 无法拦截设置 URL 的位置。

我在两个库的 `curl_easy_perform` 入口调用 `getinfo(handle, CURLINFO_EFFECTIVE_URL)`，再将结果写入 JSONL。这样可以记录 MSDK、FaaS 的完整请求 URL，以及构造服务器地址时使用的 Tdir 字符串，并通过 `via` 区分来源。

## 消息工作台和远端规则

规则最初写在设备的 `wzry.cfg` 中。每次修改都要编辑文件、推送并等待热重载；查看消息结构还要先读取 JSONL。大厅能收到 282 种消息，继续用配置文件操作很慢。

我把消息查看和规则配置放到主机。设备上报收发消息，前端提供实时列表、历史记录和全文搜索，也可以直接创建规则。设备端只保留引导配置。

传输使用局域网常驻 TCP，每帧由四字节大端长度和 JSON 组成。连接开启 `TCP_NODELAY`；实测 Nagle 会增加约 40ms 决策延迟。收发直接调用 syscall，防止数据再次进入 libc hook 的 `scan()`。

局域网常驻连接的 300 次往返全部成功：P50 2.5ms、P99 5.0ms、最大 18.1ms。登录峰值达到每秒 264 条消息；全部同步决策时，网络线程单秒累计等待约 700ms。大厅空闲阶段约为每秒 5 条消息，累计等待 13ms。

服务端会下发一份关注集。名单内的 msgid 使用同步决策，名单外直接放行并异步上报。单次超时或连续失败时，设备放行消息并熔断十秒，随后重新探测连接。

服务端使用 Node 22 和内置的 `node:sqlite`，启用 FTS5。TypeScript 由 Node 直接运行，一个进程提供 TCP 决策、HTTP 控制接口和前端静态文件。前端使用 Vite、React 与 react-router。

界面现在是这样：

![工作台实时页：左侧消息流按 npc 过滤，右侧是消息详情和 body 的 JSON 树](/upload/images/2026-07-26-WZRY-Protocol-Hook/workbench.png)

左侧消息流支持按方向、msgid 和名称过滤，也可以暂停。右侧显示消息头、运行时类名和 body 的 JSON 树。图中搜索 `npc` 后找到了 `CSID_ADD_NPC_REQ`（2015）。点击树中的字段可以创建改写规则，路径和当前值会自动填入。

规则支持三种处置：`allow` 原样放行、`patch` 按字段路径修改、`drop` 在发包侧丢弃。

## 验证昵称、金币和钻石

昵称规则用于验证远端下发。`synctimeout` 最初按 30 字节空包的 P99 设为 5ms，真实事件 JSON 约 5KB，设备在收到决策前已经超时。放宽到 50ms 后，日志记录为 `决策回话 8323us`。JSON 字符串值本身带引号，重复包装后昵称会显示为 `"远端下发的名字"`，解析时需要去掉外层引号。

货币数据位于登录响应。`SCPKG_CMD_GAMELOGINRSP` 中有 `stCoinList.CoinCnt`，类型为 `UInt32[]`。

完整登录后，`stCoinList.CoinCnt[1] = 6222` 与界面金币一致，下标 6 的值 190 与钻石一致。`COM_COIN_TYPE` 只能提供候选，这两个下标来自界面交叉确认。前端会保存人工确认的数组下标含义。

原来的 JSON walker 遇到数值数组只记录长度，赋值也只支持 `Byte[]`。这里增加了数组元素展开和 `name[idx]` 路径语法。

规则在页面上填两行就行：

![规则编辑弹窗：收包、msgid 1003、patch 两条字段路径](/upload/images/2026-07-26-WZRY-Protocol-Hook/rule-editor.png)

保存，重登，大厅顶上的数字就变了：

![大厅顶部显示金币 8888万、钻石 66666](/upload/images/2026-07-26-WZRY-Protocol-Hook/coins.png)

点券不在 `CoinCnt` 里，它有自己的消息 `SCPKG_CMD_ACNTCOUPONS`（1161/1162），字段是 `llCouponsCnt`，后来也验过了，同样能改。

这些修改只影响 `unpack` 后的客户端对象。服务器账户数据没有变化，购买请求仍会按服务器状态校验。

## 协议按 msgid 分发消息

前端显示往返耗时，需要先配对请求和响应。`RegisterMsgHandler(msgid, delegate)` 只按 msgid 建立索引，`HandleMsg` 也根据包头 msgid 找到委托。分发过程中没有通用请求上下文、逐请求回调或关联令牌。

`CSPkgHead.dwSvrPkgSeq` 是服务器包序号，客户端发包会回显最近收到的值，同一个序号可能连续出现在多条发包中；服务器主动通知的值为 0，属于 ack 语义。四千个消息类里只有 6 个带 `dwClientReqID`。SCID 有 2,435 个，CSID 有 1,580 个，许多服务器通知没有对应请求。

前端使用命名规则和时间窗口配对，`CSID_X_REQ` 对应 `SCID_X_RSP`。1,580 个 CSID 中有 1,280 个能按名称找到响应，耗时列会明确标记为推测值。

`HandleMsg` 按 msgid 选择处理委托。构造 CSPkg 后交给这个入口，就能复用游戏已有的消息处理函数。

## 构造 CSPkg 并交给 HandleMsg

`CSPkg`、`CSPkgHead` 和 `CSPkgBody` 会经过真实收包路径，可以在 hook 中缓存对应的 class。`dataObject` 的协议类需要按名称查找，模块会在 112 个程序集里调用 `il2cpp_class_from_name`。`object_new` 分配内存后，还要通过 `il2cpp_runtime_object_init` 执行 TDR 生成的 `.ctor`，创建子结构和定长数组。

托管 API 需要在已经 attach domain 的线程上调用。在轮询线程直接调用会导致进程退出。远端命令会先进入队列，下一次 `HandleMsg` 触发时再由游戏网络线程执行。队列在当前消息分发前清空，以保持到账通知先于 `_RSP` 的实际顺序。

注入 `1162 SCPKG_CMD_ACNTCOUPONS` 并将 `llCouponsCnt` 设为 777777 后，大厅顶栏显示 777777 点券。注入 `1823 SCPKG_HEROSKIN_ADD` 后，商城中对应皮肤的按钮从「购买」变为「已拥有」。

## 让客户端显示到账需要三类消息

我记录了一次购买小乔的完整时间线，一条请求对应七条服务端消息：

```text
s 1817 CSID_BUYHERO_REQ                  dwBillNo=... bBuyType=2 dwHeroID=106
r 1010 SCID_ACNT_INFO_UPD                货币扣除
r 1504 CSID_TASKUPD_NTF                  任务进度
r 48601 SCID_COLLECT_VALUE_TOTAL_INFO_NTF
r 4403 SCID_ACHIEVEMENT_DONE_DATA_CHG_NTF
r 1810 SCID_HERO_INFO_UPD          ←     英雄到账，排在 _RSP 前面
r 1818 SCID_BUYHERO_RSP                  iResultId=0 dwHeroID=106 dwCoinCost=5888
r 51457 SCID_BUY_REGRET_INFO_NTF         反悔期信息
```

`1810 SCID_HERO_INFO_UPD` 在购买响应 `1818` 之前到达。另一次皮肤购买因货币不足而失败，服务端只返回 `1820`，`iResultId=13`，`wCoinType` 和 `dwCoinCost` 都是 0。

只把 `_RSP` 结果码改为 0 时，客户端没有收到到账通知，也没有显示购买成功弹窗。

注入到账通知后，客户端自动发送穿戴请求，服务端继续返回：

```text
s 8566 CSID_CMD_SKIN_SUIT_REQ         客户端自动发的穿戴请求
r 8569 SCID_CMD_WEAR_SKIN_SUIT_RSP    iResultId=122009
r 8567 SCID_CMD_SKIN_SUIT_RSP         iResultId=0
```

`122009` 对应下面的未拥有提示。此时商城按钮已经显示「已拥有」，穿戴请求仍被服务端拒绝：

![商城里皮肤按钮显示已拥有，上方提示由于您尚未拥有翡翠华章皮肤，无法自动穿戴](/upload/images/2026-07-26-WZRY-Protocol-Hook/skin-owned.png)

这次皮肤流程需要三处处理：模块注入 `1823` 到账通知，规则将 `1820` 的购买响应改为成功，再将 `8569` 的穿戴校验结果改为成功。三条都只改变客户端当前会话中的显示和后续处理。

购买请求只提供 `dwResID`，到账通知使用 `dwHeroID` 和 `bSkinID`。换算关系为 `dwHeroID = dwResID / 100`、`bSkinID = dwResID % 100`；`18801` 对应英雄 188 的 1 号皮肤。

## 英雄拥有列表在登录时下发

注入英雄到账通知后，客户端显示了购买成功弹窗，商城列表仍显示未拥有。

`1886 SCID_ACNTHEROINFO_PARTTWO_NTY` 在登录时下发英雄拥有列表，结构为 `dwHeroNum` 加一个 200 槽位数组，我的账号当时 `dwHeroNum=12`。`1810 SCID_HERO_INFO_UPD` 只更新已有条目；列表中缺少目标英雄时，商城读取不到对应记录。

处理方式是在 `1886` 中增加 `dwHeroNum`，并向空槽位写入英雄号。普通字段改写遇到空元素时停止，构造消息时则按元素类型创建对象。

## 用模块处理计算和跨消息状态

规则适合把指定字段改成固定值。购买流程还需要根据 `dwResID` 计算英雄号和皮肤号、记录已经处理的物品，并主动推送新消息。

本地主机服务增加了模块脚本。脚本运行在 `node:vm` 中，上下文只提供 `msg`、`body`、`get`、`push`、`patch`、`store`、`grants` 和 `log`。`on` 声明触发条件，`handle` 执行处理。皮肤模块的主体如下：

```js
on = { dir: 's', msgid: 1819 };
handle = function (ctx) {
  const resid = ctx.get('dwResID');
  ctx.push({ msgid: 1823, type: 'SCPKG_HEROSKIN_ADD', patch: [
    { path: 'dwHeroID', value: String(Math.floor(resid / 100)) },
    { path: 'bSkinID',  value: String(resid % 100) },
  ]});
};
```

`ctx.store` 保存模块自己的 KV 状态，`ctx.grants` 按类型记录物品号。前端存储页可以查看和编辑这两类数据，也可以手工添加发放记录。

固定字段改写继续使用规则；涉及计算、状态或消息推送时使用模块。

模块命中次数最初 upsert 到 `modules` 表。仓库模块命中后会产生一条 `code` 为空的同名记录，数据库记录优先加载，导致文件模块失效。命中计数随后移到独立表中。

## 当前范围

目前验证的是客户端消息改写和本地消息注入。金币、点券、英雄与皮肤状态都只改变当前客户端中的对象；切换场景或重新登录后，真实响应会覆盖这些状态，服务器账户数据保持原值。

完整服务端还需要实现持久状态、业务逻辑和校验。文中的 IL2CPP RVA 只适用于 11.4.1.1 与 2026-06-14 构建，游戏更新后需要重新定位。
