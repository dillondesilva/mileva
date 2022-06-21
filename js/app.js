const { dialog } = require("@electron/remote");
const fs = require('fs');
const $ = require("jquery");
const HOME_DIRECTORY = require('os').homedir();

let editor;
let pendingCalls = 0;

const graphingToolPopover = document.getElementById('graphingToolPopover');
const desmos = require('desmos');
const elt = document.createElement('div');

elt.setAttribute("id", "desmosCalc")
elt.style.width = '60vw';
elt.style.height = '70vh';
elt.style.zIndex = 12;
elt.style.position = 'absolute';
elt.style.margin = '0 auto';
elt.style.transform = 'translate(-50%, -0%)';
elt.style.top = '0vh';
elt.style.left = '50%';

const calculator = desmos.GraphingCalculator(elt, {border: false})

window.onload = () => {
    createEditorInstance();

    const saveButton = document.querySelector('#save');
    saveButton.onclick = saveFile;

    const directoryButton = document.querySelector("#directory");

    const gridButton = document.querySelector("#grid");
    gridButton.onclick = graphingToolOpen;

    const insertGraphButton = document.querySelector("#btnInsert");
    btnInsert.onclick = insertGraph;

    const cancelGraphButton = document.querySelector("#btnCancel");
    btnCancel.onclick = cancelGraph;

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
    
    // document.body.append(elt)

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

                    console.log(folderIcons);

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
    document.head.appendChild(generator.stylesAndScripts("https://cdn.jsdelivr.net/npm/latex.js@0.12.4/dist/"));
    previewDisplay.innerHTML = generator.domFragment().children[0].innerHTML;
    document.body.appendChild(generator.domFragment());

    editor.session.on("change", (e) => {
        let text = editor.getValue();
        let generator = new latexjs.HtmlGenerator({ hyphenate: false, CustomMacros: (function() {
            var args      = CustomMacros.args = {},
                prototype = CustomMacros.prototype;
        
            function CustomMacros(generator) {
              this.g = generator;
            }
        
            args['bf'] = ['HV']
            prototype['bf'] = function() {
              this.g.setFontWeight('bf')
            };
        
            return CustomMacros;
          }()) })

        try {
            generator = latexjs.parse(text, { generator: generator })

            document.head.appendChild(generator.stylesAndScripts("https://cdn.jsdelivr.net/npm/latex.js@0.12.4/dist/"));
            previewDisplay.innerHTML = generator.domFragment().children[0].innerHTML;
            document.body.appendChild(generator.domFragment());
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
        iconEl.classList.add("fas");
        iconEl.classList.add("fa-caret-right");

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
        iconEl.classList.add("fas");
        iconEl.classList.add("fa-caret-right");

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

// graphingToolOpen() toggles the graphing tool view and 
function graphingToolOpen() {
    graphingToolPopover.style.display = 'block';

    calculator.setExpression({ id: 'graph1', latex: 'y=x^2' })
    console.log(calculator.getExpressions());
    graphingToolPopover.appendChild(elt);
}

function cancelGraph() {
    graphingToolPopover.style.display = 'none';
}

function insertGraph() {
    let graphLatex = "\n " + calculator.getExpressions()[0].latex;
    editor.session.insert(editor.getCursorPosition(), graphLatex);
    graphingToolPopover.style.display = 'none'; 
    return;
}