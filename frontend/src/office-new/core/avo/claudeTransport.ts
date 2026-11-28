// Event hook Claude Code lewat backend AVO (POST /office/claude-code/events → SSE `claude.event`).
// Logika agen/kursi tetap milik PluginAdapter (referensi), di sini hanya transport-nya.
import type { HookEvent, HookTransport } from '../plugin/PluginAdapter';
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
  open(onEvents, onStatus) {
    let live = false;
    const early: HookEvent[] = [];
    const close = officeStream({
      'claude.event': (d) => { if (live) onEvents([d as HookEvent]); else early.push(d as HookEvent); },
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
};
