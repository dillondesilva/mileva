const { dialog } = require("@electron/remote");
const fs = require('fs');
const Swal = require('sweetalert2')
const $ = require("jquery");
const pdfjsLib = require("pdfjs-dist/build/pdf");
const HOME_DIRECTORY = require('os').homedir();

let previewDisplay = document.getElementById("previewDisplay");
let folderSelector = document.getElementById("folderSelector");

var exec = require('child_process').exec;

let editorInstances = {};
let currentEditor;

// pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = `http://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.js`;

const graphingToolPopover = document.getElementById('graphingToolPopover');
const lookupInfoModal = document.getElementById('lookupInfoModal');
const mainView = document.getElementById('mainView');
const desmos = require('desmos');
const { throws } = require("assert");
const { contextIsolated } = require("process");
const { UndoManager } = require("ace-builds");

let modalMathInfo = document.getElementById("modalMathInfo");
let modalDocInfo = document.getElementById("modalDocInfo");
let modalGraphInfo = document.getElementById("modalGraphInfo");
let modalMilevaInfo = document.getElementById("modalMilevaInfo");

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

const calculator = desmos.GraphingCalculator(elt, {border: false, images: false, folders: false, notes: false, sliders: false});

let screenshot;
let renderContainsImage = false;

window.onload = () => {
    currentEditor = createEditorInstance(`welcome.tex`);
    copyStylingFiles();

    const saveButton = document.querySelector('#save');
    saveButton.onclick = saveFile;

    const directoryButton = document.querySelector("#directory");

    const gridButton = document.querySelector("#grid");
    gridButton.onclick = graphingToolOpen;

    const infoButton = document.querySelector("#lookup");
    infoButton.onclick = infoLookupOpen;

    let closeInfoModalButton = document.querySelector("#closeInfoModal");
    closeInfoModalButton.onclick = closeInfoModal;

    let btnMathInfo = document.querySelector("#btnMathInfo");
    btnMathInfo.onclick = () => setActiveModalTab(btnMathInfo, modalMathInfo);

    let btnDocInfo = document.querySelector("#btnDocInfo");
    btnDocInfo.onclick = () => setActiveModalTab(btnDocInfo, modalDocInfo);

    let btnGraphInfo = document.querySelector("#btnGraphInfo");
    btnGraphInfo.onclick = () => setActiveModalTab(btnGraphInfo, modalGraphInfo);

    let btnMilevaInfo = document.querySelector("#btnMilevaInfo");
    btnMilevaInfo.onclick = () => setActiveModalTab(btnMilevaInfo, modalMilevaInfo);

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

    // previewDisplay.src = `${pathHandler.app.getPath('temp')}preview.pdf`; 

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

function changeTab (tab) {
    document.querySelectorAll(".editor .editorArea").forEach(editorDiv => {
        editorDiv.classList.add("hide");
    });

    document.querySelector(`#${tab}`).classList.remove("hide");

    for (let editor in editorInstances) {
        if (editor == tab) {
            currentEditor = editorInstances[editor];
        }
    }

    previewDisplay.innerHTML = parseLaTeX(currentEditor, currentEditor.getValue());
}

function parseLaTeX (editor, data) {
    let graphsToRender = [];
    let generator = new latexjs.HtmlGenerator({ hyphenate: false, CustomMacros: (function() {
        let args = CustomMacros.args = {}, prototype = CustomMacros.prototype;
        
        function CustomMacros(generator) {
            this.g = generator;
        }
        
        args['graph'] = ['H', 'g']

        prototype['graph'] = function(expr) {
            let exprAnnotated = expr.querySelector('annotation');
            expr = "y=" + exprAnnotated.innerHTML;
            graphScreenshot(expr, graphsToRender);        
        };
        
        return CustomMacros;
    }())});

    try {
        generator = latexjs.parse(data, { generator: generator });

        if (!renderContainsImage) {
            let doc = generator.htmlDocument();
            let stylesInfo = doc.head.innerHTML;
            let content = doc.body.innerHTML;

            return content;
        }

        editor.getSession().clearAnnotations();        
    } catch (error) {
        highlightError(editor, error);
    }
}

function createEditorInstance (fileName=null) {
    let editorDiv = null;
    if (Object.entries(editorInstances).length > 0) {
        editorDiv = document.createElement("div");
        editorDiv.id = `editor${Object.entries(editorInstances).length + 1}`;
        editorDiv.classList.add(`editorArea`);
        editorDiv.classList.add(`hide`);
        editorDiv.focus = false;
        $('.editor').append(editorDiv);
    }

    let editor = ace.edit(`${Object.entries(editorInstances).length > 0 ? editorDiv.id : "editor"}`, {selectionStyle: "text"});
    editor.resize();
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/latex");
    editor.getSession().setUseSoftTabs(true);

    // Disabling worker so that our own LaTeX error annotations are not overriden
    // editor.session.setOption("useWorker", false)
    editor.session.setOption("useWorker", false);

    // this is a bit of a hacky solution to force the preview to only occur
    // for the first editor instance which is rendered
    if (!Object.entries(editorInstances).length) {
        let text = editor.getValue();
        updatePreview(editor, text);
        // previewDisplay.innerHTML = parseLaTeX(editor, text);
    }

    editor.session.on("change", (e) => {
        let text = editor.getValue();
        updatePreview(editor, text);
        // previewDisplay.innerHTML = parseLaTeX(editor, text);
    });

    document.querySelector('.tabSelector .tabs ul').appendChild(new DOMParser().parseFromString(`<li><a data-target="${Object.entries(editorInstances).length >= 1 ? editorDiv.id : "editor"}"><span class="icon-text"><span class="tabNameText">${fileName === null ? "untitled.tex" : fileName}</span><span class="icon"><i class="fa-solid fa-xmark"></i></span></span></a></li>`, `text/html`).body.firstElementChild);
    document.querySelectorAll('.tabSelector .tabs ul li a').forEach(el => {
        let targetValue = el.attributes.item("data-target").value;
        
        el.onclick = () => { 
            changeTab(targetValue);
        };

        el.querySelector('.icon-text .icon i').onclick = () => {
            console.log(targetValue);
        }
    });

    editorInstances[editorDiv != null ? editorDiv.id : "editor"] = editor;

    if (editorDiv != null) changeTab(editorDiv.id);

    return editor;
}

function openFile (filePath) {
    const fileArray = filePath.includes('/') ? filePath.split('/') : filePath.split('\\');
    const fileName = fileArray[fileArray.length-1];

    const text = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'r'});

    let editor = createEditorInstance(fileName);
    editor.setValue(text);
}

