const builder = require("./builder");
const path = require("path");
const fs = require("fs");

console.log("Testing the builder using the built in source code...");
builder.buildWithBuiltInSourceCode().then(data => {
    const outputPath = path.join(__dirname, '../'), filename = 'albw_archipelago.zip';
    fs.writeFileSync(path.join(outputPath, filename), Buffer.from(data, "base64"));
    console.log(`All testing was complete. A file named ${filename} is located inside of ${outputPath} if you want it.`);
}).catch(e => {
    console.error("All testing has failed due to an error. See below:\n\n", e);
});