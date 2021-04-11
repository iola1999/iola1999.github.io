---
layout: post
title: Virtual Scrolling of LongList
date: 2021-04-01 18:00:00 +0800
categories: 笔记
tag:
typora-root-url: ..
---

* content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.virtual-scrolling-of-long-list)

~~今天看一下列表虚拟滚动的实现细节，~~

试试放下洋屁，用蹩脚英语写一篇。虚拟滚动文章网上到处都是，本文没有参考意义，只是为了记录。

Today I'm trying to focus on some implementation details of the virtual scrolling of long list.Try to use the vite and [vue3 composition api](https://v3.cn.vuejs.org/guide/composition-api-introduction.html#%E4%BB%80%E4%B9%88%E6%98%AF%E7%BB%84%E5%90%88%E5%BC%8F-api) by the way.

## use Vite to build project

`npm init @vitejs/app` Then choose the `vue` template。

## implementation of the virtual scrolling

Rendering the entire long list has a high performance overhead (many DOM nodes and time-consuming rendering), so we can listen to the scroll event to get the currently visible range of list items and render only that part.

It is also necessary to keep the list height correct and the distance between list items and the top correct. So consider this three-tier structure：

```html
<div class="list-container">
  <div class="list-content">
    <item />
    ...
    <item />
  </div>
</div>
```

The outer div is the display window for the list, such as the body of a table.

The second div layer is designed to hold the height that can be used for scrolling, which is the height of the entirely rendered list.

To make the list items the correct distance from the top, consider the following two positioning methods.

One is to dynamically modify the height, margin-top of the second div so that the sum is equal to the fixed height of the entire list. Then render only those list items in the visible area. The first item rendered is actually right next to the top of the second div (not counting margin-top).

Another option is to set the second div to a fixed height and `position: relative`, set the list item to the style `position: absolute`, and set the `top` style to make it appear in the correct position.

Here I choose the first option to implement first. Prepare a list item component.

```html
<template>
  <div class="product-info-item">{{ productId }}</div>
</template>

<script setup>
  import { defineProps, reactive, ref } from "vue";
  const props = defineProps({
    productId: Number,
  });
</script>

<style scoped>
  .product-info-item {
    height: 79px;
    font-size: 72px;
    border-bottom: 1px solid gray;
  }
</style>
```


-END-
