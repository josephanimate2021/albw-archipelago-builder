// The URL of the WebSocket server.
const serverUrl = 'ws://localhost:8080';

// Any data that needs to be held onto.
const data = {};

// The function of the UserPrefersAPSourceCode class
var userPrefersAPSourceCode;

class UserPrefersAPSourceCode {
  constructor() {
    this.branchesSelectionDisplay = this.makeDisplayJSON('branchSelector');
    this.releaseVersionSelectionDisplay = this.makeDisplayJSON('releaseVersionSelector');
  }
  makeDisplayJSON(elemName) {
    return {
      elemName,
      showing: document.getElementById(elemName)?.style.display
    }
  }
  elementToggled(formElem) {
    if (formElem.getAttribute("data-showSubmitBtnOnClick")) showOrHide('submitBtn', 'block', 'none');
    else {
      for (const h of ['branchesSelectionDisplay', 'releaseVersionSelectionDisplay']) {
        if (this[h].showing == "none") continue;
        showOrHide(this[h].elemName)
      }
      showOrHide('userPrefersBranchCheckbox');
      showOrHide('genericSummary');
      showOrHide('userPrefersArchipelago', 'block', 'none')
    }
    function showOrHide(elemName, show1 = 'none', show2 = 'block') {
      document.getElementById(elemName).style.display = formElem.checked ? show1 : show2;
    }
  }
}

/**
 * Allows a user to open up file explorer in order for them to be able to select their z17-randomizer source code file.
 */
function buildALBWArchipelagoViaFileExplorerMethod() {
  const fileExplorerInfo = new URLSearchParams({
    title: 'Select your z17-randomizer source code zip file.',
    buttonLabel: 'Open ZIP File',
    anythingToDump: JSON.stringify({
      filters: [
        {
          name: 'Zip Files',
          extensions: ['zip']
        }
      ]
    })
  }).toString();

  const connection = new WebSocket(serverUrl + '/openExplorer?' + fileExplorerInfo);
  connection.onmessage = (event) => {
    try {
      makeFeedback(true);
      beginBuilding(JSON.parse(event.data)[0]);
    } catch (e) {
      console.error(e);
      makeFeedback(false, "warning", "Please select a zip file to use with your build");
    }
  };
}

/**
 * Allows a user to also use the form to build their albw archipelago.
 * @param {HTMLFormElement} formElement 
 */
function buildALBWArchipelagoViaFormMethod(formElement) {
  makeFeedback(true);
  const data = serializeFormData(formElement);
  if (data['z17-randomizer-userPrefersBuiltInSourceCodeOption'] == "on") emulateTerminal(new WebSocket(serverUrl + '/beginBuild?useBultInSourceCode=true'))
  else if (data['z17-randomizer-userPrefersBranchOption'] == 'on') getZipURLBeforeBuild(document.getElementById('branch'), data['z17-randomizer-branch']);
  else getZipURLBeforeBuild(document.getElementById('releaseVersion'), data['z17-randomizer-release'])
}

/**
 * Obtains a ZIP url from the selected option given by the data-zipURL attribute.
 * @param {HTMLSelectElement} selectElement 
 * @param {string} origValue 
 */
function getZipURLBeforeBuild(selectElement, origValue) {
  for (const option of selectElement.getElementsByTagName('option')) {
    if (option.value != origValue) continue;
    emulateTerminal(new WebSocket(serverUrl + '/beginBuild?zipURL=' + encodeURIComponent(option.getAttribute('data-zipURL'))))
  }
}

/**
 * Begins the build of the z17-randomizer archipelago using the user's selected file path.
 * @param {string} filePath 
 */
function beginBuilding(filePath) {
  if (filePath) emulateTerminal(new WebSocket(serverUrl + '/beginBuild?filePath=' + encodeURIComponent(filePath)));
}

/**
 * Generates some feedback for the user.
 * @param {boolean} isClearingFeedback 
 * @param {string} alertType 
 * @param {string} message 
 */
function makeFeedback(isClearingFeedback, alertType, message) {
  const availableAlertTypes = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'];
  document.getElementById('feedbackBlock').innerHTML = !isClearingFeedback ? `<div class="alert${
    availableAlertTypes.find(i => i == alertType) ? ` alert-${alertType}` : ''
  }" role="alert">
    ${message}
  </div>` : '';
}

/**
 * Helps with the output for building the z17-randomizer archipelago.
 * @param {WebSocket} connection 
 */
function emulateTerminal(connection) {
  const pageForm = document.getElementById('pageForm');
  for (const g of pageForm.getElementsByClassName('order-md-last')) g.style.display = 'none';
  pageForm.style.display = 'none';
  document.getElementById('intro').style.display = 'none';
  const resultField = document.getElementById('resultField');
  const terminal = new TerminalEmulator(connection, resultField);
  terminal.otherDataFunction = event => {
    console.log(event.data);
    try {
      const info = JSON.parse(event.data);
      makeFeedback(false, info.operationSucessful ? 'success' : 'danger', info.message);
      resultField.innerHTML = '';
      resultField.setAttribute('data-installingProgram', info.programToInstall);
      if (info.commandForInstallingProgram) resultField.setAttribute("data-programInstallCommand", encodeURIComponent(info.commandForInstallingProgram));
      data.terminalWebsocketConnection = connection;
    } catch {}
  }
}

/**
 * Creates a summary for the user on the right side of the page.
 */
