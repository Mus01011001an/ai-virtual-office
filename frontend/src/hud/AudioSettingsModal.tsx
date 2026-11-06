import { useState } from 'react'
import { useOffice } from '../state/store'
import { audioManager } from '../audio/audio-manager'
import { proceduralAudio } from '../audio/procedural-audio'
import { voiceEngine } from '../audio/voice-engine'
import { updateVoiceProfile } from '../lib/api'
import { Btn, Field, Modal, Toggle } from './ui'

export function AudioSettingsModal() {
  const open = useOffice((s) => s.audioSettingsOpen)
  const muted = useOffice((s) => s.muted)
  const setStore = useOffice((s) => s.set)
  const employees = useOffice((s) => s.employees)

  const [masterVol, setMasterVol] = useState(80)
  const [sfxVol, setSfxVol] = useState(60)
  const [voiceVol, setVoiceVol] = useState(90)
  const [spatialAudioEnabled, setSpatialAudioEnabled] = useState(true)
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(true)
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '')
  const [pitch, setPitch] = useState(1.0)
  const [rate, setRate] = useState(1.0)
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('neutral')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  if (!open) return null

  const close = () => {
    setStore({ audioSettingsOpen: false })
    setSavedMsg('')
  }

  const handleMasterChange = (val: number) => {
    setMasterVol(val)
    audioManager.setMasterVolume(val / 100)
  }

  const handleSfxChange = (val: number) => {
    setSfxVol(val)
    proceduralAudio.setSfxVolume(val / 100)
  }

  const handleVoiceChange = (val: number) => {
    setVoiceVol(val)
    audioManager.setVoiceVolume(val / 100)
  }

  const handleMuteToggle = (isMuted: boolean) => {
    setStore({ muted: isMuted })
    audioManager.setMuted(isMuted)
  }

  const testChime = () => {
    proceduralAudio.playChime('meeting')
  }

  const testTyping = () => {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => proceduralAudio.playKeyboardClick(), i * 80)
    }
  }

  const testVoice = () => {
    const emp = employees.find((e) => e.id === selectedEmpId)
    const name = emp ? emp.name : 'AI Virtual Office'
    voiceEngine.speak(
      `Halo CEO, saya ${name}. Sistem audio spasial 3D telah terhubung dan siap mendukung operasional tim.`,
      { pitch, rate, gender }
    )
  }

  const saveProfile = async () => {
    if (!selectedEmpId) return
    setSaving(true)
    setSavedMsg('')
    try {
      await updateVoiceProfile(selectedEmpId, { pitch, rate, gender })
      // Update local employee
      setStore({
        employees: employees.map((e) =>
          e.id === selectedEmpId ? { ...e, voiceProfile: { pitch, rate, gender } } : e
        ),
      })
      setSavedMsg('Profil vokal karyawan berhasil disimpan!')
    } catch {
      setSavedMsg('Gagal menyimpan profil suara.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Pusat Audio Spasial & Suara Tim (Phase 8)" onClose={close}>
      <div className="flex h-[540px] flex-col p-5 text-sm text-bone overflow-y-auto space-y-5">
        {/* Banner Penjelasan */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎧</span>
            <div>
              <h4 className="font-bold text-bone">Three.js 3D Spatial Audio & Voice Engine</h4>
              <p className="text-xs text-bone/60">
                Suara terdengar terarah secara fisik mengikuti koordinat avatar Anda di ruang kantor virtual.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleMuteToggle(!muted)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              muted
                ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
            }`}
          >
            {muted ? '🔇 Muted' : '🔊 Audio Aktif'}
          </button>
        </div>

        {savedMsg && (
          <div className="rounded-xl bg-accent/15 p-3 text-xs text-accent-light ring-1 ring-accent/30">
            ✓ {savedMsg}
          </div>
        )}

        {/* Volume Sliders Grid */}
        <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.01] p-4">
          <Field label={`Master Volume (${masterVol}%)`}>
            <input
              type="range"
              min="0"
              max="100"
              value={masterVol}
              onChange={(e) => handleMasterChange(Number(e.target.value))}
              className="w-full accent-accent h-2 rounded-lg bg-black/40 cursor-pointer"
            />
          </Field>

          <Field label={`Efek Suara Fisik (SFX) (${sfxVol}%)`}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={sfxVol}
                onChange={(e) => handleSfxChange(Number(e.target.value))}
                className="w-full accent-accent h-2 rounded-lg bg-black/40 cursor-pointer"
              />
              <button
                onClick={testChime}
                className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-bone hover:bg-white/20"
              >
                🔔 Bell
              </button>
              <button
                onClick={testTyping}
                className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-bone hover:bg-white/20"
              >
                ⌨️ Ketik
              </button>
            </div>
          </Field>

          <Field label={`Volume Vokal Agen (TTS) (${voiceVol}%)`}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={voiceVol}
                onChange={(e) => handleVoiceChange(Number(e.target.value))}
                className="w-full accent-accent h-2 rounded-lg bg-black/40 cursor-pointer"
              />
              <button
                onClick={testVoice}
                className="shrink-0 rounded-lg bg-accent/20 text-accent px-3 py-1 text-xs font-semibold hover:bg-accent/30"
              >
                🗣️ Tes Suara
              </button>
            </div>
          </Field>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <Toggle
            label="Audio Spasial 3D (Positional HRTF)"
            hint="Suara mengecil secara alami saat avatar menjauh dari sumber suara."
            checked={spatialAudioEnabled}
            onChange={setSpatialAudioEnabled}
          />
          <Toggle
            label="Push-to-Talk (Hotkey 'V')"
            hint="Tahan tombol V pada keyboard untuk mendiktekan perintah suara langsung ke tim."
            checked={pushToTalkEnabled}
            onChange={setPushToTalkEnabled}
          />
        </div>

        {/* Kustomisasi Profil Vokal Agen */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="font-semibold text-bone text-xs uppercase tracking-wider">
            Kustomisasi Profil Suara Karyawan
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-bone/70 block mb-1">Pilih Karyawan:</label>
              <select
                value={selectedEmpId}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value)
                  const emp = employees.find((x) => x.id === e.target.value)
                  if (emp?.voiceProfile) {
                    setPitch(emp.voiceProfile.pitch || 1.0)
                    setRate(emp.voiceProfile.rate || 1.0)
                    setGender(emp.voiceProfile.gender || 'neutral')
                  }
                }}
                className="w-full rounded-xl bg-ink-2 px-3 py-2 text-xs border border-line text-bone"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-bone/70 block mb-1">Karakter Vokal (Gender):</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full rounded-xl bg-ink-2 px-3 py-2 text-xs border border-line text-bone"
              >
                <option value="neutral">Netral / Default</option>
                <option value="female">Wanita (Higher range)</option>
                <option value="male">Pria (Deeper range)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field label={`Pitch / Nada (${pitch.toFixed(2)})`}>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="w-full accent-accent h-2 rounded-lg bg-black/40 cursor-pointer"
              />
            </Field>

            <Field label={`Kecepatan Bicara (${rate.toFixed(2)}x)`}>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full accent-accent h-2 rounded-lg bg-black/40 cursor-pointer"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" size="sm" onClick={testVoice}>
              🗣️ Uji Bicara
            </Btn>
            <Btn variant="primary" size="sm" onClick={saveProfile}>
              {saving ? 'Menyimpan...' : 'Simpan Profil'}
            </Btn>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Btn variant="solid" size="md" onClick={close}>
            Selesai
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
