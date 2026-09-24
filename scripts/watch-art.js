const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(projectRoot, '..');
const syncScript = path.join(__dirname, 'sync-art.ps1');
const projectName = path.basename(projectRoot);

const MEDIA_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm']);
const EXCLUDED_DIRS = new Set([
  projectName,
  'node_modules',
  'dist',
  '.git',
  '.vscode',
]);

const POLL_MS = 1500;
const SYNC_DELAY_MS = 800;

function isMediaFile(name) {
  return MEDIA_EXT.has(path.extname(name).toLowerCase());
}

function isSourceDir(name) {
  return (
    !EXCLUDED_DIRS.has(name) &&
    !name.startsWith('.') &&
    !name.startsWith('~')
  );
}

function snapshot() {
  const state = {};

  const rootProfile = path.join(sourceRoot, 'profile.jpg');
  try {
    if (fs.statSync(rootProfile).isFile()) {
      state['__profile__'] = fs.statSync(rootProfile).size;
    }
  } catch {
    state['__profile__'] = -1;
  }

  let entries;
  try {
    entries = fs.readdirSync(sourceRoot, { withFileTypes: true });
  } catch {
    return state;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSourceDir(entry.name)) continue;
    const dirPath = path.join(sourceRoot, entry.name);
    let files;
    try {
      files = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }
    const details = {};
    for (const file of files) {
      if (!file.isFile() || !isMediaFile(file.name) || file.name.startsWith('~')) continue;
      let size = 0;
      try {
        size = fs.statSync(path.join(dirPath, file.name)).size;
      } catch {
        continue;
      }
      details[file.name] = size;
    }
    state[entry.name] = details;
  }
  return state;
}

function runSync(callback) {
  execFile(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', syncScript],
    { windowsHide: true },
    (error, stdout, stderr) => {
      if (error) {
        console.error('[watcher] sync failed:', error.message);
      } else if (stdout.trim()) {
        console.log(stdout.trim().split('\n').map((l) => `[watcher] ${l}`).join('\n'));
      }
      if (stderr.trim()) console.error(stderr.trim().split('\n').map((l) => `[watcher] ${l}`).join('\n'));
      if (callback) callback();
    }
  );
}

let lastState = JSON.stringify(snapshot());
let syncTimer = null;
let firstRun = true;

console.log(`[watcher] Watching "${sourceRoot}" every ${POLL_MS} ms for new photos/folders...`);
console.log('[watcher] Drop a photo into any folder (or create a new folder) and it will be added automatically.');

function poll() {
  const now = JSON.stringify(snapshot());

  if (firstRun) {
    firstRun = false;
    lastState = now;
    console.log('[watcher] Running initial sync...');
    runSync();
    return;
  }

  if (now !== lastState) {
    lastState = now;
    console.log(`[watcher] Change detected at ${new Date().toLocaleTimeString()} - syncing...`);
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(runSync, SYNC_DELAY_MS);
  }
}

setInterval(poll, POLL_MS);

process.on('SIGINT', () => {
  if (syncTimer) clearTimeout(syncTimer);
  console.log('\n[watcher] Stopped.');
  process.exit(0);
});