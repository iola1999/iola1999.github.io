---
layout: post
title: 在浏览器端计算 ssimulacra2
date: 2023-01-08 19:00:00 +0800
categories: 折腾
tag: 
typora-root-url: ..
---

* content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.Calc-Ssimulacra2-in-FE)

## 关于图像处理

关于图片处理前后的质量差异，有多种评价指标: PSNR SSIM SSIMULACRA SSIMULACRA2

## 计算 SSIMULACRA2

### C++

原版实现，官方仓库 https://github.com/cloudinary/ssimulacra2

编译困难，可执行环境有限。

### Rust

编译简单，支持多种可执行环境 https://github.com/rust-av/ssimulacra2

### 纯 JS 实现

性能问题、精度

https://github.com/iola1999/ssimulacra2-js

### Wasm

两种思路：虚拟文件系统、零拷贝 rgb 数组

## 实现 Wasm 方案

安装 rust 等等等等

## 可用库

npm 包 https://github.com/iola1999/calc-s2-rust

demo 演示 https://calc-s2-vitefe.vercel.app/

