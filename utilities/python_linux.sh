echo Installing pyenv...
curl https://pyenv.run | bash
echo Successfuly installed pyenv! Setting up Python path...
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc
pyenv install 3.12.11
pyenv global 3.12.11
echo Python has been downloaded and installed. The CLI Installer will be exiting in a few seconds.
sleep 7
exit
