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
                    'openFile',
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
                function textInstallRequired(type, file, shellRestartRequired = false) {
                    return `You need to install ${type} in order to be able to build a python module out of the z17-randomizer source code. 
                    You may begin the installation of rust if you want to by clicking <a href="javascript:launchToolFromUtilities('${file}', ${
                        shellRestartRequired
                    })">here</a>.`
                }

                const userHomePath = process.env.HOME || process.env.USERPROFILE;

                /**
                 * Checks to see if any important paths are existant 
                 * (Keep in mind that keeping the required programs in their default paths is recommended for most people).
                 */
                function checkPathsExistance() {
                    const rustPathExists = fs.existsSync(path.join(userHomePath, '.cargo/bin'));
                    const pythonPathExistsWin = fs.existsSync(path.join(userHomePath, './AppData/Local/Programs/Python/Python312/'));
                    const pythonPathExistsMac = fs.existsSync('/Library/Frameworks/Python.framework/Versions/3.12');
                    const pythonPathExistsLinux = fs.existsSync('/usr/bin/python3.12');
                    const pythonPathExists = (
                        process.platform == "darwin" && pythonPathExistsMac
                    ) || (
                        process.platform == "win32" && pythonPathExistsWin
                    ) || (
                        process.platform == "linux" && pythonPathExistsLinux
                    );
                    const pyModuleMaturinExists = (
                        process.platform == "win32" 
                        && fs.existsSync(path.join(userHomePath, './AppData/Local/Programs/Python/Python312/Scripts/maturin.exe'))
                    );
                    return {
                        rustPathExists,
                        pythonPathExists,
                        pyModuleMaturinExists
                    }
                }

                /**
                 * Runs some checks to ensure that the required programs are installed.
                 */
                function runChecks(wasRan = false) {
                    ws.send(`\nChecking${wasRan ? ' again' : ''} to see if you have Python version 3.12, rust, and maturin installed...`);
                    const pathsExist = checkPathsExistance();
                    if (!pathsExist.rustPathExists) {
                        ws.send(JSON.stringify({
                            operationSuccessful: false,
                            operatingSystemInfo: {
                                platform: process.platform,
                                arch: process.arch,
                            },
                            programToInstall: 'rust',
                            commandForInstallingProgram: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
                            message: textInstallRequired(
                                'rust', 
                                process.platform == "win32" ? `rustup-init${process.env.PROCESSOR_ARCHITECTURE != "x86" ? `-${
                                    process.env.PROCESSOR_ARCHITECTURE.toLowerCase()
                                }` : ''}.exe` : `fromCommand`,
                                true
                            )
                        }))
                    } else if (!pathsExist.pythonPathExists) {
                        ws.send(JSON.stringify({
                            operationSuccessful: false,
                            operatingSystemInfo: {
                                platform: process.platform,
                                arch: process.arch,
                            },
                            programToInstall: 'Python',
                            message: textInstallRequired(
                                'Python', 
                                process.platform != "linux" ? `python-3.12.0${(() => {
                                    switch (process.platform) {
                                        case "win32": return process.env.PROCESSOR_ARCHITECTURE != "x86" ? `-${
                                            process.env.PROCESSOR_ARCHITECTURE.toLowerCase()
                                        }` : '' + '.exe';
                                        case "darwin": return '-macos11.pkg'
                                    }
                                })()}` : '-install.sh',
                                true
                            )
                        }));
                    } else if (!pathsExist.pyModuleMaturinExists) {
                        ws.send('\nmaturin does not exist inside your Python Path. Installing...\n');
                        shellInit(cmd.spawn("pip", ['install', 'maturin'], {
                            shell: true
                        }), ws).then(() => runChecks(true));
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
                        await continueBuildingWithBuffer(fs.readFileSync(filePath), ws);
                    } else if (parsedUrl.query.zipURL) {
                        const res = await fetch.default(decodeURIComponent(parsedUrl.query.zipURL));
                        await continueBuildingWithBuffer(await res.arrayBuffer(), ws);
                    } else if (parsedUrl.query.useBultInSourceCode) builder.buildWithBuiltInSourceCode(ws).then(data => {
                        ws.send("\nPress the enter key to continue.")
                        ws.on("message", () => {
                            ws.send(JSON.stringify({
                                operationSucessful: true,
                                message: `The z17-randomizer Archipelago build was successful! To download your build, you may click <a download='albw_archipelago.zip' href='data:application/zip;base64,${
                                    data
                                }'>here</a>. To start the process again, you may <a href="javascript:location.reload()">reload this page</a>.`
                            }))
                        });
                    }).catch(e => {
                        console.error(e);
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
            shellInit(cmd.spawn(path.join(__dirname, '../utilities', decodeURIComponent(parsedUrl.query.filename))), ws).then(info => ws.send(JSON.stringify(info)));
        }
    }
});

/**
 * Core for the app
 * @param {number} serverPort 
 * @param {electron.BrowserWindow} mainWindow 
 * @param {Function} isRunningFromSource 
 */