function makeSummary(onlyInitAPCheckbox = false) {
  userPrefersAPSourceCode = new UserPrefersAPSourceCode();
  if (!onlyInitAPCheckbox) {
    const releaseVersion = document.getElementById('releaseVersion').value;
    const branch = document.getElementById('branch').value;
    const userPrefersBranch = document.getElementById('userPrefersBranch').checked;
    const elemToWorkWith = document.getElementById(userPrefersBranch ? 'branchThatTheUserWillBeUsing' : 'releaseVersionThatTheUserWillBeUsing');
    elemToWorkWith.getElementsByTagName('span')[0].innerText = userPrefersBranch ? branch : releaseVersion;
    elemToWorkWith.style.display = 'block';
    document.getElementById(userPrefersBranch ? 'releaseVersionThatTheUserWillBeUsing' : 'branchThatTheUserWillBeUsing').style.display = 'none';
  }
}

/**
 * This serializes data from a form.
 * @param {HTMLFormElement} form 
 * @returns 
 */
function serializeFormData(form) {
  var formData = new FormData(form);
  var serializedData = {};

  for (var [name, value] of formData) {
    if (serializedData[name]) {
      if (!Array.isArray(serializedData[name])) {
        serializedData[name] = [serializedData[name]];
      }
      serializedData[name].push(value);
    } else {
      serializedData[name] = value;
    }
  }

  return serializedData;
}

/**
 * Launches a file from the utilites folder.
 * @param {string} filename 
 */
function launchToolFromUtilities(filename, requiresShellRestart = false, programUsesCLI = false) {
  const resultField = document.getElementById('resultField');
  const installingProgram = resultField.getAttribute('data-installingProgram');
  const info = {
    filename
  }
  if (filename == "fromCommand") {
    delete info.filename;
    info.runCommand = decodeURIComponent(resultField.getAttribute("data-programInstallCommand"))
  }
  const connection = new WebSocket(serverUrl + '/launchToolFromUtilities?' + new URLSearchParams(info).toString());
  if (programUsesCLI) {
    const terminal = new TerminalEmulator(connection, resultField);
    terminal.otherDataFunction = handleWebSocketData;
  } else connection.onmessage = handleWebSocketData;
  makeFeedback(false, 'info', `You are currently installing ${installingProgram} right now.`);

  function handleWebSocketData(e) {
    try {
      const info = JSON.parse(e.data);
      if (info.programEnded) {
        const programSubstring1 = installingProgram.substring(1);
        data.terminalWebsocketConnection.onmessage = (event) => {
          const info = JSON.parse(event.data);
          if (info.programInstalled) programInstalled(requiresShellRestart, installingProgram);
          else programInstallCanceled(installingProgram, filename, requiresShellRestart, programUsesCLI);
        }
        data.terminalWebsocketConnection.send(`is${installingProgram.split(programSubstring1)[0].toUpperCase() + programSubstring1}Installed`);
        resultField.innerHTML = '';
      }
    } catch {}
  }

}

/**
 * Tells the user that they canceled the program installer.
 * @param {string} program 
 * @param {string} filename 
 * @param {boolean} requiresShellRestart 
 * @param {WebSocket} connection
 */
function programInstallCanceled(program, filename, requiresShellRestart = false, programUsesCLI = false) {
  makeFeedback(false, 'info', `You canceled the ${program} installer. To relaunch it, you may click <a href="javascript:launchToolFromUtilities('${
    filename
  }', ${requiresShellRestart}, ${programUsesCLI})">here</a>.`);
}

/**
 * Delivers feedback after the program is installed.
 * @param {boolean} requiresShellRestart 
 * @param {string} installationInfo 
 */
async function programInstalled(requiresShellRestart, program) {
  let filepath = await fetch('/myFilePath?appRequiresShellRestart=' + requiresShellRestart), feedbackType;
  const textCloseAppMethod = 'To close this app, click <a href="javascript:closeApp()">here</a>.';
  const textAppCloseWaring = `However, because ${program} requires a shell restart, this app will need to be closed.`
  const texts = {
    requiresShellRestart: `${textAppCloseWaring} You may open this app again by opening FILE_PATH in your file explorer. ${textCloseAppMethod}`,
    doesNotRequireShellRestart: 'your archipelago for The Legend of Zelda: A Link Between Worlds will keep on building using the infomation you submitted beforehand.'
  }
  let text = texts[requiresShellRestart ? 'requiresShellRestart' : 'doesNotRequireShellRestart'];
  try {
    filepath = await filepath.json();
    feedbackType = 'warning';
    text = `${textAppCloseWaring} ${filepath.message} ${textCloseAppMethod}`;
  } catch {
    text = text.replace('FILE_PATH', await filepath.text());
    feedbackType = 'success';
  } finally {
    makeFeedback(false, feedbackType, `${program} has been installed successfuly! ${text}`);
    setTimeout(() => {
      if (!requiresShellRestart) {
        document.getElementById('resultField').removeAttribute('data-installingProgram');
        makeFeedback(true);
        emulateTerminal(data.terminalWebsocketConnection);
        data.terminalWebsocketConnection.send('userInstalledProgram');
      }
    }, 7067)
  }
}

/**
 * Closes the app on request.
 */
function closeApp() {
  fetch('/closeApp', {
    method: "POST"
  })
}

function downloadFile(elem) {
  fetch(`/downloadFile?data=${elem.getAttribute('data-base64')}`,{
    method: "POST"
  });
}