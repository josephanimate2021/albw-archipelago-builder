const builder = require("./builder");
const path = require("path")
const z17randomizerpath = path.join(__dirname, '../z17-randomizer');

console.log("Testing the builder with the path:", z17randomizerpath);
builder.beginBuildFrom(z17randomizerpath).then(zipObject => {
    console.log("All testing was complete. ZipObject:", zipObject)
});