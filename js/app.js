const { dialog } = require("@electron/remote");
const fs = require('fs');
const $ = require("jquery");
const HOME_DIRECTORY = require('os').homedir();

let editor;
let pendingCalls = 0;

window.onload = () => {
    createEditorInstance();

    const saveButton = document.querySelector('#save');
    saveButton.onclick = saveFile;

    const directoryButton = document.querySelector("#directory");

    /*
    Required innerHTML

    <div class="parentFolderIcon"> 
        <span class="icon-text">
            <span class="icon">
                <i class="fas fa-caret-right"></i>
            </span>
            <span>Folder</span>
        </span>
    </div> 
    */

    directoryButton.onclick = () => {
        dialog.showOpenDialog({
            properties: ['openDirectory']
        }).then(res => {
            if (!res.canceled) {
                for (const filePath of res.filePaths) {
                    $(directoryButton).css('display', 'none');
                    $('.openFolderBtnBounding').css('padding', '2vh');

                    displayFolder(filePath, filePath);

                    let folderIcons = document.querySelectorAll('.parentFolderIcon, .childFolderIcon');

                    for (let folderIcon of folderIcons) {
                        for (let child of folderIcon.children) {
                            if (child.classList.contains('childFolderIcon')) {
                                child.classList.add('hide');
                            }
                        }

                        $(folderIcon).click(evt => {
                            const target = $(evt.target).parent().parent();

                            for (let child of $(target).children()) {
                                if (child.classList.contains('childFolderIcon')) {
                                    child.classList.toggle('hide');
                                } else if (child.classList.contains('icon-text')) {
                                    $(child).children('.icon').children('i').toggleClass('fa-folder');
                                    $(child).children('.icon').children('i').toggleClass('fa-folder-open');
                                }

                            }
                        });
                    }
                }
            }
        });
    }
}

function createEditorInstance () {
    editor = ace.edit("editor", {selectionStyle: "text"});
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
}

function saveFile () {
    const contents = editor.getValue();

    dialog.showSaveDialog({
        buttonLabel: 'Save Document',
        defaultPath: `${HOME_DIRECTORY}/Desktop/untitled.tex`,
        filters: [
            { name: 'LaTeX Document', extensions: ['tex'] }
        ]
    }).then(res => {
        if (!res.canceled) fs.writeFile(res.filePath, contents, () => console.log('File successfully saved!'));
    }).catch(err => {
        console.log(err);
    });
}

function displayFolder (folderPath, parentPath, parentNode=true, parentEl=null) {
    let folderName;

    if (folderPath.match(/(\\[^\\]+)$/)) {
        folderName = folderPath.match(/(\\[^\\]+)$/)[0];
        folderName = folderName.substr(1, folderName.length);
    } else {
        folderName = folderPath;
    }

    let folderBtnBounding = document.querySelector(".openFolderBtnBounding");

    let folderEl;

    if (parentNode) {
            /* 
            <div class="parentFolderIcon"> 
                <span class="icon-text">
                    <span class="icon">
                        <i class="fas fa-caret-right"></i>
                    </span>
                </span>
            </div>
            */

        let iconEl = document.createElement("i");
        iconEl.classList.add("fa-solid");
        iconEl.classList.add("fa-folder");

        let iconSpanEl = document.createElement("span");
        iconSpanEl.classList.add("icon");
        iconSpanEl.appendChild(iconEl);

        let nameEl = document.createElement("span");
        let nameNode = document.createTextNode(folderName);
        nameEl.appendChild(nameNode);

        let iconTextEl = document.createElement("span");
        iconTextEl.classList.add("icon-text");
        iconTextEl.appendChild(iconSpanEl);
        iconTextEl.appendChild(nameEl);

        folderEl = document.createElement("div");
        folderEl.classList.add('parentFolderIcon');
        folderEl.appendChild(iconTextEl);

        folderBtnBounding.appendChild(folderEl);
    } else {
        let iconEl = document.createElement("i");
        iconEl.classList.add("fa-solid");
        iconEl.classList.add("fa-folder");

        let iconSpanEl = document.createElement("span");
        iconEl.classList.add("icon");
        iconSpanEl.appendChild(iconEl);

        let nameEl = document.createElement("span");
        let nameNode = document.createTextNode(folderName);
        nameEl.appendChild(nameNode);

        let iconTextEl = document.createElement("span");
        iconTextEl.classList.add("icon-text");
        iconTextEl.appendChild(iconSpanEl);
        iconTextEl.appendChild(nameEl);

        folderEl = document.createElement("div");
        folderEl.classList.add('childFolderIcon');
        folderEl.appendChild(iconTextEl);

        parentEl.appendChild(folderEl);
    }

    fs.readdirSync(parentPath, {withFileTypes: true}).forEach(dirent => {
        if (dirent.isDirectory()) {
            displayFolder(dirent.name, path.join(parentPath, dirent.name), false, folderEl);
        }
    });
}

