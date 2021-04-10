---
layout: post
title: JavaScript Basics Review
date: 2021-04-05 12:00:00 +0800
categories: 笔记
tag:
typora-root-url: ..
---

* content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.JavaScript-basics-review)

计划开溜，复习一下。

+ 2021.04.05 初版。JavaScript 基础（类型、原型链、函数），手写常用方法。

+ 2021.04.10 排序方法，ES6+ 语法/提案。

## 常用方法

### 类型识别

typeof 可以正确识别：Undefined、Boolean、Number、String、Symbol、Function 等类型的数据，但是对于其他的都会认为是 object，比如 Null、Date 等，所以通过 typeof 来判断数据类型会不准确。但是可以使用 Object.prototype.toString 实现。

```javascript
console.log(typeof new Date());
function getRealType(obj) {
  console.log(
    Object.prototype.toString
      .call(obj)
      .split(" ")[1]
      .replace("]", "")
      .toLowerCase()
  );
}
getRealType(new Date());
getRealType(() => {});
getRealType(null);
getRealType(new Function("console.log(123)"));
```

### 深浅拷贝

```javascript
const source = {
  a: 1,
  b: 2,
  c: true,
  d: /abc/g,
  e: function () {},
  f: { f1: null, f2: 1 },
  g: undefined,
  h: [1, 2, 3],
};
function getRealType(obj) {
  return Object.prototype.toString
    .call(obj)
    .split(" ")[1]
    .replace("]", "")
    .toLowerCase();
}
// 如何手动实现？递归。下面这个写法有些问题还没处理好 TODO:再看看吧，现在不想折腾了
const deepCopy = (obj) => {
  let isArray = Array.isArray(obj);
  const result = isArray ? [] : {};
  if (isArray) {
    obj.forEach((item) => {
      ["object", "array"].includes(getRealType(item))
        ? result.push(deepCopy(item))
        : result.push(item);
    });
  } else {
    Object.keys(obj).forEach((key) => {
      ["object", "array"].includes(getRealType(obj[key]))
        ? (result[key] = deepCopy(obj[key]))
        : (result[key] = obj[key]);
    });
  }
  return result;
};
const _ = require("lodash");
var resultLodash = _.cloneDeep(source);
const resultMine = deepCopy(source);
// source.h.push(4);
// source.f.f2 = 4;
console.log(resultLodash, resultMine);
// // 原文参考写法：
// const isObject = (target) => (typeof target === "object" || typeof target === "function") && target !== null;
//
// function deepClone(target, map = new WeakMap()) {
//   if (map.get(target)) {
//     return target;
//   }
//   // 获取当前值的构造函数：获取它的类型
//   let constructor = target.constructor;
//   // 检测当前对象target是否与正则、日期格式对象匹配
//   if (/^(RegExp|Date)$/i.test(constructor.name)) {
//     // 创建一个新的特殊对象(正则类/日期类)的实例
//     return new constructor(target);
//   }
//   if (isObject(target)) {
//     map.set(target, true);  // 为循环引用的对象做标记
//     const cloneTarget = Array.isArray(target) ? [] : {};
//     for (let prop in target) {
//       if (target.hasOwnProperty(prop)) {
//         cloneTarget[prop] = deepClone(target[prop], map);
//       }
//     }
//     return cloneTarget;
//   } else {
//     return target;
//   }
// }
```

### 解析 URL 参数为对象

应该就是写个 qs ?没考虑 url encode

```javascript
const queryString = "a=1&b=2&c=3&d&e=4";
const queryStringParser = (qs) => {
  const result = {};
  qs.split("&").forEach((queryPart) => {
    if (queryPart.indexOf("=") !== -1) {
      result[queryPart.split("=")[0]] = queryPart.split("=")[1];
    } else {
      result[queryPart] = true;
    }
  });
  return result;
};
console.log(queryStringParser(queryString));
```

### 替换字符串模板

练习下正则使用。

{% raw %}

```javascript
const strTemplate =
  "我是{{name}}，年龄{{age}}，女朋友是{{girlfriend}}，恶心的测试用例{{a\\{\\{b}}可以吗";
const strTemplateParser = (template, obj) => {
  const regExp = /{{(.*?)}}/; // 用 (\w+) 的话也行
  if (regExp.test(template)) {
    const [replaceStr, key, ..._] = regExp.exec(template);
    console.log(replaceStr, key);
    template = template.replace(replaceStr, obj[key]);
    return strTemplateParser(template, obj);
  } else {
    return template;
  }
};
console.log(
  strTemplateParser(strTemplate, {
    name: "Xiaoming",
    age: 17,
    "a\\{\\{b": "haha",
  })
);
```

