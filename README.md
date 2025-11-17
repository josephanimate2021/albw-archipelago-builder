# The Legend of Zelda: A Link Between Worlds Archipelago Builder
This is an application that makes the process of building The Legend of Zelda: A Link Between Worlds Randomizer on Archipelago easier by removing most of the ability to modify the z17 randomizer source code manually 
and then building it that way as some developers won't know what tools you need to distribute a rust app as a python module.

## Current bugs and issues
* In this app's current state, you cannot build your apworld on versions older than
v0.4.0. On the branch selection screen, try avoiding a branch that has it's
build version older than v0.4.0. I am
just leaving those in for testing
purposes to ensure that I can get this
app to build your Archipelago from
older versions of the source code. Because you are able to select a release version the frst time the app loads, i removed releases older than v0.4.0 to avoid confusion, same attempt on the branch selection screen as well.
* Randomizing The Legend of Zelda: A Link Between Worlds currently isn't possible after generating a new patch file with Archipelago and then opening it in Archipelago. I am not sure why that is, but for now you may choose to build with the built in source code as that part of this app works fine.

## Running from the source
This method is not recommended for most people as you won't get the most up to date source code by running the app this way. 
However, if you want to contribute to this app, here are the steps that you can take to run this app from the source:
1. Download <a href="https://nodejs.org/">Node.JS Version 22 LTS or above</a>.
2. Download the <a href="../../archive/master.zip">Source Code ZIP File</a>.
3. Extract the Source Code ZIP file to a folder of your choice.
4. Go inside the extracted zip file and you should at least see the package.json file along with the README.md file and others if you did things correctly.
   NOTE: You can also clone this repository by running the ```git clone https://github.com/josephanimate2021/albw-archipelago-builder.git --recurse-submodules``` command inside your terminal to achieve the same result, this will give you the
   benefit of getting updates every time a new commit is created on this repo.
5. Double click on the run_from_source.bat (or run_from_source.sh if you're not running Windows on your computer) file. This will start up the app where you can do any testing you need to. DevTools will even open by default. Happy hacking!

## Building
If you want to build this app for a different computer operating system or architecture, here is a way to do it:
1. Open up the build_app.bat (or build_app.sh if you're using linux) file.
2. Once there, you will be provided with two options:
* One will be to just package the app which then the app will be located in the out folder.
* Two will be to make the app executable for your computer which tends to take longer which is why it's better to stick with the first option if possible.

## Downloading builds from recent commits

WARNING: BY DOING THIS METHOD, THIS APP WILL NOT AUTO UPDATE. YOU WILL HAVE TO UPDATE THE APP MANUALLY EVERY SINGLE TIME!!!

This method of running the app is possible if you want to beta test the app. If that's the case, here are the steps below:
1. Head to the <a href="../../actions/workflows/build_beta_app.yml">Build App for Beta Testing workflow</a> inside the Actions Panel.
2. Select a workflow run.
3. Check that you selected a job based off of your operating system. it should be build_beta_app (OPPERATING_SYSTEM-latest)
4. scroll on the logs until you see the Upload Artifacts section. if you scroll far enough, you will see a link to click on. This contains the beta build of the app.

## Downloading builds from releases (Recommended)
This method of running the app is recommended for most users as you will get a pretty stable app that's ideal for building your ALBW Archipelago. Here is how you can do it:
1. Head to the <a href="../../releases">Releases Tab</a> of this source code.
2. Select your desired version to download your files from based off of your operating system. The rest should be self explainitory.

## Any issues with this app?
Please head over to the <a href="../../issues">Issues tab</a> of this source code to report your issue. 
Screenshots or a video is recommended which will then allow me to combine your text and screenshot/video at the same time in order for me to better undertstand your issue.
