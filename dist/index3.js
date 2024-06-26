"use strict";
const { render, useState, useEffect } = window.MiniReact;
function Counter(props) {
    const { initialNum, interval } = props;
    const [count, setCount] = useState(initialNum);
    useEffect(() => {
        const timer = setInterval(() => {
            setCount((count) => count + 1);
        }, interval);
        return () => clearTimeout(timer);
    }, []);
    return MiniReact.createElement("div", null,
        MiniReact.createElement("p", null, count));
}
function App() {
    return MiniReact.createElement(Counter, { interval: 1000, initialNum: 10 });
}
render(MiniReact.createElement(App, null), document.getElementById('root'));
