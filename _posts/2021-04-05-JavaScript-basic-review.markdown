---
layout: post
title:  JavaScript 基础 review
date:  2021-04-05 12:00:00 +0800
categories: 笔记
tag: 
typora-root-url: ..
---

* content
{:toc}
![read_count](https://visitor-badge.glitch.me/badge?page_id=iola1999.blog.JavaScript-basic-review)

看了一篇 JavaScript 基础的文章，参考着手动写一遍常用的方法。

## 基础

### 类型识别

typeof 可以正确识别：Undefined、Boolean、Number、String、Symbol、Function 等类型的数据，但是对于其他的都会认为是 object，比如 Null、Date 等，所以通过 typeof 来判断数据类型会不准确。但是可以使用 Object.prototype.toString 实现。

```javascript
console.log(typeof new Date());
function getRealType(obj) {
  console.log(Object.prototype.toString.call(obj).split(" ")[1].replace("]", "").toLowerCase());
}
getRealType(new Date());
getRealType(() => {});
getRealType(null);
getRealType(new Function("console.log(123)"));
```

## 继承

### 原型链继承

存在的问题：
+ 原型中包含的引用类型属性将被所有实例共享；
+ 子类在实例化的时候不能给父类构造函数传参；

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
  Animal.call(this, name);  // 这样每份实例可以拥有自己独立的属性
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
const flatArray = array => {
  const result = [];
  array.forEach(item => {
    Array.isArray(item) ? result.push(...flatArray(item)) : result.push(item);
  });
  return result;
};
console.log(flatArray(source))
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
[1, 2, 3].forEach2(item => {
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
console.log([1, 2, 3].map2(item => item + "/"));
// 顺便：["1", "2", "3"].map(parseInt)//返回应该是 [1, NaN, NaN]。注意参数 .map((item, index) => parseInt(item, index));
```

### 实现 filter

```javascript
Array.prototype.filter2 = function (func, thisArg) {
  const backupArray = Object(this); // 防止被修改？
  const result = [];
  for (let i = 0; i < backupArray.length; i++) {
    func.call(thisArg, backupArray[i], i, backupArray) && result.push(backupArray[i]);
  }
  return result;
};
console.log([1, 2, 3].filter2(item => item > 1));
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
console.log([1, 2, 3].some2(item => item > 9));
```

### 实现 reduce

```javascript
// TODO 不熟悉，也很少使用，先过了
Array.prototype.reduce2 = function (func, initialValue) {
};
let arr = [2, 1, 4, 9];
arr.reduce((acc, current) => acc + current);//16
```

## 常用方法

###深浅拷贝

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
  return Object.prototype.toString.call(obj).split(" ")[1].replace("]", "").toLowerCase();
}
// 如何手动实现？递归。下面这个写法有些问题还没处理好 TODO:再看看吧，现在不想折腾了
const shallowCopy = obj => {
  let isArray = Array.isArray(obj);
  const result = isArray ? [] : {};
  if (isArray) {
    obj.forEach(item => {
      ["object", "array"].includes(getRealType(item))
        ? result.push(shallowCopy(item))
        : result.push(item);
    });
  } else {
    Object.keys(obj).forEach(key => {
      ["object", "array"].includes(getRealType(obj[key]))
        ? (result[key] = shallowCopy(obj[key]))
        : (result[key] = obj[key]);
    });
  }
  return result;
};
const _ = require("lodash");
var resultLodash = _.cloneDeep(source);
const resultMine = shallowCopy(source);
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
const queryStringParser = qs => {
  const result = {};
  qs.split("&").forEach(queryPart => {
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
console.log(strTemplateParser(strTemplate, { name: "Xiaoming", age: 17, "a\\{\\{b": "haha" }));
```

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

## 发布订阅 EventEmitter

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
    callbackQueue.forEach(cb => {
      cb(...args);
    });
  }
  off(eventName, fn) {
    if (fn) {
      this.events[eventName] = this.events[eventName].filter(fnItem => fnItem !== fn);
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

## html 原生开发相关

### 图片懒加载

TODO:这个不想写。直接看了原文。

```javascript
addEventListener('scroll', imgLazyLoad)
let rect = img.getBoundingClientRect()
if (rect.top < window.innerHeight) img.src = img.dataset.src // 以及已经显示过的图片移除掉。
```

### JSONP

原理就是新建一个 script，封装生成 url，window[callbackName]，拿到数据后 removeChild

### 封装 AJAX

new XMLHttpRequest() .open .setRequestHeader  .onreadystatechange

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
const curry = func => {
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
const { partial } = require("lodash");
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
  obj = obj ? Object(obj) : window;
  obj.fn = this; // this 是 dmeoFunc（即 call2 的调用源）
  let args = [...arguments].slice(1); // 剩余的参数
  let result = obj.fn(...args);
  delete obj.fn;
  return result;
};
function dmeoFunc(age, color) {
  console.log(this.name, age, color);
}
function Cat(name) {
  this.name = name;
}
const cat = new Cat("Tom");
dmeoFunc.call(cat, 3, "yellow");
dmeoFunc.call2(cat, 3, "yellow");
```

## 参考资料

+ juejin 6946022649768181774 下次更新再补链接，还有一个 segmentfault、一个 cnblogs

-END-
