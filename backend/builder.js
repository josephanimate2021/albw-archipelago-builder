const cmd = require("child_process");
const jszip = require("jszip");
const admzip = require("adm-zip");
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

module.exports = {
    /**
     * Builds the z17 randomizer source code and then distributes a zip file for the albwrandomizer module
     * @param {string} path The path of the source code
     * @param {WebSocket} ws A WebSocket connection for sending messages to the client.
     * @returns {Promise<jszip>} The object for the albwrandomizer zip file.
     */
    beginBuildFrom(buildPath, ws) {
        return new Promise(async (res, rej) => {
            this.sendMessageToClient(
                "Building the z17-randomizer archipelago from path: " + buildPath + ".",
                ws
            );
            const targetPath = path.join(buildPath, 'target');
            if (fs.existsSync(targetPath)) fs.rmSync(targetPath, {
                recursive: true,
                force: true
            });
            this.executeCommand(`cd ${buildPath} && ${this.pythonExec()} -m maturin build`, ws).then(info => {
                if (info.code == 0) {
                    this.sendMessageToClient("The build was successful! Preparing your zip file for the albwrandomizer module...\n", ws);
                    const zip = new jszip();
                    zip.file("readme.txt", `For the albw.apworld file, you may copy that to your custom_worlds folder located inside the Archipelago Folder. 
                        for the albwrandomizer folder, you may copy that to the lib folder inside the Archipelago Folder. 
                        Other folders like z17-randomizer and albw-archipelago are just source codes for how your albw archipelago was built.`)
                    const albwrandomizerFolder = zip.folder("albwrandomizer");
                    const wheelsFolder = path.join(targetPath, 'wheels');
                    if (fs.existsSync(wheelsFolder)) {
                        const wheelFile = fs.readdirSync(wheelsFolder)[0];
                        if (wheelFile) {
                            const wheelsFolderExtracted = path.join(wheelsFolder, 'extracted');
                            const whlzip = new admzip(path.join(wheelsFolder, wheelFile));
                            whlzip.extractAllToAsync(wheelsFolderExtracted, false, true, async err => {
                                if (err) rej(err);
                                else {
                                    const albwrandomizerfolder = path.join(wheelsFolderExtracted, 'albwrandomizer');
                                    fs.readdirSync(albwrandomizerfolder).forEach(file => {
                                        albwrandomizerFolder.file(file, fs.readFileSync(path.join(albwrandomizerfolder, file)));
                                        this.sendMessageToClient("Prepared file: " + file + "\n", ws);
                                    });
                                    fs.rmSync(targetPath, {
                                        recursive: true,
                                        force: true
                                    });
                                    this.sendMessageToClient("Your zip file for the albwrandomizer module was successfuly prepared! zipping up the source code for viewing purposes...", ws);
                                    await this.zipStuff(buildPath, zip.folder("z17-randomizer"));
                                    this.sendMessageToClient("The source code was zipped successfuly!", ws)
                                    res(zip);
                                }
                            })
                        } else rej("Your wheel file (.whl) does not exist inside the build. Maybe the build failed?")
                    } else rej("Your wheels folder does not exist for some reason. Maybe the build failed?");
                } else rej(`The archipelago build has failed at code ${info.code}.`);
            });
        })
    },
    async executeCommand(command, ws) {
        const args = command.split(" ");
        const args0 = args[0];
        args.splice(0, 1);
        return await this.shellInit(cmd.spawn(args0, args, {
            shell: true
        }), ws)
    },
    /**
     * loads a user's shell using the provided ChildProcess.
     * @param {cmd.ChildProcess} shell - the ChildProcess shell
     * @param {Function} callbackOnClose - the callback function that is provided on close.
     * @param {WebSocket} ws - a WebSocket connection that is used to send messages to the client.
     * @returns {Promise<object>} A JSON Object that tells the program that the shell has ended.
     */
    shellInit(shell, ws) {
        return new Promise((res, rej) => {
            shell.stdin.setEncoding("utf8")
            ws.on('message', c => shell.stdin.write(c + "\n"));
            shell.stdout.setEncoding("utf8")
            shell.stdout.on('data', o => ws.send('\n' + o));
            shell.stderr.setEncoding("utf8")
            shell.stderr.on('data', e => ws.send('\n' + e));
            shell.stdout.on("close", code => {
                shell.kill();
                res({
                    code,
                    programEnded: true
                });
            })
        })
    },
    pythonExec() {
        return `${process.platform == "linux" ? 'pyenv exec ' : ''}python${process.platform == "darwin" ? 3 : ''}`
    },
    /**
     * Sends a message to the client via a WebSocket connection (From Client Side) or CLI (Testing only)
     * @param {string} msg The message to send
     * @param {WebSocket} ws A WebSocket connection for sending messages to the client.
     * @param {boolean} error A boolean for whatever or not to use console.error to log the error (Testing Only)
     */
    sendMessageToClient(msg, ws, error = false) {
        ws ? ws.send(`\n${msg}`) : console[error ? 'error' : 'log'](msg);
    },
    /**
     * Builds the albw archipelago apworld using the built in source code.
     * @param {WebSocket} ws a WebSocket connection
     * @returns {Promise<jszip>} a JSZip object containing the files for the albw archipelago apworld.
     */
    buildWithBuiltInSourceCode(ws) {
        return new Promise((res, rej) => {
            const z17randomizerpath = path.join(__dirname, '../z17-randomizer');
            const targetPath = path.join(z17randomizerpath, 'target');
            if (fs.existsSync(targetPath)) fs.rmSync(targetPath, {
                recursive: true,
                force: true
            });
            this.beginBuildFrom(z17randomizerpath, ws).then(async ZipObject => {
                this.sendMessageToClient("Building your albw.apworld file...", ws);
                this.zipALBWApworld(ZipObject, ws).then(res);
            }).catch(rej);
        })
    },
    /**
     * Zips Up the apworld for the albw archipelago after preparing files.
     * @param {JSZip} ZipObject A JSZIp Object contining files for the albwrandomizer module.
     * @param {WebSocket} ws A WebSocket connection
     * @param {string} folderPath A path to the python apworld folder.
     * @returns {Promise<string>} A base64 string representing the zip file.
     */
    zipALBWApworld(ZipObject, ws, folderPath = path.join(__dirname, '../albw-archipelago')) {
        return new Promise(async (res, rej) => {
            const albwArchipelagoFolder = ZipObject.folder("albw-archipelago");
            await this.zipStuff(folderPath, albwArchipelagoFolder, ws);
            ZipObject.file("albw.apworld", await albwArchipelagoFolder.generateAsync({
                type: "nodebuffer"
            }));
            ZipObject.generateAsync({
                type: "base64",
                mimeType: "application/zip"
            }).then(data => {
                this.sendMessageToClient("Successfuly generated your albw.apworld file!", ws);
                res(data);
            }).catch(rej);
        })
    },
    zipStuff(filePath, zip, ws) {
        return new Promise((res, rej) => {
            fs.readdirSync(filePath).forEach(file => {
                const filepath = path.join(filePath, file);
                const stats = fs.lstatSync(filepath);
                if (stats.isDirectory()) this.zipStuff(filepath, zip.folder(file), ws);
                else zip.file(file, fs.readFileSync(filepath));
                this.sendMessageToClient(`\nZipped\n${filepath}\n`, ws);
            })
            res();
        })
    },
    /**
     * Returns A JSON containing settings that are expected to be used for the generated apworld.
     * @returns {object} The settings object for ALBW apworld.
     */
    APWorldSettings() {
        return {
            logic_mode: {
                desc: "Determines the logical rules the randomizer will follow when placing items.\n\
                normal: Standard gameplay, no tricky item use or glitches. If unsure, choose this.\n\
                hard: Adds tricks that may be difficult or obscure, but aren't technically glitches.\n\
                glitched: Includes the above plus a selection of easy-to-learn glitches.\n\
                adv_glitched: Includes the above plus 'advanced' glitches that may be a challenge to master.\n\
                hell: Includes every known RTA-viable glitch, including the insane ones. Don't choose this.\n\
                no_logic: Items are placed with no logic at all. Seeds have a high chance of being impossible to complete\n\
                due (primarily) to dungeon key placement, but these odds improve if this setting is combined with the Keysy setting.",
                className: "LogicMode",
                classParam: "Choice",
                displayName: "Logic Mode",
                options: [
                    "normal",
                    "hard",
                    "glitched",
                    "adv_glitched",
                    "hell",
                    "no_logic"
                ],
                default_option: "normal",
            },
            ped_requirement: {
                desc: "Determines the requirements to reach the Master Sword Pedestal.\n\
                standard: Requires all three Pendants of Power, Wisdom, and Courage.\n\
                vanilla: Requires just the Pendants of Power and Wisdom, as in the vanilla game.",
                className: "PedestalRequirement",
                classParam: "Choice",
                displayName: "Pedestal Requirement",
                options: [
                    "vanilla",
                    "standard"
                ],
                default_option: "standard",
                specific_option_name: "pedestal_requirement"
            },
            cracks: {
                desc: "Determines the initial state of the Cracks between Hyrule and Lorule.\n\
                closed: All cracks (except the one in Hyrule Castle) will be closed until the player finds Quake, a special randomizer-only item.\n\
                open: All cracks are open from game start, and the Quake item is not included in the item pool.",
                specific_option_name: "initial_crack_state",
                className: "InitialCrackState",
                classParam: "Choice",
                displayName: "Initial Crack State",
                options: [
                    "closed",
                    "open"
                ],
                default_option: "open"
            },
            trials_door: {
                desc: "Determines the behavior of the Trial's Door in Lorule Castle.\n\
                open_from_inside_only: The door will automatically open when the player approaches it from within the Lorule Castle dungeon, effectively skipping the need to complete any of the trials. The door will NOT be open when approached from the side with the Lorule Castle crack, preventing early access to the dungeon.\n\
                x_trial(s)_required: X number of trials (randomly selected) must be completed to open the door.\n\
                open_from_both_sides: The door will automatically open when approached from either side. This option may require the player to enter the dungeon early by way of the Lorule Castle crack.",
                className: "TrialsDoor",
                classParam: "Choice",
                displayName: "Trials Door",
                options: [
                    "open_from_inside_only",
                    "one_trial_required",
                    "two_trials_required",
                    "three_trials_required",
                    "four_trials_required",
                    "open_from_both_sides"
                ],
                default_option: "open_from_inside_only"
            },
            lc_requirement: {
                desc: "Determines the number of Sages that must be rescued to open the front door to Lorule Castle. A red X will appear by the dungeon door on the bottom screen map to indicate when this requirement has been met.",
                className: "LoruleCastleRequirement",
                classParam: "Range",
                displayName: "Lorule Castle Requirement",
                range: {
                    min: 0,
                    max: 7
                },
                default_option: 7,
                specific_option_name: "lorule_castle_requirement"
            },
            dungeon_prize_shuffle: {
                desc: "Shuffles the 7 Sages and 3 Pendants amongst themselves such that each dungeon will hold a random prize.",
                className: "RandomizeDungeonPrizes",
                classParam: "Toggle",
                displayName: "Randomize Dungeon Prizes",
                specific_option_name: "randomize_dungeon_prizes"
            },
            crack_shuffle: this.APCrackSanitySettings("crack_shuffle"),
            cracksanity: this.APCrackSanitySettings("crack_sanity"),
            weather_vanes: {
                desc: "Determines the default state and behavior of the Weather Vanes.\n\
                standard: All Weather Vanes will be off at the start of the game.\n\
                shuffled: The Weather Vanes will be shuffled in 'pairs'.\n\
                Example:\n\
                \t- Activating Vane A enables fast travel to Vane B&NewLine;- Similarly, activating Vane B enables fast travel to Vane A.\n\
                convenient: Weather Vanes that do not have logical requirements to them will be pre-activated at the start of the game. The specific vanes this setting will activate depend on other settings.\n\
                hyrule: All the Hyrule Weather Vanes will be pre-activated.\n\
                lorule: All the Lorule Weather Vanes will be pre-activated.\n\
                all: All Weather Vanes will be pre-activated.",
                className: "WeatherVanes",
                classParam: "Choice",
                displayName: "Weather Vanes",
                options: [
                    "standard",
                    "shuffled",
                    "convenient",
                    "hyrule",
                    "lorule",
                    "all"
                ],
                default_option: "standard"
            },
            nice_items: {
                desc: "Determines how the randomizer will handle Nice Items, which are the upgraded versions of the 9 core items originally sold in Ravio's Shop.\n\
                shuffled: A second progressive copy of each Ravio Item will be freely shuffled anywhere in the game.\n\
                vanilla: Mother Maiamai will upgrade a Ravio Item to its Nice version for 10 Maiamai each.\n\
                off: Only the base versions of each Ravio Item will be obtainable.\n\
                Note:\n\
                \t- Selecting either 'Shuffled' or 'Off' will cause Mother Maiamai to have a random selection of items.",
                className: "NiceItems",
                classParam: "Choice",
                displayName: "Nice Items",
                options: [
                    "shuffled",
                    "vanilla",
                    "off"
                ],
                default_option: "shuffled",
            },
            maiamai_limit: {
                desc: "Places a limit on the maximum number of Maiamai a player may have to collect to complete a seed *IF* they do not spend them foolishly.\n\
                Notes:\n\
                \t- The 100 Maiamai Reward can only ever be logically required if this is set to 100.",
                className: "MaiamaiLimit",
                classParam: "Range",
                displayName: "Maiamai Limit",
                range: {
                    min: 0,
                    max: 100
                },
                default_option: 100
            },
            super_items: {
                desc: "This setting shuffles a second progressive copy of the Lamp and Net into the general item pool",
                className: "SuperItems",
                classParam: "Toggle",
                displayName: "Super Items"
            },
            lamp_and_net_as_weapons: {
                desc: "Treat the base Lamp and Net as damage-dealing weapons?\n\
                \t- The red base Lamp and Net each deal 1/2 the damage of the Forgotten Sword (i.e. they're VERY BAD weapons).\n\
                \t- The blue Super Lamp and Super Net each deal 4 damage (same as MS Lv3) and are always considered weapons, regardless of this setting.",
                className: "LampAndNetAsWeapons",
                classParam: "Toggle",
                displayName: "Lamp and Net as Weapons"
            },
            no_progression_enemies: {
                desc: "Removes Enemies from dungeons that are themselves Progression (e.g.: Bawbs, the bomb enemy). Logic will be adjusted to require the player's items instead.",
                className: "NoProgressionEnemies",
                classParam: "Toggle",
                displayName: "No Progression Enemies"
            },
            assured_weapon: {
                desc: "Guarantees that the player will find at least one weapon in the item pool.",
                className: "AssuredWeapon",
                classParam: "Toggle",
                displayName: "Assured Weapon"
            },
            maiamai_madness: {
                desc: "This setting shuffles Maiamai into the item pool, adding 100 more locations in the process.",
                className: "MaiamaiMayhem",
                classParam: "Toggle",
                displayName: "Maiamai Mayhem",
                specific_option_name: "maiamai_mayhem"
            },
            minigames_excluded: {
                desc: "Excludes the following minigames: Octoball Derby, Dodge the Cuccos, Hyrule Hotfoot, Treacherous Tower, and both Rupee Rushes. These minigames often require a specific skill set, which may not be suitable for all players.",
                className: "MinigamesExcluded",
                classParam: "Toggle",
                displayName: "Minigames Excluded"
            },
            skip_big_bomb_flower: {
                desc: "Skips the Big Bomb Flower quest by removing the 5 Big Rocks in Lorule Field. (Does not affect the Lorule Castle Bomb Trial)",
                className: "SkipBigBombFlower",
                classParam: "Toggle",
                displayName: "Skip Big Bomb Flower"
            },
            bow_of_light_in_castle: {
                desc: "Limits the Bow of Light's placement to somewhere in Lorule Castle (possibly including Zelda).",
                className: "BowOfLightInCastle",
                classParam: "Toggle",
                displayName: "Bow of Light in Castle"
            },
            dark_rooms_lampless: {
                desc: "If enabled the logic may expect players to cross Dark Rooms without the Lamp. Not for beginners and those who like being able to see things.",
                className: "DarkRoomsLampless",
                classParam: "Toggle",
                displayName: "Dark Rooms Lampless"
            },
            swordless_mode: {
                desc: "Removes *ALL* Swords from the game. The Bug Net becomes a required item to play Dead Man's Volley against Yuga Ganon.",
                className: "SwordlessMode",
                classParam: "Toggle",
                displayName: "Swordless Mode"
            },
            chest_size_matches_contents: {
                desc: "All chests containing progression items will become large, and others will be made small.\n\
                Note: Some large chests will have a reduced hitbox to prevent negative gameplay interference.",
                className: "ChestSizeMatchesContents",
                classParam: "Toggle",
                displayName: "Chest Size Matches Contents"
            },
            treacherous_tower_floors: {
                desc: "Choose how many floors the Treacherous Tower should have (2-66).",
                className: "TreacherousTowerFloors",
                classParam: "Range",
                displayName: "Treacherous Tower Floors",
                range: {
                    min: 2,
                    max: 66
                },
                default_option: 5
            },
            purple_potion_bottles: {
                desc: "Fills all Empty Bottles with a free Purple Potion.",
                className: "PurplePotionBottles",
                classParam: "Toggle",
                displayName: "Purple Potion Bottles"
            },
            keysy: {
                desc: "This setting removes keys and locked doors from dungeons if enabled.",
                className: "Keysy",
                classParam: "Choice",
                displayName: "Keysy",
                options: [
                    "off",
                    "small_keysy",
                    "big_keysy",
                    "all_keysy"
                ]
            },
            door_shuffle: {
                desc: "Randomizes the destinations of doors within dungeons.\n\
                off: Doors are not shuffled and will lead to their vanilla destinations.\n\
                dungeon_entrances: Doors that lead to dungeons will be shuffled amongst themselves. All other doors remain unshuffled.",
                className: "DoorShuffle",
                classParam: "Choice",
                displayName: "Door Shuffle",
                options: [
                    "off",
                    "dungeon_entrances"
                ],
                default_option: "off"
            },
            start_with_merge: {
                desc: "Starts the player with the ability to Merge into walls, without Ravio's Bracelet.",
                className: "StartWithMerge",
                classParam: "Toggle",
                displayName: "Start With Merge"
            },
            start_with_pouch: {
                desc: "Starts the player with the Pouch and a usable X Button.",
                className: "StartWithPouch",
                classParam: "Toggle",
                displayName: "Start With Pouch"
            },
            bell_in_shop: {
                desc: "Places the Bell for sale in Ravio's Shop at the start of the game.",
                className: "BellInShop",
                classParam: "Toggle",
                displayName: "Bell In Shop"
            },
            sword_in_shop: {
                desc: "Places the Sword for sale in Ravio's Shop at the start of the game.",
                className: "SwordInShop",
                classParam: "Toggle",
                displayName: "Sword In Shop"
            },
            boots_in_shop: {
                desc: "Places the Pegasus Boots for sale in Ravio's Shop at the start of the game.",
                className: "BootsInShop",
                classParam: "Toggle",
                displayName: "Boots In Shop"
            },
            night_mode: {
                desc: "Starts the game in Night Mode, making the overworld darker and more challenging for some players to navigate.",
                className: "NightMode",
                classParam: "Toggle",
                displayName: "Night Mode"
            }
        }
    },
    /**
     * Settings for CrackSanity (or Crack Shuffle) in The Legend of Zelda: A Link Between Worlds Randomizer.
     * @param {string} specific_option_name The specific name of the option.
     * @returns {object} The settings object for CrackSanity (or Crack Shuffle).
     */
    APCrackSanitySettings(specific_option_name) {
        return {
            desc: "Randomizes the destinations of the game's Cracks (sometimes called 'fissures' or 'portals').\n\
            off: Cracks are not shuffled and will lead to their vanilla destinations.\n\
            cross_world_pairs: Cracks will be shuffled in pairs such that all Hyrule cracks lead to Lorule and vice-versa.\n\
            any_world_pairs: Cracks will be shuffled with no restrictions. This may result in Hyrule-Hyrule or Lorule-Lorule crack pairings.\n\
            mirrored_settings: The two mirrored settings will operate the same as their non-mirrored counterparts, but with the additional restriction that any randomly paired cracks will have their vanilla counterparts paired together as well.\n\
            Example:\n\
            \t- Consider cracks A, B, X, and Y that are paired up as A-B and X-Y in the vanilla game.\n\
            \t- If, as a result of this setting, A is paired with X, then the mirrored settings will guarantee that B is paired with Y.\n\
            \t- Similarly, if A is paired with Y, then B will be paired with X.",
            className: specific_option_name.split("_").map(this.upperCaseBegWord).join(""),
            classParam: "Choice",
            displayName: specific_option_name.split("_").map(this.upperCaseBegWord).join(" "),
            options: [
                "off",
                "cross_world_pairs",
                "any_world_pairs",
                "mirrored_cross_world_pairs",
                "mirrored_any_world_pairs"
            ],
            default_option: "off",
            specific_option_name
        }
    },
    /**
     * Capitalizes the first letter of a word.
     * @param {string} word - The word to capitalize
     * @returns {string} The word with the first letter capitalized.
     */
    upperCaseBegWord(word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }
}
