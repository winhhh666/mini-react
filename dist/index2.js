"use strict";
const { render, useState, useEffect } = window.MiniReact;
function App() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => {
            setCount((count) => count + 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);
    return MiniReact.createElement("div", null,
        MiniReact.createElement("p", null, count));
}
render(MiniReact.createElement(App, null), document.getElementById('root'));
