#!/usr/bin/env node
/**
 * dev.mjs — Virtual AI Office Interactive Dev CLI
 * Usage: node dev.mjs   OR   npm run dev
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m',
  red: '\x1b[31m', magenta: '\x1b[35m', blue: '\x1b[34m',
};
const paint = (color, text) => `${color}${text}${c.reset}`;

const ROOT = __dirname;
const FE_DIR = path.join(ROOT, 'frontend');
const BE_DIR = path.join(ROOT, 'backend');
const FE_PORT = 5173;
const BE_PORT = 8010;

/** Backend (Prisma 7) butuh Node 22 LTS — pakai nvm otomatis bila Node aktif bukan 22. */
function withNode22(cmd) {
  const major = Number(process.versions.node.split('.')[0]);
  const nvm = path.join(process.env.NVM_DIR || path.join(process.env.HOME || '', '.nvm'), 'nvm.sh');
  if (major === 22 || !fs.existsSync(nvm)) return cmd;
  return `. "${nvm}" && nvm use 22 >/dev/null && ${cmd}`;
}

function printHeader() {
  console.clear();
  console.log(paint(c.cyan + c.bold, '╔══════════════════════════════════════════╗'));
  console.log(paint(c.cyan + c.bold, '║     🏢  Virtual AI Office Dev CLI  🏢    ║'));
  console.log(paint(c.cyan + c.bold, '╚══════════════════════════════════════════╝'));
  console.log(paint(c.dim, `  Root: ${ROOT}\n`));
}

function runCommand(cmd, cwd = ROOT, opts = {}) {
  return new Promise((resolve) => {
    console.log(paint(c.dim, `\n  $ ${cmd}\n`));
    const child = spawn(cmd, { shell: true, cwd, stdio: 'inherit' });
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', (e) => { console.error(e.message); resolve(1); });
  });
}

function spawnDaemon(cmd, cwd, label) {
  console.log(paint(c.green, `  ▶ Starting ${label}...`));
  const child = spawn(cmd, { shell: true, cwd, stdio: 'inherit' });
  child.on('error', (e) => console.error(paint(c.red, `  ✖ ${label}: ${e.message}`)));
  return child;
}

async function getInquirer() {
  try {
    const mod = await import('inquirer');
    return mod.default;
  } catch {
    console.log(paint(c.yellow, '  Installing inquirer...'));
    execSync('npm install --save inquirer@^9.3.7', { cwd: ROOT, stdio: 'inherit' });
    const mod = await import('inquirer');
    return mod.default;
  }
}