{% endraw %}

### 函数防抖

```javascript
const handleSumbit = function (name) {
  console.log("handleSumbit 真正执行", name);
};
// 简单版本
const debounceV1 = function (func, waitExec) {
  let timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, arguments); // 记一下 apply bind call 等区别，还有 arguments
    }, waitExec);
  };
};
// immediate 是指第一次调用时就执行，后面防抖间隔内调用的忽略。
// 支持取消（仅限非immediate时）、立即执行、（立即执行时）返回结果（这个算了 没啥应用场景额）。是否可以做成 Promise 返回结果？
const debounce = function (func, waitExec, immediate) {
  let timer;
  const debounced = function () {
    clearTimeout(timer);
    if (immediate) {
      if (!timer) {
        func.apply(this, arguments);
      }
      timer = setTimeout(() => {
        timer = null; // 说明这次防抖间隔结束了。必须置null，clearTimeout 的还是有值的，影响上面 if (!timer)
      }, waitExec);
    } else {
      timer = setTimeout(() => {
        func.apply(this, arguments); // 记一下 apply bind call 等区别，还有 arguments
      }, waitExec);
    }
  };
  debounced.cancel = function () {
    clearTimeout(timer);
    timer = null;
  };
  return debounced;
};
const handleSumbitDebounced = debounce(handleSumbit, 1000, true);
setTimeout(handleSumbitDebounced, 0, "try1");
setTimeout(handleSumbitDebounced, 700, "try2");
setTimeout(handleSumbitDebounced, 1500, "try3");
setTimeout(() => {
  console.log("第二轮测试");
}, 2600);
setTimeout(handleSumbitDebounced, 2600, "try4");
setTimeout(handleSumbitDebounced, 2800, "try5");
```

### 函数节流

```javascript
const handleSumbit = function (name) {
  console.log("handleSumbit 真正执行", name);
};
const throttle = function (func, waitExec) {
  let lastSuccessExec = 0;
  return function () {
    if (+new Date() - lastSuccessExec >= waitExec) {
      lastSuccessExec = +new Date();
      func.apply(this, arguments);
    }
  };
};
const handleSumbitThrottled = throttle(handleSumbit, 1000);
setTimeout(handleSumbitThrottled, 0, "try1"); // 第一次
setTimeout(handleSumbitThrottled, 700, "try2"); // 未到 0+1000
setTimeout(handleSumbitThrottled, 1100, "try3"); // 超过了 0+1000
setTimeout(handleSumbitThrottled, 2050, "try4"); // 应该是跟谁比较呢，是 0+1100 +1000 吧， 不执行
setTimeout(handleSumbitThrottled, 2250, "try5"); // 超过了 0+1100 +1000
// TODO: 复杂需求 leading、tailing 就先不写了
```

### 发布订阅 EventEmitter

```javascript
class EventEmitter {
  constructor() {
    this.events = Object.create(null);
  }
  on(eventName, fn) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(fn);
  }
  once(eventName, fn) {
    // 即生成一个函数，代替调用on+off
    const tempFn = (...args) => {
      fn(...args);
      this.off(eventName, tempFn);
    };
    this.on(eventName, tempFn);
  }
  emit(eventName, ...args) {
    const callbackQueue = this.events[eventName] || [];
    callbackQueue.forEach((cb) => {
      cb(...args);
    });
  }
  off(eventName, fn) {
    if (fn) {
      this.events[eventName] = this.events[eventName].filter(
        (fnItem) => fnItem !== fn
      );
    } else {
      // 不传第二个参数的话，会清空所有的注册
      this.events[eventName] = [];
    }
  }
}
let eventBus = new EventEmitter();
let fn1 = function (value) {
  console.log("fn1 called", value);
};
let fn2 = function (value) {
  console.log("fn2 called", value);
};
eventBus.on("onFun1", fn1);
eventBus.on("onFun1", fn1);
eventBus.on("onFun1", fn2);
eventBus.on("onFun2", fn2);
eventBus.emit("onFun1", 11);
eventBus.emit("onFun2", 12);
eventBus.off("onFun1", fn1);
eventBus.emit("onFun1", 15);
eventBus.off("onFun1");
eventBus.off("onFun2");
console.log("全部取消，测试一下once");
eventBus.once("onFun1", fn1);
eventBus.emit("onFun1", 17);
eventBus.emit("onFun1", 17);
```