function highlightError(editor, error) {
    let errMsg = `${error.name}: ${error.message}`;
    
    if (error.location !== undefined) {
        editor.getSession().setAnnotations([{
            row: error.location.start.line - 1,
            column: error.location.start.column + 1,
            text: errMsg,
            type: "error" // also warning and information
        }]); 
    }
}

function reloadPreview() {
    
}

function saveFile () {
    const contents = currentEditor.getValue();

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

        iconTextEl.onclick = () => {
            openFile(parentPath);
        }

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
    
    currentEditor.session.insert(currentEditor.getCursorPosition(), graphLatex);
    graphingToolPopover.style.display = 'none'; 
    mainView.style.opacity = '1';
    return;
}

function refreshPreview(graphsToRender) {
    //console.log(graphsToRender)
    let text = currentEditor.getValue();
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
        currentEditor.getSession().clearAnnotations();
        generator = latexjs.parse(text, { generator: generator });
        renderContainsImage = false;
        
        let doc = generator.htmlDocument();

        let content = doc.body.innerHTML;   
        previewDisplay.innerHTML = content
        return; 
    } catch (error) {
        console.log(`ERROR: ${error}`)
        highlightError(currentEditor, error);
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
    let eqnText = "\n$$y=e^{i\\pi} + 1 = 0$$"
    currentEditor.session.insert(currentEditor.getCursorPosition(), eqnText);
    let newCursorPos = currentEditor.getCursorPosition();
    newCursorPos.column -= 1;
    currentEditor.moveCursorToPosition(newCursorPos);
    currentEditor.clearSelection();
    currentEditor.focus();
}

