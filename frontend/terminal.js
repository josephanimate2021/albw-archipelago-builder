/**
 * Terminal Emulator for a Web Browser
 * 
 * If you are thinking about adding this terminal to your web application, please consider removing these comments or keep some in if you want to.
 * This helps clean things up a little bit and keeps code clean.
 * 
 * Maker: josephanimate2021
 * @param {WebSocket} socket
 * @param {HTMLDivElement} element
 */ 
class TerminalEmulator {
    constructor(socket, element) {
        // variables
        const commandHistory = [];
        let cursorX, historyIndex = -1;
        const term = new Terminal({ 
            // To know what options are supported for the Terminal class, refer to this URL: https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts
            cursorBlink: true,
            convertEol: true
        });
        // To know what options are supported for the FitAddon class, refer to this URL: https://github.com/xtermjs/xterm.js/blob/master/addons/addon-fit/typings/addon-fit.d.ts
        const fitAddon = new FitAddon.FitAddon();
        // To know what options are supported for the WebLinksAddon class, refer to this URL: https://github.com/xtermjs/xterm.js/blob/master/addons/addon-web-links/typings/addon-web-links.d.ts
        const webLinksAddon = new WebLinksAddon.WebLinksAddon();
        // loads the terminal
        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);
        term.open(element);
        fitAddon.fit();
        window.addEventListener("resize", () => fitAddon.fit())
        // sets up a websocket so that the terminal is usable.
        socket.addEventListener("message", e => {
            try {
                if (typeof JSON.parse(e.data) == "object" && typeof this.otherDataFunction == "function") this.otherDataFunction(e);
            } catch {
                if (typeof e.data == "string") { // writes string data to the terminal.
                    cursorX = e.data.substring(e.data.lastIndexOf("\n") + 1).length;
                    term.write(e.data)
                } else if (typeof this.otherDataFunction == "function") this.otherDataFunction(e);
            }
        });
        // input variable meant for handing off the array of letters to the server by converting them into plain text.
        let input = []
        function writeHistroy(h) {
            const currentText = input.join('');
            if (cursorX != undefined && term.buffer.active.cursorX > cursorX) for (var i = 0; i < currentText.length; i++) term.write('\b \b');
            term.write(h);
            input = [];
            for (var i = 0; i < h.length; i++) input.push(h.substring(i, i + 1));
        }
        term.onKey(k => { // preforms terminal events when a key is pressed.
            // switch function that allows javascript code to be executed depending on the key the user presses.
            console.log(k.domEvent)
            switch (k.domEvent.code) {
                case "ArrowUp": {
                    if (historyIndex > 0) {
                        historyIndex--;
                        writeHistroy(commandHistory[historyIndex]);
                    }
                    break;
                } case "ArrowDown": {
                    if (historyIndex < commandHistory.length - 1) {
                        historyIndex++;
                        writeHistroy(commandHistory[historyIndex]);
                    } else {
                        historyIndex = commandHistory.length;
                        const text = commandHistory[historyIndex - 1];
                        if (cursorX != undefined && term.buffer.active.cursorX > cursorX) for (var i = 0; i < text.length; i++) term.write('\b \b')
                    }
                    break;
                } case "Enter": { // sends the input to the server after a user presses the enter key.
                    const text = input.join('');
                    cursorX = '';
                    socket.send(text)
                    if (text.toLowerCase() == "cls" || text.toLowerCase() == "clear") term.clear();
                    else term.write(k.key);
                    commandHistory.push(text);
                    historyIndex = commandHistory.length;
                    input = [];
                    break;
                } case "Backspace": { // deletes a letter from the terminal after the backspace key is pressed.
                    if (cursorX != undefined && term.buffer.active.cursorX > cursorX) {
                        if (input[input.length - 1]) input.splice(input.length - 1, 1);
                        term.write('\b \b');
                    }
                    break;
                } case "ArrowLeft": { // prevents the cursor from going too far to the left after the left arrow key is pressed.
                    if (cursorX != undefined && term.buffer.active.cursorX > cursorX) term.write('\x1B[D');
                    break;
                } default: { // writes key data to the input array and terminal.
                    if (k.domEvent.code != "ArrowRight") input[term.buffer.active.cursorX] = k.key;
                    term.write(k.key);
                }
            }
        })
    }
}