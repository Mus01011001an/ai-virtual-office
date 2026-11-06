import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActivityEvent, Ambience, CameraMode, ChatMsg, Employee, Me, Office, OfficeSchedule, Quality, RemoteUserData, ShiftState, TaskItem, WhiteboardState } from './types'
import { createDemoTeam } from './demoTeam'
import { uid } from '../lib/rng'
import { resetRuntime, type SeatInfo } from './runtime'

interface OfficeState {
  // dari server (tidak dipersist)
  me: Me | null
  authChecked: boolean
  offices: Office[]
  currentOfficeId: string
  providersOpen: boolean
  whiteboardOpen: boolean
  debateMode: boolean
  whiteboard: WhiteboardState
  remoteUsers: RemoteUserData[]
  shiftState: ShiftState | null
  officeSchedule: OfficeSchedule | null
  standupOpen: boolean
  scheduleConfigOpen: boolean
  approvalOpen: boolean
  integrationsOpen: boolean
  pendingApprovalsCount: number
  audioSettingsOpen: boolean
  isRecordingVoice: boolean
  dictatedText: string
  muted: boolean
  // persisted (preferensi lokal)
  cameraMode: CameraMode
  showNames: boolean
  quality: Quality
  /** Suasana pencahayaan: malam (default, seperti referensi desain), siang, atau ikut jam office */
  ambience: Ambience
  /** TPS: mouse langsung menggerakkan kamera (pointer-lock), tanpa klik kanan */
  mouseLook: boolean
  showHints: boolean
  showMinimap: boolean
  simulateSchedule: boolean
  sensitivity: number
  // session
  entered: boolean
  /** pointer-lock aktif (mouse menggerakkan kamera) */
  locked: boolean
  employees: Employee[]
  activity: Record<string, ActivityEvent[]>
  tasks: TaskItem[]
  selectedId: string | null
  workstationId: string | null
  nearbyId: string | null
  hoveredId: string | null
  nearbySeat: SeatInfo | null
  isSitting: boolean
  directoryOpen: boolean
  newOfficeOpen: boolean
  createEmployeeOpen: boolean
  settingsOpen: boolean
  membersOpen: boolean
  mcpOpen: boolean
  /** employee yang sedang dipanggil/ikut CEO (mendengarkan diskusi) */
  summoned: string[]
  chat: ChatMsg[]
  /** balon bicara di atas kepala: id → teks ('…' = sedang mengetik) */
  bubbles: Record<string, string>

  set: (p: Partial<OfficeState>) => void
  /** Masuk office: employee dari server + fixture DEMO bila template demo-team */
  enterOffice: (id: string, employees?: Employee[]) => void
  patchEmployee: (id: string, p: Partial<Employee>) => void
  pushActivity: (id: string, kind: ActivityEvent['kind'], text: string) => void
  addTask: (t: Omit<TaskItem, 'id' | 'createdAt'>) => TaskItem
  patchTask: (id: string, p: Partial<TaskItem>) => void
  cycleCamera: () => void
}

export const currentOffice = () => {
  const s = useOffice.getState()
  return s.offices.find((o) => o.id === s.currentOfficeId) ?? s.offices[0]
}

export const useOffice = create<OfficeState>()(
  persist(
    (set, get) => ({
      me: null,
      authChecked: false,
      offices: [],
      currentOfficeId: '',
      providersOpen: false,
      cameraMode: 'tps',
      showNames: true,
      quality: 'medium',
      ambience: 'night',
      mouseLook: true,
      showHints: true,
      showMinimap: true,
      simulateSchedule: false,
      sensitivity: 1,
      entered: false,
      locked: false,
      employees: [],
      activity: {},
      tasks: [],
      selectedId: null,
      workstationId: null,
      nearbyId: null,
      hoveredId: null,
      nearbySeat: null,
      isSitting: false,
      directoryOpen: false,
      newOfficeOpen: false,
      createEmployeeOpen: false,
      settingsOpen: false,
      membersOpen: false,
      mcpOpen: false,
      whiteboardOpen: false,
      debateMode: false,
      whiteboard: {
        topic: 'Diskusi Tim',
        consensusScore: 0,
        points: [],
        actionItems: [],
        summary: '',
      },
      remoteUsers: [],
      shiftState: null,
      officeSchedule: null,
      standupOpen: false,
      scheduleConfigOpen: false,
      approvalOpen: false,
      integrationsOpen: false,
      pendingApprovalsCount: 0,
      audioSettingsOpen: false,
      isRecordingVoice: false,
      dictatedText: '',
      muted: false,
      summoned: [],
      chat: [],
      bubbles: {},

      set: (p) => set(p),

      enterOffice: (id, employees = []) => {
        const office = get().offices.find((o) => o.id === id)
        if (!office) return
        const demo = office.template === 'demo-team' ? createDemoTeam(office.id) : []
        resetRuntime()
        set({
          currentOfficeId: id, entered: true, employees: [...demo, ...employees], activity: {}, tasks: [],
          selectedId: null, workstationId: null, nearbyId: null, hoveredId: null, directoryOpen: false,
          summoned: [], chat: [], bubbles: {},
        })
      },

      patchEmployee: (id, p) =>
        set({ employees: get().employees.map((e) => (e.id === id ? { ...e, ...p } : e)) }),

      pushActivity: (id, kind, text) => {
        const list = get().activity[id] ?? []
        const next = [...list, { id: uid(), at: Date.now(), kind, text }]
        if (next.length > 300) next.splice(0, next.length - 300)
        set({ activity: { ...get().activity, [id]: next } })
      },

      addTask: (t) => {
        const task: TaskItem = { ...t, id: `task-${uid()}`, createdAt: Date.now() }
        set({ tasks: [...get().tasks, task] })
        return task
      },
      patchTask: (id, p) => set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) }),

      cycleCamera: () => {
        const order: CameraMode[] = ['fps', 'tps', 'iso']
        const i = order.indexOf(get().cameraMode)
        set({ cameraMode: order[(i + 1) % 3] })
      },
    }),
    {
      name: 'avo-office',
      // v2: office & employee kini dari backend → buang data lokal lama (offices/customEmployees)
      version: 2,
      migrate: (persisted) => {
        const { offices: _o, currentOfficeId: _c, customEmployees: _e, ...prefs } = (persisted ?? {}) as Record<string, unknown>
        void _o; void _c; void _e
        return prefs as never
      },
      partialize: (s) => ({
        cameraMode: s.cameraMode, showNames: s.showNames, quality: s.quality, ambience: s.ambience,
        mouseLook: s.mouseLook, showHints: s.showHints, showMinimap: s.showMinimap,
        simulateSchedule: s.simulateSchedule, sensitivity: s.sensitivity,
      }),
    },
  ),
)

export const isUiBlocking = () => {
  const s = useOffice.getState()
  return (
    !s.entered ||
    !!s.workstationId ||
    s.newOfficeOpen ||
    s.membersOpen ||
    s.mcpOpen ||
    s.createEmployeeOpen ||
    s.providersOpen ||
    s.whiteboardOpen ||
    s.standupOpen ||
    s.scheduleConfigOpen ||
    s.approvalOpen ||
    s.integrationsOpen ||
    s.audioSettingsOpen
  )
}

/** Cek permission role aktif (wildcard '*' = semua). Office demo lokal tanpa login → tidak dipakai. */
export const can = (perm: string, me = useOffice.getState().me) =>
  !!me?.activeRole && (me.activeRole.permissions.includes('*') || me.activeRole.permissions.includes(perm))