## 继承

### 原型链继承

存在的问题：

- 原型中包含的引用类型属性将被所有实例共享；
- 子类在实例化的时候不能给父类构造函数传参；

```javascript
function Animal() {
  this.possibleColors = ["black", "white"]; //someReferenceTypedValue
  this.currentColor = "black"; // non-reference
}
Animal.prototype.getPossibleColors = function () {
  return this.possibleColors;
};
Animal.prototype.getCurrentColor = function () {
  return this.currentColor;
};
function Dog() {}
Dog.prototype = new Animal(); // 记一下这个方式
const dogA = new Dog();
console.log(dogA.getPossibleColors());
dogA.possibleColors.push("yellow");
const dogB = new Dog();
console.log(dogA.getPossibleColors()); // [ 'black', 'white', 'yellow' ] 原型中包含的引用类型属性将被所有实例共享；
console.log(dogB.getPossibleColors());
const animalA = new Animal();
console.log(animalA.getPossibleColors()); // [ 'black', 'white' ] 未影响

// 再测试一下非引用类型
dogA.currentColor = "yellow";
console.log(dogA.getCurrentColor());
console.log(dogB.getCurrentColor());
```

### 构造函数实现继承

```javascript
function Animal(name) {
  this.possibleColors = ["black", "white"]; //someReferenceTypedValue
  this.name = name;
  this.getPossibleColors = () => {
    return this.possibleColors;
  };
}
function Dog(name, age) {
  Animal.call(this, name); // 这样每份实例可以拥有自己独立的属性
  this.age = age;
}
const dogA = new Dog("dogA", 4);
const dogB = new Dog("dogB", 4);
dogA.possibleColors.push("yellow");
console.log(dogA.getPossibleColors());
console.log(dogB.getPossibleColors()); // [ 'black', 'white' ] 未影响。但是这种方式，方法也被创建了多份
```

### 组合继承

使用原型链继承原型上的属性和方法，而通过盗用构造函数继承实例属性。这样既可以把方法定义在原型上以实现重用，又可以让每个实例都有自己的属性。这种方式多余地调用了一次父类构造函数。一次定义时的 Animal.call，多次 new Animal()

```javascript
function Animal(name) {
  console.log("Animal constructor called");
  this.name = name;
  this.possibleColors = ["black", "white"]; //someReferenceTypedValue
}
Animal.prototype.getPossibleColors = function () {
  return this.possibleColors;
};
function Dog(name, age) {
  console.log("will Animal.call");
  Animal.call(this, name); // 这样每份实例可以拥有自己独立的属性
  this.age = age;
}
Dog.prototype = new Animal(); // 使用原型链上的方法
Dog.prototype.constructor = Animal;
const dogA = new Dog("dogA", 4);
const dogB = new Dog("dogB", 4);
dogA.possibleColors.push("yellow");
console.log(dogA.getPossibleColors());
console.log(dogB.getPossibleColors()); // [ 'black', 'white' ] 未影响
```

### 寄生式组合继承

能避免调用两次父类构造函数。

```javascript
function Animal(name) {
  console.log("Animal constructor called");
  this.name = name;
  this.possibleColors = ["black", "white"]; //someReferenceTypedValue
}
function Dog(name, age) {
  console.log("Animal.call");
  Animal.call(this, name); // 这样每份实例可以拥有自己独立的属性
  this.age = age;
}
// function F() {}
//
// F.prototype = Animal.prototype;
// let f = new F();
// f.constructor = Dog;
// Dog.prototype = f;
// 或者简单：
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;
const dogA = new Dog("dogA", 4);
const dogB = new Dog("dogB", 4);
```

