// Resepsionis (walk-in): sapaan pertama begitu masuk gedung + siapa yang ada hari ini (state live) + antar ke mejanya.
import { Shell } from './Modals';
import { useOffice } from '../store/useOffice';
import { AGENT_IDS, type AgentId } from '../core/types';
import { DESKS, PLAYER_BOUNDS, roomAt } from '../world/layout';
import { agentBodies, player } from '../world/runtime';
import { collide } from '../world/nav';
import { AgentBadge, StatusPill } from './common';

function whereIs(id: AgentId, place: string, task: string | null) {
  if (place === 'meeting') return 'In the meeting room';
  if (place === 'coffee') return 'Taking a coffee break in the kitchen';
  if (place === 'security') return 'In Cyber Security';
  const room = roomAt(DESKS[id].x, DESKS[id].z)?.name ?? 'the office';
  return task ? `Working on "${task}" · ${room}` : `At the desk · ${room}`;
}

export function ReceptionModal() {
  const agents = useOffice((s) => s.agents);
  const tasks = useOffice((s) => s.tasks);
  const office = useOffice((s) => s.officeName);
  const list = AGENT_IDS.filter((id) => !agents[id].vacant);
  const busy = list.filter((id) => agents[id].status === 'working' || agents[id].status === 'thinking').length;
  const walkTo = (id: AgentId) => {
    const b = agentBodies[id];
    const x = b.x + Math.sin(b.rot) * 1.3, z = b.z + Math.cos(b.rot) * 1.3;
    const p = collide(x, z, 0.32, undefined, PLAYER_BOUNDS);
    const yaw = Math.atan2(b.x - p.x, b.z - p.z);
    Object.assign(player, { x: p.x, z: p.z, yaw, facing: yaw, seat: null });
    useOffice.getState().openModal(null);
  };
  return (
    <Shell title="Reception">
      <p className="text-[14px] font-semibold">Welcome to {office ?? 'Agent Office'}! 👋</p>
      <p className="mb-3 text-[12.5px] text-muted">
        {list.length ? `${list.length} agent${list.length === 1 ? '' : 's'} on the team today, ${busy} working right now. Who would you like to see?` : 'Nobody is in yet. Start Claude Code in your project and the team will arrive.'}
      </p>
      <div className="flex flex-col gap-1.5">
        {list.map((id) => {
          const a = agents[id];
          const t = a.currentTaskId ? tasks[a.currentTaskId]?.title ?? null : null;
          return (
            <div key={id} className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2">
              <AgentBadge id={id} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold">{a.name} <span className="font-normal text-muted">· {a.role}</span></span>
                  <StatusPill status={a.status} />
                </div>
                <div className="truncate text-[11.5px] text-muted">{whereIs(id, a.place, t)}</div>
              </div>
              <button onClick={() => walkTo(id)} className="shrink-0 rounded-md bg-white/8 px-2 py-1 text-[11.5px] font-semibold hover:bg-white/14">Take me there</button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
