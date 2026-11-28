import { createRoot } from 'react-dom/client';
import './index.css';
import { probeAssets } from './scene/assetMode';
import { Gate, resolveGate } from './ui/Gate';

// Office Baru (docs/ai-office-architecture.md). Pintu masuk: sign in → pilih office → office (otak: Claude Code).
// Aset dicek dulu: Synty (bila dipasang) atau kit CC0.
// Tanpa StrictMode: label drei <Html> membuat root React sendiri (sama seperti referensi).
const root = createRoot(document.getElementById('root')!);

// Cadangan untuk browser yang mengabaikan user-select (Safari lama): batalkan seleksi di luar kolom isian.
const editable = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, [contenteditable="true"]');
document.addEventListener('selectstart', (e) => { if (!editable(e.target)) e.preventDefault(); });
document.addEventListener('pointerdown', (e) => { if (!editable(e.target)) window.getSelection()?.removeAllRanges(); });
document.addEventListener('contextmenu', (e) => { if (!editable(e.target)) e.preventDefault(); });
void resolveGate().then(async (gate) => {
  if (gate) { root.render(<Gate mode={gate} />); return; }
  await probeAssets();
  const [{ default: App }, { DebugProps }, { useOffice }] = await Promise.all([
    import('./App'), import('./scene/DebugProps'), import('./store/useOffice'),
  ]);
  if (import.meta.env.DEV) {
    (window as unknown as { __office: typeof useOffice }).__office = useOffice;
    void import('./world/runtime').then((r) => { (window as unknown as { __officeRuntime: typeof r }).__officeRuntime = r; });
  }
  root.render(new URLSearchParams(location.search).get('debug') === 'props' ? <DebugProps /> : <App />);
});