function updatePreview(editor, text) {
    const pathHandler = require("@electron/remote");
    const tempPath = pathHandler.app.getPath('temp') + 'toExport.tex';

    var fs = require('fs');

    
    fs.writeFile(tempPath,  text, { flag: 'w' }, err => {
        if (err) {
            console.error(err);
        }
    });

    exec(`pandoc ${tempPath}`,
        function (error, stdout, stderr) {
            console.log('stdout: ' + stdout);
            console.log('stderr: ' + stderr);
            if (error !== null) {
                console.log('exec error: ' + error);
            }

            previewDisplay.innerHTML = stdout;

            // var loadingTask = pdfjsLib.getDocument(`${pathHandler.app.getPath('temp')}preview.pdf`);
    
            // loadingTask.promise.then((pdf) =>  {
            //     pdf.getPage(1).then((page) => {
            //         var scale = {scale: 5};
            //         var viewport = page.getViewport(scale);
            //         console.log(page)
         
            //         var context = canvas.getContext('2d');
        
            //         canvas.height = viewport.height;
            //         canvas.width = viewport.width;
        
            //         // previewDisplay.style.width = Math.floor(viewport.width) + "px";
            //         // previewDisplay.style.height =  Math.floor(viewport.height) + "px";
        
            //         page.render({canvasContext: context, viewport: viewport}).promise.then(() => {
            //             previewDisplay.src = canvas.toDataURL('image/jpeg');
            //         }).catch((err) => {
            //             console.log(err)
            //         }
            //         );
            //     })
            // })
        }
    );

    console.log(previewDisplay);
    console.log(pdfjsLib);
}

function exportToPDF() {
    const contents = currentEditor.getValue();
    const pathHandler = require("@electron/remote");
    const tempPath = pathHandler.app.getPath('temp') + 'toExport.tex';

    var fs = require('fs');
    
    fs.writeFile(tempPath,  contents, { flag: 'w+' }, err => {
        if (err) {
            console.error(err);
        }
    });
  
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
        if (!file.canceled) {
            let filePath = file.filePath.toString();
            console.log(`Path for export: ${filePath}`);
            exec(`pandoc ${tempPath} -o ${filePath}`,
                function (error, stdout, stderr) {
                    console.log('stdout: ' + stdout);
                    console.log('stderr: ' + stderr);
                    if (error !== null) {
                        console.log('exec error: ' + error);
                    }
                }
            );
        }
    }).catch(err => {
        console.log(err)
    });
}

function infoLookupOpen() {
    lookupInfoModal.style.display = 'block';
    setActiveModalTab(btnMathInfo, modalMathInfo);
}

function closeInfoModal() {
    lookupInfoModal.style.display = "none";
}

function setActiveModalTab(newActive, modalInfo) {
    btnMathInfo.classList.remove("is-active");
    btnDocInfo.classList.remove("is-active");
    btnGraphInfo.classList.remove("is-active");
    btnMilevaInfo.classList.remove("is-active");

    modalMathInfo.style.display = "none";
    modalDocInfo.style.display = "none";
    modalGraphInfo.style.display = "none";
    modalMilevaInfo.style.display = "none";

    newActive.classList.add("is-active");
    modalInfo.style.display = "block";
}

function copyStylingFiles() {
    const pathHandler = require("@electron/remote");
    const fs = require('fs-extra');

    var udataPath = pathHandler.app.getPath('temp');
    console.log("PRE COPY MSG")
    // fs.copyFile(__dirname + '/re/base.css', udataPath + 'base.css', (err) => {
    //     if (err) throw err;     
    //     console.log('source.txt was copied to destination.txt');
    // });

    fs.copy(__dirname + "/resources/runtime/", udataPath, (err) => {
        if (err) throw err;     
        console.log('source.txt was copied to dest');
    });
}