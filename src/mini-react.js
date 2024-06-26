(function () {
  //总览
  //jsx 通过render function（注意这个render function不是我们react实现的render函数这两只是名字相似，我们在react里面具体实现的render function是 createElement）进行加工变成vdom
  //然后vdom经过加工变成fiber链表，然后执行fiber链表
  //记住这里的fiber链表是边构成边执行的
  //详细的说就是走完了一个完整组件的fiber链表就去渲染一遍
  //然后再去搞下一个组件
  //整个构建和渲染的流程都是在一个主循环里面完成的（就是类似于游戏一样，一直在一个主循环里面执行）
  //大致结构讲解完毕， 至于具体怎么构建， 构建时候怎么更新，渲染， 以及如何不阻塞页面，就看具体函数就行

  //为什么要实现这个函数？
  //上面我们说过jsx变成vdom
  //其实中间的流程具体是这样
  //先由bable/tsc将jsx编译成react.createElement(类型， 参数， 子元素)
  //然后再由这个createElement实现将其转换为vdom， 这就是加工的整体细节

  //下面看这个函数， createElement返回对象， 其中children是用对象数组， 如果子元素是数字或字符， 直接返回一个node节点， 否则返回这个元素执行后的值
  function createElement(type, props, ...children) {
    return {
      type,
      props: {
        ...props,
        children: children.map((child) => {
          const isTextNode =
            typeof child === "string" || typeof child === "number";
          return isTextNode ? createTextNode(child) : child;
        }),
      },
    };
  }

  //这是创建字符/数字节点
  function createTextNode(nodeValue) {
    return {
      type: "TEXT_ELEMENT",
      props: {
        nodeValue,
        children: [],
      },
    };
  }

  let nextUnitOfWork = null; //这个是指向下一个要处理的fiber节点
  let wipRoot = null; //这个是指向当前fiber链表的根节点
  let currentRoot = null; //指向上一个fiber链表的根节点
  let deletions = null; //更新后需要删除的元素的数组

  //这个render函数是用来初始化的
  //也就是用户调用的那个render
  function render(element, container) {
    wipRoot = {
      dom: container,
      props: {
        children: [element],
      },
      alternate: currentRoot,
    };

    deletions = [];

    nextUnitOfWork = wipRoot;
  }

  //重头戏来了， 这个minireact框架能跑起来，进行一系列更新渲染， 和并发模式都靠这个
  //但是怎么实现这个主循环呢
  //react中是自己实现的调度器，
  //我这边是用浏览器的api来实现时间分片的requestIdleCallback
  //其实这个api就是利用一帧渲染之后的剩余时间来执行下面的脚本
  function workLoop(deadline) {
    let shouldYield = false;
    while (nextUnitOfWork && !shouldYield) {
      nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
      shouldYield = deadline.timeRemaining() < 1; //这里deadline是requestIdleCallback传过来的数
    }

    if (!nextUnitOfWork && wipRoot) {
      commitRoot();
    }

    requestIdleCallback(workLoop);
  }

  //这个 requestIdleCallback 它有的浏览器不支持怎么办？自己实现一个
  //浏览器一帧执行正常是16.6ms 如果执行时间大于这个值 可以任务浏览器处于繁忙状态。否则即代表空闲。
  //因为requestAnimationFrame这个函数是和渲染保持同步的 可以通过函数获取帧的开始时间，然后使用帧率(开始时间+16.6ms)计算出帧的结束时间, 然后开启一个宏任务，当宏任务被执行时 比较当前的执行时间和帧结束的时间 判断出当前帧是否还有空闲
  //因为是宏任务不会像微任务优先级那么高，可以被推迟到下一个事件循环中不会阻塞渲染。这里使用MessageChannel宏任务来实现。
  //其实核心就是 获取一帧渲染剩余时间+让执行的任务不阻塞下一次渲染
  window.requestIdleCallback =
    window.requestIdleCallback ||
    function (callback, params) {
      const channel = new MessageChannel(); // 建立宏任务的消息通道
      const port1 = channel.port1;
      const port2 = channel.port2;
      const timeout = params === undefined ? params.timeout : -1;
      let cb = callback;
      let frameDeadlineTime = 0; // 当前帧结束的时间
      const begin = performance.now();
      let cancelFlag = 0;
      const frameTime = 16.6;
      const runner = (timeStamp) => {
        // 获取当前帧结束的时间
        frameDeadlineTime = timeStamp + frameTime;
        if (cb) {
          port1.postMessage("task");
        }
      };
      port2.onmessage = () => {
        const timeRemaining = () => {
          const remain = frameDeadlineTime - performance.now();
          return remain > 0 ? remain : 0;
        };
        let didTimeout = false;
        if (timeout > 0) {
          didTimeout = performance.now() - begin > timeout;
        }
        // 没有可执行的回调 直接结束
        if (!cb) {
          return;
        }
        // 当前帧没有时间&没有超时 下次再执行
        if (timeRemaining() <= 1 && !didTimeout) {
          cancelFlag = requestAnimationFrame(runner);
          return cancelFlag;
        }
        //有剩余时间或者超时
        cb({
          didTimeout,
          timeRemaining,
        });
        cb = null;
      };
      cancelFlag = requestAnimationFrame(runner);
      return cancelFlag;
    };

  requestIdleCallback(workLoop);

  //这个函数上面是构建fiber链表（一开始是初始化， 后面是更新）， 下面是返回fiber链表的fiber节点
  function performUnitOfWork(fiber) {
    const isFunctionComponent = fiber.type instanceof Function;
    if (isFunctionComponent) {
      updateFunctionComponent(fiber);
    } else {
      updateHostComponent(fiber);
    }
    if (fiber.child) {
      return fiber.child;
    }
    let nextFiber = fiber;
    while (nextFiber) {
      if (nextFiber.sibling) {
        return nextFiber.sibling;
      }
      nextFiber = nextFiber.return;
    }
  }

  let wipFiber = null; //当前fiber节点
  let stateHookIndex = null; //为了存取前一个fiber节点的useState的hook函数并将其执行完而设立的坐标， 
  //为什么effect hook没有这种坐标？
  //因为useEffect, 是通过队列搞定的

  //初始化/更新 函数组件的fiber节点
  function updateFunctionComponent(fiber) {
    wipFiber = fiber;
    stateHookIndex = 0;
    wipFiber.stateHooks = []; //挂载
    wipFiber.effectHooks = [];

    const children = [fiber.type(fiber.props)];
    reconcileChildren(fiber, children);
  }

  //这里是初始化/更新原生组件的fiber节点
  //为啥要把原生和函数分开？
  //原生有fom需要创建， 函数组件无dom， 并且它们的处理子节点的方式也不一样
  function updateHostComponent(fiber) {
    if (!fiber.dom) {
      fiber.dom = createDom(fiber);
    }
    reconcileChildren(fiber, fiber.props.children);
  }

  //创建dom节点
  function createDom(fiber) {
    const dom =
      fiber.type == "TEXT_ELEMENT"
        ? document.createTextNode("")
        : document.createElement(fiber.type);

    updateDom(dom, {}, fiber.props);//添加dom节点内容

    return dom;
  }

  const isEvent = (key) => key.startsWith("on");
  const isProperty = (key) => key !== "children" && !isEvent(key);
  const isNew = (prev, next) => (key) => prev[key] !== next[key];
  const isGone = (prev, next) => (key) => !(key in next);

  //可做初始化使用 ， 或者根据 前面遍历子节点的时候打好的标签进行更新操作（这一步在commitRoot里面才执行）
  function updateDom(dom, prevProps, nextProps) {
    //Remove old or changed event listeners
    Object.keys(prevProps)
      .filter(isEvent)
      .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
      .forEach((name) => {
        const eventType = name.toLowerCase().substring(2);
        dom.removeEventListener(eventType, prevProps[name]);
      });

    // Remove old properties
    Object.keys(prevProps)
      .filter(isProperty)
      .filter(isGone(prevProps, nextProps))
      .forEach((name) => {
        dom[name] = "";
      });

    // Set new or changed properties
    Object.keys(nextProps)
      .filter(isProperty)
      .filter(isNew(prevProps, nextProps))
      .forEach((name) => {
        dom[name] = nextProps[name];
      });

    // Add event listeners
    Object.keys(nextProps)
      .filter(isEvent)
      .filter(isNew(prevProps, nextProps))
      .forEach((name) => {
        const eventType = name.toLowerCase().substring(2);
        dom.addEventListener(eventType, nextProps[name]);
      });
  }

  //构建子组件的fiber节点
  //在构建之前， 我们给新旧节点上标记
  // 遍历比较新旧两组fiber节点的子元素 ， 打上删除/新增/更新 三种标记effectTag， 其中删除标记要存在上面创建的deletions数组中
  function reconcileChildren(wipFiber, elements) {
    let index = 0;
    let oldFiber = wipFiber.alternate?.child;
    let prevSibling = null;

    while (index < elements.length || oldFiber != null) {
      const element = elements[index];
      let newFiber = null;

      const sameType = element?.type == oldFiber?.type;

      if (sameType) {
        newFiber = {
          type: oldFiber.type,
          props: element.props,
          dom: oldFiber.dom,
          return: wipFiber,
          alternate: oldFiber,
          effectTag: "UPDATE",
        };
      }
      if (element && !sameType) {
        newFiber = {
          type: element.type,
          props: element.props,
          dom: null,
          return: wipFiber,
          alternate: null,
          effectTag: "PLACEMENT",
        };
      }
      if (oldFiber && !sameType) {
        oldFiber.effectTag = "DELETION";
        deletions.push(oldFiber);
      }

      if (oldFiber) {
        oldFiber = oldFiber.sibling;
      }

      if (index === 0) {
        wipFiber.child = newFiber;
      } else if (element) {
        prevSibling.sibling = newFiber;
      }

      prevSibling = newFiber;
      index++;
    }
  }

  function useState(initialState) {
    const currentFiber = wipFiber;

    const oldHook = wipFiber.alternate?.stateHooks[stateHookIndex];

    const stateHook = {
      state: oldHook ? oldHook.state : initialState,
      queue: oldHook ? oldHook.queue : [],
    };

    stateHook.queue.forEach((action) => {
      stateHook.state = action(stateHook.state);
    });

    stateHook.queue = [];

    stateHookIndex++;
    wipFiber.stateHooks.push(stateHook);

    function setState(action) {
      const isFunction = typeof action === "function";

      stateHook.queue.push(isFunction ? action : () => action);

      wipRoot = {
        ...currentFiber,
        alternate: currentFiber,
      };
      nextUnitOfWork = wipRoot;
    }

    return [stateHook.state, setState];
  }

  function useEffect(callback, deps) {
    const effectHook = {
      callback,
      deps,
      cleanup: undefined,
    };
    wipFiber.effectHooks.push(effectHook);
  }

  //先把删除的节点搞掉
  //然后再去执行子节点更新和新增

  function commitRoot() {
    deletions.forEach(commitWork);
    commitWork(wipRoot.child);
    commitEffectHooks();
    currentRoot = wipRoot;
    wipRoot = null;
    deletions = [];
  }

  //递归执行增删改查的工作， 将此时的fiber节点看成一颗二叉树， 左子树是fiber.child(孩子节点), 右子树是fiber.sibling（兄弟节点）
  function commitWork(fiber) {
    if (!fiber) {
      return;
    }

    let domParentFiber = fiber.return;
    while (!domParentFiber.dom) {
      domParentFiber = domParentFiber.return;
    }
    const domParent = domParentFiber.dom;

    if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
      domParent.appendChild(fiber.dom);
    } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
      updateDom(fiber.dom, fiber.alternate.props, fiber.props);
    } else if (fiber.effectTag === "DELETION") {
      commitDeletion(fiber, domParent);
    }

    commitWork(fiber.child);
    commitWork(fiber.sibling);
  }

  function commitDeletion(fiber, domParent) {
    if (fiber.dom) {
      domParent.removeChild(fiber.dom);
    } else {
      commitDeletion(fiber.child, domParent);
    }
  }

  function isDepsEqual(deps, newDeps) {
    if (deps.length !== newDeps.length) {
      return false;
    }

    for (let i = 0; i < deps.length; i++) {
      if (deps[i] !== newDeps[i]) {
        return false;
      }
    }
    return true;
  }

  //先清除之前状态的effect函数（就是调用之前状态的return），再去执行当前状态的effect
  function commitEffectHooks() {
    function runCleanup(fiber) {
      if (!fiber) return;

      fiber.alternate?.effectHooks?.forEach((hook, index) => {
        const deps = fiber.effectHooks[index].deps;

        if (!hook.deps || !isDepsEqual(hook.deps, deps)) {
          hook.cleanup?.();
        }
      });

      runCleanup(fiber.child);
      runCleanup(fiber.sibling);
    }

    function run(fiber) {
      if (!fiber) return;

      fiber.effectHooks?.forEach((newHook, index) => {
        if (!fiber.alternate) {
          newHook.cleanup = newHook.callback();
          return;
        }

        if (!newHook.deps) {
          newHook.cleanup = newHook.callback();
        }

        if (newHook.deps.length > 0) {
          const oldHook = fiber.alternate?.effectHooks[index];

          if (!isDepsEqual(oldHook.deps, newHook.deps)) {
            newHook.cleanup = newHook.callback();
          }
        }
      });

      run(fiber.child);
      run(fiber.sibling);
    }

    runCleanup(wipRoot);
    run(wipRoot);
  }

  const MiniReact = {
    createElement,
    render,
    useState,
    useEffect,
  };
  
//用立即执行函数包裹起来， 防止全局变量污染
  window.MiniReact = MiniReact;
})();
