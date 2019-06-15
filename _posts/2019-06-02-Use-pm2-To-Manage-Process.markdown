---
layout: post
title:  使用 pm2 管理非 node 进程
date:   2019-06-02 22:30:00 +0800
categories: 折腾
tag: 
---

* content
{:toc}


最近一直在用上篇文章里提到的 `Ubuntu on Android` 跑些后台任务，screen 用起来似乎并不是很方便，这里考虑使用 pm2 来管理后台的进程。

## 安装node、npm、pm2：

1. sudo apt-get install nodejs-legacy
2. sudo apt-get install npm
3. sudo npm install npm@latest -g
4. sudo npm install -g n
5. 上面(3)升级 npm 到最新时可能会出导致(4)安装 n 报错（node版本过低）。如果出现这个问题，解决方法：
   先删掉刚刚升级的 npm（sudo mv /usr/local/lib/node_modules/npm/ /tmp/usr_local_lib_node_modules_npm），然后先装 n（4），再升 node（3），再升 npm（下面这条 6）。也可以按照（4、3、6）顺序安装。
6. sudo n stable
7. 看下版本
   sudo node -v
   sudo npm -v
8. npm install pm2 -g

## 生成配置文件

以 Python 为例，使用 pm2 init 生成一份配置文件（js），或者自己手动创建这样的（json也可以，可以找找格式要求）：

```js
module.exports = {
  apps : [{
    name: 'wzry-pm2', // 任务名
    exec_interpreter: 'bash', // 利用 bash 启动 Python，因为script没法指示 py 代码的路径
    script: 'wzry-pm2.sh', // 比如 env PYTHONIOENCODING=utf-8 python /xxx/yyyy.py 前面 env是因为 pm2 会重定向 log 到磁盘文件，如果程序中有中文输出，则需要用环境变量指定编码
    args: '',
    instances: 1, //下面这些参数可有可无，有些这里也省略掉了 比如 log 路径
    autorestart: false,
    watch: false,
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }],
};

```

## 任务控制

`pm2 start 配置文件名` 		**开始一项任务（初次运行）**

`pm2 ls`		**列出任务**

`pm2 delete 任务名/配置文件名/id/all`		**停止并删除**

`pm2 stop 任务名/配置文件名/id/all`		**停止**

`pm2 start 任务名/配置文件名/id/all`		**启动**

`pm2 restart 任务名/配置文件名/id/all`		**重启**


## 日志

**查看**日志：`pm2 logs 任务名/id/all`

如果没有配置 log 路径，默认日志文件在 ~/.pm2/logs/ 下

**清空**日志：`pm2 flush`








另外有个小缺点，（可能）因为是通过 bash 运行的 python，pm2 的性能监测功能是失效的。