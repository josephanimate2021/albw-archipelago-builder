/**
 * App loader for albw-archipelago-builder.
 */

// Modules
const cmd = require("child_process");
const fs = require("fs");

if (fs.existsSync('.git')) { // Checks for updates if the user cloned this source code with git.
    console.log('Checking for updates...');
    runCommand('start git pull && git submodule update --remote').then(code => {
        if (code == 0) {
            console.log("All updates were checked successfuly!");
            runChecks();
        } else {
            console.warn("Could not check for updates due to error code", code);
            console.log("");
            console.log("Running the checks without updates...");
            runChecks();
        }
    });
} else runChecks();

/**
 * Runs some checks before starting the app.
 */
async function runChecks() {
    if (!fs.existsSync('node_modules') || !fs.existsSync('package-lock.json')) {
        console.log("All required app dependecies do not exist! Installing them...");
        const code = await runCommand("npm install");
        if (code == 0) {
            console.log("All app dependecies were installed successfuly! Starting the app...");
            startApp();
        } else exitError('All app dependecies have failed to install. Error Code:', code);
    } else {
        console.log("All app dependecies are currently installed. Starting the app...");
        startApp();
    }
}

/**
 * Starts the app once everything checks out.
 */
function startApp() {
    runCommand("start npm start").then(code => {
        if (code == 0) console.log("You chose to close the app. Code was", code);
        else exitError("The app failed to start. Error Code:", code);
    });
}

/**
 * 
 * @param {string} command The provided command to run.
 * @returns {Promise<Number>} The closing code after the command is run.
 */
function runCommand(command) {
    if (process.platform != "win32" && command.startsWith("start")) command = command.substring(6);
    return new Promise((res, rej) => {
        setTimeout(() => {
            const args = command.split(" ");
            const command1 = args[0];
            args.splice(0, 1);
            const proces = cmd.spawn(command1, args, {
                shell: true
            })
            proces.stdout.on("data", d => console.log(d.toString()));
            proces.stderr.on("data", d => console.error(d.toString()));
            proces.on("close", res);
        }, 4167);
    });
}

/**
 * Exits the app when a user recieves an error from the console.
 * @param {string} startMsg The beginning of the message
 * @param {Number} code The closing code that the user got.
 */
function exitError(startMsg, code) {
    console.log(startMsg + " Error code was", code, "\n\nPlease fix those errors before running the app again.");
    runCommand("exit");
}
