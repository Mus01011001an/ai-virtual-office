#!/usr/bin/env node
// Office Baru ← Claude Code (seperti plugin Agent-Office di video referensi). Node 18+, tanpa dependency.
//
// Pasang di folder project (sekali):
//   mkdir -p .claude && curl -fsSL https://office.musyan.my.id/office-new/claude-hook.mjs -o .claude/avo-office-hook.mjs \
//     && node .claude/avo-office-hook.mjs install --api <API_URL> --token <TOKEN>
// (perintah lengkap dengan token: Office Baru → ⚙ → Claude Code → Copy install command)
//
// Mode hook (dipanggil Claude Code, JSON di stdin): kirim event ke backend, maks ~1 dtk, selalu exit 0.
// Office tidak memakai token model: hanya mendengar.
//
// Dua arah (tugas & chat dari office → Claude Code di komputer ini), di folder project yang sama:
//   node .claude/avo-office-hook.mjs listen            # hanya Anda (pemilik token) yang bisa memberi tugas
//   node .claude/avo-office-hook.mjs listen --team     # semua anggota office boleh memberi tugas
// Opsi: --mode <permission-mode Claude Code, default acceptEdits>, --allow "<allowedTools>", --model <model>,
//       --claude <path ke claude>. Biaya: memakai akun Claude yang login di `claude` komputer ini.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
// listen: API & token diambil dari hook yang sudah dipasang (settings.local.json), jadi tidak perlu diketik ulang
const installed = (() => {
  try {
    const hooks = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.claude', 'settings.local.json'), 'utf8')).hooks ?? {};
    for (const list of Object.values(hooks)) for (const m of list ?? []) for (const h of m.hooks ?? []) {
      const c = String(h.command ?? '');
      const hit = c.includes('avo-office-hook.mjs') && /--api (\S+) --token (\S+)/.exec(c);
      if (hit) return { api: hit[1], token: hit[2] };
    }
  } catch { /* belum dipasang */ }
  return {};
})();
const API = (arg('--api') || process.env.AVO_API_URL || installed.api || 'http://localhost:8011/api/v1').replace(/\/$/, '');
const TOKEN = arg('--token') || process.env.AVO_TOKEN || installed.token || '';
const HOOKS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'SubagentStop', 'Stop', 'Notification'];
const MARK = 'avo-office-hook.mjs';

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const front = (txt, key) => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(txt)?.[1]?.trim().replace(/^["']|["']$/g, '');

/** Sub-agent project (.claude/agents/*.md) → kursi di office. */
function team(dir) {
  try {
    const d = path.join(dir, '.claude', 'agents');
    return fs.readdirSync(d).filter((f) => f.endsWith('.md')).slice(0, 12).map((f) => {
      const txt = fs.readFileSync(path.join(d, f), 'utf8').slice(0, 800);
      return { id: front(txt, 'name') || f.replace(/\.md$/, '') };
    });
  } catch { return undefined; }
}

/** Skill (project lalu user) → meja di Agent HQ. */
function skills(dir) {
  const out = new Map();
  for (const root of [path.join(dir, '.claude', 'skills'), path.join(os.homedir(), '.claude', 'skills')]) {
    let names = [];
    try { names = fs.readdirSync(root); } catch { continue; }
    for (const n of names) {
      if (out.size >= 9) break;
      try {
        const txt = fs.readFileSync(path.join(root, n, 'SKILL.md'), 'utf8').slice(0, 1500);
        const id = front(txt, 'name') || n;
        if (!out.has(id)) out.set(id, { id, description: (front(txt, 'description') || '').slice(0, 80) });
      } catch { /* bukan skill */ }
    }
  }
  return out.size ? [...out.values()] : undefined;
}

/** Ekor transcript (maks 4 MB) → token sejak prompt terakhir + kalimat terakhir Claude. */
function transcript(file) {
  try {
    const size = fs.statSync(file).size;
    const len = Math.min(size, 4 * 1024 * 1024);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    const rows = buf.toString('utf8').split('\n').slice(size > len ? 1 : 0).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const isPrompt = (r) => r.type === 'user' && !r.isMeta && (typeof r.message?.content === 'string' || (Array.isArray(r.message?.content) && r.message.content.some((c) => c.type === 'text')));
    let start = 0;
    for (let i = rows.length - 1; i >= 0; i--) if (isPrompt(rows[i])) { start = i; break; }
    const seen = new Set();
    let tokens = 0, last = '';
    for (const r of rows.slice(start)) {
      if (r.type !== 'assistant' || !r.message) continue;
      const u = r.message.usage;
      if (u && !seen.has(r.message.id)) {
        seen.add(r.message.id);
        tokens += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.output_tokens || 0);
      }
      const text = Array.isArray(r.message.content) ? r.message.content.filter((c) => c.type === 'text').map((c) => c.text).join(' ') : '';
      if (text.trim()) last = text.trim();
    }
    return { tokens, last: last.slice(-240) };
  } catch { return {}; }
}

function install() {
  if (!TOKEN) { console.log('✖ --token wajib (salin perintah lengkap dari Office Baru → ⚙ → Claude Code).'); process.exit(1); }
  const dir = process.cwd();
  const claudeDir = path.join(dir, '.claude');
  fs.mkdirSync(path.join(claudeDir, 'commands'), { recursive: true });
  // 1. hooks di settings.local.json (tidak di-commit: berisi token)
  const file = path.join(claudeDir, 'settings.local.json');
  const s = readJson(file, {});
  s.hooks ??= {};
  const command = `node "$CLAUDE_PROJECT_DIR/.claude/${MARK}" --api ${API} --token ${TOKEN}`;
  for (const h of HOOKS) {
    const keep = (s.hooks[h] ?? []).filter((m) => !(m.hooks ?? []).some((x) => String(x.command ?? '').includes(MARK)));
    s.hooks[h] = [...keep, { hooks: [{ type: 'command', command, timeout: 3 }] }];
  }
  fs.writeFileSync(file, `${JSON.stringify(s, null, 2)}\n`);
  console.log(`✔ Hooks → ${path.relative(dir, file)}`);
  // 2. /office-setup: Claude membaca project dan menulis tim sub-agent (setara /agent-office:setup)
  fs.writeFileSync(path.join(claudeDir, 'commands', 'office-setup.md'), `---
description: Bentuk tim sub-agent project ini untuk Agent Office (satu agen per area kerja)
---
Baca struktur project ini (README, package/manifest, folder utama) lalu buat tim sub-agent di \`.claude/agents/\`:
satu file per area kerja yang benar-benar ada (contoh: backend, frontend, qa, devops, mobile, data, docs), 3–5 agen.
Format tiap file:

\`\`\`markdown
---
name: <id pendek, huruf kecil, mis. backend>
description: <kapan agen ini dipakai, satu kalimat konkret untuk project ini>
tools: Read, Grep, Glob, Edit, Write, Bash
---
<instruksi kerja agen: folder yang dia pegang, perintah build/test yang relevan, aturan penting project>
\`\`\`

Jangan menimpa agen yang sudah ada. $ARGUMENTS
Akhiri dengan daftar agen yang dibuat. Office akan memberi tiap agen meja, nama, dan karakter.
`);
  console.log('✔ Perintah /office-setup → .claude/commands/office-setup.md');
  // 3. token jangan ikut ter-commit
  try {
    if (fs.existsSync(path.join(dir, '.git'))) {
      const gi = path.join(dir, '.gitignore');
      const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
      if (!/settings\.local\.json/.test(cur)) { fs.appendFileSync(gi, `${cur.endsWith('\n') || !cur ? '' : '\n'}.claude/settings.local.json\n`); console.log('✔ .gitignore: .claude/settings.local.json'); }
    }
  } catch { /* abaikan */ }
  console.log('\nSelesai. Jalankan `claude` di folder ini, lalu `/office-setup` untuk membentuk tim. Buka Office Baru → sumber Claude Code.');
  console.log('Agar tugas & chat dari office dikerjakan Claude di komputer ini: node .claude/avo-office-hook.mjs listen');
}

// ---------------------------------------------------------------- listen: office → Claude Code
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (method, url, body, ms = 15_000) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`${API}${url}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.message || `HTTP ${r.status}`), { status: r.status });
    return j?.data ?? j;
  } finally { clearTimeout(t); }
};

/** Prompt untuk Claude: tugas apa adanya; chat dijawab sebagai karyawan yang diajak bicara. */
function promptFor(c) {
  const who = c.from?.name ? ` dari ${c.from.name}` : '';
  const agent = c.to ? (fs.existsSync(path.join(process.cwd(), '.claude', 'agents', `${c.to}.md`)) ? c.to : null) : null;
  if (c.kind === 'chat') {
    return [
      `[Agent Office] Pesan${who} untuk ${c.toName || c.to || 'tim'}${c.to ? ` (${c.to})` : ''}:`,
      c.text,
      '',
      `Jawab sebagai ${c.toName || 'anggota tim'}${agent ? ` — sub-agent \`${agent}\`` : ''}, singkat (maks 5 kalimat), dalam bahasa pesan di atas.`,
      `Jika pesan ini meminta pekerjaan, kerjakan${agent ? ` dengan sub-agent \`${agent}\` (Task tool)` : ''}, lalu laporkan hasilnya singkat.`,
      'Jika hanya menanyakan status/progres, jawab dari apa yang sudah dikerjakan di sesi ini tanpa menjalankan tool.',
    ].join('\n');
  }
  return [`[Agent Office] Tugas${who}${c.toName ? ` untuk ${c.toName}` : ''}:`, c.text, agent ? `\nKerjakan dengan sub-agent \`${agent}\` (Task tool).` : '', '\nAkhiri dengan ringkasan hasil 2–4 kalimat.'].join('\n');
}

