const cmd = require("child_process");
const fs = require("fs");
const builder = require("./backend/builder");

if (!fs.existsSync('node_modules') || !fs.existsSync('package-lock.json')) {
    console.log("All required app dependecies do not exist! Installing them...");
    builder.shellOutput(cmd.spawn('npm', ['install'])).then(() => {
        console.log("Dependecies were successfuly installed! Starting app...");
        startApp();
    });
} else {
    console.log("All app dependecies are currently installed. Starting the app...");
    startApp();
}

function startApp() {
    cmd.execSync("start npm start");
}