### ES6 Class

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
}
class Dog extends Animal {
  constructor(name, age) {
    super(name);
    this.age = age;
  }
  getAge() {
    return this.age;
  }
}
console.log(new Dog("dogA", 6).getAge());
```

## 实现数组方法

### 数组去重 ES6 Set

```javascript
const source = [1, 2, 2, 3, 5, 5, 6];
console.log([...new Set(source)]);
// 这种方式（ES5），看下思路就行，filter的第 2、3 个参数
function unique(arr) {
  return arr.filter(function (item, index, array) {
    return array.indexOf(item) === index;
  });
}
```

### 数组拍平 flat

```javascript
const source = [1, 2, [3, 4, 5, [6, 7, 8]]];
// console.log(source.flat());
// 如何手动实现？递归
const flatArray = (array) => {
  const result = [];
  array.forEach((item) => {
    Array.isArray(item) ? result.push(...flatArray(item)) : result.push(item);
  });
  return result;
};
console.log(flatArray(source));
```

### 实现 forEach

```javascript
Array.prototype.forEach2 = function (func, thisArg) {
  // 还可以加上 this == null、typeof callback !== "function"的校验，throw new TypeError
  // thisArg 可选。当执行回调函数 callback 时，用作 this 的值。
  const backupArray = Object(this); // 防止被修改？
  for (let i = 0; i < backupArray.length; i++) {
    // 原文还提到了 .length >>> 0 ，无符号右移
    // 是为了保证结果有意义（为数字类型），且为正整数，在有效的数组范围内（0 ～ 0xFFFFFFFF），且在无意义的情况下缺省值为0。
    func.call(thisArg, backupArray[i], i, backupArray);
  }
};
[1, 2, 3].forEach2((item) => {
  console.log(item);
});
```

### 实现 map

```javascript
Array.prototype.map2 = function (func, thisArg) {
  const backupArray = Object(this); // 防止被修改？
  const result = [];
  for (let i = 0; i < backupArray.length; i++) {
    result.push(func.call(thisArg, backupArray[i], i, backupArray));
  }
  return result;
};
console.log([1, 2, 3].map2((item) => item + "/"));
// 顺便：["1", "2", "3"].map(parseInt)//返回应该是 [1, NaN, NaN]。注意参数 .map((item, index) => parseInt(item, index));
```

### 实现 filter

```javascript
Array.prototype.filter2 = function (func, thisArg) {
  const backupArray = Object(this); // 防止被修改？
  const result = [];
  for (let i = 0; i < backupArray.length; i++) {
    func.call(thisArg, backupArray[i], i, backupArray) &&
      result.push(backupArray[i]);
  }
  return result;
};
console.log([1, 2, 3].filter2((item) => item > 1));
```

### 实现 some

```javascript
Array.prototype.some2 = function (func, thisArg) {
  const backupArray = Object(this); // 防止被修改？
  let result = false;
  for (let i = 0; i < backupArray.length; i++) {
    if (func.call(thisArg, backupArray[i], i, backupArray)) {
      result = true;
      break;
    }
  }
  return result;
};
console.log([1, 2, 3].some2((item) => item > 9));
```

### 实现 reduce

```javascript
Array.prototype.reduce2 = function (func, initialValue) {
  const backupArray = Object(this);
  let currentValue = initialValue || backupArray[0] || null; // 允许不传第二个参数，不传时用第一项，且从第二项开始遍历
  for (let i = initialValue ? 0 : 1; i < backupArray.length; i++) {
    currentValue = func(currentValue, backupArray[i]);
  }
  return currentValue;
};
let arr = [1, 2, 3, 4];
const result = arr.reduce2((acc, current) => acc + current, 0); //10
console.log(result);
```

## html 原生开发相关

### 图片懒加载

TODO:这个不想写。直接看了原文。

```javascript
addEventListener("scroll", imgLazyLoad);
let rect = img.getBoundingClientRect();
if (rect.top < window.innerHeight) img.src = img.dataset.src; // 以及已经显示过的图片移除掉。
```

### JSONP

原理就是新建一个 script，封装生成 url，window[callbackName]，拿到数据后 removeChild

### 封装 AJAX

new XMLHttpRequest() .open .setRequestHeader .onreadystatechange

## 函数相关

《一等公民》

### 函数柯里化

跟偏函数不是一个意思（下面再写）。先看一个简单的例子：

```javascript
function add(x, y) {
  return x + y;
}

