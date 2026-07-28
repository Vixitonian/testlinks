; Laptop Agent Service installer
;
; A self-contained installer for the headless Windows Service variant of
; the laptop agent (see ../src/service-main.js and ../README.md's
; "Tamper-resistant install for a child's account" section). Unlike the
; Electron tray-app installer (built separately via electron-builder),
; this one bundles a portable Node.js runtime so the target machine needs
; nothing pre-installed — just run this .exe as Administrator.
;
; Built from a staged directory (see ../scripts/build-service-installer.sh)
; containing:
;   runtime/node.exe            portable Node.js, used to run everything below
;   node_modules/node-windows/  only needed for the install/uninstall step itself
;   src/*.js, src/network/*.js  the agent's core modules (no Electron/UI files)
;   scripts/install-service.js
;   scripts/uninstall-service.js

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

Name "Laptop Agent Service"
OutFile "..\dist\LaptopAgentService-Setup.exe"
InstallDir "$PROGRAMFILES64\Laptop Agent Service"
InstallDirRegKey HKLM "Software\LaptopAgentService" "InstallDir"
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show

!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install" SEC_INSTALL
  SetOutPath "$INSTDIR"
  File /r "stage\runtime"
  File /r "stage\node_modules"
  File /r "stage\src"
  File /r "stage\scripts"

  DetailPrint "Registering the Laptop Agent Windows Service (this can take up to 30 seconds)..."
  nsExec::ExecToLog '"$INSTDIR\runtime\node.exe" "$INSTDIR\scripts\install-service.js"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Service installation reported an error (exit code $0). Check the log above, or re-run as Administrator: $INSTDIR\runtime\node.exe $INSTDIR\scripts\install-service.js"
  ${Else}
    DetailPrint "Service installed and started. Check services.msc for 'Laptop Agent' (status: Running)."
  ${EndIf}

  WriteRegStr HKLM "Software\LaptopAgentService" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LaptopAgentService" \
    "DisplayName" "Laptop Agent Service"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LaptopAgentService" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LaptopAgentService" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LaptopAgentService" \
    "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LaptopAgentService" \
    "NoRepair" 1
SectionEnd

Function .onInit
  ${If} ${RunningX64}
    ; ok — 64-bit runtime bundled
  ${Else}
    MessageBox MB_OK|MB_ICONSTOP "This installer requires 64-bit Windows."
    Abort
  ${EndIf}
FunctionEnd

Section "Uninstall"
  DetailPrint "Removing the Laptop Agent Windows Service..."
  nsExec::ExecToLog '"$INSTDIR\runtime\node.exe" "$INSTDIR\scripts\uninstall-service.js"'
  Pop $0

  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LaptopAgentService"
  DeleteRegKey HKLM "Software\LaptopAgentService"

  RMDir /r "$INSTDIR"
SectionEnd
