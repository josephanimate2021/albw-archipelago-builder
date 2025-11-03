const fs = require("fs");
const packagerConfig = JSON.parse(fs.readFileSync('./package.json'));

let indexJSForCrossZip = fs.readFileSync('node_modules/cross-zip/index.js').toString();
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
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'josephanimate2021',
          name: 'albw-archipelago-builder'
        },
        prerelease: false,
        draft: false
      }
    }
  ]
};
