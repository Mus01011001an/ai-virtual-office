// Event hook Claude Code lewat backend AVO (POST /office/claude-code/events → SSE `claude.event`).
// Logika agen/kursi tetap milik PluginAdapter (referensi), di sini hanya transport-nya.
import type { ClaudeCommand, HookEvent, HookTransport, RunnerStatus } from '../plugin/PluginAdapter';
import type { TeamRole } from '../plugin/team';
import { list, one, officeStream } from './api';
import { setHqSkills } from '../../hq/claudeHq';

const DEFAULT_TEAM: TeamRole[] = [{ id: 'backend' }, { id: 'frontend' }, { id: 'devops' }];

/** Event lama yang masih relevan saat office dibuka (sesi yang sedang berjalan). */
const REPLAY_MS = 10 * 60_000;

export const claudeTransport: HookTransport = {
  label: 'Claude Code (hooks)',
  async team() {
    const r = await one<{ team: TeamRole[]; skills?: { id: string; description?: string }[] }>('GET', '/office/claude-code/team');
    setHqSkills(r?.skills);
    // Belum ada .claude/agents: tim default seperti video (Michael · Emma · Jake · Ryan).
    return r?.team?.length ? r.team : DEFAULT_TEAM;
  },
  open(onEvents, onStatus, onControl) {
    let live = false;
    const early: HookEvent[] = [];
    const close = officeStream({
      'claude.event': (d) => { if (live) onEvents([d as HookEvent]); else early.push(d as HookEvent); },
      // dua arah: antrean perintah, balasan Claude, runner hidup/mati
      'claude.command': (d) => onControl?.('command', d),
      'claude.reply': (d) => onControl?.('reply', d),
      'claude.runner': (d) => onControl?.('runner', d),
    }, onStatus);
    list<HookEvent & { ts: number }>(`/office/claude-code/events?since=${Date.now() - REPLAY_MS}`)
      .then((evs) => {
        const seen = new Set(evs.map((e) => e.ts));
        onEvents([...evs, ...early.filter((e) => !seen.has((e as { ts?: number }).ts ?? -1))]);
      })
      .catch(() => onEvents(early))
      .finally(() => { live = true; });
    return close;
  },
  runner: () => one<RunnerStatus>('GET', '/office/claude-code/runner'),
  send: (cmd) => one<ClaudeCommand>('POST', '/office/claude-code/commands', cmd),
};