module.exports = (serverPort, mainWindow, isRunningFromSource) => {
    app.use((req, _, next) => {
        console.log('HTTP', req.method, req.url);
        next();
    }).use(express.static(path.join(__dirname, '../frontend')));

    app.post('/getGithubStuff', async (_, res) => {
        res.json(await generateGithubResponses());
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
 * loads a user's shell using the provided ChildProcess.
 * @param {cmd.ChildProcess} shell 
 * @param {Function} callbackOnClose 
 * @param {WebSocket} ws 
 */
function shellInit(shell, ws) {
    return new Promise((res, rej) => {
        shell.stdin.setEncoding("utf8")
        ws.on('message', c => shell.stdin.write(c + "\n"));
        shell.stdout.setEncoding("utf8")
        shell.stdout.on('data', o => ws.send('\n' + o));
        shell.stderr.setEncoding("utf8")
        shell.stderr.on('data', e => ws.send('\n' + e));
        shell.stdout.on("end", () => {
            shell.kill();
            res({
                programEnded: true
            });
        })
    })
}

/**
 * Generates the releases and branches response from the z17-randomizer repo.
 * @returns {Promise}
 */
function generateGithubResponses() {
    return new Promise(res => {
        let info = {
            releases: [],
            branches: []
        }
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
             * takes out versions of the z17 randomizer that don't ship with an auto retry feature (best for archipelago)
             * @param {number} pathIndex 
             * @returns {Promise}
             */
            function modifyResponses(pathIndex = 0) {
                return new Promise(res => {
                    const term = paths[pathIndex].substring(1);
                    if (info[term]) for (var i = 0; i < 9; i++) {
                        for (var e = 0; e < info[term].length; e++) {
                            const json = info[term][e];
                            if (json.name.endsWith(`0.0.${i}`)) info[term].splice(e, 1);
                        }
                    }
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
async function continueBuildingWithBuffer(buffer, ws) {
    function sendFileModifiedMessage(pathToFile, fileModified = true) {
        ws.send(`\n${fileModified ? 'Modified' : 'Created'}\n${pathToFile}\n`);
    }
    const unzipedContent = await JSZip.loadAsync(buffer);
    const pathToWriteTempFiles = path.join(__dirname, '../temp');
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
            ws.send(`\nExtracted\n${fileOrFolderPath}\n`);
        }
    }
    ws.send('\nFiles were extracted successfuly! Modifying files for the build...\n');
    const z17randomizerFolder = path.join(pathToWriteTempFiles, fs.readdirSync(pathToWriteTempFiles)[0]);
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
        fs.writeFileSync(buildPath, fs.readFileSync(path.join(__dirname, '../z17-randomizer/build.rs')));
        sendFileModifiedMessage(buildPath);
    }
    const plandoPath = path.join(z17randomizerFolder, 'src/bin/plando.rs');
    if (fs.existsSync(plandoPath)) {
        let contents = fs.readFileSync(plandoPath, 'utf-8');
        fs.writeFileSync(plandoPath, contents.replace("settings,", "archipelago_info: None,\n\t\tsettings,"));
        sendFileModifiedMessage(plandoPath);
    }
    const patchModPath = path.join(z17randomizerFolder, 'randomizer/src/patch/mod.rs');
    if (fs.existsSync(patchModPath)) {
        let contents = fs.readFileSync(patchModPath, 'utf-8');
        fs.writeFileSync(patchModPath, contents.replace("println!()", 'info!("")'));
        sendFileModifiedMessage(patchModPath);
    }
    const libPath = path.join(z17randomizerFolder, 'src/lib.rs');
    fs.writeFileSync(libPath, fs.readFileSync(path.join(__dirname, '../z17-randomizer/src/lib.rs')));
    sendFileModifiedMessage(libPath, false);
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
    for (const file of ['modinfo/src/settings/mod.rs', 'settings/src/lib.rs']) {
        const modinfoModPath = path.join(z17randomizerFolder, file);
        if (fs.existsSync(modinfoModPath)) {
            let contents = fs.readFileSync(modinfoModPath, 'utf-8');
            contents = contents.replace(";", ";\nuse pyo3::prelude::*;");
            let index = contents.indexOf("#[serde(");
            while (index > -1) {
                const setting = contents.substring(index).split("\n")[1];
                if (
                    !setting.startsWith("pub fn")
                ) contents = contents.replace(setting, `${setting.startsWith("pub struct") ? '#[pyclass]' : '\t#[pyo3(get, set)]'}\n${setting}`)
                index = contents.indexOf("#[serde(", index + 8);
            }
            contents = contents.replace(
                "impl Settings {", 
                `#[pymethods]\nimpl Settings {\n\t#[new]\n\tpub fn new() -> Settings {\n\t\tSettings::default()\n\t}\n}\n\nimpl Settings {`
            )
            fs.writeFileSync(modinfoModPath, contents);
            sendFileModifiedMessage(modinfoModPath)
        }
    }
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
    const randoFillerPath = path.join(z17randomizerFolder, 'randomizer/src/filler');
    if (fs.existsSync(randoFillerPath)) addpyclass(randoFillerPath, 'cracks.rs');
    sendFileModifiedMessage(randoFillerPath);
    ws.send("\nAll files were successfuly modified! Beginning build...");
    builder.beginBuildFrom(z17randomizerFolder, ws).then(async ZipObject => {
        fs.rmSync(z17randomizerFolder, {
            force: true,
            recursive: true
        });
        ws.send('\nPreparing your apworld file...');
        ZipObject.file("albw.apworld", (() => {

        })());
        ws.send("\nThe build had finished successfuly!");
        ws.send(await ZipObject.generateAsync({
            type: "blob"
        }))
    })
    function addpyclass(modInfoSettingPath, modinfoSettingFile) {
        modinfoSettingPath = path.join(modInfoSettingPath, modinfoSettingFile);
        let contents = fs.readFileSync(modinfoSettingPath, 'utf-8');
        contents = contents.replace(";", ";\nuse pyo3::pyclass;");
        contents = contents.replace(")]", ")]\n#[pyclass]");
        fs.writeFileSync(modinfoSettingPath, contents);
        sendFileModifiedMessage(modinfoSettingPath)
    }
}