export const keys = new Set<string>()

export const isTyping = () => {
  if (typeof document === 'undefined') return false
  const a = document.activeElement as HTMLElement | null
  if (!a) return false
  const tag = a.tagName.toUpperCase()
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    a.isContentEditable ||
    a.hasAttribute('contenteditable')
  )
}

let installed = false
export function installKeyboard() {
  if (installed) return
  installed = true
  window.addEventListener('keydown', (e) => {
    if (isTyping()) return
    keys.add(e.code)
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault()
  })
  window.addEventListener('keyup', (e) => keys.delete(e.code))
  window.addEventListener('blur', () => keys.clear())
}
