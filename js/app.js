const { dialog } = require("@electron/remote");
const fs = require('fs');
const HOME_DIRECTORY = require('os').homedir();

let editor = ace.edit("editor", {selectionStyle: "text"});
editor.resize()
editor.setTheme("ace/theme/dawn");
editor.getSession().setMode("ace/mode/latex");
editor.getSession().setUseSoftTabs(true);

let previewDisplay = document.getElementById("previewDisplay");

let text = editor.getValue();
let generator = new latexjs.HtmlGenerator({ hyphenate: false })

generator = latexjs.parse(text, { generator: generator })
document.head.appendChild(generator.stylesAndScripts("https://cdn.jsdelivr.net/npm/latex.js@0.12.4/dist/"))
previewDisplay.innerHTML = generator.domFragment().children[0].innerHTML;
document.body.appendChild(generator.domFragment())

editor.session.on("change", (e) => {
    let text = editor.getValue();
    console.log(text)
    let generator = new latexjs.HtmlGenerator({ hyphenate: false })

    try {
        generator = latexjs.parse(text, { generator: generator })

        document.head.appendChild(generator.stylesAndScripts("https://cdn.jsdelivr.net/npm/latex.js@0.12.4/dist/"))
        previewDisplay.innerHTML = generator.domFragment().children[0].innerHTML;
        document.body.appendChild(generator.domFragment())
    } catch (error) {
        console.log(error)
    }
});

const saveButton = document.querySelector('#save');
saveButton.onclick = saveFile;

console.log(HOME_DIRECTORY);

function saveFile () {
    const contents = editor.getValue();

    dialog.showSaveDialog({
        buttonLabel: 'Save Document',
        defaultPath: `${HOME_DIRECTORY}/Desktop`,
        filters: [
            { name: 'LaTeX Document', extensions: '.tex' }
        ]
    }).then(res => {
        if (!res.canceled) fs.writeFile(res.filePath, contents, () => console.log('File successfully saved!'));
    }).catch(err => {
        console.log(err);
    });
}
