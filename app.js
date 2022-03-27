const { parse, HtmlGenerator } = require('latex.js')

let editorText = document.getElementById("editorText");
let previewDisplay = document.getElementById("previewDisplay");
console.log(editorText);
console.log(previewDisplay);

editorText.addEventListener("input", (e) => {
    let generator = new HtmlGenerator({ hyphenate: false })
    let doc = parse(latex, { generator: generator }).htmlDocument()
    console.log(doc.documentElement.outerHTML);
    previewDisplay.innerHTML = editorText.innerText;   
})