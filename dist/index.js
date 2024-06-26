"use strict";
const { render, useState, useEffect } = window.MiniReact;
function App() {
    const [count, setCount] = useState(0);
    function handleClick() {
        setCount((count) => count + 1);
    }
    return MiniReact.createElement("div", null,
        MiniReact.createElement("p", null, count),
        MiniReact.createElement("button", { onClick: handleClick }, "\u52A0\u4E00"));
}
render(MiniReact.createElement(App, null), document.getElementById('root'));
