# Extraneous Process Detector
Attempts to kill extraneous Chrome processes. Requires a running server.
This is basically a workaround for https://crbug.com/707509.

This is an alpha release and may contain critical bugs, like ending valid processes and more. It was *not* tested for security.

## System Requirements
- Windows.
- Powershell.
- Chrome.

Tested on Windows 7 Enterprise.

## Usage -
Follow the prerequisites, run the server and install the extension.

### Prerequisites
Use Dev channel Chrome. If you want to work with the stable Chrome, read the "Faking The Dev Channel" sub section, otherwise, skip it.

Note - once https://crbug.com/763960 is fixed, this will not be needed anymore and launching Chrome with the `--enable-experimental-extension-apis` command line flag would be enough.

#### Faking The Dev Channel
Otherwise - fake it using some registry fiddling -
Warning - fiddling with the registry is dangeous. If you do not know what you are doing, do not do it.
1. Press WinKey + R (or Start > Run...)
2. Enter `regedit.exe`
3. Click on OK.
4. Find the following path/key -
`HKEY_LOCAL_MACHINE\SOFTWARE\Wow6432Node\Google\Update\ClientState\{8A69D345-D564-463C-AFF1-A69D9E530F96}\`
5. Right click on the right pane.
6. Select "New".
7. Select "String Value".
8. Type `ap` as the name.
9. Type one of the following as the value -
```
x64-dev
0-dev
20-dev
```

### Running The Server
1. Either create a shortcut for the following command and put it in the Startup folder of the start menu and run it, or run the following command by yourself -
```
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Unrestricted C:\Path-To-Repository\Start-Killer.ps1
```
(Replace `Path-To-Repository` with the path to the local folder with the files from the repository.)
2. Enter `R` in order to allow the script to run.

### Extension Installation
1. Download/clone the repository.
2. Go to `chrome://extensions`.
3. Tick the "Developer mode" on the top right corner.
4. Click on "Load unpacked extension...".
5. Choose the local folder with the files from the repository.
6. Click on "OK".

## License
MIT.