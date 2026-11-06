import type { ReactNode } from 'react'
import { STATUS_META, type EmployeeStatus } from '../state/types'

type Variant = 'primary' | 'ghost' | 'solid' | 'light'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:bg-accent-2',
  solid: 'bg-white/[0.07] text-bone hover:bg-white/[0.12]',
  ghost: 'text-bone/70 hover:bg-white/[0.07] hover:text-bone',
  light: 'bg-bone text-ink hover:bg-white',
}

export const Btn = ({ children, onClick, active, className = '', title, variant = 'solid', size = 'sm', disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void; active?: boolean; className?: string; title?: string; variant?: Variant; size?: 'sm' | 'md'; disabled?: boolean; type?: 'button' | 'submit' | 'reset'
}) => (
  <button type={type} title={title} onClick={onClick} disabled={disabled}
    className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${size === 'md' ? 'h-10 px-5 text-sm' : 'h-8 px-3.5 text-[12.5px]'} ${active ? 'bg-bone text-ink' : VARIANT[variant]} ${className}`}>
    {children}
  </button>
)

export const IconBtn = ({ children, onClick, title, active }: { children: ReactNode; onClick?: () => void; title?: string; active?: boolean }) => (
  <button title={title} onClick={onClick}
    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${active ? 'bg-bone text-ink' : 'text-bone/70 hover:bg-white/[0.08] hover:text-bone'}`}>
    {children}
  </button>
)

export const StatusPill = ({ s }: { s: EmployeeStatus }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-bone/85">
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[s].color }} />{STATUS_META[s].label}
  </span>
)

export const DemoBadge = () => (
  <span className="rounded-full bg-demo px-2 text-[10px] font-bold leading-[16px] text-ink">Demo</span>
)

export const Avatar = ({
  color,
  name,
  size = 36,
}: {
  color?: string
  name?: string
  size?: number
}) => {
  const safeColor = color || '#f4a259'
  const safeName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : '?'
  const initial = safeName.slice(0, 1).toUpperCase()

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/10"
      style={{
        background: `linear-gradient(135deg, ${safeColor}, color-mix(in srgb, ${safeColor} 55%, #000))`,
        width: size,
        height: size,
        fontSize: size * 0.42,
      }}
    >
      {initial}
    </div>
  )
}

export const CloseBtn = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-full text-bone/50 hover:bg-white/10 hover:text-bone" aria-label="Tutup">✕</button>
)

export const PanelHead = ({ title, right, sub }: { title: ReactNode; right?: ReactNode; sub?: ReactNode }) => (
  <div className="flex items-center gap-3 px-4 pb-2 pt-3.5">
    <div className="min-w-0 flex-1">
      <div className="display truncate text-[15px] leading-tight text-bone">{title}</div>
      {sub && <div className="truncate text-[11px] text-bone/50">{sub}</div>}
    </div>
    {right}
  </div>
)

export const Modal = ({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) => (
  <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4" onMouseDown={onClose}>
    <div className={`panel rise max-h-[calc(100dvh-20px)] sm:max-h-[88vh] flex flex-col text-bone shadow-2xl ${wide ? 'w-[min(1100px,calc(100vw-16px))]' : 'w-[min(540px,calc(100vw-16px))]'}`} onMouseDown={(e) => e.stopPropagation()}>
      <div className="border-b border-line shrink-0"><PanelHead title={title} right={<CloseBtn onClick={onClose} />} /></div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  </div>
)

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block"><span className="label mb-1.5 block">{label}</span>{children}</label>
)
export const inputCls = 'w-full rounded-xl border border-line bg-ink-2 px-3 py-2 text-sm text-bone outline-none placeholder:text-bone/30 focus:border-accent/60'

export const Toggle = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
  <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-2.5 text-left">
    <span><span className="block text-[13px] text-bone">{label}</span>{hint && <span className="block text-[11px] text-bone/45">{hint}</span>}</span>
    <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-white/15'}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  </button>
)

export const Segmented = <T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string; title?: string }[]; onChange: (v: T) => void }) => (
  <div className="flex rounded-full bg-white/[0.06] p-0.5">
    {options.map((o) => (
      <button key={o.id} title={o.title} onClick={() => onChange(o.id)}
        className={`h-7 flex-1 rounded-full px-3 text-[12.5px] font-semibold transition-colors ${value === o.id ? 'bg-bone text-ink shadow' : 'text-bone/60 hover:text-bone'}`}>
        {o.label}
      </button>
    ))}
  </div>
)

export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { hour12: false })