function freePort(port) {
  try {
    execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch {}
}

function ensureDeps(dir, label) {
  if (fs.existsSync(path.join(dir, 'node_modules'))) return Promise.resolve(0);
  console.log(paint(c.yellow, `  ℹ ${label}: node_modules belum ada, menjalankan npm install...`));
  return runCommand('npm install', dir);
}

async function menuServices(inquirer) {
  const { choice } = await inquirer.prompt([{
    type: 'list', name: 'choice', message: '🟢 Start which services?',
    choices: [
      { name: `Frontend + Backend  (port ${FE_PORT} + ${BE_PORT})`, value: 'all' },
      { name: `Frontend 3D Office  (port ${FE_PORT})`, value: 'fe' },
      { name: `Backend API         (port ${BE_PORT}, docs /api/docs)`, value: 'be' },
      { name: 'Prisma Studio       (lihat database)', value: 'studio' },
      { name: 'Prisma migrate status', value: 'migrate-status' },
      { name: 'Build Frontend      (production)', value: 'build' },
      { name: 'Preview Build       (port 4173)', value: 'preview' },
      new inquirer.Separator(),
      { name: '← Back', value: 'back' },
    ],
  }]);
  if (choice === 'back') return;
  const wantFe = choice === 'fe' || choice === 'all' || choice === 'build' || choice === 'preview';
  const wantBe = choice === 'be' || choice === 'all' || choice === 'studio' || choice === 'migrate-status';
  if (wantFe) await ensureDeps(FE_DIR, 'Frontend');
  if (wantBe && !fs.existsSync(path.join(BE_DIR, 'node_modules'))) await runCommand(withNode22('npm install'), BE_DIR);

  if (choice === 'build') { await runCommand('npm run build', FE_DIR); return; }
  if (choice === 'preview') { await runCommand('npm run build && npx vite preview --port 4173', FE_DIR); return; }
  if (choice === 'studio') { await runCommand(withNode22('npx prisma studio'), BE_DIR); return; }
  if (choice === 'migrate-status') { await runCommand(withNode22('npx prisma migrate status'), BE_DIR); return; }

  const procs = [];
  if (choice === 'be' || choice === 'all') {
    freePort(BE_PORT);
    procs.push(spawnDaemon(withNode22('npm run dev'), BE_DIR, `Backend (http://localhost:${BE_PORT}/api/v1)`));
  }
  if (choice === 'fe' || choice === 'all') {
    freePort(FE_PORT);
    procs.push(spawnDaemon(`npx vite --port ${FE_PORT} --strictPort`, FE_DIR, `Frontend (http://localhost:${FE_PORT})`));
  }
  console.log(paint(c.green + c.bold, '\n  ✔ Services started. Press Ctrl+C to stop all.\n'));
  process.on('SIGINT', () => { procs.forEach((p) => { try { p.kill(); } catch {} }); process.exit(0); });
  await Promise.all(procs.map((p) => new Promise((r) => p.on('close', r))));
}

async function menuQuality() {
  await ensureDeps(FE_DIR, 'Frontend');
  let code = await runCommand('npm run typecheck', FE_DIR);
  if (fs.existsSync(path.join(BE_DIR, 'node_modules'))) code ||= await runCommand(withNode22('npm run typecheck'), BE_DIR);
  console.log(code === 0 ? paint(c.green + c.bold, '\n  ✔ Typecheck OK\n') : paint(c.red + c.bold, `\n  ✖ Typecheck gagal (exit ${code})\n`));
}

function getGitBranch() {
  try {
    return execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf-8' }).trim() || 'master';
  } catch {
    return 'master';
  }
}

function getGitStatusSummary() {
  try {
    return execSync('git status -s', { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function parseStatusFiles(rawStatus) {
  if (!rawStatus) return [];
  return rawStatus
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.{2})\s+(.+)$/);
      const status = match ? match[1].trim() : line.slice(0, 2).trim();
      const file = match ? match[2].trim() : line.slice(2).trim();
      let icon = '📝';
      let label = 'Modified';
      let color = c.yellow;
      if (status.includes('?') || status.includes('A')) {
        icon = '✨';
        label = 'Added   ';
        color = c.green;
      } else if (status.includes('D')) {
        icon = '🗑️ ';
        label = 'Deleted ';
        color = c.red;
      } else if (status.includes('R')) {
        icon = '🔄';
        label = 'Renamed ';
        color = c.magenta;
      }
      return { status, file, icon, label, color };
    });
}

function getUnpushedFiles(branch) {
  try {
    const raw = execSync(`git diff --name-status origin/${branch}..HEAD`, { cwd: ROOT, encoding: 'utf-8' }).trim();
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map((line) => {
      const parts = line.split('\t');
      const status = (parts[0] || '').trim();
      const file = parts.slice(1).join('\t').trim();
      let icon = '📝';
      let label = 'Modified';
      let color = c.yellow;
      if (status.startsWith('A')) {
        icon = '✨';
        label = 'Added   ';
        color = c.green;
      } else if (status.startsWith('D')) {
        icon = '🗑️ ';
        label = 'Deleted ';
        color = c.red;
      } else if (status.startsWith('R')) {
        icon = '🔄';
        label = 'Renamed ';
        color = c.magenta;
      }
      return { status, file, icon, label, color };
    });
  } catch {
    return [];
  }
}

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// Statistik perubahan yang dikirim: dari posisi origin/<branch> sebelum push sampai HEAD
function collectPushStats(baseRef) {
  const range = baseRef ? `${baseRef}..HEAD` : 'HEAD~1..HEAD';
  const counts = { A: 0, M: 0, D: 0, R: 0, C: 0, T: 0 };
  git(`diff --name-status -M ${range}`).split('\n').filter(Boolean).forEach((line) => {
    const key = line[0];
    if (key in counts) counts[key]++;
  });

  let insertions = 0;
  let deletions = 0;
  let binary = 0;
  git(`diff --numstat -M ${range}`).split('\n').filter(Boolean).forEach((line) => {
    const [add, del] = line.split('\t');
    if (add === '-') {
      binary++;
      return;
    }
    insertions += Number(add) || 0;
    deletions += Number(del) || 0;
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const commits = Number(git(`rev-list --count ${range}`)) || 0;
  return { range, counts, total, insertions, deletions, binary, commits };
}

function printPushSummary({ branch, baseRef, startedAt, status, exitCode, workingTreeFiles }) {
  const s = collectPushStats(baseRef);
  const remoteUrl = git('remote get-url origin').replace(/\/\/[^@/]+@/, '//');
  const head = git('log -1 --format=%h%x09%s%x09%an%x09%ae');
  const [hash, subject, author, email] = head.split('\t');
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const net = s.insertions - s.deletions;
  // Lebar kolom terminal: emoji = 2, variation selector/ZWJ = 0 (padEnd menghitung code unit → tidak sejajar)
  const termWidth = (str) =>
    [...str].reduce((w, ch) => w + (/[\uFE0F\u200D]/.test(ch) ? 0 : /\p{Extended_Pictographic}/u.test(ch) ? 2 : 1), 0);
  const row = (label, value) =>
    console.log(`  ${paint(c.dim, label + ' '.repeat(Math.max(0, 16 - termWidth(label))))}: ${value}`);
  const line = paint(c.cyan, '  ' + '─'.repeat(52));

  const statusText = {
    pushed: paint(c.green + c.bold, '✅ Berhasil dipush'),
    uptodate: paint(c.green + c.bold, '✔ Sudah up to date (tidak ada yang dipush)'),
    'push-failed': paint(c.red + c.bold, `✖ Push gagal (exit code ${exitCode})`),
    'commit-failed': paint(c.red + c.bold, `✖ Commit gagal (exit code ${exitCode}), tidak ada yang dipush`),
  }[status];

  console.log('');
  console.log(paint(c.cyan + c.bold, '  ══════════════════ 📊 RINGKASAN PUSH ══════════════════'));
  row('Status', statusText);
  row('Branch', `${branch} → origin/${branch}`);
  if (remoteUrl) row('Remote', remoteUrl);
  if (hash) row('Commit terakhir', `${paint(c.yellow, hash)} ${subject}`);
  if (author) row('Author', `${author} <${email}>`);
  row('Jumlah commit', `${s.commits}${baseRef ? paint(c.dim, `  (${baseRef.slice(0, 7)}..${hash || 'HEAD'})`) : ''}`);
  console.log(line);
  row('Total file', paint(c.bold, String(s.total)));
  row('  ✨ Added', paint(c.green, String(s.counts.A)));
  row('  📝 Modified', paint(c.yellow, String(s.counts.M)));
  row('  ❌ Deleted', paint(c.red, String(s.counts.D)));
  row('  🔄 Renamed', paint(c.magenta, String(s.counts.R)));
  if (s.counts.C) row('  📄 Copied', String(s.counts.C));
  if (s.counts.T) row('  🔀 Type changed', String(s.counts.T));
  row('File biner', String(s.binary));
  row(
    'Baris kode',
    `${paint(c.green, `+${s.insertions}`)} / ${paint(c.red, `-${s.deletions}`)}  (net ${net >= 0 ? '+' : ''}${net})`
  );
  if (workingTreeFiles != null) row('File di-stage', String(workingTreeFiles));
  console.log(line);
  row('Waktu selesai', new Date().toLocaleString('id-ID'));
  row('Durasi', `${seconds} detik`);
  console.log(paint(c.cyan + c.bold, '  ═══════════════════════════════════════════════════════\n'));
}

function printFileList(files, title = '📦 File yang akan dipush') {
  if (!files || files.length === 0) return;
  console.log(paint(c.cyan + c.bold, `  ${title} (${files.length} file${files.length > 1 ? 's' : ''}):`));
  files.forEach((f) => {
    console.log(`    ${f.icon} ${paint(f.color, f.label)} : ${paint(c.bold, f.file)}`);
  });
  console.log('');
}

async function executeDirectPush(customMessage) {
  const startedAt = Date.now();
  const branch = getGitBranch();
  const rawStatus = getGitStatusSummary();
  const statusFiles = parseStatusFiles(rawStatus);
  // Posisi remote sebelum push, untuk menghitung ringkasan di akhir
  const baseRef = git(`rev-parse --verify --quiet origin/${branch}`);
  const summary = (status, exitCode = 0) =>
    printPushSummary({ branch, baseRef, startedAt, status, exitCode, workingTreeFiles: rawStatus ? statusFiles.length : null });

  const defaultMsg = customMessage || 'update: sync workspace changes';
  console.log(paint(c.cyan + c.bold, `\n  🚀 Instant 1-Click Push -> origin/${branch}`));
  console.log(paint(c.dim, `  Commit message: "${defaultMsg}"\n`));

  if (!rawStatus) {
    const unpushedFiles = getUnpushedFiles(branch);
    if (unpushedFiles.length > 0) {
      printFileList(unpushedFiles, '📦 File commit lokal yang belum ter-push');
      console.log(paint(c.green, `  ▶ Pushing to origin/${branch}...`));
      const pushCode = await runCommand(`git push origin ${branch}`, ROOT);
      if (pushCode === 0) {
        console.log(paint(c.green + c.bold, `\n  ✅ All unpushed commits successfully pushed to origin/${branch}!\n`));
      } else {
        console.log(paint(c.red + c.bold, `\n  ✖ Failed to push to origin/${branch} (exit code ${pushCode}).\n`));
      }
      summary(pushCode === 0 ? 'pushed' : 'push-failed', pushCode);
    } else {
      console.log(paint(c.yellow, '  ℹ No local changes or unpushed commits. Checking remote...'));
      const pushCode = await runCommand(`git push origin ${branch}`, ROOT);
      if (pushCode === 0) {
        console.log(paint(c.green + c.bold, `\n  ✔ Remote origin/${branch} is up to date!\n`));
      }
      summary(pushCode === 0 ? 'uptodate' : 'push-failed', pushCode);
    }
    return;
  }

  // Tampilkan daftar file yang akan dipush
  printFileList(statusFiles, '📦 File yang akan dipush');

  console.log(paint(c.green, '  ▶ [1/3] Staging all files (git add -A)...'));
  await runCommand('git add -A', ROOT);

  console.log(paint(c.green, `  ▶ [2/3] Committing changes...`));
  const escaped = defaultMsg.replace(/"/g, '\\"');
  const commitCode = await runCommand(`git commit -m "${escaped}"`, ROOT);
  if (commitCode !== 0) {
    console.log(paint(c.red, '  ✖ Commit skipped or failed.'));
    summary('commit-failed', commitCode);
    return;
  }

  console.log(paint(c.green, `  ▶ [3/3] Pushing to origin/${branch}...`));
  const pushCode = await runCommand(`git push origin ${branch}`, ROOT);
  if (pushCode === 0) {
    console.log(paint(c.green + c.bold, `\n  ✅ Berhasil dipush ke origin/${branch}!`));
    console.log(paint(c.dim, `  📋 Rincian file (${statusFiles.length} file):`));
    statusFiles.forEach((f) => {
      console.log(paint(c.dim, `     • [${f.label.trim()}] ${f.file}`));
    });
    console.log('');
  } else {
    console.log(paint(c.red + c.bold, `\n  ✖ Failed to push to origin/${branch} (exit code ${pushCode}).\n`));
  }
  summary(pushCode === 0 ? 'pushed' : 'push-failed', pushCode);
}

// ── Selective push: pilih direktori (↑↓ + ketik untuk filter) ────────────────

const PUSH_ALL = '__all__';

// Path yang berubah (staged/unstaged/untracked), tanpa file .gitignore
function getChangedEntries() {
  let raw = '';
  try {
    raw = execSync('git status --porcelain -uall -z', { cwd: ROOT, encoding: 'utf-8' });
  } catch {
    return [];
  }
  const parts = raw.split('\0').filter(Boolean);
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const xy = parts[i].slice(0, 2);
    entries.push({ xy, file: parts[i].slice(3) });
    if (xy[0] === 'R' || xy[0] === 'C') i++; // -z: path asal rename ada di entry berikutnya
  }
  return entries;
}

// Entry top-level workspace yang tidak di-.gitignore
function getTopLevelEntries() {
  const names = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.name !== '.git');
  let ignored = new Set();
  try {
    const out = execSync('git check-ignore --stdin', {
      cwd: ROOT,
      encoding: 'utf-8',
      input: names.map((d) => (d.isDirectory() ? `${d.name}/` : d.name)).join('\n'),
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    ignored = new Set(out.split('\n').filter(Boolean).map((n) => n.replace(/\/$/, '')));
  } catch {
    // exit code 1 = tidak ada yang di-ignore
  }
  return names
    .filter((d) => !ignored.has(d.name))
    .map((d) => ({ path: d.name, isDir: d.isDirectory() }))
    .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.path.localeCompare(b.path));
}

const inPath = (file, p) => file === p || file.startsWith(`${p}/`);

function buildPushTargets(changed) {
  const count = (p) => changed.filter((e) => inPath(e.file, p)).length;
  const label = (p, isDir) => {
    const n = count(p);
    const name = isDir ? `${p}/` : p;
    return n ? `${paint(c.bold, name)} ${paint(c.yellow, `(${n} berubah)`)}` : paint(c.dim, `${name} (tidak ada perubahan)`);
  };

  const top = getTopLevelEntries().map((e) => ({ value: e.path, name: label(e.path, e.isDir), top: true }));
  const known = new Set(top.map((t) => t.value));
  const nested = [];
  const nestedDirs = new Set();
  changed.forEach(({ file }) => {
    const segs = file.split('/');
    for (let i = 1; i < segs.length; i++) nestedDirs.add(segs.slice(0, i).join('/'));
  });
  [...nestedDirs].sort().forEach((d) => {
    if (!known.has(d)) nested.push({ value: d, name: label(d, true), top: false });
  });
  changed.forEach(({ file }) => {
    if (!known.has(file)) nested.push({ value: file, name: label(file, false), top: false });
  });

  const all = { value: PUSH_ALL, name: paint(c.green + c.bold, `★ ALL — semua perubahan (${changed.length} file)`), top: true };
  return [all, ...top, ...nested].map((t) => ({ ...t, search: t.value === PUSH_ALL ? 'all' : t.value.toLowerCase() }));
}

async function registerSearchCheckbox(inquirer) {
  const { default: Base } = await import('inquirer/lib/prompts/base.js');

  class SearchCheckboxPrompt extends Base {
    constructor(question, rl, answers) {
      super(question, rl, answers);
      this.items = question.items;
      this.pageSize = question.pageSize || 15;
      this.checked = new Set();
      this.pointer = 0;
      this.filter = '';
    }

    _run(cb) {
      this.done = cb;
      this.onKey = (_str, key = {}) => this.handleKey(key);
      this.onLine = () => this.submit();
      this.rl.input.on('keypress', this.onKey);
      this.rl.on('line', this.onLine);
      this.render();
      return this;
    }

    // Filter kosong → hanya top-level; saat mengetik → cari di semua path (termasuk subfolder & file)
    visible() {
      const f = this.filter.toLowerCase();
      return f ? this.items.filter((i) => i.search.includes(f)) : this.items.filter((i) => i.top);
    }

    handleKey(key) {
      if (this.status === 'answered' || key.name === 'return' || key.name === 'enter') return;
      const list = this.visible();
      if (key.name === 'up' || key.name === 'down') {
        if (list.length) this.pointer = (this.pointer + (key.name === 'up' ? -1 : 1) + list.length) % list.length;
      } else if (key.name === 'space') {
        const item = list[this.pointer];
        if (item) this.checked.has(item.value) ? this.checked.delete(item.value) : this.checked.add(item.value);
        this.rl.line = this.rl.line.replace(/\s/g, '');
        this.rl.cursor = this.rl.line.length;
      }
      const next = this.rl.line.trim();
      if (next !== this.filter) {
        this.filter = next;
        this.pointer = 0;
      }
      this.render();
    }

    submit() {
      const list = this.visible();
      let values = [...this.checked];
      if (!values.length && list[this.pointer]) values = [list[this.pointer].value];
      if (!values.length) {
        this.rl.line = this.filter;
        this.rl.cursor = this.filter.length;
        this.render('Tidak ada yang cocok, ubah filter');
        return;
      }
      if (values.includes(PUSH_ALL)) values = [PUSH_ALL];
      this.status = 'answered';
      this.rl.input.removeListener('keypress', this.onKey);
      this.rl.removeListener('line', this.onLine);
      this.screen.render(this.getQuestion() + paint(c.cyan, values.map((v) => (v === PUSH_ALL ? 'ALL' : v)).join(', ')), '');
      this.screen.done();
      this.done(values);
    }

    render(error) {
      const list = this.visible();
      const size = this.pageSize;
      const start = Math.max(0, Math.min(this.pointer - Math.floor(size / 2), list.length - size));
      const rows = list.slice(start, start + size).map((it, i) => {
        const box = this.checked.has(it.value) ? paint(c.green, '◉') : '◯';
        return start + i === this.pointer ? `${paint(c.cyan, '❯')}${box} ${it.name}` : ` ${box} ${it.name}`;
      });
      if (!list.length) rows.push(paint(c.yellow, '  Tidak ada direktori/file yang cocok'));
      const info = [
        list.length > size ? `${this.pointer + 1}/${list.length}` : '',
        this.checked.size ? `${this.checked.size} dipilih` : '',
      ].filter(Boolean).join(' • ');
      const hint = paint(c.dim, `  ↑↓ pindah • ketik untuk filter • <spasi> pilih banyak • <enter> push${info ? `  [${info}]` : ''}`);
      const bottom = [...rows, hint, error ? paint(c.red, `  >> ${error}`) : ''].filter(Boolean).join('\n');
      this.screen.render(this.getQuestion() + this.rl.line, bottom);
    }
  }

  inquirer.registerPrompt('search-checkbox', SearchCheckboxPrompt);
}

async function executeSelectivePush(paths, customMessage) {
  const startedAt = Date.now();
  const branch = getGitBranch();
  const baseRef = git(`rev-parse --verify --quiet origin/${branch}`);
  const changed = getChangedEntries().filter((e) => paths.some((p) => inPath(e.file, p)));
  const msg = customMessage || 'update: sync workspace changes';
  const summary = (status, exitCode = 0) =>
    printPushSummary({ branch, baseRef, startedAt, status, exitCode, workingTreeFiles: changed.length || null });

  console.log(paint(c.cyan + c.bold, `\n  🚀 Selective Push -> origin/${branch}`));
  console.log(paint(c.dim, `  Target : ${paths.join(', ')}`));
  console.log(paint(c.dim, `  Commit message: "${msg}"\n`));

  if (!changed.length) {
    console.log(paint(c.yellow, '  ℹ Tidak ada perubahan di target terpilih.'));
    const unpushed = getUnpushedFiles(branch);
    if (!unpushed.length) return;
    printFileList(unpushed, '📦 File commit lokal yang belum ter-push');
    const pushCode = await runCommand(`git push origin ${branch}`, ROOT);
    summary(pushCode === 0 ? 'pushed' : 'push-failed', pushCode);
    return;
  }

  printFileList(parseStatusFiles(changed.map((e) => `${e.xy} ${e.file}`).join('\n')), '📦 File yang akan dipush');

  const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
  const specs = paths.filter((p) => changed.some((e) => inPath(e.file, p))).map(quote).join(' ');

  console.log(paint(c.green, '  ▶ [1/3] Staging target...'));
  await runCommand(`git add -A -- ${specs}`, ROOT);

  console.log(paint(c.green, '  ▶ [2/3] Committing target saja...'));
  const commitCode = await runCommand(`git commit -m "${msg.replace(/"/g, '\\"')}" -- ${specs}`, ROOT);
  if (commitCode !== 0) {
    console.log(paint(c.red, '  ✖ Commit skipped or failed.'));
    summary('commit-failed', commitCode);
    return;
  }

  console.log(paint(c.green, `  ▶ [3/3] Pushing to origin/${branch}...`));
  const pushCode = await runCommand(`git push origin ${branch}`, ROOT);
  console.log(
    pushCode === 0
      ? paint(c.green + c.bold, `\n  ✅ Berhasil dipush ke origin/${branch}!\n`)
      : paint(c.red + c.bold, `\n  ✖ Failed to push to origin/${branch} (exit code ${pushCode}).\n`)
  );
  summary(pushCode === 0 ? 'pushed' : 'push-failed', pushCode);
}

async function menuSelectivePush(inquirer, customMessage) {
  const changed = getChangedEntries();
  await registerSearchCheckbox(inquirer);
  const { targets } = await inquirer.prompt([{
    type: 'search-checkbox',
    name: 'targets',
    message: 'Push direktori mana? (ketik untuk filter)',
    items: buildPushTargets(changed),
  }]);
  if (targets.includes(PUSH_ALL)) return executeDirectPush(customMessage);
  return executeSelectivePush(targets, customMessage);
}

async function menuGit(inquirer) {
  const branch = getGitBranch();
  const rawStatus = getGitStatusSummary();
  const changedFiles = rawStatus
    ? rawStatus.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];

  console.log(paint(c.cyan + c.bold, `\n  🌿 Branch: ${branch}`));
  if (changedFiles.length > 0) {
    console.log(paint(c.yellow, `  📁 Uncommitted changes (${changedFiles.length} file${changedFiles.length > 1 ? 's' : ''}):`));
    changedFiles.slice(0, 10).forEach((f) => console.log(paint(c.dim, `     ${f}`)));
    if (changedFiles.length > 10) {
      console.log(paint(c.dim, `     ... and ${changedFiles.length - 10} more files`));
    }
    console.log('');
  } else {
    console.log(paint(c.green, '  ✔ Working tree clean (no uncommitted changes).\n'));
  }

  const choices = [];
  choices.push(
    { name: '⚡ Instant Push (Add All, Commit & Push langsung)', value: 'instant-push' },
    { name: '✏️  Custom Push  (Ketik pesan commit & push)',       value: 'custom-push' },
  );
  if (changedFiles.length > 0) {
    choices.push(
      { name: '🔍 Select Files to Stage & Commit',                value: 'select-commit' },
      new inquirer.Separator(),
      { name: '📋 View Diff                     (git diff)',     value: 'diff' },
    );
  }
  choices.push(
    { name: `📤 Push unpushed commits        (origin/${branch})`, value: 'push' },
    { name: `📥 Pull latest with rebase      (origin/${branch})`, value: 'pull' },
    { name: '📜 View Recent Git Log         (Last 5 commits)',   value: 'log' },
    { name: '📊 Full Git Status             (git status)',       value: 'status' },
  );
  if (changedFiles.length > 0) {
    choices.push(
      new inquirer.Separator(),
      { name: '⚠️  Stash all uncommitted changes (git stash)',     value: 'stash' },
    );
  }
  choices.push(
    new inquirer.Separator(),
    { name: '← Back',                                             value: 'back' },
  );

  const { gitAction } = await inquirer.prompt([{
    type: 'list', name: 'gitAction', message: '📦 Git Operations:',
    pageSize: 12,
    choices,
  }]);

  if (gitAction === 'back') return;

  if (gitAction === 'instant-push') {
    await executeDirectPush();
  } else if (gitAction === 'custom-push') {
    const { customMsg } = await inquirer.prompt([{
      type: 'input', name: 'customMsg',
      message: 'Enter commit message:',
      default: 'update: sync workspace changes',
      validate: (input) => input.trim().length > 0 || 'Commit message cannot be empty!',
    }]);
    await executeDirectPush(customMsg.trim());
  } else if (gitAction === 'select-commit') {
    const fileChoices = changedFiles.map((line) => {
      const statusPrefix = line.slice(0, 2);
      const filePath = line.slice(3).trim();
      return {
        name: `${statusPrefix} ${filePath}`,
        value: filePath,
        checked: true,
      };
    });

    const { selectedFiles } = await inquirer.prompt([{
      type: 'checkbox', name: 'selectedFiles',
      message: 'Select files to stage (Space to toggle, Enter to confirm):',
      choices: fileChoices,
      validate: (input) => input.length > 0 || 'Please select at least 1 file!',
    }]);

    const { commitMsg } = await inquirer.prompt([{
      type: 'input', name: 'commitMsg',
      message: 'Enter commit message:',
      validate: (input) => input.trim().length > 0 || 'Commit message cannot be empty!',
    }]);

    const filesArg = selectedFiles.map((f) => `"${f}"`).join(' ');
    await runCommand(`git add ${filesArg}`, ROOT);
    const escapedMsg = commitMsg.trim().replace(/"/g, '\\"');
    const commitCode = await runCommand(`git commit -m "${escapedMsg}"`, ROOT);

    if (commitCode === 0) {
      console.log(paint(c.green + c.bold, '\n  ✔ Commit successful!\n'));
      const { doPush } = await inquirer.prompt([{
        type: 'confirm', name: 'doPush', message: `Push to origin/${branch}?`, default: true,
      }]);
      if (doPush) await runCommand(`git push origin ${branch}`, ROOT);
    }
  } else if (gitAction === 'push') {
    await runCommand(`git push origin ${branch}`, ROOT);
  } else if (gitAction === 'pull') {
    await runCommand(`git pull --rebase origin ${branch}`, ROOT);
  } else if (gitAction === 'diff') {
    await runCommand('git diff', ROOT);
  } else if (gitAction === 'log') {
    await runCommand('git log -n 5 --oneline --graph --decorate', ROOT);
  } else if (gitAction === 'status') {
    await runCommand('git status', ROOT);
  } else if (gitAction === 'stash') {
    const { stashMsg } = await inquirer.prompt([{
      type: 'input', name: 'stashMsg', message: 'Stash message (optional):', default: 'WIP stash via dev CLI',
    }]);
    await runCommand(`git stash push -m "${stashMsg}"`, ROOT);
  }

  const { again } = await inquirer.prompt([{
    type: 'confirm', name: 'again', message: 'Perform another Git operation?', default: false,
  }]);
  if (again) return menuGit(inquirer);
}

async function main() {
  // Pilih direktori lalu push: npm run push / node dev.mjs --push-select ["commit message"]
  if (process.argv.includes('--push-select')) {
    const customMsg = process.argv.slice(2).filter((a) => !a.startsWith('-')).join(' ').trim() || undefined;
    printHeader();
    await menuSelectivePush(await getInquirer(), customMsg);
    process.exit(0);
  }

  // Direct 1-click execution: npm run push / node dev.mjs --direct-push
  const isDirectPush =
    process.argv.includes('--push') ||
    process.argv.includes('--direct-push') ||
    process.argv.includes('push');

  if (isDirectPush) {
    const rawArgs = process.argv.slice(2).filter((a) => !a.startsWith('-') && a !== 'push');
    const customMsg = rawArgs.join(' ').trim() || undefined;
    printHeader();
    await executeDirectPush(customMsg);
    process.exit(0);
  }

  const inquirer = await getInquirer();

  // Interactive Git Menu shortcut: npm run git / node dev.mjs --git
  if (process.argv.includes('--git') || process.argv.includes('git')) {
    printHeader();
    await menuGit(inquirer);
    process.exit(0);
  }

  while (true) {
    printHeader();
    const { action } = await inquirer.prompt([{
      type: 'list', name: 'action', message: 'What do you want to do?',
      pageSize: 12,
      choices: [
        { name: '🟢 Start Services        (Frontend 3D Office)',  value: 'services' },
        { name: '🔎 Typecheck             (Frontend)',           value: 'quality' },
        new inquirer.Separator(),
        { name: '📦 Git Tools             (Add, Commit, Push)',   value: 'git' },
        new inquirer.Separator(),
        { name: '❌ Exit',                                         value: 'exit' },
      ],
    }]);

    if (action === 'exit') { console.log(paint(c.cyan, '\n  👋 Bye!\n')); process.exit(0); }

    try {
      if (action === 'services') await menuServices(inquirer);
      else if (action === 'quality') await menuQuality();
      else if (action === 'git') await menuGit(inquirer);
    } catch (err) {
      console.log(paint(c.red, `\n  ✖ Error: ${err.message}\n`));
    }

    await inquirer.prompt([{
      type: 'input', name: '_',
      message: paint(c.dim, 'Press Enter to return to main menu...'),
    }]);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
