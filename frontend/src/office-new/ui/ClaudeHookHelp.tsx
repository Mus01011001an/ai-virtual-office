import { useState } from 'react';
import { getToken } from '../core/avo/api';
import { API_URL } from '../../lib/api';

/**
 * Menyambungkan Claude Code ke office ini, seperti langkah plugin di video referensi:
 * satu perintah di folder project (hook + /office-setup), lalu bekerja seperti biasa di terminal.
 */
export function ClaudeHookHelp() {
  const [copied, setCopied] = useState(false);
  const token = getToken();
  const cmd = `mkdir -p .claude && curl -fsSL ${location.origin}/office-new/claude-hook.mjs -o .claude/avo-office-hook.mjs && node .claude/avo-office-hook.mjs install --api ${API_URL} --token ${token ?? '<login first>'}`;
  const copy = () => { void navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="mb-3 rounded-lg border border-line bg-black/25 p-2 text-[11.5px] leading-snug">
      <div className="mb-1 font-semibold">Connect Claude Code</div>
      <div className="mb-1 text-muted">1 · In your project folder, run:</div>
      <button onClick={copy} disabled={!token} className="mb-2 w-full rounded bg-black/40 px-2 py-1 text-left font-mono text-[10.5px] hover:bg-black/60 disabled:opacity-50">
        {copied ? 'Copied ✓' : 'Copy install command'}
      </button>
      <div className="text-muted">2 · Start <code>claude</code> there and run <code>/office-setup</code> to create your team.</div>
      <div className="text-muted">3 · Give Claude work as usual. Every tool call shows up here, live.</div>
      <div className="mt-1.5 text-muted">Zero model tokens: the office only listens. The token stays in <code>.claude/settings.local.json</code> (git-ignored).</div>
    </div>
  );
}