async function listen() {
  if (!TOKEN) { console.log('✖ Token tidak ditemukan. Jalankan dulu perintah install dari Office Baru → ⚙ → Claude Code (di folder project ini).'); process.exit(1); }
  const team = argv.includes('--team');
  const mode = arg('--mode') || 'acceptEdits';
  const allow = arg('--allow') ?? 'Bash(npm run:*),Bash(npm test:*),Bash(npx tsc:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*),Bash(ls:*)';
  const model = arg('--model');
  const bin = arg('--claude') || process.env.CLAUDE_BIN || 'claude';
  const host = os.hostname();
  let session = null; // percakapan office berlanjut (Claude ingat pesan sebelumnya) sampai runner dihentikan
  let stopping = false;
  const bye = async () => { if (stopping) return; stopping = true; await call('POST', '/office/claude-code/runner/bye', {}, 3000).catch(() => {}); process.exit(0); };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
  console.log(`● Agent Office runner — ${host}\n  office: ${API}\n  folder: ${process.cwd()}\n  izin: ${mode}${team ? ' · semua anggota office boleh memberi tugas' : ' · hanya Anda yang bisa memberi tugas'}\n  Ctrl+C untuk berhenti.\n`);
  let fails = 0;
  for (;;) {
    let cmd = null;
    try {
      cmd = (await call('GET', `/office/claude-code/runner/next?host=${encodeURIComponent(host)}&team=${team ? 1 : 0}&wait=25000`, undefined, 35_000))?.command ?? null;
      if (fails) console.log('✔ Tersambung lagi ke office.');
      fails = 0;
    } catch (e) {
      if (e.status === 401 || e.status === 403) { console.log(`✖ Ditolak office (${e.message}). Token kedaluwarsa? Pasang ulang perintah install dari Office Baru.`); process.exit(1); }
      if (!fails++) console.log(`… office tidak terjangkau (${e.message}), mencoba lagi`);
      await sleep(Math.min(30_000, 2000 * fails));
      continue;
    }
    if (!cmd) continue;
    const t0 = Date.now();
    console.log(`▶ ${cmd.kind === 'chat' ? `Chat → ${cmd.toName || cmd.to || 'tim'}` : 'Tugas'} dari ${cmd.from?.name ?? 'office'}: ${cmd.text.slice(0, 120)}`);
    const ping = setInterval(() => { call('POST', '/office/claude-code/runner/ping', { host, team, busy: true }, 5000).catch(() => {}); }, 20_000);
    const run = (resume) => new Promise((resolve) => {
      const args = ['-p', promptFor(cmd), '--output-format', 'json', '--permission-mode', mode];
      if (allow) args.push('--allowedTools', allow);
      if (model) args.push('--model', model);
      if (resume) args.push('--resume', resume);
      let out = '', err = '';
      const p = spawn(bin, args, { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
      p.stdout.on('data', (d) => { out += d; });
      p.stderr.on('data', (d) => { err += d; });
      p.on('error', (e) => resolve({ ok: false, text: `Claude Code tidak bisa dijalankan (${e.message}). Pastikan \`claude\` terpasang dan sudah login.` }));
      p.on('close', (code) => {
        try {
          const j = JSON.parse(out.trim().split('\n').filter(Boolean).pop() || '{}');
          if (j.session_id) session = j.session_id;
          resolve({ ok: code === 0 && !j.is_error, text: String(j.result ?? '').trim() || err.trim().slice(-400) || `claude keluar dengan kode ${code}` });
        } catch { resolve({ ok: false, text: (err || out).trim().slice(-400) || `claude keluar dengan kode ${code}` }); }
      });
    });
    let res = await run(session);
    // sesi lama tidak bisa dilanjutkan (dihapus / versi Claude berbeda): mulai sesi baru sekali
    if (!res.ok && session) { session = null; res = await run(null); }
    clearInterval(ping);
    await call('POST', `/office/claude-code/commands/${cmd.id}/result`, { status: res.ok ? 'done' : 'error', reply: res.text }).catch((e) => console.log(`… hasil tidak terkirim (${e.message})`));
    console.log(`${res.ok ? '✔' : '✖'} ${Math.round((Date.now() - t0) / 1000)} dtk — ${res.text.replace(/\s+/g, ' ').slice(0, 160)}\n`);
  }
}

if (argv[0] === 'install') install();
else if (argv[0] === 'listen') listen();
else {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', async () => {
    try {
      if (!TOKEN) process.exit(0);
      const e = JSON.parse(raw);
      const hook = e.hook_event_name;
      const dir = process.env.CLAUDE_PROJECT_DIR || e.cwd || process.cwd();
      if (hook === 'SessionStart' || hook === 'UserPromptSubmit') { e.team = team(dir); e.skills = skills(dir); }
      if (e.transcript_path && /^(PostToolUse|PostToolUseFailure|Stop|SubagentStop)$/.test(hook)) {
        const t = transcript(e.transcript_path);
        if (t.tokens) e.tokens = t.tokens;
        if (hook === 'Stop' && t.last) e.last_message = t.last;
      }
      // tool_response bisa besar: cukup penanda sub-agent latar belakang
      if (e.tool_response && typeof e.tool_response === 'object') e.tool_response = { isAsync: e.tool_response.isAsync, status: e.tool_response.status };
      else delete e.tool_response;
      delete e.transcript_path;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 1000);
      await fetch(`${API}/office/claude-code/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify(e),
        signal: ctl.signal,
      }).catch(() => {});
      clearTimeout(timer);
    } catch { /* office mati atau input rusak: Claude tetap jalan */ }
    process.exit(0);
  });
}
