const fs = require("fs");
const packagerConfig = JSON.parse(fs.readFileSync('./package.json'));

<<<<<<< HEAD
let indexJSForCrossZip = fs.readFileSync('node_modules/cross-zip/index.js').toString("utf-8");
=======
let indexJSForCrossZip = fs.readFileSync('node_modules/cross-zip/index.js').toString();
>>>>>>> 60ab5ad1381f037a20ca4d5d0ef9a42096a93dfe
indexJSForCrossZip = indexJSForCrossZip.split("fs.rmdir").join("fs.rm");
fs.writeFileSync('node_modules/cross-zip/index.js', indexJSForCrossZip);

module.exports = {
  packagerConfig: {},
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {}
    },
    {
      name: '@electron-forge/maker-zip',
      config: {}
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: packagerConfig.author,
          homepage: packagerConfig.homepage
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          homepage: packagerConfig.homepage
        }
      }
    }
  ],
};