function currying(fn, ...rest1) {
  return function (...rest2) {
    return fn.apply(null, rest1.concat(rest2));
  };
}
console.log(currying(add, 1)(2));
```

```javascript
// 如何实现高阶的？
// const { curry } = require("lodash");
const curry = (func) => {
  let curried = (...args) => {
    return args.length === func.length
      ? func(...args)
      : (...newArgs) => curried(...args, ...newArgs); // 说明还有剩余参数
  };
  return curried;
};
function add(a, b, c) {
  return a + b + c;
}
let addCurry = curry(add);
console.log(addCurry(1)(2)(3));
console.log(addCurry(1, 2)(3));
```

### 偏函数

```javascript
// const { partial } = require("lodash");
function add(a, b, c) {
  return a + b + c;
}
const partial = (func, ...partArgs) => {
  return (...leftArgs) => func(...partArgs, ...leftArgs);
};

let partialAdd = partial(add, 1);
console.log(partialAdd(2, 3));
```

```javascript
// 要支持占位的话
function partial(fn, ...args) {
  return (...leftArg) => {
    const newArgs = [...args];
    for (let i = 0; i < newArgs.length; i += 1) {
      if (newArgs[i] === "_") {
        newArgs[i] = leftArg[0];
        leftArg.shift();
      }
    }
    return fn(...newArgs, ...leftArg);
  };
}
function clg(a, b, c) {
  console.log(a, b, c);
}
let partialClg = partial(clg, "_", 2);
partialClg(1, 3); // 依次打印：1, 2, 3
```

### 实现 函数原型方法 call

使用一个指定的 this 值和一个或多个参数来调用一个函数。

```javascript
Function.prototype.call2 = function (obj) {
  obj = obj ? Object(obj) : window; // 绑定为 null 时指向全局
  obj.fn = this; // this 是 dmeoFunc（即 call2 的调用源）
  let args = [...arguments].slice(1); // 剩余的参数
  let result = obj.fn(...args);
  delete obj.fn;
  return result;
};

function dmeoFunc(age, color) {
  console.log(this.name, age, color);
}

const cat = {
  name: "Tom",
};
dmeoFunc.call(cat, 3, "yellow");
dmeoFunc.call2(cat, 3, "yellow");
dmeoFunc.apply(cat, [3, "yellow"]);
dmeoFunc.apply2(cat, [3, "yellow"]);
console.log(Object.prototype.toString.call2([]));
// 如果不让用 ES6 展开运算符的话，会麻烦不少，
```

### 实现 函数原型方法 apply

apply 区别是 函数参数用数组传入。TODO：null 等边界情况未考虑

```javascript
Function.prototype.apply2 = function (obj) {
  obj = obj ? Object(obj) : window;
  obj.fn = this; // this 是 dmeoFunc（即 call2 的调用源）
  let args = arguments[1]; // 剩余的参数
  let result = obj.fn(...args);
  delete obj.fn;
  return result;
};
```

### 实现 函数原型方法 bind

bind 是返回一个绑定了 this 的函数，支持柯里化

```javascript
Function.prototype.bind2 = function (obj) {
  const partArgs = [...arguments].slice(1); // [0] 是 dmeoFunc
  obj = obj ? Object(obj) : window;
  obj.fn = this; // this 是 dmeoFunc
  return function (...args) {
    return obj.fn(...partArgs, ...args);
  };
};

function dmeoFunc(age, color) {
  console.log(this.name, age, color);
}

const cat = {
  name: "Tom",
};
const boundFunc = dmeoFunc.bind(cat, 3);
boundFunc("yellow");
const boundFuncTest = dmeoFunc.bind2(cat, 3);
boundFuncTest("yellow");
new boundFunc(); // undefined 3 undefined
new boundFuncTest(); // Tom 3 undefined

