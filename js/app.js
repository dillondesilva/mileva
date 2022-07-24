const { dialog } = require("@electron/remote");
const fs = require('fs');
const Swal = require('sweetalert2')
const $ = require("jquery");
const HOME_DIRECTORY = require('os').homedir();

let editor;
let pendingCalls = 0;

let previewDisplay = document.getElementById("previewDisplay");
let folderSelector = document.getElementById("folderSelector");

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
let renderContainsImage = false;

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

    const exportButton = document.querySelector("#btnExport");
    exportButton.onclick = exportToPDF;

    directoryButton.onclick = () => {
        dialog.showOpenDialog({
            properties: ['openDirectory']
        }).then(res => {
            if (!res.canceled) {
                for (const filePath of res.filePaths) {
                    $(directoryButton).css('display', 'none');
                    $('.openFolderBtnBounding').css('padding', '0.25vw');

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

    let text = editor.getValue();
    let generator = new latexjs.HtmlGenerator({ hyphenate: false });

    generator = latexjs.parse(text, { generator: generator });

    let doc = generator.htmlDocument();

    let stylesInfo = doc.head.innerHTML;
    let content = doc.body.innerHTML;

    previewDisplay.innerHTML = content;

    editor.session.on("change", (e) => {
        let text = editor.getValue();
        let graphsToRender = [];
        let generator = new latexjs.HtmlGenerator({ hyphenate: false, CustomMacros: (function() {
            var args      = CustomMacros.args = {},
                prototype = CustomMacros.prototype;
        
            function CustomMacros(generator) {
              this.g = generator;
            }
        
            args['graph'] = ['H', 'g']

            prototype['graph'] = function(expr) {
                let exprAnnotated = expr.querySelector('annotation');
                expr = "y=" + exprAnnotated.innerHTML;
                console.log(expr)
                graphScreenshot(expr, graphsToRender);        
            };
        
            return CustomMacros;
          }()) })

        try {
            generator = latexjs.parse(text, { generator: generator });

            if (!renderContainsImage) {
                let doc = generator.htmlDocument();
                let stylesInfo = doc.head.innerHTML;
                let content = doc.body.innerHTML;
                previewDisplay.innerHTML = content;
            }

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
        if (!res.canceled) fs.writeFile(res.filePath, contents, () => {
            Swal.mixin({
                customClass: {
                    title: 'alertTitle',
                    container: 'alertText'
                }
            })

            Swal.fire('Saved!')
        });
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
        let iconEl = document.createElement("i");
        iconEl.classList.add("fa-solid");
        iconEl.classList.add("fa-folder");

        let iconSpanEl = document.createElement("span");
        iconSpanEl.classList.add("icon");
        iconSpanEl.appendChild(iconEl);

        let nameEl = document.createElement("span");
        let nameNode = document.createTextNode(folderName);
        nameEl.classList.add("folderName");
        nameEl.appendChild(nameNode);

        let iconTextEl = document.createElement("span");
        iconTextEl.classList.add("icon-text");
        iconTextEl.appendChild(iconSpanEl);
        iconTextEl.appendChild(nameEl);

        folderEl = document.createElement("div");
        folderEl.classList.add('parentFolderIcon');
        folderEl.classList.add("folderElement");
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
        nameEl.classList.add("folderName");
        nameEl.appendChild(nameNode);

        let iconTextEl = document.createElement("span");
        iconTextEl.classList.add("icon-text");
        iconTextEl.appendChild(iconSpanEl);
        iconTextEl.appendChild(nameEl);

        folderEl = document.createElement("div");
        folderEl.classList.add('childFolderIcon');
        folderEl.classList.add("folderElement");
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
        nameEl.classList.add("folderName");
        nameEl.appendChild(nameNode);

        let iconTextEl = document.createElement("span");
        iconTextEl.classList.add("icon-text");
        iconTextEl.appendChild(iconSpanEl);
        iconTextEl.appendChild(nameEl);

        folderEl = document.createElement("div");
        folderEl.classList.add("file");
        folderEl.classList.add("folderElement");
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
    let graphLatex = "\n" + "\\graph{$" + expr + "$}\n";
    
    editor.session.insert(editor.getCursorPosition(), graphLatex);
    graphingToolPopover.style.display = 'none'; 
    mainView.style.opacity = '1';
    return;
}

function refreshPreview(graphsToRender) {
    console.log(graphsToRender)
    let text = editor.getValue();
    let currGraphNum = -1;

    let generator = new latexjs.HtmlGenerator({ hyphenate: false, CustomMacros: (function() {
        var args      = CustomMacros.args = {},
            prototype = CustomMacros.prototype;
    
        function CustomMacros(generator) {
          this.g = generator;
        }
    
        args['graph'] = ['H', 'g']

        prototype['graph'] = function(expr) {
            // console.log(screenshot); 
            currGraphNum += 1;
            return [graphsToRender[currGraphNum]];
        };
    
        return CustomMacros;
      }()) })

    try {
        generator = latexjs.parse(text, { generator: generator });
        renderContainsImage = false;
        
        let doc = generator.htmlDocument();

        let content = doc.body.innerHTML;   
        previewDisplay.innerHTML = content
        return; 
    } catch (error) {
        console.log(error)
    }
}

function graphScreenshot(eqn, graphsToRender) {
    var screenshotTempElt = document.createElement('div');
    screenshotTempElt.style.display = "none";

    renderContainsImage = true;

    calculator.setExpression({id: "graph1", latex: eqn });

    const screenshotParams = {
        width: 200,
        height: 200,
        targetPixelRatio: 2
    }

    calculator.asyncScreenshot(screenshotParams, (data) => {
        screenshot = document.createElement('img');

        screenshot.width = 200;
        screenshot.height = 200;
        screenshot.src = data;
        
        graphsToRender.push(screenshot)

        refreshPreview(graphsToRender);
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


function exportToPDF() {
    var fs = require('fs');
    var pdf = require('html-pdf');

    const pathHandler = require("@electron/remote");

    let finalHTML =  "<link rel=\"stylesheet\" href=\"article.css\"><link rel=\"stylesheet\" href=\"base.css\"><link rel=\"stylesheet\" href=\"book.css\"><link rel=\"stylesheet\" href=\"katex.css\">" + previewDisplay.innerHTML;

    var tempPath = pathHandler.app.getPath('temp') + 'toRender.html';

    dialog.showSaveDialog({
        title: 'Select the File Path to export',
        defaultPath: path.join(__dirname, '../assets/sample.pdf'),
        // defaultPath: path.join(__dirname, '../assets/'),
        buttonLabel: 'Export',
        // Restricting the user to only Text Files.
        filters: [
            {
                name: 'PDF Files',
                extensions: ['pdf']
            }, ],
        properties: []
    }).then(file => {
        // Stating whether dialog operation was cancelled or not.
        console.log(file.canceled);
        if (!file.canceled) {
            let filePath = file.filePath.toString();
            fs.writeFile(tempPath,  finalHTML, { flag: 'w+' }, err => {
                if (err) {
                    console.error(err);
                }
                // file written successfully
                var html = fs.readFileSync(tempPath, 'utf8');
                var options = { format: 'A4', base: "../css/",   "border": {
                    "top": "0.25in",            // default is 0, units: mm, cm, in, px
                    "right": "0.5in",
                    "bottom": "0.25in",
                    "left": "0.5in"
                  }};
        
                pdf.create(html, options).toFile(filePath, function(err, res) {
                    if (err) return console.log(err);
                    console.log(res); // { filename: '/app/businesscard.pdf' }
                });
            }); 
        }
    }).catch(err => {
        console.log(err)
    });
}