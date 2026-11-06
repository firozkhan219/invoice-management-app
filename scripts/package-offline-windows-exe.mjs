import { existsSync } from "node:fs";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const root = process.cwd();
const distDir = path.join(root, "dist");
const zipPath = path.join(distDir, "invoice-management-offline-windows.zip");
const installerScriptPath = path.join(distDir, "install-offline-windows.cmd");
const sedPath = path.join(distDir, "invoice-management-offline-windows.sed");
const exePath = path.join(distDir, "Invoice Management Offline Setup.exe");
const stagingDir = path.join(os.tmpdir(), "invapp_offline_pack");
const iexpressTargetPath = path.join(stagingDir, "invoice-management-offline-setup.exe");

if (!existsSync(zipPath)) {
  console.error("Missing offline package zip. Run npm run offline:package:windows first.");
  process.exit(1);
}

await mkdir(distDir, { recursive: true });
await rm(stagingDir, { recursive: true, force: true });
await mkdir(stagingDir, { recursive: true });

await writeFile(
  installerScriptPath,
  `@echo off
setlocal
set "APP_DIR=%LOCALAPPDATA%\\Invoice Management Offline"
set "ZIP_PATH=%~dp0invoice-management-offline-windows.zip"

echo Installing Invoice Management Offline...
if not exist "%APP_DIR%" mkdir "%APP_DIR%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%ZIP_PATH%' -DestinationPath '%APP_DIR%' -Force"
if errorlevel 1 (
  echo Installation failed.
  pause
  exit /b 1
)

if exist "%APP_DIR%\\invoice-management-offline-windows\\Start Invoice Management.cmd" (
  start "" "%APP_DIR%\\invoice-management-offline-windows\\Start Invoice Management.cmd"
) else (
  echo App launcher was not found after extraction.
  pause
  exit /b 1
)
`,
  "utf8"
);

await copyFile(zipPath, path.join(stagingDir, "invoice-management-offline-windows.zip"));
await copyFile(installerScriptPath, path.join(stagingDir, "install-offline-windows.cmd"));

await writeFile(
  sedPath,
  `[Version]
Class=IEXPRESS
SEDVersion=3

[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=1
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles

[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=Invoice Management Offline has been installed and started.
TargetName=${iexpressTargetPath}
FriendlyName=Invoice Management Offline
AppLaunched=install-offline-windows.cmd
PostInstallCmd=<None>
FILE0="invoice-management-offline-windows.zip"
FILE1="install-offline-windows.cmd"

[SourceFiles]
SourceFiles0=${stagingDir}

[SourceFiles0]
%FILE0%=
%FILE1%=
`,
  "utf8"
);

const result = spawnSync("iexpress.exe", ["/N", "/Q", sedPath], {
  cwd: root,
  stdio: "inherit",
  shell: false
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (existsSync(iexpressTargetPath)) {
  await copyFile(iexpressTargetPath, exePath);
}

console.log(`Created Windows executable installer at ${path.relative(root, exePath)}.`);
