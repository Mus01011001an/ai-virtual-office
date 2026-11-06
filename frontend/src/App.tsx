import { useEffect } from 'react'
import { useOffice } from './state/store'
import { startDemoEngine, stopDemoEngine } from './state/demoEngine'
import { installKeyboard } from './camera/input'
import { Scene } from './Scene'
import { TopBar } from './hud/TopBar'
import { Minimap } from './hud/Minimap'
import { EmployeePanel } from './hud/EmployeePanel'
import { Directory } from './hud/Directory'
import { Workstation } from './hud/Workstation'
import { Discussion } from './hud/Discussion'
import { WhiteboardModal } from './hud/WhiteboardModal'
import { StandupModal } from './hud/StandupModal'
import { ScheduleConfigModal } from './hud/ScheduleConfigModal'
import { ApprovalModal } from './hud/ApprovalModal'
import { IntegrationsModal } from './hud/IntegrationsModal'
import { AudioSettingsModal } from './hud/AudioSettingsModal'
import { AiProvidersModal } from './hud/AiProviders'
import { ChangePasswordModal } from './hud/Auth'
import { MembersModal } from './hud/MembersModal'
import { McpModal } from './hud/McpModal'
import { EscapeMenu } from './hud/EscapeMenu'
import { IdeIntegrationModal } from './hud/IdeIntegrationModal'
import { bootstrapSession } from './state/remote'
import { CreateEmployeeModal, NewOfficeModal, SettingsPanel } from './hud/Modals'
import { ClickToPlay, ControlsHint, Crosshair, Hotkeys, InteractPrompt, LoadingBar, StartScreen } from './hud/Overlay'

import { OrientationWarning } from './hud/OrientationWarning'
import { VirtualJoystick } from './hud/VirtualJoystick'

export default function App() {
  const entered = useOffice((s) => s.entered)
  const officeId = useOffice((s) => s.currentOfficeId)
  const settingsOpen = useOffice((s) => s.settingsOpen)

  useEffect(() => { installKeyboard(); void bootstrapSession() }, [])
  useEffect(() => {
    if (!entered) return
    startDemoEngine()
    return stopDemoEngine
  }, [entered, officeId])

  return (
    <div className="relative h-full w-full select-none safe-area-container overflow-hidden">
      <OrientationWarning />
      {entered && (
        <>
          <Scene officeKey={officeId} />
          <TopBar />
          <Directory />
          {!settingsOpen && <EmployeePanel />}
          <SettingsPanel />
          <Minimap />
          <ControlsHint />
          <InteractPrompt />
          <Crosshair />
          <ClickToPlay />
          <VirtualJoystick />
          <Workstation />
          <Discussion />
          <WhiteboardModal />
          <StandupModal />
          <ScheduleConfigModal />
          <ApprovalModal />
          <IntegrationsModal />
          <AudioSettingsModal />
          <Hotkeys />
        </>
      )}
      {!entered && <StartScreen />}
      <LoadingBar />
      <NewOfficeModal />
      <CreateEmployeeModal />
      <AiProvidersModal />
      <ChangePasswordModal />
      <MembersModal />
      <McpModal />
      <EscapeMenu />
      <IdeIntegrationModal />
    </div>
  )
}
