const express = require('express');
const app = express();
const path = require("path");
const WebSocket = require('ws');
const electron = require('electron');
const url = require("url");
const JSZip = require("jszip");
const fs = require("fs");
const https = require("https");
const fetch = require("node-fetch");
const cmd = require("child_process");
const toml = require("smol-toml");
const UserAgent = require("user-agents");
const builder = require("./builder");

const possibleAgentsToUse = [ // These user agents are from the python fake user agent script. (https://pypi.org/project/fake-useragent/)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/343.0.695551749 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1 Ddg/17.6",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.76",
    "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/118.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
];

const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', async (ws, req) => {
    const parsedUrl = url.parse(req.url, true);
    console.log('WS', req.method, req.url);
    switch (parsedUrl.pathname) {
        case "/openExplorer": {
            const info = Object.assign(parsedUrl.query, JSON.parse(parsedUrl.query.anythingToDump), {
                properties: [
                    parsedUrl.query.askForDirectory ? 'openDirectory' : 'openFile',
                    'promptToCreate',
                    'createDirectory',
                    'treatPackageAsDirectory'
                ]
            });
            delete info.anythingToDump;
            ws.send(JSON.stringify(electron.dialog.showOpenDialogSync(info)))
            break;
        } case "/beginBuild": {
            try {

                /**
                 * Made this a function to avoid repeated text.
                 * @param {string} type 
                 * @param {string} file 
                 * @returns {string}
                 */
                function textInstallRequired(type, file, shellRestartRequired = false, programUsesCLI = false) {
                    return `You need to install ${type} in order to be able to build a python module out of the z17-randomizer source code. 
                    You may begin the installation of ${type} if you want to by clicking <a href="javascript:launchToolFromUtilities('${file}', ${
                        shellRestartRequired
                    }, ${programUsesCLI})">here</a>.`
                }

                const userHomePath = process.env.HOME || process.env.USERPROFILE;

                /**
                 * Checks to see if any important paths are existant 
                 * (Keep in mind that keeping the required programs in their default paths is recommended for most people).
                 * @returns {Object} a JSON Object containing booleans for existant paths.
                 */
                function checkPathsExistance() {
                    return {
                        rustPathExists: fs.existsSync(path.join(userHomePath, '.cargo/bin')),
                        pythonPathExists: (
                            process.platform == "darwin" && fs.existsSync('/Library/Frameworks/Python.framework/Versions/3.12')
                        ) || (
                            process.platform == "win32" && fs.existsSync(path.join(userHomePath, './AppData/Local/Programs/Python/Python312/'))
                        ) || (
                            process.platform == "linux" && fs.existsSync(path.join(userHomePath, '.pyenv'))
                        ),
                        pyModuleMaturinExists: (
                            process.platform == "win32" 
                            && fs.existsSync(path.join(userHomePath, './AppData/Local/Programs/Python/Python312/Scripts/maturin.exe'))
                        ) || (process.platform == "linux" && fs.existsSync(path.join(userHomePath, ".pyenv/shims/maturin")))
                    }
                }

                /**
                 * Runs some checks to ensure that the required programs are installed.
                 */
                function runChecks(wasRan = false) {
                    ws.send(`\nChecking${wasRan ? ' again' : ''} to see if you have Python version 3.12, rust, pip, and maturin installed...`);
                    const pathsExist = checkPathsExistance();
                    if (!pathsExist.rustPathExists) {
                        ws.send(JSON.stringify({
                            operationSuccessful: false,
                            programToInstall: 'rust',
                            commandForInstallingProgram: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
                            message: textInstallRequired(
                                'rust', 
                                process.platform == "win32" ? `rustup-init${process.env.PROCESSOR_ARCHITECTURE != "x86" ? `-${
                                    process.env.PROCESSOR_ARCHITECTURE.toLowerCase()
                                }` : ''}.exe` : `fromCommand`,
                                true,
                                true
                            )
                        }))
                    } else if (!pathsExist.pythonPathExists) {
                        ws.send(JSON.stringify({
                            operationSuccessful: false,
                            programToInstall: 'Python',
                            commandForInstallingProgram: `cd ${path.join(__dirname, "../utilities")} && bash python_linux.sh`,
                            message: textInstallRequired(
                                'Python', 
                                process.platform != "linux" ? `python-3.12.0${(() => {
                                    switch (process.platform) {
                                        case "win32": return process.env.PROCESSOR_ARCHITECTURE != "x86" ? `-${
                                            process.env.PROCESSOR_ARCHITECTURE.toLowerCase()
                                        }` : '' + '.exe';
                                        case "darwin": return '-macos11.pkg'
                                    }
                                })()}` : 'fromCommand',
                                process.platform != "linux",
                                process.platform == "linux"
                            )
                        }));
                    } else if (!pathsExist.pyModuleMaturinExists) {
                        ws.send('\nmaturin does not exist inside your Python Path. Installing...\n');
                        builder.executeCommand(`${builder.pythonExec()} -m pip install maturin`, ws).then(() => runChecks(true));
                    } else {
                        ws.send('\nAll required programs are installed. Beginning Archipelago Build for\nThe Legend of Zelda: A Link Between Worlds...');
                        buildStart();
                    }
                }
                runChecks();

                ws.on("message", message => {
                    const msg = message.toString();
                    if (msg == "isPythonInstalled" || msg == "isRustInstalled") {
                        const pathsExist = checkPathsExistance();
                        const type = msg.split("Installed")[0].split("is")[1].toLowerCase();
                        ws.send(JSON.stringify({
                            programInstalled: type == "rust" ? pathsExist.rustPathExists : pathsExist.pythonPathExists
                        }));
                    } else if (msg == "userInstalledProgram") runChecks(true);
                })

                /**
                 * Starts a build for the z17-randomizer.
                 */
                async function buildStart() {
                    if (parsedUrl.query.filePath) {
                        const filePath = decodeURIComponent(parsedUrl.query.filePath);
                        continueBuildingWithBuffer(fs.readFileSync(filePath), ws).then(buildFinished).catch(buildFailed);
                    } else if (parsedUrl.query.zipURL) {
                        const res = await fetch.default(decodeURIComponent(parsedUrl.query.zipURL));
                        continueBuildingWithBuffer(await res.arrayBuffer(), ws).then(buildFinished).catch(buildFailed);
                    } else if (parsedUrl.query.useBultInSourceCode) builder.buildWithBuiltInSourceCode(ws).then(buildFinished).catch(buildFailed);
                }
                /**
                 * Called when the build of the albw apworld is finished.
                 * @param {Base64URLString} data the data recieved from jszip.
                 */
                function buildFinished(data) {
                    ws.send("\nPress the enter key to download your build. You can do this as many times as you like. If you want to start the build process again, use the ctrl + r keyboard shortcut to reload this app.")
                    ws.on("message", () => {
                        electron.dialog.showSaveDialog({
                            title: "Choose a File Location to Save Your Build",
                            buttonLabel: "Save Build",
                            filters: [
                                {
                                    name: "albw_archipelago.zip",
                                    extensions: ['zip']
                                }
                            ],
                            properties: [
                                'showHiddenFiles',
                                'showOverwriteConfirmation',
                                'createDirectory',
                                'treatPackageAsDirectory'
                            ]
                        }).then(info => {
                            if (info.canceled) ws.send("\nDon't worry, you can still save your build if you press the enter key.");
                            if (info.filePath) {
                                fs.writeFileSync(info.filePath, Buffer.from(data, "base64"));
                                ws.send(`\nYou have saved your build in\n${info.filePath}.\nFeel free to save another copy of your build if you want.`)
                            }
                        })
                    });
                }
                /**
                 * Called when the build failed.
                 * @param {Error} e 
                 */
                function buildFailed(e) {
                    console.error(e);
                    ws.send('\nThe build has failed. Press the enter key to continue...');
                    ws.on("message", () => {
                        ws.send(JSON.stringify({
                            operationSucessful: false,
                            message: e.toString()
                        }))
                    })
                }

            } catch (e) {
                console.error(e);
                ws.send(JSON.stringify({
                    env: process.env,
                    operationSuccessful: false,
                    message: e.toString()
                }))
            }
            break;
        } case "/launchToolFromUtilities": {
            builder.shellInit((() => {
                if (parsedUrl.query.filename) return cmd.spawn(path.join(__dirname, '../utilities', decodeURIComponent(parsedUrl.query.filename)));
                if (parsedUrl.query.runCommand) {
                    const args = parsedUrl.query.runCommand.split(" ");
                    const command1 = args[0];
                    args.splice(0, 1);
                    return cmd.spawn(command1, args, {
                        shell: true
                    });
                }
                return cmd.spawn("echo", ['I cannot run a program if I don\'t have a command or file from the utilites folder to execute.']);
            })(), ws).then(info => ws.send(JSON.stringify(info)));
        }
    }
});

