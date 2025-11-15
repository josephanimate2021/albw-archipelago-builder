echo Installing pyenv...
curl -fsSL https://pyenv.run | bash
echo Successfuly installed pyenv!
echo Setting Python Paths...
PYENV_ROOT_EXPORT='export PYENV_ROOT="$HOME/.pyenv"'
PYENV_PATH='[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"'
PYENV_INIT_EXEC='eval "$(pyenv init - bash)"'
echo "$PYENV_ROOT_EXPORT" >> ~/.bashrc
echo "$PYENV_PATH" >> ~/.bashrc
echo "$PYENV_INIT_EXEC" >> ~/.bashrc
echo Python paths were successfully set!
pyenv install 3.12.0
pyenv global 3.12.0
echo Python has been downloaded and installed. The CLI Installer will be exiting in a few seconds.
sleep 7
exit