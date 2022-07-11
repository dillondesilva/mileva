const { dialog } = require("@electron/remote");
const fs = require('fs');
const $ = require("jquery");
const HOME_DIRECTORY = require('os').homedir();

let editor;
let pendingCalls = 0;

const graphingToolPopover = document.getElementById('graphingToolPopover');
const mainView = document.getElementById('mainView');
const desmos = require('desmos');
const { throws } = require("assert");
const { contextIsolated } = require("process");
const elt = document.createElement('div');

elt.setAttribute("id", "desmosCalc")
elt.style.width = '60vw';
elt.style.height = '80vh';
elt.style.zIndex = 12;
elt.style.position = 'absolute';
elt.style.margin = '0 auto';
elt.style.transform = 'translate(-50%, -0%)';
elt.style.top = '0vh';
elt.style.left = '50%';

const calculator = desmos.GraphingCalculator(elt, {border: false});

let screenshot;

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

    const insertEqnButton = document.querySelector("#btnEqnInsert");
    insertEqnButton.onclick = insertEquation;

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
                            if (child.classList.contains('childFolderIcon') || child.classList.contains('file')) {
                                child.classList.add('hide');
                            }
                        }

                        createFolderClickHandeler(folderIcon);
                    }
                }
            }
        });
    }
}

function createFolderClickHandeler (folderIcon) {
    $(folderIcon).click(evt => {
        const target = $(evt.target).parent().parent();

        for (let child of $(target).children()) {
            if (child.classList.contains('childFolderIcon')) {
                child.classList.toggle('hide');
                createFolderClickHandeler(child);
            } else if (child.classList.contains('file')) {
                child.classList.toggle('hide');
            } else if (child.classList.contains('icon-text')) {
                $(child).children('.icon').children('i').toggleClass('fa-folder');
                $(child).children('.icon').children('i').toggleClass('fa-folder-open');
            }
        }
    });
}

function createEditorInstance () {
    editor = ace.edit("editor", {selectionStyle: "text"});
    editor.resize()
    editor.setTheme("ace/theme/monokai");
    editor.getSession().setMode("ace/mode/latex");
    editor.getSession().setUseSoftTabs(true);

    let previewDisplay = document.getElementById("previewDisplay");

    let text = editor.getValue();
    let generator = new latexjs.HtmlGenerator({ hyphenate: false });

    generator = latexjs.parse(text, { generator: generator })
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
        
            args['graph'] = ['H', 'g']

            prototype['graph'] = function(expr) {
                expr = "y=" + expr.data;

                graphScreenshot(expr);
            };
        
            return CustomMacros;
          }()) })

        try {
            generator = latexjs.parse(text, { generator: generator });

            document.head.appendChild(generator.stylesAndScripts("https://cdn.jsdelivr.net/npm/latex.js@0.12.4/dist/"))
            // previewDisplay.innerHTML = generator.domFragment().children[0].innerHTML;
            // document.body.appendChild(generator.domFragment());
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

function displayFolder (folderPath, parentPath, parentNode=true, parentEl=null, file=false) {
    let folderName;
    let foldersList = folderPath.includes('/') ? folderPath.split('/') : folderPath.split('\\');

    folderName = foldersList[foldersList.length - 1];

    let folderBtnBounding = document.querySelector(".openFolderBtnBounding");

    let folderEl;

    let openFolderPrompt = document.getElementById("openFolderPrompt");
    openFolderPrompt.style.display = "none";

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
    } else if (!file) {
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
        folderEl.classList.add('childFolderIcon');
        folderEl.appendChild(iconTextEl);

        parentEl.appendChild(folderEl);
    } else {
        let iconEl = document.createElement("i");
        iconEl.classList.add("fa-solid");
        iconEl.classList.add("fa-file-lines");

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
        folderEl.classList.add("file");
        folderEl.appendChild(iconTextEl);

        parentEl.appendChild(folderEl);
    }

    if (!file) {
        fs.readdirSync(parentPath, {withFileTypes: true}).forEach(dirent => {
            if (dirent.isDirectory()) {
                displayFolder(dirent.name, path.join(parentPath, dirent.name), false, folderEl);
            } else if (dirent.isFile() && dirent.name.match(/.*\.tex/)) {
                displayFolder(dirent.name, path.join(parentPath, dirent.name), false, folderEl, true);
            }
        });
    }
}

// graphingToolOpen() toggles the graphing tool view and 
function graphingToolOpen() {
    graphingToolPopover.style.display = 'block';

    mainView.style.opacity = '0.4';

    calculator.setExpression({ id: 'graph1', latex: 'y=x^2' })
    console.log(calculator.getExpressions());
    graphingToolPopover.appendChild(elt);
}

function cancelGraph() {
    graphingToolPopover.style.display = 'none';
    mainView.style.opacity = '1';
}

function insertGraph() {
    let expr = calculator.getExpressions()[0].latex;
    expr = expr.replace('y=', '')
    expr = expr.replace('^', '\\textasciicircum')
    let graphLatex = "\n " + "\\graph{" + expr + "}\n";
    
    editor.session.insert(editor.getCursorPosition(), graphLatex);
    graphingToolPopover.style.display = 'none'; 
    mainView.style.opacity = '1';
    return;
}

// function setEquation() {
//     calculator
// }

function refreshPreview(screenshot) {
    console.log(screenshot)
    let text = editor.getValue();

    let generator = new latexjs.HtmlGenerator({ hyphenate: false, CustomMacros: (function() {
        var args      = CustomMacros.args = {},
            prototype = CustomMacros.prototype;
    
        function CustomMacros(generator) {
          this.g = generator;
        }
    
        args['graph'] = ['H', 'g']

        prototype['graph'] = function(expr) {
            console.log(screenshot);
            return [screenshot];
        };
    
        return CustomMacros;
      }()) })

    try {
        generator = latexjs.parse(text, { generator: generator });

        document.head.appendChild(generator.stylesAndScripts("https://cdn.jsdelivr.net/npm/latex.js@0.12.4/dist/"))
        previewDisplay.innerHTML = generator.domFragment().children[0].innerHTML;
        document.body.appendChild(generator.domFragment());
    } catch (error) {
        console.log(error)
    }
}

function graphScreenshot(eqn) {
    var screenshotTempElt = document.createElement('div');
    screenshotTempElt.style.display = "none";

    calculator.setExpression({id: "graph1", latex: eqn });

    var screenshot = calculator.screenshot();
    calculator.asyncScreenshot((data) => {
        screenshot = document.createElement('img');

        screenshot.width = 200;
        screenshot.height = 200;
        screenshot.src = data; 

        refreshPreview(screenshot);
    });  
}

function insertEquation() {
    let eqnText = "\n$$"
    editor.session.insert(editor.getCursorPosition(), eqnText);
    let newCursorPos = editor.getCursorPosition();
    newCursorPos.column -= 1;
    editor.moveCursorToPosition(newCursorPos);
    editor.clearSelection();
    editor.focus();
}