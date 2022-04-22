---
layout: post
title: Web3.0 捞钱入门
date: 2022-04-09 16:00:00 +0800
categories: 折腾
tag:
typora-root-url: ..
---

* content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.Make-money-with-smart-contract)

先看示例 [https://web3-fe.vercel.app/](https://web3-fe.vercel.app/) ，接下来分享如何实现它，看完你也有机会去捞钱。

## 基础概念

> 这部分内容大多整理自 [https://ethereum.org/zh/developers/docs/intro-to-ethereum/](https://ethereum.org/zh/developers/docs/intro-to-ethereum/)

### 以太坊网络

以太坊是一条区块链，最好的描述是将其描述为一个公共数据库，它由网络中的许多计算机更新和共享。

"区块"指的是数据和状态是按顺序批量或"区块"存储的。 如果你向别人发送 ETH，需要将交易数据添加到一个区块中才算成功。

"链"指的是每个区块加密引用其父块。 换句话说，区块被链接在一起。 在不改变所有后续区块的情况下，区块内数据是无法改变，但改变后续区块需要整个网络的共识。

### ETH

以太币 (ETH) 是以太坊上的的原生加密货币。 它存在目的是为了允许算力市场的存在。 这种市场为参与者提供了一种经济激励，以验证并执行交易请求，为网络提供计算资源。这也是大家对挖矿、加密数字货币的传统印象。

当前，1 ETH 价格约 3200 USD ，大约 20400 CNY。

比 ETH 更小的单位是 wei（致敬密码学的先驱戴伟（Wei Dai）），1 ETH = 10^9 Gwei = 10^18 wei。

### 交易

在以太坊网络中，有一台规范化计算机（称为以太坊虚拟机，或 EVM），其状态得到以太坊网络中所有人的一致同意。 每个参与以太坊网络的人（每个以太坊节点）都会保存一份这台计算机的状态。 此外，任何参与者都可以广播请求这台计算机进行任意计算。 每当广播这样的请求网络时，网络上的其他参与者就会验证、确认并进行（“执行”）计算。 这个命令会导致 EVM 的状态变化，并且在整个网络中传播。

计算请求被称为交易请求；所有交易的记录以及 EVM 的当前状态都存储在区块链中，而区块链又由所有节点存储并达成一致。

以下为一些交易示例：

- ETH 转账 [https://etherscan.io/tx/0x0aee0c2060a15a172701abbd17bde9c1ca7f11210a90002336aeb5d59d9454fe](https://etherscan.io/tx/0x0aee0c2060a15a172701abbd17bde9c1ca7f11210a90002336aeb5d59d9454fe)
- 发布智能合约代码（目标账户地址是 0） [https://etherscan.io/tx/0x8f7858f98c58d61c2648788f06affe505fde3b29cb35bd6256477eb5212a7203](https://etherscan.io/tx/0x8f7858f98c58d61c2648788f06affe505fde3b29cb35bd6256477eb5212a7203)
- 执行智能合约代码

### 智能合约

应用程序开发者将程序（可重复使用的代码片段）上传到 EVM 存储中，然后用户通过不同的参数请求执行这些代码片段。 我们将这些上传至网络并由网络执行的程序称为智能合约（类似后端服务），它不可被篡改。

简单来说，你可以把智能合约想象成一种自动售货机：通过特定参数调用脚本后，如果满足某些特定条件，就会执行一些操作或计算。 例如，如果调用者将以太币发送给特定的接收者，通过简单的卖方智能合约就可以创建和分配数字资产所有权。

任何开发者都可以创建智能合约并在网络上公开，并使用区块链作为其数据层，向网络支付费用。 然后，任何用户都可以调用智能合约来执行其代码，并再次向网络支付费用。

### 帐户

存储以太币之处。 用户可以初始化帐户，将以太币存入帐户，并将以太币转给其他用户。 帐户和帐户余额储存在 EVM 中的一个大表格中，是 EVM 总体状态的一部分。

以太坊有两种帐户类型：

- 外部持有 -- 私钥的所有者控制
- 合约 -- 一种由代码控制，部署在网络上的智能合约。

它们都能接收、持有和发送 ETH，与已部署的智能合约进行交互。

### 钱包

帐户和钱包不同。 账户是用户拥有的以太坊账户的密钥和地址对。 钱包是一个界面或者说应用程序，可以与以太坊账户交互。

支持 ETH 的钱包非常多：[https://ethereum.org/zh/wallets/find-wallet/](https://ethereum.org/zh/wallets/find-wallet/)

为了与 Web3.0 交互，可以考虑如 Chrome 浏览器插件：MetaMask 这样的钱包。

### Gas

以太坊允许开发者创建 去中心化应用 (dApp)，它们共享算力池。 这个共享池是有限的，因此以太坊需要一种机制来确定谁可以使用它。 否则，某个 dApp 可能会意外或恶意地消耗所有网络资源，从而导致其他应用程序无法访问算力池。

ETH 加密货币支持以太坊算力的定价机制。 当用户想要完成一笔交易时，他们必须支付以太币，使他们的交易被区块链识别。 「交易」要是按照智能合约的规定一步一步执行命令，每执行一个命令都会产生一定的消耗，这个消耗以 Gas 作为单位，不同命令消耗的 Gas 数量也不相同。例如，加减计算的费用是 3，计算 SHA-3 的费用是 30，输出日志的费用是 8 gas / byte，写入存储的费用高达 20000 gas / 32 bytes。总的来说，消耗 CPU 比消耗存储便宜，简单计算比复杂计算便宜，读取比写入便宜。「查询」则不需要。

这些使用成本被称为 gas 费用，gas 费用的多少取决于执行交易所需的算力和全网当时的算力需求。以太坊上的每一笔交易都包含一个值域，指定了要从发送者地址发送到接收者地址的 ETH 转移数量（以 wei ，10^-18 ETH，为单位）。当接收者地址是智能合约时，当智能合约执行其代码时，这些转移的以太币可用于支付 gas 费用。

> 撰文时以太坊的 Gas Limit (即 Gas 限制) 是 1500 万 Gas，这是**单个以太坊区块**中可以使用多少 Gas 数量的上限(也即是说，单个以太坊区块中包含的所有交易的 Gas 量加起来不能超过 1500 万)。

Gas 价格以 Gwei 标明，假设 gas 的价格是 20 Gwei（这个比例称为基本费用，最终会被燃烧销毁），当前一次交易费用 21000 gas，则需要支付交易费用 21000 \* 20 = 420,000 Gwei = 0.00042 ETH（约 1.34 USD， 约 8.5 CNY）。

Gas 一般用于描述交易费用，wei 则一般用于 ETH 金额单位。

为了使交易更快地被确认，还可以在每 gas 对应的基本 Gwei 费用之外添加额外的小费（优先费），由矿工获得，大多数钱包会自动设置该值。

还可以为交易设置最高费用，它与实际收费之间的差额将会退还给交易发起者。

### Web3

Web2 指的是我们如今众所周知的互联网版本。 一个在互联网公司掌控下提供服务来交换个人数据的互联网。 就以太坊而言，Web3 指的是在区块链上运行的去中心化应用。 任何用户都可以参与以太坊上的这些应用，个人数据却不会被出卖。

Web3 就是一个去中心化的互联网，旨在打造出一个全新的合约系统，并颠覆个人和机构达成协议的方式。可以基于“无须信任的交互系统”在“各方之间实现创新的交互模式”。

> 一些优点：
>
> - 网络上的任何人都有使用服务的权限 — — 换言之，不需要许可。
> - 没有人可以屏蔽您或拒绝您访问该服务。
> - 付款是通过本地令牌即 ether (ETH) 构建的。
> - 以太坊是图灵完备的，这意味着你可以有很多程序部署在上面。
>
> 局限性：
>
> - 交易进展较慢
> - 开发、使用学习门槛高，可访问性稍差
> - 成本较高，因此很多成功的 dApp 仅将其代码的一小部分放入区块链

## Let's start

### 了解测试网络

MetaMask 钱包中切换到测试网络

此处图片待补充。

获取测试所需的 ETH 资产 [https://faucet.egorfine.com/](https://faucet.egorfine.com/)

> 测试网浏览器 [https://ropsten.etherscan.io/](https://ropsten.etherscan.io/)

### 编写合约

HardHat 是一个 Ethereum 本地开发套件，用于智能合约的开发测试部署。

```bash
mkdir demo-web3
cd demo-web3
npx hardhat init
# basic sample project
```

`contracts`sol 是 eth 合约后缀名，VSCode 插件：solidity

`contract`关键字声明合约。`view`关键字是指该函数不需要花费“燃料”**。**

```typescript
//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract Counter {
    uint256 count;

    constructor() {
        count = 0;
    }

    function increment() public {
        count += 1;
    }

    function getCount() public view returns (uint256) {
        return count;
    }
}

```

### 部署、执行合约

在 `hardhat.config.js`文件中添加一个 `network` 条目。 这里我们使用 Ropsten 测试网络。

```typescript
require("@nomiclabs/hardhat-waffle");

// usePlugin("@nomiclabs/hardhat-waffle");
// Go to https://infura.io/ and create a new project
// Replace this with your Infura project ID
const INFURA_PROJECT_ID = "xxxxx";
// Replace this private key with your Ropsten account private key
// To export your private key from Metamask, open Metamask and
// go to Account Details > Export Private Key
// Be aware of NEVER putting real Ether into testing accounts
const ROPSTEN_PRIVATE_KEY = "xxxxx";

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  networks: {
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`],
    },
  },
};
```

设置运行的网络：

此处图片待补充。

```typescript
const hre = require("hardhat");
const main = async () => {
  const Counter = await hre.ethers.getContractFactory("Counter");
  const counter = await Counter.deploy();
  await counter.deployed();

  console.log(`deplyed at ${counter.address}`);

  let count;
  count = await counter.getCount();
  console.log(`count(0) is ${count}`);

  await counter.increment();
  count = await counter.getCount();
  console.log(`count(1) is ${count}`);

  const incrementTx = await counter.increment();
  // 等待确认
  await incrementTx.wait();
  count = await counter.getCount();
  console.log(`count(2) is ${count}`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

使用`npx hardhat run --network ropsten scripts/run.js`来运行合约。

> $ npx hardhat run --network ropsten scripts/run.js
> Compiled 1 Solidity file successfully
> deplyed at 0x4a37bDf634b6D56b0A84Ec60939E11F0f16c0B44
> count(0) is 0
> count(1) is 0
> count(2) is 2

可以在 `artifacts`目录查看合约编译产物。反编译合约：[https://ropsten.etherscan.io/bytecode-decompiler?a=0x4a37bdf634b6d56b0a84ec60939e11f0f16c0b44](https://ropsten.etherscan.io/bytecode-decompiler?a=0x4a37bdf634b6d56b0a84ec60939e11f0f16c0b44)

每次重新部署都会产生新的合约地址，所以合约一经部署后是不能更新的，即使是被发现了 Bug。

> 不过，也可以实现一种“可升级”的智能合约来实现迭代。

可以看到 count(1) 还是旧的值，说明交易在被矿工确认过之前还不是真正“生效”的。

合约交易执行完成后会返回一个 Transaction 对象，获取 count(2) 之前等待了这个交易确认（耗时可能要许久），获取的才是更新后的值。

如需直接执行指定地址的合约，参考代码如下：

```typescript
const contractAddress = "0x4a37bDf634b6D56b0A84Ec60939E11F0f16c0B44";
const counter = await hre.ethers.getContractAt("Counter", contractAddress);

let count;

count = await counter.getCount();
console.log(`count(0) is ${count}`);
```

### 检查 ETH 支出

在测试网浏览器上查看自己的钱包地址的 ETH 记录：[https://ropsten.etherscan.io/address/0x02f71c43977dfe2399a23ba4272493819fbf86b5](https://ropsten.etherscan.io/address/0x02f71c43977dfe2399a23ba4272493819fbf86b5)

此处图片待补充。

可以看到合约部署 + 合约调用及其 ETH 花费。

### 在线编辑器

[http://remix.ethereum.org/](http://remix.ethereum.org/) 这里可以在线编译、部署、调试调用合约，也十分方便。

### 本地网络测试

> 因为公开测试网络的存在，开发调试已经很方便了，可以忽略本章节。本地网络在交易确认速度上很有优势。

通过 `npx hardhat node`可以启动一个本机节点，同时会提供一些测试钱包地址和私钥。

> $ npx hardhat node
> Started HTTP and WebSocket JSON-RPC server at [http://127.0.0.1:8545/](http://127.0.0.1:8545/)
>
> Accounts......

Metamask 添加本地网络时，需要修改一下链 ID。

此处图片待补充。

使用`npx hardhat run scripts/run.js --network localhost`在本地网络运行合约

节点这边日志看到成功部署：

> Contract deployment: Counter
> Contract address: 0x5fbdb2315678afecb367f032d93f642f64180aa3
> Transaction: 0xdbd2def227498425ab0ebff63e56ba2b99a36101c7c1492c5dfb8365fbc345a3
> From: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
> Value: 0 ETH
> Gas used: 135941 of 135941
> Block #1: 0x500048e068c01c318a005f663c3210ebf72ec33335477435cdb98ff8fe62551f

> deplyed at 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
> count(1) is 0
> count(2) is 1
> count(3) is 2

## Web3 前端交互

### 使用钱包插件

在浏览器上，与以太坊网络的交互依赖浏览器钱包插件，继续使用 MetaMask 钱包，一般的流程是使用钱包登陆，通过钱包调用网络上的智能合约。

钱包插件会在 `window` 上挂载 `web3`、`ethereum`，使用 npm 包 `ethers`来处理与钱包的连接工作。

### 主要流程

先创建个前端项目 `npx create-react-app web3-fe --template typescript`

与钱包交互的几个核心的方法如下：

```typescript
const checkIfWalletConnected = async () => {
  try {
    const { ethereum } = window;

    if (!ethereum) {
      console.log(`please install metamask`);
      return;
    }

    const accounts = await ethereum.request({
      method: "eth_accounts",
    });
    if (accounts.length !== 0) {
      const account = accounts[0];
      console.log(`found account with address`, account);
      setAccount(account);
    } else {
      console.log(`no auth account found`);
    }
  } catch (err) {
    console.error(err);
  }
};
```

```typescript
const connectWallet = async () => {
  try {
    const { ethereum } = window;

    if (!ethereum) {
      console.log(`please install metamask`);
      return;
    }

    const accounts = await ethereum.request({
      method: "eth_requestAccounts",
    });
    console.log(accounts[0]);
    setAccount(accounts[0]);
  } catch (err) {
    console.error(err);
  }
};
```

```typescript
import { ethers } from "ethers";
import abi from "./utils/Counter.json";

const contractAddress = "0x4a37bDf634b6D56b0A84Ec60939E11F0f16c0B44";
const contractABI = abi.abi;

const getCount = async () => {
  try {
    const { ethereum } = window;

    const provider = new ethers.providers.Web3Provider(ethereum);
    const signer = provider.getSigner();
    const CounterContract = new ethers.Contract(
      contractAddress,
      contractABI,
      signer
    );

    const counts = await CounterContract.getCount();
    setCount(counts.toNumber());
  } catch (err) {
    console.error(err);
  }
};

const increment = async () => {
  try {
    const { ethereum } = window;
    const provider = new ethers.providers.Web3Provider(ethereum);
    const signer = provider.getSigner();
    const CounterContract = new ethers.Contract(
      contractAddress,
      contractABI,
      signer
    );
    const tx = await CounterContract.increment();
    await tx.wait();
    await getCount();
  } catch (err) {
    console.err(err);
  }
};
```

UI 部分自行发挥，最终效果见演示。

在请求交易时，浏览器钱包插件会弹出确认提示框：

此处图片待补充。

此处图片待补充。

完整前端代码供参考：[https://github.com/iola1999/web3-fe](https://github.com/iola1999/web3-fe)

## 不忘初心

掌握了以上知识，如何捞钱？

### 发行 NTF

像素头像、盲盒、转~~赠~~售一应俱全 [https://www.bilibili.com/video/BV1S341177sQ](https://www.bilibili.com/video/BV1S341177sQ)

### 发行数字货币

基于以太坊发行 [https://solidity-cn.readthedocs.io/zh/develop/introduction-to-smart-contracts.html#subcurrency](https://solidity-cn.readthedocs.io/zh/develop/introduction-to-smart-contracts.html#subcurrency)

无门槛割韭菜，一键发行空气币 [https://mp.weixin.qq.com/s/JRQgpJfhIMVV8erSK3Dfcw](https://mp.weixin.qq.com/s/JRQgpJfhIMVV8erSK3Dfcw)

### 区块链彩票

智能合约开源，投注、开奖流程链上可查，可信度高。

来这里体验：[https://web3-fe.vercel.app/lottery](https://web3-fe.vercel.app/lottery)

合约、前端源码开源在：[https://github.com/iola1999/web3-fe](https://github.com/iola1999/web3-fe)

此处图片待补充。

中奖者将获得奖池里一半的 ETH，当然在测试链上这并没有什么价值。但是：

先演示一下钱包、连接、交易流程。

水龙头备选：[https://faucet.egorfine.com/](https://faucet.egorfine.com/) 或者直接找我转账一些。
