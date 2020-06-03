// ==UserScript==
// @name         q.js
// @namespace    https://github.com/learnedtocode/qjs
// @version      0.2
// @description  Q board improvements
// @author       anonsw, __, learnedtocode
// @match        https://8kun.top/qresearch/*
// @grant        GM_getResourceText
// @grant        unsafeWindow
// @resource     qjs file:///C:/Users/learnedtocode/Desktop/qjs/q.js
// ==/UserScript==

(function() {
    var script = unsafeWindow.document.createElement('script');
    script.text = GM_getResourceText('qjs');
    unsafeWindow.document.querySelector('body').appendChild(script);
})();
