# mini-react

一个迷你 react 实现， 实现了解析 jsx， render，useState, useEffect， 用浏览器的requestIdleCallback来实现模拟react调度器的效果并为了兼容性实现了这个api， 帮助你深入了解 react 的底层原理

##如何使用？

直接引入 src 中的 mini-react.js 就能使用

##如何在当前项目中测试这个 mini-react?

先用执行 npx tsc， 将源代码打包到 dist 文件夹中
在根目录下编写 html 代码， 引入 dist 文件夹中的源码和组件
然后直接将 html 用浏览器运行就行了， 本文提供了三个 html 例子， 可以自行查阅/使用
