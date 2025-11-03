const cmd = require("child_process");
const fs = require("fs");

if (fs.existsSync('.git')) {
    console.log('Checking for updates...');
    runCommand('start git pull').then(() => {
        console.log("All updates were checked successfuly!");
        runChecks();
    });
} else runChecks();

async function runChecks() {
    if (!fs.existsSync('node_modules') || !fs.existsSync('package-lock.json')) {
        console.log("All required app dependecies do not exist! Installing them...");
        await runCommand("npm install");
        console.log("All app dependecies were installed successfuly! Starting the app...");
        startApp();
    } else {
        console.log("All app dependecies are currently installed. Starting the app...");
        startApp();
    }

function startApp() {
    runCommand("start npm start");
}

function runCommand(command) {
    return new Promise((res, rej) => {
        setTimeout(() => {
            cmd.execSync(command);
            res();
        }, 4167);
    });
}
