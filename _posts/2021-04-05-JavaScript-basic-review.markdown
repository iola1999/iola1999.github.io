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

看下两种高亮有什么区别，下面这种不打算使用，只是看下区别。

{% highlight javascript%}
console.log(typeof new Date());
function getRealType(obj) {
  console.log(Object.prototype.toString.call(obj).split(" ")[1].replace("]", "").toLowerCase());
}
getRealType(new Date());
getRealType(() => {});
getRealType(null);
getRealType(new Function("console.log(123)"));
{% endhighlight %}


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

存在的问题：
+ 原型中包含的引用类型属性将被所有实例共享；
+ 子类在实例化的时候不能给父类构造函数传参；

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

-END-