/**
 * Core for the app
 * @param {number} serverPort - the port for the app
 * @param {electron.BrowserWindow} mainWindow - the window from electron
 * @param {Function} isRunningFromSource - a function that returns a boolean stating whatever or not the user is running the app straight from the source code.
 */
module.exports = (serverPort, mainWindow, isRunningFromSource) => {
    app.use((req, _, next) => {
        console.log('HTTP', req.method, req.url);
        next();
    }).use(express.static(path.join(__dirname, '../frontend')));

    app.post('/getGithubStuff', async (req, res) => {
        res.json(await generateGithubResponses(req.query.forArchipelago));
    }).post('/closeApp', () => mainWindow.close());

    app.get('/myFilePath', (req, res) => {
        if (!isRunningFromSource()) {
            /*const appPath = path.join(__dirname, '../../../');
            const file = fs.readdirSync(appPath).find(
                i => process.platform != "linux" ? i.endsWith(process.platform == "win32" ? '.exe' : process.platform == "darwin" ? '.app' : '') : !i.endsWith(".")
            );
            res.send(path.join(appPath, file));*/
            res.send(process.execPath);
        } else req.query.appRequiresShellRestart ? res.json({
            message: "I cannot tell you what filepath this app will be located in because you are running it directly from the source which is inconvient for most people. Using a packaged version of this app is recommended and you may find that under the releases tab of this <a href='https://github.com/josephanimate2021/albw-archipelago-builder/releases'>Github Repository</a>."
        }) : res.send();
    })

    app.listen(serverPort, () => {
        mainWindow.loadURL('http://localhost:' + serverPort);
        console.log('App is listening on port ' + serverPort + '.');
    });
}

/**
 * Generates the releases and branches response from the z17-randomizer repo.
 * @returns {Promise}
 */
function generateGithubResponses(forArchipelago) {
    return new Promise(res => {
        let info = {}
        const paths = ['/releases', '/branches'];

        /**
         * Fetches all GitHub responses like mentioned in my last comment.
         * @param {number} pageCount 
         * @param {string} userAgent 
         * @param {number} agentsTried 
         * @param {number} pathIndex 
         * @returns {Promise}
         */
        function responsesFetch(
            pageCount = 1, 
            userAgent = possibleAgentsToUse[0], 
            agentsTried = 0,
            pathIndex = 0
        ) {
            return new Promise(res => {
                const pathname = paths[pathIndex];
                
                if (!info[pathname.substring(1)]) info[pathname.substring(1)] = [];

                /**
                 * Ends the promise when the request either finished or errored out.
                 * @param {JSON} k 
                 */
                function clearStuff(k) {
                    if (k) info = {
                        message: k.toString()
                    };
                    res();
                }

                https.get(`https://api.github.com/repos/rickfay/z17-randomizer${pathname}?page=${pageCount}`, {
                    headers: {
                        'user-agent': userAgent,
                    }
                }, r => {
                    const buffers = [];
                    r.on("data", b => buffers.push(b)).on("end", () => {
                        try {
                            const response = JSON.parse(Buffer.concat(buffers));
                            if (!Array.isArray(response)) {
                                if (agentsTried == possibleAgentsToUse.length - 1) {
                                    info = response;
                                    return clearStuff();
                                } 
                                agentsTried++;
                                return res(responsesFetch(
                                    pageCount, 
                                    possibleAgentsToUse[agentsTried], 
                                    agentsTried,
                                    pathIndex
                                ));
                            }
                            if (response.length != 0) {
                                for (const res of response) if (info[pathname.substring(1)]) info[pathname.substring(1)].push(res);
                                return res(responsesFetch(pageCount += 1, userAgent, agentsTried, pathIndex));
                            } 
                            if (pathIndex == (paths.length - 1)) return clearStuff(); 
                            res(responsesFetch(1, userAgent, agentsTried, pathIndex += 1));
                        } catch (e) {
                            clearStuff(e);
                        }
                    }).on("error", clearStuff);
                }).on("error", clearStuff);
            })
        }

        responsesFetch().then(() => {

            /**
             * takes out versions of the z17 randomizer that aren't supported like ones that aren't withn range of v0.4.0 (works best with archipelago)
             * @param {number} pathIndex The index of the current path
             * @returns {Promise} A way of telling the computer that the response was modified.
             */
            function modifyResponses(pathIndex = 0) {
                return new Promise(res => {
                    if (!forArchipelago) return res();
                    const term = paths[pathIndex].substring(1);
                    if (info[term]) info[term] = info[term].filter(
                        i => !i.name.includes("0.3")  && !i.name.includes("0.2") && !i.name.includes("0.1") && !  i.name.includes("0.0")
                    );
                    if (pathIndex != paths.length - 1) return res(modifyResponses(pathIndex += 1));
                    res()
                })
            }

            modifyResponses().then(() => res(info));
        });
    })
}

/**
 * Allows the building of the z17-randomizer archipelago to continue if a buffer and websocket connection are present.
 * @param {ArrayBuffer} buffer 
 * @param {WebSocket} ws 
 */
