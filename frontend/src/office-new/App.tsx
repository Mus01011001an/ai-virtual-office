import { useEffect, useState } from 'react';
import { PerfBadge } from './ui/PerfBadge';
import { AnimatePresence } from './ui/motion';
import { OfficeScene } from './scene/OfficeScene';
import { RENDER } from './scene/RenderController';
import { useOffice } from './store/useOffice';
import { TopBar } from './ui/TopBar';
import { Dock } from './ui/Dock';
import { AgentPanel } from './ui/AgentPanel';
import { ChatWindow } from './ui/ChatWindow';
import { AssignModal, ManagerModal, MeetingModal, WhiteboardModal } from './ui/Modals';
import { LifeHud } from './ui/LifeHud';
import { HqScene } from './hq/HqScene';
import { HqHud } from './hq/HqHud';
import { HireModal } from './ui/HireModal';
import { ReceptionModal } from './ui/ReceptionModal';
import { Icon } from './ui/common';

/** Saat UI disembunyikan: satu tombol kecil samar untuk menampilkan lagi. */
function ShowUi() {
  return (
    <button onClick={() => useOffice.getState().toggleUi()} title="Show interface (H)"
      className="fixed right-3 top-3 z-30 flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-black/35 px-2.5 text-[11px] font-semibold text-white/60 opacity-60 hover:opacity-100">
      <Icon name="eye" size={15} /> H
    </button>
  );
}

export default function App() {
  const mode = useOffice((s) => s.mode);
  const selectedId = useOffice((s) => s.selectedId);
  const chatWith = useOffice((s) => s.chatWith);
  const modal = useOffice((s) => s.modal);
  const uiHidden = useOffice((s) => s.uiHidden);
  const shot = useOffice((s) => s.shot);

  // While a camera shot plays (for recording), hide every overlay and the 3D labels; Esc stops it.
  useEffect(() => {
    const labels = document.getElementById('label-layer');
    if (labels) labels.style.visibility = (shot && RENDER?.ui !== 'full') || uiHidden ? 'hidden' : '';
    if (!shot) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useOffice.getState().playShot(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shot, uiHidden]);

  // Esc closes chat / modals in Overview Mode too (Virtual Life handles its own keys).
  useEffect(() => {
    if (mode !== 'overview') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useOffice.getState();
      if (s.chatWith) s.openChat(null);
      else if (s.modal) s.openModal(null);
      else if (s.selectedId) s.select(null);
      else if (s.panel) s.setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  // Agent HQ: kedua scene tetap ter-mount (label drei <Html> rusak bila di-unmount di tengah render);
  // yang tidak terlihat berhenti merender (frameloop 'never').
  const hq = mode === 'hq';
  const [hqOpened, setHqOpened] = useState(false);
  useEffect(() => { if (hq) setHqOpened(true); }, [hq]);

  // H: sembunyikan / tampilkan semua UI (semua mode), kecuali saat mengetik
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey) useOffice.getState().toggleUi();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  // Render mode (video frames for ep7): just the 3D scene, or with ui=life the walk-in HUD and chat as well.
  // ui=full: the whole interface stays on screen while shots play (for recording the live panels)
  if (RENDER && RENDER.ui !== 'full') {
    if (RENDER.ui !== 'life') return <OfficeScene />;
    return (
      <div className="relative h-full w-full">
        <div className="absolute inset-0"><OfficeScene /></div>
        {mode === 'life' && <LifeHud />}
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2">
          <AnimatePresence>{chatWith && <ChatWindow key={chatWith} id={chatWith} />}</AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0" style={{ visibility: hq ? 'hidden' : 'visible' }}>
        <OfficeScene />
      </div>
      {hqOpened && (
        <div className="absolute inset-0 z-[5]" style={{ visibility: hq ? 'visible' : 'hidden' }}>
          <HqScene active={hq} />
        </div>
      )}
      {hq && !uiHidden && <HqHud />}
      {hq && !uiHidden && <div className="pointer-events-none absolute inset-x-0 top-0 z-20"><TopBar /></div>}
      {hq && uiHidden && <ShowUi />}
      {!hq && <>

      {!uiHidden && (
        <div className={`pointer-events-none absolute inset-0 z-10 flex flex-col ${shot && RENDER?.ui !== 'full' ? 'invisible' : ''}`}>
          <TopBar />
          <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 pt-2.5">
            {/* layar bersih: semua panel lewat dock ikon kecil di kiri */}
            <Dock />
            <div className="flex-1" />
            <div className="pointer-events-auto flex min-h-0 w-[340px] flex-col gap-2 empty:hidden">
              <AnimatePresence mode="wait">
                {selectedId ? <AgentPanel key={selectedId} id={selectedId} /> : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
      {uiHidden && <ShowUi />}

      {mode === 'life' && <LifeHud />}
      <PerfBadge />

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2">
        <AnimatePresence>{chatWith && <ChatWindow key={chatWith} id={chatWith} />}</AnimatePresence>
      </div>

      <AnimatePresence>
        {modal === 'whiteboard' && <WhiteboardModal key="wb" />}
        {modal === 'meeting' && <MeetingModal key="mt" />}
        {modal === 'assign' && <AssignModal key="as" />}
        {modal === 'manager' && <ManagerModal key="mg" />}
        {modal === 'hire' && <HireModal key="hire" />}
        {modal === 'reception' && <ReceptionModal key="reception" />}
      </AnimatePresence>
      </>}
    </div>
  );
}
