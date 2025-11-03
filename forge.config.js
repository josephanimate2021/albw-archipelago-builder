const fs = require("fs");
const packagerConfig = JSON.parse(fs.readFileSync('./package.json'));

module.exports = {
  packagerConfig: {},
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {}
    },
    {
      name: '@electron-forge/maker-wix',
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
