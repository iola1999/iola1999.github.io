---
layout: post
title: Virtual Scrolling of LongList
date: 2021-04-11 18:00:00 +0800
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

### principle

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

One is to dynamically modify the `height, margin-top` of the second div so that the sum is equal to the fixed height of the entire list. Then render only those list items in the visible area. The first item rendered is actually right next to the top of the second div (not counting margin-top).

Another option is to set the second div to a fixed height and `position: relative`, set the list item to the style `position: absolute`, and set the `top` style to make it appear in the correct position.

### implementation

Here I choose the first option to implement first. Prepare a list item component.

```html
<!-- ./components/productInfo.vue -->
<template>
  <div class="product-info-item">{{ productId }}</div>
</template>

<script setup>
  import { defineProps } from "vue";
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

Next is the outer layers for showing list.

```html
<template>
  <div
    class="product-list-container"
    ref="listContainer"
    :style="{ height: viewportHeight + 'px' }"
  >
    <div class="product-list-content" :style="contentStyleObj">
      <productInfo
        v-for="item in shouldRenderItemsList"
        :key="item.productId"
        :productId="item.productId"
      />
    </div>
  </div>
</template>

<script setup>
  import { reactive, ref, computed, onMounted } from "vue";
  import productInfo from "./components/productInfo.vue";

  const viewportHeight = ref(400);
  const productInfoList = reactive([]);
  const showStartIndex = ref(0);
  const beforeRenderBuffer = ref(3); // Number of additional rendering items above
  const afterRenderBuffer = ref(5);
  const itemHeight = ref(80);
  const listContainer = ref(null); // https://v3.cn.vuejs.org/guide/composition-api-template-refs.html After mounted, it points to the Dom.

  const realStartIndex = computed(() => {
    return showStartIndex.value - beforeRenderBuffer.value < 0
      ? 0
      : showStartIndex.value - beforeRenderBuffer.value;
  });
  const shouldRenderItemsList = computed(() => {
    return productInfoList.slice(
      realStartIndex.value,
      showStartIndex.value + viewportHeight.value / itemHeight.value + afterRenderBuffer.value
    );
  });
  const contentStyleObj = computed(() => ({
    height:
      productInfoList.length * itemHeight.value - realStartIndex.value * itemHeight.value + "px",
    marginTop: realStartIndex.value * itemHeight.value + "px",
  }));

  function handleScroll(evt) {
    const scrollTop = evt.target.scrollTop;
    const currentStartIndex = Math.floor(scrollTop / itemHeight.value);
    showStartIndex.value = currentStartIndex;
  }

  onMounted(() => {
    listContainer.value.addEventListener("scroll", handleScroll);
    productInfoList.length = 0;
    for (let index = 0; index < 1000; index++) {
      productInfoList.push({ productId: index });
    }
  });
</script>

<style>
  #app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    margin-top: 30px;
  }
  .product-list-container {
    border: 1px solid red;
    overflow-y: scroll;
  }
</style>
```

The basic implementation idea is to get how far the second layer has scrolled relative to the `container` based on scroll events, and thus know which items should be visible. The list of visible items is maintained using the `computed property` and rendered by the child component.

At the same time, the top distance of the second layer component is set correctly so that the first item rendered is displayed correctly at the top of the viewport (i.e. where it would be if it were not scrolled virtually).

### some tests

I tried to change the list item component to look like this to simulate rendering complex scenes.

```html
<template>
  <div class="product-info-item">{{ showValue }}</div>
</template>

<script setup>
  import { defineProps, ref } from "vue";

  const props = defineProps({
    productId: Number,
  });

  const showValue = ref("");

  console.log(props.productId);
  // simulate rendering complex scenes.
  for (let index = 0; index < 100000000; index++) {
    Math.pow(Math.abs(2.7111548 ** 31 - 2.669875 ** 32), 2);
  }
  showValue.value = props.productId;
</script>
```

After a fast scroll time, the final position of the item takes a lot of time to show up, apparently because every child component is tried to be rendered. This can be optimized by adding debounce to the scroll event handler, but I happened to find another good optimization solution.

```javascript
// Omit the same content
import { defineProps, reactive, ref, onMounted, onBeforeUnmount } from "vue";

let timer;

timer = setTimeout(() => {
  console.log(props.productId);
  // simulate rendering complex scenes.
  for (let index = 0; index < 100000000; index++) {
    Math.pow(Math.abs(2.7111548 ** 31 - 2.669875 ** 32), 2);
  }
  showValue.value = props.productId;
}, 0);

onBeforeUnmount(() => {
  clearTimeout(timer); // In this way, items that scroll past quickly do not really take time to render.
  // The actual use in the project can be implemented using v-if
});
```

-END-
