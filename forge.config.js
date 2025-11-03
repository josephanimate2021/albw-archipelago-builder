const packagerConfig = require("./package.json");

module.exports = {
  packagerConfig: {},
  rebuildConfig: {},
  outDir: `${process.platform == "darwin" ? 'macos' : process.platform == "linux" ? 'ubuntu' : process.platform == "win32" ? 'windows' : process.platform}-latest`,
  makers: [
    {
      name: '@electron-forge/maker-wix',
      config: {
        language: 1033,
        manufacturer: packagerConfig.author
      }
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
