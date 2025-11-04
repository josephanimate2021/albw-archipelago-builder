const readline = require('node:readline');
const cmd = require("child_process");
const path = require("path");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askAppBuildQuestion() {
  return new Promise((res, rej) => {
    const appBuildOptions = ["package", "make"]
    rl.question("How do you want to build your app? Options include: " + appBuildOptions.join(", ") + "\n\n", answer => {
      if (appBuildOptions.find(i => i == answer)) {
        console.log("Good choice! Bulding the app...");
        res(answer);
      } else {
        console.warn("You need to type in one of the options provided in the question. Provided answer:", answer);
        res(askAppBuildQuestion());
      }
    })
  })
}
askAppBuildQuestion().then(answer => {
  const process = cmd.spawn("npm", ['run', answer], {
    shell: true
  });
  process.stdout.on("data", d => console.log(d.toString()));
  process.stderr.on("data", d => console.error(d.toString()));
  process.on("close", code => {
    console.log(code == 0 ? `The ${answer} command ran successfuly! Your build should be located in this file path: ${
      path.join(__dirname, `out${answer == "make" ? '/make' : ''}`)
    }` : `The ${answer} command has failed to run. Error code: ${code}. Please fix any errors encountered above.`);
    setTimeout(() => {
      cmd.execSync("exit");
    }, 4167);
  });
})