function continueBuildingWithBuffer(buffer, ws) {
    return new Promise(async (res, rej) => {
        try {
            const apworldSettings = builder.APWorldSettings();
            const unzipedContent = await JSZip.loadAsync(buffer);
            const dirName = (() => {
                try {
                    const workingPath = path.join(__dirname, "test.txt");
                    fs.writeFileSync(workingPath, "This is a test.");
                    fs.unlinkSync(workingPath);
                    return __dirname;
                } catch {
                    const workingPath = path.join(process.env.HOME || process.env.USERPROFILE, 'albw-archipelago-builder/backend');
                    if (!fs.existsSync(workingPath)) fs.mkdirSync(workingPath, {
                        recursive: true
                    });
                    fs.writeFileSync(path.join(workingPath,'../.gitmodules'), fs.readFileSync(path.join(__dirname,'../.gitmodules')));
                    return workingPath;
                }
            })();
            const pathToWriteTempFiles = path.join(dirName, '../temp');
            ws.send('\nRemoving some temporary data from\n' + pathToWriteTempFiles);
            if (fs.existsSync(pathToWriteTempFiles)) fs.rmSync(pathToWriteTempFiles, {
                recursive: true,
                force: true
            });
            ws.send('\nDeleted some temporary data. Creating a new temporary folder in\n' + pathToWriteTempFiles);
            fs.mkdirSync(pathToWriteTempFiles);
            ws.send('\nTemporary folder was created. Extracting the z17-randomizer files...\n')
            for (const folderOrFile in unzipedContent.files) {
                const fileOrFolderPath = path.join(pathToWriteTempFiles, folderOrFile);
                if (!fs.existsSync(fileOrFolderPath)) {
                    if (unzipedContent.files[folderOrFile].dir) fs.mkdirSync(fileOrFolderPath);
                    else fs.writeFileSync(fileOrFolderPath, await unzipedContent.file(folderOrFile).async("nodebuffer"));
                }
            }
            ws.send('\nFiles were extracted successfuly! Modifying files for the build...\n');
            const z17RandomizerAPPiecesFolder = path.join(__dirname, "../apPieces/z17-randomizer");
            const albwArchipelagoAPPiecesFolder = path.join(__dirname, "../apPieces/albw-archipelago");
            const albwArchipelagoBuiltInFolder = await gitPathCheck(path.join(dirName, "../albw-archipelago"));
            const z17randomizerBuiltInFolder = await gitPathCheck(path.join(dirName, "../z17-randomizer"));
            ws.send("\nAll folder checks were done successfuly! Continuing the build...");
            const z17randomizerFolder = path.join(pathToWriteTempFiles, fs.readdirSync(pathToWriteTempFiles)[0]);
            const albwArchipelagoFolder = path.join(pathToWriteTempFiles, "albw-archipelago");
            fs.mkdirSync(albwArchipelagoFolder);
            const cargoPath = path.join(z17randomizerFolder, 'Cargo.toml');
            const cargoToml = toml.parse(fs.readFileSync(cargoPath, 'utf-8'));
            if (cargoToml.package?.authors) cargoToml.package.authors.push("Caroline Madsen <randomsalience@gmail.com>");
            cargoToml.lib = {
                name: "albwrandomizer",
                'crate-type': ["cdylib", "rlib"]
            }
            cargoToml.dependencies = Object.assign(cargoToml.dependencies || {}, { 
                pyo3: {
                    version: "0.20.2",
                    features: ["extension-module", "generate-import-lib"] 
                }
            });
            if (cargoToml.bin) delete cargoToml.bin;
            cargoToml.workspace.dependencies = Object.assign(cargoToml.workspace.dependencies || {}, { 
                pyo3: {
                    version: "0.20.2",
                    features: ["extension-module", "generate-import-lib"] 
                }
            });
            fs.writeFileSync(cargoPath, toml.stringify(cargoToml));
            sendFileModifiedMessage(cargoPath);
            const buildPath = path.join(z17randomizerFolder, 'build.rs');
            if (fs.existsSync(buildPath)) {
                fs.writeFileSync(buildPath, fs.readFileSync(path.join(z17randomizerBuiltInFolder, 'build.rs')));
                sendFileModifiedMessage(buildPath);
            }
            const plandoPath = path.join(z17randomizerFolder, 'src/bin/plando.rs');
            const replace = [
                ";", "use crate::filler::cracks::Crack;", "AccessLoruleCastleField,", 'Self::AccessLoruleCastleField => "Lorule Castle Field Access",', "PartialEq", 'fn build_layout', "Randomizable", 
                'use std::{', 'impl SeedInfo {', "cmp", "Instruction", "seed_info.layout.find_single", "SageRosso, SageSeres,", "Result, SeedInfo,", 
                "fn patch_item_names(patcher: &mut Patcher", "fn patch_event_item_get(patcher: &mut Patcher", "p.has_bell() &&"
            ];
            const archipelagoInfoNone = 'archipelago_info: None,';
            if (fs.existsSync(plandoPath)) {
                fs.writeFileSync(plandoPath, replaceWithPyClassAndOriginal(fs.readFileSync(plandoPath, 'utf-8'), "settings,", archipelagoInfoNone, 2));
                sendFileModifiedMessage(plandoPath);
            }
            const patchModPath = path.join(z17randomizerFolder, 'randomizer/src/patch/mod.rs');
            if (fs.existsSync(patchModPath)) {
                fs.writeFileSync(patchModPath, replacePrintlnWithInfo(fs.readFileSync(patchModPath, 'utf-8')));
                sendFileModifiedMessage(patchModPath);
            }
            for (const file of ['modinfo/Cargo.toml', 'settings/Cargo.toml']) {
                const modinfoCargoPath = path.join(z17randomizerFolder, file);
                if (fs.existsSync(modinfoCargoPath)) {
                    const modInfoToml = toml.parse(fs.readFileSync(modinfoCargoPath, 'utf-8'));
                    modInfoToml.dependencies = Object.assign(modInfoToml.dependencies || {}, { 
                        pyo3: {
                            workspace: true
                        }
                    });
                    fs.writeFileSync(modinfoCargoPath, toml.stringify(modInfoToml));
                    sendFileModifiedMessage(modinfoCargoPath);
                }
            }
            for (const folder of ['modinfo/src/settings', 'settings/src']) {
                let modInfoSettingPath = path.join(z17randomizerFolder, folder);
                if (fs.existsSync(modInfoSettingPath)) for (
                    const modinfoSettingFile of fs.readdirSync(modInfoSettingPath).filter(i => i != "mod.rs" && i != "lib.rs")
                ) addpyclass(modInfoSettingPath, modinfoSettingFile);
            }
            const settingClassesModules = [];
            for (const file of ['modinfo/src/settings/mod.rs', 'settings/src/lib.rs']) {
                const modinfoModPath = path.join(z17randomizerFolder, file);
                if (fs.existsSync(modinfoModPath)) {
                    let contents = fs.readFileSync(modinfoModPath, 'utf-8');
                    const originalContents = contents;
                    contents = contents.replace(replace[0], replace[0] +"\nuse pyo3::prelude::*;");
                    let index = originalContents.indexOf("pub ");
                    while (index > -1) {
                        const setting = originalContents.substring(index).split("\n")[0];
                        if (!setting.startsWith("pub fn") && !setting.startsWith("pub mod")) {
                            const structBoolean = setting.startsWith("pub struct");
                            if (
                                !setting.startsWith("pub use ")
                            ) {
                                const key = setting.split(": ")[0].substring(4);
                                if (apworldSettings[key]) {
                                    apworldSettings[key].randoSourceClass = setting.split(": ")[1].split(",")[0]
                                    apworldSettings[key].applyToArchipelago = true
                                }
                                contents = replaceWithPyClassAndOriginal(contents, setting, structBoolean ? '#[pyclass]' : '#[pyo3(get, set)]', !structBoolean ? 1 : 0);
                            } else settingClassesModules.push(setting.substring(25))
                        }
                        index = originalContents.indexOf("pub ", index + 4);
                    }
                    contents = replaceWithPyClassAndOriginal(contents, 'impl Settings {', '#[pymethods]\nimpl Settings {\n\t#[new]\n\tpub fn new() -> Settings {\n\t\tSettings::default()\n\t}\n}\n');
                    fs.writeFileSync(modinfoModPath, contents);
                    sendFileModifiedMessage(modinfoModPath);
                    break;
                }
            }
            const libPath = path.join(z17randomizerFolder, 'src/lib.rs');
            let lib2contents = fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, 'src/lib.rs'), 'utf-8');
            lib2contents = lib2contents.replace("RANDO_SETTINGS_CLASSES", settingClassesModules.map(m => m.slice(0, -1)).join(",\n\t"));
            lib2contents = lib2contents.replace("M_ADD_CLASS_SETTINGS", settingClassesModules.map(mod => `m.add_class::<${mod.split("::")[1].slice(0, -1)}>()?;`).join("\n\t"))
            fs.writeFileSync(libPath, lib2contents);
            sendFileModifiedMessage(libPath, false);
            const randoCargoPath = path.join(z17randomizerFolder, 'randomizer/Cargo.toml');
            const randoCargoToml = toml.parse(fs.readFileSync(randoCargoPath, 'utf-8'));
            if (randoCargoToml.package?.authors) randoCargoToml.package.authors.push("Caroline Madsen <randomsalience@gmail.com>");
            randoCargoToml.dependencies = Object.assign(randoCargoToml.dependencies || {}, { 
                pyo3: { 
                    workspace: true 
                },
                regex: "1.10.6"
            });
            fs.writeFileSync(randoCargoPath, toml.stringify(randoCargoToml));
            sendFileModifiedMessage(randoCargoPath);
            const randoFillerPath = {
                root: path.join(z17randomizerFolder, 'randomizer/src/filler'),
                file(f) {
                    return path.join(this.root, f)
                },
            };
            if (fs.existsSync(randoFillerPath.file('cracks.rs'))) addpyclass(randoFillerPath.root, 'cracks.rs');
            sendFileModifiedMessage(randoFillerPath.file('cracks.rs'));
            let fillerItemContents = fs.readFileSync(randoFillerPath.file('filler_item.rs'), 'utf-8');
            fillerItemContents = fillerItemContents.replace(replace[1], `pub ${replace[1]}`);
            fillerItemContents = fillerItemContents.replace(replace[0], replace[0] + "\nuse pyo3::prelude::*;\nuse std::collections::hash_map::DefaultHasher;\nuse std::hash::{Hash, Hasher};");
            fillerItemContents = replaceWithPyClassAndOriginal(fillerItemContents, '#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Ord, PartialOrd)]', 
                fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, "randomizer/src/filler/filler_item.rs"), 'utf-8'));
            fillerItemContents = replaceWithPyClassAndOriginal(fillerItemContents, 'pub enum Item {');
            fillerItemContents = replaceWithPyClassAndOriginal(fillerItemContents, 'pub enum Goal {');
            fillerItemContents = replaceWithPyClassAndOriginal(fillerItemContents, 'pub enum Vane {');
            fillerItemContents = fillerItemContents.replace(replace[2], replace[2] + "\n\tClearTreacherousTower,")
            fillerItemContents = fillerItemContents.replace(replace[3], replace[3] + '\n\t\t\tSelf::ClearTreacherousTower => "Clear Treacherous Tower",')
            fillerItemContents += '\n#[pymethods]\nimpl Vane {\n\nfn __hash__(&self) -> u64 {\n\t\tlet mut hasher = DefaultHasher::new();\n\t\tself.hash(&mut hasher);\n\t\thasher.finish()\n\t}\n}';
            fs.writeFileSync(randoFillerPath.file('filler_item.rs'), fillerItemContents);
            sendFileModifiedMessage(randoFillerPath.file('filler_item.rs'));
            let fillerLocationContents = fs.readFileSync(randoFillerPath.file('location.rs'), 'utf-8');
            fillerLocationContents = fillerLocationContents.replace(replace[0], replace[0] + "\nuse strum::{Display, EnumString};");
            fillerLocationContents = fillerLocationContents.replace(replace[4], "Display, EnumString, " + replace[4]);
            fs.writeFileSync(randoFillerPath.file('location.rs'), fillerLocationContents);
            sendFileModifiedMessage(randoFillerPath.file('location.rs'));
            let fillerLocationNodeContents = fs.readFileSync(randoFillerPath.file('location_node.rs'), 'utf-8');
            fillerLocationNodeContents = putTextIntoLine(25, "&self.paths", fillerLocationNodeContents, true);
            fillerLocationNodeContents = putTextIntoLine(24, "pub fn get_paths(&self) -> &Option<Vec<Path>> {", fillerLocationNodeContents, true);
            fillerLocationNodeContents = fillerLocationNodeContents.replace(replace[4], "Display, EnumString, " + replace[4]);
            fs.writeFileSync(randoFillerPath.file('location_node.rs'), fillerLocationNodeContents);
            sendFileModifiedMessage(randoFillerPath.file('location_node.rs'));
            let fillerModContents = fs.readFileSync(randoFillerPath.file("mod.rs"), 'utf-8');
            fillerModContents = fillerModContents.replace(replace[5], 'pub ' + replace[5]);
            fillerModContents = fillerModContents.replace("const PROGRESSION_EVENTS: usize = 36;", "const PROGRESSION_EVENTS: usize = 37;");
            fillerModContents = fillerModContents.replace("pub fn prefill_check_map(world_graph: &mut WorldGraph) -> CheckMap {", "pub fn prefill_check_map(world_graph: &WorldGraph) -> CheckMap {");
            fillerModContents = fillerModContents.replace("for location_node in world_graph.values_mut() {", "for location_node in world_graph.values() {");
            fillerModContents = fillerModContents.replace('layout.set(loc_info, item);', `else {\n\t\t\t\t\tpanic!("No item placed at {}", loc_info.name);\n\t\t\t\t}`);
            const itemPoolsParams = accessTextFromLine(findTextLineNumber('pub fn fill_all_locations_reachable(', fillerModContents) + 3, fillerModContents).split("(")[1].split(")")[0];
            fillerModContents = replaceWithPyClassAndOriginal(fillerModContents, 'fn place_cracks', `/// Verify all locations are reachable without actually filling them\npub fn access_check(rng: &mut StdRng, seed_info: &SeedInfo, check_map: &mut CheckMap) -> bool {\n\tlet (${itemPoolsParams}) = item_pools::get_item_pools(rng, seed_info);\n\tplace_cracks(seed_info, check_map);\n\tplace_weather_vanes(seed_info, check_map);\n\tverify_all_locations_accessible(seed_info, check_map, &mut progression_pool).is_ok()\n}\n`);
            fillerModContents = fillerModContents.replace(
                'let item = check_map.get(check.get_name()).unwrap().unwrap();', `if let Some(item) = check_map.get(check.get_name()).unwrap() {\n\t\t\t\t\tlayout.set(loc_info, *item);\n\t\t\t\t}`);
            fs.writeFileSync(randoFillerPath.file('mod.rs'), fillerModContents);
            sendFileModifiedMessage(randoFillerPath.file('mod.rs'));
            let fillerProgressionContents = fs.readFileSync(randoFillerPath.file('progress.rs'), 'utf-8');
            const rustReturnTrueIfArchipelago = 'if self.seed_info.is_archipelago() {\n\t\t\treturn true;\n\t\t}\n\n\t\t';
            fillerProgressionContents = replaceWithPyClassAndOriginal(fillerProgressionContents, 'let heart_containers', `// Heart containers and heart pieces are not progression items in Archipelago\n\t\t${
                rustReturnTrueIfArchipelago
            }\n`, 2)
            fillerProgressionContents = replaceFillerCompass(fillerProgressionContents, 'self.has(Item::EasternCompass)', rustReturnTrueIfArchipelago);
            fillerProgressionContents = replaceFillerCompass(fillerProgressionContents, 'self.has(Item::IceCompass)', rustReturnTrueIfArchipelago);
            fillerProgressionContents = replaceWithPyClassAndOriginal(fillerProgressionContents, 'let purples', 
                `// Rupees are not progression items in Archipelago, so instead require Treacherous Tower for easy farming\n\t\t${
                    'if self.seed_info.is_archipelago() {\n\t\t\treturn self.has(Goal::ClearTreacherousTower);\n\t\t}\n\n\t\t'
                }\n`, 2);
            fs.writeFileSync(randoFillerPath.file('progress.rs'), fillerProgressionContents);
            sendFileModifiedMessage(randoFillerPath.file('progress.rs'));
            const randoLibPath = path.join(z17randomizerFolder, "randomizer/src/lib.rs");
            let randoLibContents = fs.readFileSync(randoLibPath, "utf-8");
            randoLibContents = randoLibContents.replace(replace[0], replace[0] + "\nuse crate::filler::location::Location;\nuse crate::filler::progress::Progress;\nuse pyo3::prelude::*;\nuse regex::Regex;\nuse filler::access_check;");
            randoLibContents = randoLibContents.replace(replace[6], `{PyRandomizable, ${replace[6]}}`);
            randoLibContents = randoLibContents.replace(replace[7], replace[7] + '\n\tstr::FromStr,');
            randoLibContents = replaceWithPyClassAndOriginal(randoLibContents, 'pub struct SeedInfo {');
            randoLibContents = replaceWithPyClassAndOriginal(randoLibContents, 'pub settings: Settings,', '#[serde(skip_deserializing)]\n\tpub archipelago_info: Option<ArchipelagoInfo>,\n', 1);
            randoLibContents = replaceWithPyClassAndOriginal(randoLibContents, 'pub vane_map: VaneMap,', '#[pyo3(get)]', 1);
            randoLibContents = randoLibContents.replace("#[derive(Default, Debug)]", "#[derive(Clone, Default, Debug)]");
            randoLibContents = replacePrintlnWithInfo(randoLibContents);
            randoLibContents = replaceWithPyClassAndOriginal(randoLibContents, 'settings: Default::default(),', archipelagoInfoNone, 3);
            randoLibContents = replaceWithPyClassAndOriginal(randoLibContents, 'version: VERSION.to_owned(),', archipelagoInfoNone, 3);
            randoLibContents = randoLibContents.replace(replace[8], replace[8] + `\n\tpub fn is_archipelago(&self) -> bool {\n\t\tself.archipelago_info.is_some()\n\t}\n\npub fn is_major_location(&self, loc_name: &str, default: bool) -> bool {\n\tif let Some(info) = &self.archipelago_info {\n\t\tif self.settings.chest_size_matches_contents {\n\t\t\tinfo.items.get(loc_name).map(|item| item.is_major()).unwrap_or(false)\n\t\t} else {\n\t\t\tdefault\n\t\t}\n\t} else {\n\t\tdefault\n\t}\n}`)
            randoLibContents = replaceWithPyClassAndOriginal(
                randoLibContents, '#[derive(Serialize, Deserialize, Debug)]', fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, 'randomizer/src/lib_stripCharactersFromString.rs'), 'utf-8')
            )
            const seedVariables = randoLibContents.split('info!("Calculating Seed Info...");')[1].split("let mut seed_info = ")[0];
            let randoLibPyContents = fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, "randomizer/src/lib_pyStuff.rs"), "utf-8");
            const lineNumberForRemovedFromPlayOption = findTextLineNumber("pub removed_from_play: Vec<Randomizable>,", randoLibContents);
            if (!lineNumberForRemovedFromPlayOption) randoLibPyContents = deleteTextsFromLine(13, 1, randoLibPyContents);
            randoLibPyContents = randoLibPyContents.replace("VARS_BUILD", seedVariables.replaceAll(")?;", ").unwrap();"));
            const vars = seedVariables.split("let ").map(i => {
                const varName = i.split(" =")[0];
                if (varName.indexOf(" ") == -1) return varName + ",\n\t\t";
            }).join("");
            randoLibPyContents = randoLibPyContents.replace("MAPS", vars);
            randoLibContents = replaceWithPyClassAndOriginal(randoLibContents, 'pub fn patch_seed(', randoLibPyContents);
            fs.writeFileSync(randoLibPath, randoLibContents);
            sendFileModifiedMessage(randoLibPath);
            const randoBymalPatchPath = path.join(z17randomizerFolder, "randomizer/src/patch/byaml/stage.rs");
            let randoBymalPatchContents = fs.readFileSync(randoBymalPatchPath, "utf-8");
            randoBymalPatchContents = replaceWithPyClassAndOriginal(randoBymalPatchContents, "patch_ice_ruins(patcher);", "patch_npc_hinox(patcher);");
            randoBymalPatchContents = replaceWithPyClassAndOriginal(randoBymalPatchContents, 
                "//noinspection ALL", fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, "randomizer/src/patch/byaml/stage.rs"), "utf-8"));
            fs.writeFileSync(randoBymalPatchPath, randoBymalPatchContents);
            sendFileModifiedMessage(randoBymalPatchPath);
            const randoCodePatchDataPath = path.join(z17randomizerFolder, "randomizer/src/patch/code/arm/data.rs");
            const randoCodePatchDataContents = fs.readFileSync(randoCodePatchDataPath, "utf-8");
            fs.writeFileSync(randoCodePatchDataPath, replaceWithPyClassAndOriginal(randoCodePatchDataContents, "pub fn cmp<O>(rn: Register, operand2: O) -> Instruction",
                "pub fn sub<O>(rd: Register, rn: Register, operand2: O) -> Instruction\nwhere\n\tO: Into<ShifterOperand>,\n\t{\n\t\tinstruction(operand2.into().code(), 0b0010, false, rn, rd)\n\t}\n"));
            sendFileModifiedMessage(randoCodePatchDataPath);
            const randoCodePatchlsPath = path.join(z17randomizerFolder, "randomizer/src/patch/code/arm/ls.rs");
            let randoCodePatchlsContents = fs.readFileSync(randoCodePatchlsPath, "utf-8");
            randoCodePatchlsContents = randoCodePatchlsContents.replace('Self { rn, plus: true, offset: Offset::Register(rm) }', ([
                'Self { rn, plus: true, offset: Offset::Register(rm, 0) }', '\t}', '}', '\nimpl From<(Register, Register, u32)> for AddressingMode {',
                '\tfn from(parameter: (Register, Register, u32)) -> Self {', '\t\tlet (rn, rm, shift) = parameter;', '\t\tSelf { rn, plus: true, offset: Offset::Register(rm, shift) }'
            ]).join("\n"));
            randoCodePatchlsContents = randoCodePatchlsContents.replace("Register(Register)", "Register(Register, u32)");
            randoCodePatchlsContents = randoCodePatchlsContents.replace(
                "Self::Register(register) => register.shift(0) | 0x3000000", "Self::Register(register, shift) => register.shift(0) | (shift << 7) | 0x3000000");
            
            fs.writeFileSync(randoCodePatchlsPath, randoCodePatchlsContents);
            sendFileModifiedMessage(randoCodePatchlsPath);
            const randoCodePatchArmModPath = path.join(z17randomizerFolder, "randomizer/src/patch/code/arm/mod.rs");
            const randoCodePatchArmModContents = fs.readFileSync(randoCodePatchArmModPath, "utf-8");
            fs.writeFileSync(randoCodePatchArmModPath, replaceWithPyClassAndOriginal(randoCodePatchArmModContents, 
                'pub fn assemble<A, const N: usize>(start: A, instructions: [Instruction; N]) -> Box<[u8]>', ([
                    'pub fn bx(register: Register) -> Instruction {', '\tInstruction::Raw(0xe12fff10 | (register as u32))', '}', '', '', 'pub fn blx(register: Register) -> Instruction {', 
                    '\tInstruction::Raw(0xe12fff30 | (register as u32))', '}']).join("\n")));
            sendFileModifiedMessage(randoCodePatchArmModPath);
            const randoCodePatchModPath = path.join(z17randomizerFolder, "randomizer/src/patch/code/mod.rs");
            let randoCodePatchModContents = fs.readFileSync(randoCodePatchModPath, "utf-8");
            randoCodePatchModContents = randoCodePatchModContents.replace("code.patch(0x2922A0, [b(progressive_charm)]);", "code.patch(0x2922A0, [b(progressive_ore)]);");
            randoCodePatchModContents = replaceWithPyClassAndOriginal(randoCodePatchModContents, 'code.patch(0x2922A0, [b(progressive_ore)]);', 
                fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, "randomizer/src/patch/code/mod_progressiveOre.rs"), "utf-8"));
            randoCodePatchModContents = randoCodePatchModContents.replace("const FN_GET_LOCAL_FLAG_3: u32 = 0x52a05c;", "")
            randoCodePatchModContents = randoCodePatchModContents.replaceAll("FN_GET_LOCAL_FLAG_3", "FN_GET_EVENT_FLAG")
            randoCodePatchModContents = randoCodePatchModContents.replace("const FN_SET_LOCAL_FLAG_3: u32 = 0x1bb724;", "")
            randoCodePatchModContents = randoCodePatchModContents.replace("const MAP_MANAGER_INSTANCE: u32 = 0x70c8e0;", "")
            const textLineFromProgressiveBowVar = findTextLineNumber("let progressive_bow = code.text().define([", randoCodePatchModContents) + 5;
            randoCodePatchModContents = deleteTextsFromLine(textLineFromProgressiveBowVar, 5, randoCodePatchModContents);
            randoCodePatchModContents = putTextIntoLine(textLineFromProgressiveBowVar, "\t\tmov(R5, 0x11).eq(),\n\t\tmov(R5, 0x55).ne(),", randoCodePatchModContents);
            const textLineFromProgressiveSwordVar = findTextLineNumber("let progressive_sword =", randoCodePatchModContents) + 8;
            randoCodePatchModContents = putTextIntoLine(textLineFromProgressiveSwordVar, "\t\t\tcmp(R3, 5),\n\t\t\tmov(R3, 4).eq(),", randoCodePatchModContents);
            const textLineForMaiamiEventFlag = findTextLineNumber("let fn_set_local3_flag_for_this_upgrade = code.text().define([", randoCodePatchModContents) + 3;
            randoCodePatchModContents = deleteTextsFromLine(textLineForMaiamiEventFlag, 2, randoCodePatchModContents);
            randoCodePatchModContents = putTextIntoLine(textLineForMaiamiEventFlag, "\t\t\tldr(R1, offset + NEW_EVENT_FLAGS_START_IDX),", randoCodePatchModContents);
            randoCodePatchModContents = randoCodePatchModContents.replaceAll("fn_set_local3_flag_for_this_upgrade", "fn_set_event_flag_for_this_upgrade");
            randoCodePatchModContents = randoCodePatchModContents.replaceAll("FN_SET_LOCAL_FLAG_3", "FN_SET_EVENT_FLAG");
            const textLineForItemStuffCodeMod = findTextLineNumber("for (offset, addr, item) in [", randoCodePatchModContents) + 1;
            randoCodePatchModContents = deleteTextsFromLine(textLineForItemStuffCodeMod, 9, randoCodePatchModContents);
            randoCodePatchModContents = putTextIntoLine(textLineForItemStuffCodeMod, ([
                "\t\t(4, 0x3100f8, bow),", "(3, 0x3100f0, boomerang),", "(11, 0x310128, hookshot),", "(6, 0x310100, hammer),",
                "(2, 0x310130, bombs),", "(8, 0x310110, fire_rod),", "(9, 0x310118, ice_rod),", "(10, 0x310120, tornado_rod),", "(7, 0x310108, sand_rod),"
            ]).join("\n\t\t"), randoCodePatchModContents);
            randoCodePatchModContents = randoCodePatchModContents.replaceAll("fn_get_maiamai_flag3", "fn_get_maiamai_flag")
            randoCodePatchModContents = randoCodePatchModContents.replaceAll("thing", "fn_get_maiamai_flag")
            const textLineNumbersForGettingMaiamaiEventFlags = filterTextLineNumber("let fn_get_maiamai_flag = code.text().define([", randoCodePatchModContents);
            const textLineNumbersForGettingMaiamaiEventFlagLast = textLineNumbersForGettingMaiamaiEventFlags[0] + 1;
            randoCodePatchModContents = deleteTextsFromLine(textLineNumbersForGettingMaiamaiEventFlagLast, 2, randoCodePatchModContents);
            randoCodePatchModContents = putTextIntoLine(
                textLineNumbersForGettingMaiamaiEventFlagLast, "\t\tldr(R2, NEW_EVENT_FLAGS_START_IDX),\n\t\tadd(R1, R2, R1),\n\t\tldr(R0, EVENT_FLAG_PTR),", randoCodePatchModContents);
            textLineNumbersForGettingMaiamaiEventFlags.splice(0, 1);
            for (var i = 0; i < textLineNumbersForGettingMaiamaiEventFlags.length; i++) {
                const lineNumber = textLineNumbersForGettingMaiamaiEventFlags[i] + 1;
                randoCodePatchModContents = deleteTextsFromLine(lineNumber, 2, randoCodePatchModContents);
                randoCodePatchModContents = putTextIntoLine(lineNumber, "\t\tldr(R1, NEW_EVENT_FLAGS_START_IDX),\n\t\tadd(R1, R1, R4),\n\t\tldr(R0, EVENT_FLAG_PTR),", randoCodePatchModContents);
            }
            randoCodePatchModContents = randoCodePatchModContents.replaceAll("ldr(R0, (R0, 0x40)),", "");
            randoCodePatchModContents = randoCodePatchModContents.replace("const NEW_LOCAL_FLAGS_START_IDX: u32 = 300;", "const NEW_EVENT_FLAGS_START_IDX: u32 = 861;");
            randoCodePatchModContents = replaceWithPyClassAndOriginal(randoCodePatchModContents, "#[allow(unused_variables)]", 
                fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, "randomizer/src/patch/code/mod_ap.rs"), "utf-8"));
            randoCodePatchModContents = randoCodePatchModContents.replace(replace[11], "seed_info.is_archipelago() || " + replace[11]);
            randoCodePatchModContents = randoCodePatchModContents.replace("code.patch(0x3455B8, [b(0x345578)]);", "code.patch(0x3455C0, [bl(0x2558DC)]);");
            randoCodePatchModContents = replaceWithPyClassAndOriginal(randoCodePatchModContents, "let actor_names", "// This must be called first so the Archipelago header goes in the correct location\
            \n\tif let Some(info) = &seed_info.archipelago_info {\n\t\t\tpatch_archipelago(&mut code, seed_info.seed, &info.name);\n\t}");
            randoCodePatchModContents = randoCodePatchModContents.replace(replace[10], "bx, blx, " + replace[10]);
            randoCodePatchModContents = randoCodePatchModContents.replace(replace[9], "sub, " + replace[9]);
            randoCodePatchModContents = randoCodePatchModContents.replace("MAP_MANAGER_INSTANCE", "EVENT_FLAG_PTR")
            fs.writeFileSync(randoCodePatchModPath, randoCodePatchModContents);
            sendFileModifiedMessage(randoCodePatchModPath);
            const randoPatchlmsbfPath = path.join(z17randomizerFolder, "randomizer/src/patch/lms/msbf.rs");
            let randoPatchlmsbfContents = fs.readFileSync(randoPatchlmsbfPath, "utf-8");
            randoPatchlmsbfContents = randoPatchlmsbfContents.replace(replace[0], replace[0] + "\nuse rom::flag::Flag;");
            randoPatchlmsbfContents = randoPatchlmsbfContents.replace("[90] => 91, // Skip 2nd Zelda text", "[70 convert_into_action] each [ // Skip 2nd Zelda text and set an event flag\n\t\t\t\t= 0xE,\n\t\t\t\targ1(6),\n\t\t\t\tvalue(Flag::ZELDA_BOW.get_value().into()),\n\t\t\t],");
            const lineNumberForInsertingActionConverter = findTextLineNumber("[0x25] => 0x37,", randoPatchlmsbfContents) + 1;
            randoPatchlmsbfContents = putTextIntoLine(lineNumberForInsertingActionConverter, "\t\t\t[0x26] each [\n\t\t\t\t= 0xE, // Change to event flag\n\t\t\t\tvalue(Flag::NPC_HINOX.get_value().into()),\n\t\t\t],", randoPatchlmsbfContents);
            fs.writeFileSync(randoPatchlmsbfPath, randoPatchlmsbfContents);
            sendFileModifiedMessage(randoPatchlmsbfPath);
            const randoCodePatchMessageModPath = path.join(z17randomizerFolder, "randomizer/src/patch/messages/mod.rs");
            let randoCodePatchMessageModContents = fs.readFileSync(randoCodePatchMessageModPath, "utf-8");
            randoCodePatchMessageModContents = randoCodePatchMessageModContents.replace(replace[12], replace[12] + "LetterInABottle");
            randoCodePatchMessageModContents = randoCodePatchMessageModContents.replace(replace[13], "Randomizable, " + replace[13]);
            randoCodePatchMessageModContents = randoCodePatchMessageModContents.replace("patch_item_names(patcher)?;", "patch_item_names(patcher, seed_info)?;");
            randoCodePatchMessageModContents = randoCodePatchMessageModContents.replace("patch_event_item_get(patcher)?;", "patch_event_item_get(patcher, seed_info.is_archipelago())?;");
            randoCodePatchMessageModContents = randoCodePatchMessageModContents.replace(replace[14], replace[14] + ", seed_info: &SeedInfo")
            const itemGetEventFunctionLine = findTextLineNumber(replace[15], randoCodePatchMessageModContents) + 18;
            randoCodePatchMessageModContents = randoCodePatchMessageModContents.replace(replace[15], replace[15] + ", archipelago: bool")
            randoCodePatchMessageModContents = putTextIntoLine(itemGetEventFunctionLine,
                'if archipelago {\n\t\t\tmsbt.set("message_bottle", "You got an Archipelago item!")\n\t\t}', randoCodePatchMessageModContents);
            randoCodePatchMessageModContents = replaceWithPyClassAndOriginal(randoCodePatchMessageModContents, "\tpatcher.update(item_name.dump())?;", 
                fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, "randomizer/src/patch/messages/mod_item.rs"), 'utf-8'))
            randoCodePatchMessageModContents = replaceWithPyClassAndOriginal(randoCodePatchMessageModContents, "let mut street_merchant", 
                fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, "randomizer/src/patch/messages/mod_streetMerchantItem.rs"), 'utf-8'))
            randoCodePatchMessageModContents = randoCodePatchMessageModContents.replace("name(item_left)", "name(&item_name_left)")
            randoCodePatchMessageModContents = randoCodePatchMessageModContents.replaceAll("name(item_right)", "name(&item_name_right)")
            fs.writeFileSync(randoCodePatchMessageModPath, randoCodePatchMessageModContents);
            sendFileModifiedMessage(randoCodePatchMessageModPath);
            fs.writeFileSync(path.join(z17randomizerFolder, "randomizer/src/patch/mod.rs"), replacePrintlnWithInfo(
                fs.readFileSync(path.join(z17randomizerFolder, "randomizer/src/patch/mod.rs"), 'utf-8')
            ));
            sendFileModifiedMessage(path.join(z17randomizerFolder, "randomizer/src/patch/mod.rs"));
            writeReplacementChestNums(path.join(z17randomizerFolder, "randomizer/src/regions/dungeons/desert.rs"), {
                "[DP] (2F) Beamos Room": 276,
                "[DP] (2F) Under Rock (Ball Room)": 545
            });
            writeReplacementChestNums(path.join(z17randomizerFolder, "randomizer/src/regions/dungeons/swamp.rs"), {
                "[SP] (1F) Water Puzzle": 299,
                "[SP] (1F) East Room": 170,
                "[SP] (1F) West Room": 373
            });
            const hyruleWorldPath = path.join(z17randomizerFolder, "randomizer/src/world/hyrule.rs");
            let hyruleWorldContents = fs.readFileSync(hyruleWorldPath, "utf-8");
            hyruleWorldContents = hyruleWorldContents.replace(replace[16], replace[16] + " p.are_cracks_open() && ");
            fs.writeFileSync(hyruleWorldPath, hyruleWorldContents);
            sendFileModifiedMessage(hyruleWorldPath);
            const loruleWorldPath = path.join(z17randomizerFolder, "randomizer/src/world/lorule.rs");
            let loruleWorldContents = fs.readFileSync(loruleWorldPath, "utf-8");
            loruleWorldContents = replaceWithPyClassAndOriginal(loruleWorldContents, '\t\t\t\t\tcheck!("[Mai] Lorule Mountain W Skull", regions::lorule::death::mountain::SUBREGION => {', 
                fs.readFileSync(path.join(z17RandomizerAPPiecesFolder, "randomizer/src/world/lorule.rs"), "utf-8"))
            fs.writeFileSync(loruleWorldPath, loruleWorldContents);
            sendFileModifiedMessage(loruleWorldPath);
            const worldModPath = path.join(z17randomizerFolder, "randomizer/src/world/mod.rs");
            let worldModContents = fs.readFileSync(worldModPath, "utf-8");
            worldModContents = replaceWithPyClassAndOriginal(worldModContents, "graph", "check_map: DashMap<String, Check>,");
            worldModContents = worldModContents.replace("Self { graph: Default::default() }", `
                Self { graph: Default::default(), check_map: Default::default() }
            }

            fn compute_check_map(&mut self) {
                self.check_map = Default::default();
                for location_node in self.graph.values() {
                    if let Some(checks) = location_node.get_checks() {
                        for check in checks {
                            self.check_map.insert(check.get_name().to_string(), check.clone());
                        }
                    }
                }
            }

            pub fn get_check(&self, name: &str) -> Option<&Check> {
                self.check_map.get(name)`);
            worldModContents = putTextIntoLine(94, '\tworld.compute_check_map();', worldModContents);
            fs.writeFileSync(worldModPath, worldModContents);
            sendFileModifiedMessage(worldModPath);
            const romFlagPath = path.join(z17randomizerFolder, "rom/src/flag.rs");
            fs.writeFileSync(romFlagPath, replaceWithPyClassAndOriginal(fs.readFileSync(romFlagPath, "utf-8"), '920: WV_YOUR_HOUSE,', '861: NPC_HINOX,\n\t\t862: ZELDA_BOW,', 2));
            sendFileModifiedMessage(romFlagPath);
            ws.send("\nAll files were successfuly modified! Beginning app build...");
            builder.beginBuildFrom(z17randomizerFolder, ws).then(async ZipObject => {
                ws.send('\nPreparing your apworld file...');
                let OptionsPyContents = fs.readFileSync(path.join(albwArchipelagoAPPiecesFolder, "Options.py"), "utf-8");
                const APCompatiableSettings = Object.keys(apworldSettings).map(i => {
                    let info;
                    if (apworldSettings[i].applyToArchipelago) {
                        info = apworldSettings[i];
                        info.optionName = i;
                        info.specific_option_name ||= i;
                    }
                    return info
                })
                for (let i = 0; i < APCompatiableSettings.length; i++) {
                    if (!APCompatiableSettings[i]) APCompatiableSettings.splice(i, 1);
                }
                OptionsPyContents = OptionsPyContents.replace("ALBWOPTIONS", APCompatiableSettings.map(i => {
                    return `class ${i.className}(${i.classParam}):\n\t"""${i.desc}"""\n\tdisplay_name = "${i.displayName}"${(() => {
                        let stuff = '';
                        if (i.range || i.options || i.default_option) stuff += '\n\t';
                        if (i.options) {
                            const array = [];
                            let defaultOptionIndex;
                            for (let d = 0; d < i.options.length; d++) {
                                if (i.default_option == i.options[d]) defaultOptionIndex = d;
                                array.push({
                                    text: `option_${i.options[d]}`,
                                    index: d
                                })
                            }
                            stuff += array.map(d => `${d.text} = ${d.index}`).join("\n\t");
                            if (defaultOptionIndex != undefined) stuff += `\n\tdefault = ${defaultOptionIndex}`
                        } else if (i.range) {
                            stuff += `range_start = ${i.range.min}\n\trange_end = ${i.range.max}`
                            if (i.default_option) stuff += `\n\tdefault = ${i.default_option}`
                        }
                        return stuff;
                    })()}`
                }).join("\n\n"));
                OptionsPyContents = OptionsPyContents.replace("SPECIFIC_OPTIONS", `@dataclass\nclass ALBWSpecificOptions:${
                    APCompatiableSettings.map(i => `\n\t${i.specific_option_name}: ${i.className}`).join("")
                }`)
                OptionsPyContents = OptionsPyContents.replace("CREATE_RANDOMIZER_SETTINGS", `def create_randomizer_settings(options: ALBWSpecificOptions) -> albwrandomizer.Settings:\n\tsettings = albwrandomizer.Settings()\n\n\tsettings.dev_mode = False\n\t${(() => {
                    let code = '';
                    for (const setting of APCompatiableSettings) {
                        let appliedFirstSettingCode = false;
                        if (setting.randoSourceClass != "bool" && setting.randoSourceClass != "u8" && setting.randoSourceClass != "usize") code += '\n' + setting.options.map(i => {
                            let code = '\n\t'
                            if (appliedFirstSettingCode) code += 'el';
                            else appliedFirstSettingCode = true;
                            code += `if options.${setting.specific_option_name}.value == ${setting.className}.option_${i}:\n\t\tsettings.${setting.optionName} = albwrandomizer.${
                                setting.randoSourceClass
                            }.${i.split("_").map(builder.upperCaseBegWord).join("")}`
                            return code;
                        }).join("")
                        else {
                            let code1 = setting.randoSourceClass == "bool" ? 'bool(' : '';
                            code1 += `options.${setting.specific_option_name}.value`;
                            if (setting.randoSourceClass == "bool") code1 += ')';
                            code += `\n\n\tsettings.${setting.optionName} = ${code1}`;
                        }
                    }
                    return code;
                })()}\n\n\treturn settings`)
                fs.writeFileSync(path.join(albwArchipelagoFolder, "Options.py"), OptionsPyContents);
                let pyPatchContents = fs.readFileSync(path.join(albwArchipelagoAPPiecesFolder, "Patch.py"), "utf-8"), pyPatchCount = 0, pyPatchImportedClassFirstTimePass = true;
                pyPatchContents = pyPatchContents.replace("ALBWSpecificOptionsClasses", (() => {
                    let code = '';
                    for (let i = 0; i < APCompatiableSettings.length; i++) {
                        const setting = APCompatiableSettings[i];
                        if (i < (APCompatiableSettings.length - 1) && ((pyPatchCount == 3 && pyPatchImportedClassFirstTimePass) || pyPatchCount == 4)) {
                            pyPatchCount = 0;
                            pyPatchImportedClassFirstTimePass = false;
                            code += '\n\t';
                        } else pyPatchCount++;
                        code += setting.className + (i < (APCompatiableSettings.length - 1) ? ', ' : '')
                    }
                    return code;
                })());
                const OPTIONSDICT = APCompatiableSettings.map(i => `"${i.specific_option_name}"`).join(',\n\t\t\t\t')
                pyPatchContents = pyPatchContents.replace("OPTIONSDICT", OPTIONSDICT)
                pyPatchContents = pyPatchContents.replace("ALBWSpecificOptionsStuff", APCompatiableSettings.map(i => `${i.className}(info["options"]["${i.specific_option_name}"])`).join(',\n\t\t\t'))
                fs.writeFileSync(path.join(albwArchipelagoFolder, "Patch.py"), pyPatchContents);
                let pyInitContents = fs.readFileSync(path.join(albwArchipelagoAPPiecesFolder, "__init__.py"), "utf-8");
                const CrachShuffleInfo = APCompatiableSettings.find(i => i.options?.find(d => d == "any_world_pairs"))
                pyInitContents = pyInitContents.replaceAll("CrackShuffle", CrachShuffleInfo.className);
                pyInitContents = pyInitContents.replace("Cracksanity", CrachShuffleInfo.randoSourceClass);
                pyInitContents = pyInitContents.replace("cracksanity", CrachShuffleInfo.optionName);
                pyInitContents = pyInitContents.replaceAll("self.options.crack_shuffle", `self.options.${CrachShuffleInfo.specific_option_name}`);
                pyInitContents = pyInitContents.replace("OPTIONSDICT", OPTIONSDICT)
                fs.writeFileSync(path.join(albwArchipelagoFolder, "__init__.py"), pyInitContents);
                function writeStuff(fileOrFolder) {
                    const fileOrFolderPath = fileOrFolder ? path.join(albwArchipelagoBuiltInFolder, fileOrFolder) : albwArchipelagoBuiltInFolder;
                    const workingPath = fileOrFolder ? path.join(albwArchipelagoFolder, fileOrFolder) : albwArchipelagoFolder;
                    for (const file of fs.readdirSync(fileOrFolderPath)) {
                        const dir = path.join(fileOrFolderPath, file);
                        const workingDir = path.join(workingPath, file);
                        if (fs.existsSync(workingDir)) continue;
                        const stats = fs.lstatSync(dir);
                        if (stats.isDirectory()) {
                            fs.mkdirSync(workingDir)
                            writeStuff(fileOrFolder ? path.join(fileOrFolder, file) : file);
                        } else fs.writeFileSync(workingDir, fs.readFileSync(dir));
                    }
                }
                writeStuff();
                await builder.zipALBWApworld(ZipObject, ws, albwArchipelagoFolder);
                ws.send("\nThe build had finished successfuly!");
                res(await ZipObject.generateAsync({
                    type: "base64"
                }));
            }).catch(rej)
            function addpyclass(modInfoSettingPath, modinfoSettingFile) {
                let modinfoSettingPath = path.join(modInfoSettingPath, modinfoSettingFile);
                let contents = fs.readFileSync(modinfoSettingPath, 'utf-8');
                contents = contents.replace(";", ";\nuse pyo3::pyclass;");
                contents = contents.replace(")]", ")]\n#[pyclass]");
                fs.writeFileSync(modinfoSettingPath, contents);
                sendFileModifiedMessage(modinfoSettingPath)
            }
            function replaceWithPyClassAndOriginal(contents, replacer, newThing = '#[pyclass]', tab = 0, job = 'replace') {
                return contents[job](replacer, `${newThing}\n${(() => {
                    var tabs = ''
                    for (var i = 0; i < tab; i++) tabs += '\t';
                    return tabs;
                })()}${replacer}`);
            }
            function replaceFillerCompass(fillerProgressionContents, compassType, rustReturnTrueIfArchipelago) {
                return fillerProgressionContents.replace(compassType, `// Compasses are not progression in Archipelago\n\t\t${
                    rustReturnTrueIfArchipelago
                }${compassType}`);
            }
            function replacePrintlnWithInfo(contents) {
                return contents.replace("println!()", 'info!("")');
            }
            function putTextIntoLine(number, textToInsert, content, deleteOriginal = false,  splitter = "\n") {
                let lines = content.split(splitter);

                if (!textToInsert) lines.splice(number - 1, deleteOriginal ? 1 : 0);
                else lines.splice(number - 1, deleteOriginal ? 1 : 0, textToInsert);

                return lines.join(splitter)
            }
            function findTextLineNumber(text, content, splitter = "\n") {
                let lines = content.split(splitter);
                return lines.findIndex(line => line.includes(text)) + 1;
            }
            function accessTextFromLine(number, content, splitter = "\n") {
                const lines = content.split(splitter);
                return lines[number - 1];
            }
            function filterTextLineNumber(text, content, splitter = "\n") {
                let lines = content.split(splitter);
                const array = [];
                for (var index = 0; index < lines.length; index++) {
                    if (lines[index].includes(text)) array.push(index + 1);
                }
                return array.reverse();
            }
            function deleteTextsFromLine(lineNumber, numberOfLinesToDelete, randoCodePatchModContents) {
                for (var i = 0; i < numberOfLinesToDelete; i++) randoCodePatchModContents = putTextIntoLine(lineNumber, "", randoCodePatchModContents, true);
                return randoCodePatchModContents;
            }
            function writeReplacementChestNums(DungeonPath, replacementNums = {}) {
                let DungeonContents = fs.readFileSync(DungeonPath, "utf-8");
                for (const check in replacementNums) {
                    const currentTextLine = findTextLineNumber(check, DungeonContents);
                    const currentText = accessTextFromLine(currentTextLine, DungeonContents);
                    const type = currentText.split(": ")[1].split("[")[0];
                    DungeonContents = putTextIntoLine(currentTextLine, `\t\t\t"${check}": ${type}[${replacementNums[check]}]),`, DungeonContents, true)
                }
                fs.writeFileSync(DungeonPath, DungeonContents);
                sendFileModifiedMessage(DungeonPath);
            }
            function sendFileModifiedMessage(pathToFile, fileModified = true) {
                ws.send(`\n${fileModified ? 'Modified' : 'Created'}\n${pathToFile}\n`);
            }
            function gitPathCheck(folder) {
                return new Promise(async (res, rej) => {
                    if (!fs.existsSync(path.join(folder, "README.md"))) try {
                        ws.send(`\nNo files were found inside\n${folder}.\nChecking for Git Existance before making them...`);
                        if (fs.existsSync(folder)) fs.rmSync(folder, {
                            recursive: true,
                            force: true
                        });
                        function shellOutput() {
                            return new Promise(async (res, rej) => {
                                const gitModules = await (() => {
                                    return new Promise((res, rej) => {
                                        const gitModulesFile = fs.readFileSync(path.join(folder, "../.gitmodules"), "utf-8");
                                        let gitSubmoduleIndex = gitModulesFile.indexOf('[submodule "')
                                        while (gitSubmoduleIndex > -1) {
                                            const content = gitModulesFile.substring(gitSubmoduleIndex + 12);
                                            gitSubmoduleIndex = gitModulesFile.indexOf('[submodule "', gitSubmoduleIndex + 12);
                                            if (folder.substring(
                                                folder.lastIndexOf(process.platform == "win32" ? '\\' : '/') + 1
                                            ) == content.split('"]')[0]) return res({
                                                url: content.split("url = ")[1]?.split("\n")[0],
                                                branch: content.split("branch = ")[1]?.split("\n")[0],
                                                path: content.split("path = ")[1]?.split("\n")[0]
                                            });
                                        }
                                    })
                                })()
                                const commands = [path.join(folder, '../'), "&&", "git", "clone", gitModules.url, "--verbose"];
                                if (gitModules.branch) {
                                    commands.push("-b");
                                    commands.push(gitModules.branch)
                                }
                                builder.shellInit(cmd.spawn("cd", commands, {
                                    shell: true
                                }), ws).then(() => {
                                    ws.send(`\nFiles were successfuly made in\n${folder}`);
                                    res();
                                }).catch(rej);
                            })
                        }
                        function gitExistanceCheck(ranBefore = false) {
                            return new Promise(async (res, rej) => {
                                const gitPaths = {
                                    windows() {
                                        return path.join(process.env.ProgramFiles, "Git");
                                    },
                                    linux() {
                                        return '/usr/bin/git'
                                    }
                                }
                                if ((
                                    process.platform == "win32"
                                    && (!fs.existsSync(gitPaths.windows()) || fs.readdirSync(gitPaths.windows()).length == 1)
                                ) || (
                                    process.platform == "linux" && !fs.existsSync(gitPaths.linux())
                                )) {
                                    ws.send(`\nGit does not exist and that is needed to get the latest source code for\n${folder}.\nLaunching The Git Installer${ranBefore ? ' again' : ''}...`);
                                    switch (process.platform) {
                                        case "win32": {
                                            await builder.shellInit(cmd.spawn(path.join(folder, `../utilities/git-${process.env.PROCESSOR_ARCHITECTURE.toLowerCase()}.exe`)), ws).catch(rej);
                                            ws.send("\nThe Git Installer was closed. Press any key to continue building the app.");
                                            break;
                                        } default: {
                                            ws.send(`I cannot execute your ${
                                                process.platform
                                            } git file for you. You can refer to this link for an idea on how to install git on your system. https://git-scm.com/install/${
                                                process.platform == "darwin" ? 'mac' : process.platform == "linux" ? 'linux' : 'source'
                                            }\n\nOnce you are done installing git, press any key to continue.`)
                                        }
                                    }
                                    ws.on("message", async () => res({
                                        installedApp: await gitExistanceCheck(true)
                                    }));
                                } else res();
                            })
                        }
                        const stats = await gitExistanceCheck().catch(rej);
                        if (!stats) {
                            ws.send(`\nGit exists on your computer. Using it to get the files for\n${folder}`);
                            shellOutput().then(() => {
                                ws.send(`\nFolder check for\n${folder}\nis complete.`);
                                res(folder);
                            }).catch(rej)
                        } else {
                            ws.send(`\nGit exists on your computer. However, you need to restart this app in order to get the files for \n${
                                folder
                            }. Press any key to continue.`);
                            ws.on("message", () => rej(`Click <a href="javascript:closeApp()">here</a> to close the app.`))
                        }
                    } catch (e) {
                        rej(e);
                    } else res(folder)
                })
            }
        } catch (e) {
            rej(e);
        }
    })
}