// 可以看到 new 调用时 this 指向不太对 参考 https://www.cnblogs.com/echolun/p/12178655.html
```

## 排序

### 冒泡

时间 O(n^2)

```typescript
function bubbleSort(nums: number[]): number[] {
  const result = [...nums];
  let rightPtr = result.length - 1;
  while (rightPtr > 0) {
    for (let index = 0; index < rightPtr; index++) {
      if (result[index] > result[index + 1]) {
        // 左边大于右边的话就交换
        [result[index], result[index + 1]] = [result[index + 1], result[index]];
      }
    }
    // 这时 rightPtr-1 ~ result.length-1 的都已经是有序的了
    rightPtr -= 1;
  }
  return result;
}
const sourceArray: number[] = [77, 10, 7, 15, 3];
console.log(bubbleSort(sourceArray));
```

### 选择排序

遍历数组选出最小值，从原数组删除，写入新数组。时间 O(n^2)

```typescript
function chooseSort(nums: number[]): number[] {
  const result: number[] = [];
  const backupArr = [...nums];
  while (backupArr.length > 0) {
    let minValue: number = backupArr[0],
      minIndex: number = 0;
    for (let index = 1; index < backupArr.length; index++) {
      if (backupArr[index] < minValue) {
        minValue = backupArr[index];
        minIndex = index;
      }
    }
    result.push(minValue);
    backupArr.splice(minIndex, 1);
  }
  return result;
}
const sourceArray: number[] = [77, 10, 7, 15, 3];
console.log(chooseSort(sourceArray));
```

### 计数排序

需要先知道最小值 最大值，生成一个长度是其差值+1 的数组，遍历原，计数，遍历新数组，输出结果。

时间 O(m+n)，空间消耗大（在 js 中是不是还可以受益于稀疏数组？），需要知道最大值最小值。

```typescript
function countSort(nums: number[]): number[] {
  // 假设已经知道 最小值 10，最大值 150 了，这不重要。
  const minValue = 10,
    maxValue = 150;
  const countArr: number[] = new Array(maxValue - minValue + 1); // 不填充 0，可以省下空间？
  for (let index = 0; index < nums.length; index++) {
    if (countArr[nums[index] - minValue] === undefined) {
      countArr[nums[index] - minValue] = 1;
    } else {
      countArr[nums[index] - minValue] += 1;
    }
  }
  const result: number[] = [];
  for (let index = 0; index < countArr.length; index++) {
    if (countArr[index] > 0) {
      // countArr[index] 个 minValue + index
      for (let pushCount = 1; pushCount <= countArr[index]; pushCount++) {
        result.push(minValue + index);
      }
    }
  }

  return result;
}
const sourceArray: number[] = [77, 11, 17, 10, 13, 15, 17, 13];
console.log(countSort(sourceArray));
```

### 快速排序

选一个基准值，开三个数组存分别存比基准值小的，一样的，大的。然后对小的大的数组递归调用，与中间的结果拼接起来。

平均时间复杂度 O(nlog n)，最坏 O(n^2)，稳定性不如归并排序。随机取基准值的话是稳定的 O(nlog n)。空间复杂度 O(log n)。

```typescript
function quickSort(nums: number[]): number[] {
  if (nums.length < 2) {
    return nums;
  }
  const pickOneValue = nums[Math.floor(Math.random() * nums.length)]; // 随机取基准值
  const lower: number[] = [];
  const equal: number[] = [];
  const higher: number[] = [];
  nums.forEach((item) => {
    if (item === pickOneValue) {
      equal.push(item);
    } else {
      item > pickOneValue ? higher.push(item) : lower.push(item);
    }
  });
  return [...quickSort(lower), ...equal, ...quickSort(higher)];
}
const sourceArray: number[] = [77, 11, 17, 10, 13, 15, 17, 13];
console.log(quickSort(sourceArray));
```

## ES6 和更新的语法/提案

只记录了一些平时很少用，没有注意到的。

### ES6 Proxy

[https://es6.ruanyifeng.com/#docs/proxy](https://es6.ruanyifeng.com/#docs/proxy)

Proxy 对象使你能够包装目标对象 通过这样可以拦截和重新定义该对象的基本操作。Vue3 的响应式就是基于它的。

```typescript
interface DetailInfo {
  auther?: string;
  buyUrl?: string;
}
interface Book {
  name: string;
  price?: number;
  detailInfo: DetailInfo;
}
const book: Book = {
  name: "深入浅出 Node.js",
  // price: 25, // 稍后测试一下 新增的属性能否监听
  detailInfo: {
    auther: "Ming",
  },
};

const handler: ProxyHandler<Book> = {
  get: function (target: Book, prop: string | symbol, receiver): any {
    console.info("[Proxy]访问", prop);
    return target[prop];
  },
  set: function (target: Book, prop: string | symbol, value): boolean {
    console.info("[Proxy]修改", prop, value);
    if (prop === "price" && value <= 0) {
      throw new RangeError("价格数值不正确");
    }
    target[prop] = value;
    return true; // 这个似乎没有作用
  },
};

const wrappedBook = new Proxy(book, handler);
console.log("wrappedBook.name ->", wrappedBook.name);
wrappedBook.price = 25;
console.log("wrappedBook.price ->", wrappedBook.price);
// wrappedBook.price = -1;
// console.log("wrappedBook.price ->", wrappedBook.price);

