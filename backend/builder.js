const cmd = require("child_process");
const jszip = require("jszip");
const admzip = require("adm-zip");
const fs = require("fs");
const path = require("path");

module.exports = {
    /**
     * Builds the z17 randomizer source code and then distributes a zip file for the albwrandomizer module
     * @param {string} path The path of the source code
     * @param {WebSocket} ws A WebSocket connection for sending messages to the client.
     * @returns {Promise<jszip>} The object for the albwrandomizer zip file.
     */
    beginBuildFrom(buildPath, ws) {
        return new Promise(async (res, rej) => {
            this.sendMessageToClient(
                "Building the z17-randomizer archipelago from path: " + buildPath + ". Before that, some fixes need to be ran in order to encounter a better chance of a working python module.",
                ws
            );
            await this.shellOutput(cmd.spawn('cd', [buildPath, '&&', 'cargo', 'fix', '--lib', '-p', 'randomizer', '--allow-dirty'], {
                shell: true
            }), ws);
            this.sendMessageToClient("Fixes were applied. Building the z17-randomizer archipelago...", ws);
            const targetPath = path.join(buildPath, 'target');
            fs.rmSync(targetPath, {
                recursive: true,
                force: true
            });
            this.shellOutput(cmd.spawn('cd', [buildPath, '&&', 'maturin', 'build'], {
                shell: true
            }), ws).then(() => {
                this.sendMessageToClient("Build was successful! Preparing your zip file for the albwrandomizer module...", ws);
                const zip = new jszip();
                const albwrandomizerFolder = zip.folder("albwrandomizer");
                const wheelsFolder = path.join(targetPath, 'wheels');
                if (fs.existsSync(wheelsFolder)) {
                    const wheelsFolderExtracted = path.join(wheelsFolder, 'extracted');
                    const whlzip = new admzip(path.join(wheelsFolder, fs.readdirSync(wheelsFolder)[0]));
                    whlzip.extractAllToAsync(wheelsFolderExtracted, false, true, err => {
                        if (err) console.error(err);
                        else {
                            const albwrandomizerfolder = path.join(wheelsFolderExtracted, 'albwrandomizer');
                            fs.readdirSync(albwrandomizerfolder).forEach(file => albwrandomizerFolder.file(file, fs.readFileSync(path.join(albwrandomizerfolder, file))));
                            this.sendMessageToClient("Zip file for the albwrandomizer module was successfuly prepared!", ws);
                            res(zip);
                        }
                    })
                } else rej("Your wheels folder does not exist for some reason. Maybe the build failed?");
            });
        })
    },
    /**
     * Sends a message to the client via a WebSocket connection (From Client Side) or CLI (Testing only)
     * @param {string} msg The message to send
     * @param {WebSocket} ws A WebSocket connection for sending messages to the client.
     * @param {boolean} error A boolean for whatever or not to use console.error to log the error (Testing Only)
     */
    sendMessageToClient(msg, ws, error = false) {
        ws ? ws.send(`\n${msg}`) : console[error ? 'error' : 'log'](msg);
    },
    /**
     * 
     * @param {cmd.ChildProcess} shell A process provided by the child_process module.
     * @param {WebSocket} ws A WebSocket connection for sending messages to the client.
     * @returns {Promise} A JSON object repersenting whatever ot not the program has ended.
     */
    shellOutput(shell, ws) {
        return new Promise((res, rej) => {
            shell.stdout.setEncoding("utf8")
            shell.stdout.on('data', o => this.sendMessageToClient('\n' + o, ws));
            shell.stderr.setEncoding("utf8")
            shell.stderr.on('data', e => this.sendMessageToClient('\n' + e, ws, true));
            shell.stdout.on("end", () => {
                shell.kill();
                res({
                    programEnded: true
                });
            });
        })
    },
    buildWithBuiltInSourceCode(ws) {
        return new Promise((res, rej) => {
            const z17randomizerpath = path.join(__dirname, '../z17-randomizer');
            const targetPath = path.join(z17randomizerpath, 'target');
            if (fs.existsSync(targetPath)) fs.rmSync(targetPath, {
                recursive: true,
                force: true
            });
            this.beginBuildFrom(z17randomizerpath, ws).then(async ZipObject => {
                this.sendMessageToClient("Building your albw.apworld file...", ws);
                const zip = new jszip();
                function zipProcess(filePath, zip, sendMessageToClient) {
                    fs.readdirSync(filePath).forEach(file => {
                        const filepath = path.join(filePath, file);
                        const stats = fs.lstatSync(filepath);
                        if (stats.isDirectory()) zipProcess(filepath, zip.folder(file), sendMessageToClient);
                        else zip.file(file, fs.readFileSync(filepath));
                        sendMessageToClient(`\nZipped\n${filepath}\n`, ws);
                    })
                }
                zipProcess(path.join(__dirname, '../albw-archipelago'), zip, this.sendMessageToClient);
                ZipObject.file("albw.apworld", await zip.generateAsync({
                    type: "nodebuffer"
                }));
                ZipObject.generateAsync({
                    type: "base64",
                    mimeType: "application/zip"
                }).then(data => {
                    this.sendMessageToClient("Successfuly generated your albw.apworld file!", ws);
                    res(data);
                })
            }).catch(rej);
        })
    }
}