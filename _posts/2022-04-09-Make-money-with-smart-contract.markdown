---
layout: post
title: 如何用智能合约捞钱
date: 2022-04-09 16:00:00 +0800
categories: 折腾
tag:
typora-root-url: ..
---

* content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.Make-money-with-smart-contract)

> 比较火热的概念，学习一下~~，万一能靠这个赚钱~~

先看示例，接下来分享如何逐步实现它。

> WIP

## 基础概念

> [https://ethereum.org/zh/developers/docs/intro-to-ethereum/](https://ethereum.org/zh/developers/docs/intro-to-ethereum/)

### 以太坊网络

以太坊是一条区块链，最好的描述是将其描述为一个公共数据库，它由网络中的许多计算机更新和共享。

"区块"指的是数据和状态是按顺序批量或"区块"存储的。 如果你向别人发送 ETH，需要将交易数据添加到一个区块中才算成功。

"链"指的是每个区块加密引用其父块。 换句话说，区块被链接在一起。 在不改变所有后续区块的情况下，区块内数据是无法改变，但改变后续区块需要整个网络的共识。

### ETH

以太币 (ETH) 是以太坊上的的原生加密货币。 它存在目的是为了允许算力市场的存在。 这种市场为参与者提供了一种经济激励，以验证并执行交易请求，为网络提供计算资源。这也是大家对挖矿、加密数字货币的传统印象。

当前，1 ETH 价格约 3200 USD ，大约 20400 CNY。

比 ETH 更小的单位是 wei，1 ETH = 10^9 Gwei = 10^18 wei。

### 帐户

存储以太币之处。 用户可以初始化帐户，将以太币存入帐户，并将以太币转给其他用户。 帐户和帐户余额储存在 EVM 中的一个大表格中，是 EVM 总体状态的一部分。

以太坊有两种帐户类型：

- 外部持有 -- 私钥的所有者控制

- 合约 -- 一种由代码控制，部署在网络上的智能合约。

它们都能接收、持有和发送 ETH，与已部署的智能合约进行交互。

### 钱包

帐户和钱包不同。 账户是用户拥有的以太坊账户的密钥和地址对。 钱包是一个界面或者说应用程序，可以与以太坊账户交互。

支持 ETH 的钱包非常多：https://ethereum.org/zh/wallets/find-wallet/

为了与 Web3.0 交互，可以考虑如 Chrome 浏览器插件：MetaMask 这样的钱包。

### 交易

在以太坊网络中，有一台规范化计算机（称为以太坊虚拟机，或 EVM），其状态得到以太坊网络中所有人的一致同意。 每个参与以太坊网络的人（每个以太坊节点）都会保存一份这台计算机的状态。 此外，任何参与者都可以广播请求这台计算机进行任意计算。 每当广播这样的请求网络时，网络上的其他参与者就会验证、确认并进行（“执行”）计算。 这个命令会导致 EVM 的状态变化，并且在整个网络中传播。

计算请求被称为交易请求；所有交易的记录以及 EVM 的当前状态都存储在区块链中，而区块链又由所有节点存储并达成一致。

以下为一些交易示例：

- ETH 转账

- 发布智能合约代码（目标账户地址是 0）

- 执行智能合约代码

### 智能合约

应用程序开发者将程序（可重复使用的代码片段）上传到 EVM 存储中，然后用户通过不同的参数请求执行这些代码片段。 我们将这些上传至网络并由网络执行的程序称为智能合约（类似后端服务），它不可被篡改。

简单来说，你可以把智能合约想象成一种自动售货机：通过特定参数调用脚本后，如果满足某些特定条件，就会执行一些操作或计算。 例如，如果调用者将以太币发送给特定的接收者，通过简单的卖方智能合约就可以创建和分配数字资产所有权。

任何开发者都可以创建智能合约并在网络上公开，并使用区块链作为其数据层，向网络支付费用。 然后，任何用户都可以调用智能合约来执行其代码，并再次向网络支付费用。

### Gas

以太坊允许开发者创建 去中心化应用 (dApp)，它们共享算力池。 这个共享池是有限的，因此以太坊需要一种机制来确定谁可以使用它。 否则，某个 dApp 可能会意外或恶意地消耗所有网络资源，从而导致其他应用程序无法访问算力池。

ETH 加密货币支持以太坊算力的定价机制。 当用户想要完成一笔交易时，他们必须支付以太币，使他们的交易被区块链识别。 「交易」要是按照智能合约的规定一步一步执行命令，每执行一个命令都会产生一定的消耗，这个消耗以 Gas 作为单位，不同命令消耗的 Gas 数量也不相同。例如，加减计算的费用是 3，计算 SHA3 的费用是 30，输出日志的费用是 375，写入存储的费用高达 20000。总的来说，消耗 CPU 比消耗存储便宜，简单计算比复杂计算便宜，读取比写入便宜。「查询」则不需要。

这些使用成本被称为 gas 费用，gas 费用的多少取决于执行交易所需的算力和全网当时的算力需求。以太坊上的每一笔交易都包含一个值域，指定了要从发送者地址发送到接收者地址的 ETH 转移数量（以 wei ，10^-18 ETH，为单位）。当接收者地址是智能合约时，当智能合约执行其代码时，这些转移的以太币可用于支付 gas 费用。

> 撰文时以太坊的 Gas Limit (即 Gas 限制) 是 1500 万 Gas，这是单个以太坊区块中可以使用多少 Gas 数量的上限(也即是说，单个以太坊区块中包含的所有交易的 Gas 量加起来不能超过 1500 万)。

Gas 价格以 Gwei 标明，假设 gas 的价格是 200 Gwei（这个比例称为基本费用，最终会被燃烧销毁），当前一次交易费用 21000 gas，则需要支付交易费用 21000 \* 200 = 4,200,000 Gwei = 0.0042 ETH（约 0.8 CNY）。
Gas 一般用于描述交易费用，wei 则一般用于 ETH 金额单位。

为了使交易更快地被确认，还可以在每 gas 对应的基本 Gwei 费用之外添加额外的小费（优先费），由矿工获得，大多数钱包会自动设置该值。

还可以为交易设置最高费用，它与实际收费之间的差额将会退换给交易发起者。

### Web3

Web2 指的是我们如今众所周知的互联网版本。 一个在互联网公司掌控下提供服务来交换个人数据的互联网。 就以太坊而言，Web3 指的是在区块链上运行的去中心化应用。 任何用户都可以参与以太坊上的这些应用，个人数据却不会被出卖。

Web3 就是一个去中心化的互联网，旨在打造出一个全新的合约系统，并颠覆个人和机构达成协议的方式。可以基于“无须信任的交互系统”在“各方之间实现创新的交互模式”。

> 一些优点：
>
> - 网络上的任何人都有使用服务的权限 — — 换言之，不需要许可。
> - 没有人可以屏蔽您或拒绝您访问该服务。
> - 付款是通过本地令牌即 ether (ETH) 构建的。
> - 以太坊是图灵完备的，这意味着你可以有很多程序部署在上面。

> 局限性：
>
> - 交易进展较慢
> - 开发、使用学习门槛高，可访问性稍差
> - 成本较高，因此很多成功的 dApp 仅将其代码的一小部分放入区块链

## Let's start

HardHat 是一个 Ethereum 本地开发套件，用于智能合约的开发测试部署。

```bash
mkdir demo-web3
cd demo-web3
npx hardhat init
# basic sample project
```

### 编写合约

`contractssol` 是 eth 合约后缀名，VSCode 插件：solidity

`contract` 关键字声明合约。view 关键字是指该函数不需要花费“燃料”。

```typescript
//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract Counter {
    uint256 count;

    constructor() {
        count = 0;
    }

    function add() public {
        count += 1;
    }

    function getCount() public view returns (uint256) {
        return count;
    }
}
```

### 使用测试网络

> TODO 一些图

测试网浏览器 https://ropsten.etherscan.io/

### 部署合约

> TODO hardhat.config.js ，以及先介绍一下测试网、钱包

```typescript
const hre = require("hardhat");
const main = async () => {
  const Counter = await hre.ethers.getContractFactory("Counter");
  const counter = await Counter.deploy();
  await counter.deployed();

  console.log(`deplyed at ${counter.address}`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

`hre` (HardHat Runtime Environment) 会在使用 HardHat 部署合约时注入。

使用 `npx hardhat run scripts/run.js` 来运行合约。

> $ npx hardhat run scripts/run.js
> Compiled 1 Solidity file successfully
> deplyed at 0x5FbDB2315678afecb367f032d93F642f64180aa3

可以在 artifacts 目录查看合约编译产物。

### 本地测试

因为公开测试网络的存在，开发调试已经很方便了，这块可以忽略。

## 前端交互

> WIP

## 不忘初心

掌握了以上知识，如何捞钱？

### 发行 NTF

像素头像、盲盒、转赠售一应俱全 [https://www.bilibili.com/video/BV1S341177sQ](https://www.bilibili.com/video/BV1S341177sQ)

### 发行数字货币

基于以太坊发行 [https://solidity-cn.readthedocs.io/zh/develop/introduction-to-smart-contracts.html#subcurrency](https://solidity-cn.readthedocs.io/zh/develop/introduction-to-smart-contracts.html#subcurrency)

无门槛割韭菜，一键发行空气币 [https://mp.weixin.qq.com/s/JRQgpJfhIMVV8erSK3Dfcw](https://mp.weixin.qq.com/s/JRQgpJfhIMVV8erSK3Dfcw)

-END-