wrappedBook.detailInfo.auther = "Aaa"; // 只拦截到 detailInfo，用它实现响应式 也还是需要递归调用的
```

测试一下 其他的 proxy 属性

```typescript
var twice: ProxyHandler<Function> = {
  apply(target, ctx, args) {
    // console.log(arguments);
    return Reflect.apply(arguments[0], arguments[1], arguments[2]) * 2;
  },
};
function sum(left: number, right: number) {
  return left + right;
}
var sumProxied = new Proxy(sum, twice);
sumProxied(1, 2); // (1+2)*2
sumProxied.call(null, 5, 6); // call 实际上也是调用 apply？这一段没看明白
sumProxied.apply(null, [7, 8]);
```

### 模板字符串

拼接字符串时尽量用它。`` const foo = `this is a ${example}`; ``

### Symbol

当标识对象键的唯一值，防止与其他地方在该对象上使用的键名冲突。且它不会被 `for..in` 或者`Object.keys()`遍历到。

```javascript
var isOk = Symbol("isOk");
window[isOk] = true;
if (window[isOk]) {
  // do something
}
```

也可以作为对象内部的私有变量，外部无法通过键名来访问。

### for..of

结合了 forEach 的简洁性和中断循环的能力

`for (const v of ['a', 'b', 'c'])` // a b c

`for (const [i, v] of ['a', 'b', 'c'].entries())` // 0 'a'...

遍历 map

```javascript
let map = new Map([
  [1, "one"],
  [2, "two"],
  [3, "three"],
]);

map.keys();
map.values();
map.entries();

for (let [key, value] of map.entries()) {
  console.log(key);
}
```

### 装饰器

[https://github.com/mqyqingfeng/Blog/issues/109](https://github.com/mqyqingfeng/Blog/issues/109)

```javascript
function log(target, name, descriptor) {
  var oldValue = descriptor.value;

  descriptor.value = function (...args) {
    console.log(`Calling ${name} with`, args);
    return oldValue.apply(this, args);
  };

  return descriptor;
}

class MathMy {
  @log // 它可以是一个高阶函数，比如传入防抖间隔
  add(a, b) {
    return a + b;
  }
}
```

### 函数的默认值

可以直接写在入参参数名后面。`function test(quantity = 1) {}`

### 双冒号运算符

看着不错，不过并没有使用机会。

`obj::func;` 等同于 func.bind(obj);

### 可选链

对于深层级对象取值、函数调用都很不错。

```javascript
const obj = {
  foo: {
    bar: {
      baz: 42,
    },
  },
};

const baz = obj?.foo?.bar?.baz; // 42

function test() {
  return 42;
}
test?.(); // 42
```

### 逻辑分配运算符

- ??= 逻辑无效分配。逻辑空值分配仅在左侧变量为`null`或`undefined`时才分配右值到左值。

- &&= 逻辑与赋值。`x &&= y` 等于 `x && (x = y);`。

{% raw %}
- ||= 逻辑或分配。`x ||= y` 等于 `x || (x = y);`。左值 truthy 时，右值不会分配给左值。
{% endraw %}

### 空值合并运算符 ??

当左侧的操作数为 null 或者 undefined 时，返回其右侧操作数，否则返回左侧操作数。

`a ?? b` 等于 `(a !== null && a !== void 0) ? a : b`

逻辑或操作符`||`还会在左值为假值（如 0、""）时返回右值。

```javascript
const foo = null ?? "default";
console.log(foo); // "default"

const baz = 0 ?? 42;
console.log(baz); // 0。用 || 的话就是 42。
```

### 管道操作符 |>

又是一个用不上的，直接看示例就懂了。

```javascript
const double = (n) => n * 2;
const increment = (n) => n + 1;

double(increment(double(5))); // 22

5 |> double |> increment |> double; // 22
```

## 参考资料

- [死磕 36 个 JS 手写题（搞懂后，提升真的大）](https://juejin.cn/post/6946022649768181774)
- [JavaScript 深入之 call 和 apply 的模拟实现](https://segmentfault.com/a/1190000009257663)
- [js 五种绑定彻底弄懂 this，默认绑定、隐式绑定、显式绑定、new 绑定、箭头函数绑定详解](https://www.cnblogs.com/echolun/p/11962610.html)

-END-
