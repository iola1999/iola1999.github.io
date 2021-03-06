---
layout: post
title:  抓取、分析王者荣耀高分段战绩
date:   2019-04-11 21:43:00 +0800
categories: 折腾
tag: 数据分析
---

* content
{:toc}


很久之前就打算分析一下王者荣耀的战绩，奈何一直难以开始（懒）。大三下学期没有找实习，没参加比赛，也没什么拿得出手的项目，四月初又闲得要死，农药项目终于有了点进展。这里写篇博文记录一下这个过程。



2019/4/11			{#start}
------------------------------------

写了几天的代码，目前完成了玩家、对局数据积累的工作（Python 实现的）。
数据源是王者营地这款APP，因为很容易封战绩列表的查询接口（即使爬取频率非常慢也不行，12小时解封），所以需要准备多个账号（token）来爬。

代码放到了 [https://github.com/iola1999/python-work/tree/master/wzry](https://github.com/iola1999/python-work/tree/master/wzry) ，不过目前还没有开源（写得太烂了）。项目完成后再说吧，

这一过程中遇到了不少坑，目前也不知道从哪里说起。就先放一些图片凑个数。

![最近的git动态]({{ '/styles/images/WZRY-Analysis/git_0411.png' | prepend: site.baseurl  }})

![一些数据]({{ '/styles/images/WZRY-Analysis/wzry_data1.png' | prepend: site.baseurl  }})

关于数据分析，基础层次我打算做英雄胜率统计、玩家搜集（争取存下所有荣耀王者玩家）和对局质量分析，进阶一些，我打算尝试机器学习来评价阵容、预测胜率和推荐英雄（目前在采集数据时尽可能地为机器学习做准备了）。

有个计划参考的项目： [https://github.com/vpus/dota2-win-rate-prediction-v1](https://github.com/vpus/dota2-win-rate-prediction-v1) 



2019/4/13
------------------------------------
这两天主要的工作是加快采集数据的速度，注册了一堆农药小号来跑，没遇到过封禁了。

还有就是丰富了一些数据字段，比如。。。忘了。

上张图吧：

![对局数量、玩家数增长趋势0413]({{ '/styles/images/WZRY-Analysis/number_of_data_0413.png' | prepend: site.baseurl  }})

最近在入门前端。溜了。




待续			{#coming}
------------------------------------

2019.6.14 更新：后续的分析在做了，[第一篇](/2019/06/14/WZRY-Analysis-1)。