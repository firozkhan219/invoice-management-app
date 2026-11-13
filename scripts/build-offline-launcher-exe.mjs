import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(root, "dist", "invoice-management-offline-windows");
const workDir = path.join(root, "dist", "launcher-build");
const launcherSourcePath = path.join(workDir, "launcher.js");
const seaConfigPath = path.join(workDir, "sea-config.json");
const seaBlobPath = path.join(workDir, "launcher.blob");
const targetExePath = path.join(packageDir, "Invoice Management Offline.exe");
const sourceNodePath = path.join(packageDir, "runtime", "node.exe");
const postjectCli = path.join(root, "node_modules", "postject", "dist", "cli.js");

function run(command, args, options = {}) {
  const executable = command === "node" ? process.execPath : command;
  const result = spawnSync(executable, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (options.capture) {
      process.stdout.write(result.stdout || "");
      process.stderr.write(result.stderr || "");
    }
    process.exit(result.status ?? 1);
  }

  return result.stdout || "";
}

await mkdir(workDir, { recursive: true });

await writeFile(
  launcherSourcePath,
  `const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { mkdirSync, copyFileSync } = require("node:fs");
const path = require("node:path");

const appDir = path.dirname(process.execPath);
const nodeExe = path.join(appDir, "runtime", "node.exe");
const serverJs = path.join(appDir, "server.js");
const dataDir = path.join(appDir, "offline-data");
const uploadDir = path.join(dataDir, "uploads");
const databasePath = path.join(dataDir, "offline.db");
const templateDatabasePath = path.join(dataDir, "offline-template.db");

mkdirSync(uploadDir, { recursive: true });

if (!existsSync(databasePath) && existsSync(templateDatabasePath)) {
  copyFileSync(templateDatabasePath, databasePath);
}

if (!existsSync(nodeExe)) {
  console.error("Missing bundled Node runtime: " + nodeExe);
  process.exit(1);
}

if (!existsSync(serverJs)) {
  console.error("Missing app server: " + serverJs);
  process.exit(1);
}

if (!existsSync(databasePath)) {
  console.error("Missing offline database: " + databasePath);
  process.exit(1);
}

const databaseUrl = "file:" + databasePath.replace(/\\\\/g, "/");
const env = {
  ...process.env,
  NODE_ENV: "production",
  HOSTNAME: "127.0.0.1",
  PORT: "3000",
  DATABASE_URL: databaseUrl,
  UPLOAD_DIR: "offline-data/uploads",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  AUTH_SECRET: "offline-personal-auth-secret-change-me",
  BANK_FIELD_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
};

console.log("");
console.log("Invoice Management Offline");
console.log("URL: http://127.0.0.1:3000");
console.log("Data: " + dataDir);
console.log("");
console.log("Keep this window open while using the app.");
console.log("Press Ctrl+C here to stop it.");
console.log("");

spawn("cmd.exe", ["/c", "start", "", "http://127.0.0.1:3000"], {
  cwd: appDir,
  stdio: "ignore",
  detached: true
}).unref();

const child = spawn(nodeExe, [serverJs], {
  cwd: appDir,
  env,
  stdio: "inherit",
  windowsHide: false
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
`,
  "utf8"
);

await writeFile(
  seaConfigPath,
  JSON.stringify(
    {
      main: launcherSourcePath,
      output: seaBlobPath,
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false
    },
    null,
    2
  ),
  "utf8"
);

run("node", ["--experimental-sea-config", seaConfigPath]);
await copyFile(sourceNodePath, targetExePath);
run("node", [
  postjectCli,
  targetExePath,
  "NODE_SEA_BLOB",
  seaBlobPath,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
]);

console.log(`Created launcher EXE at ${path.relative(root, targetExePath)}.`);
