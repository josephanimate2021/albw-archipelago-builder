echo Installing pyenv...
curl https://pyenv.run | bash
echo Successfuly installed pyenv! Installing Python version 3.12.11...
pyenv install 3.12.11
pyenv global 3.12.11
echo Python has been downloaded and installed. The CLI Installer will be exiting in a few seconds.
sleep 7
exit
