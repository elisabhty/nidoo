import { useEffect, useState } from 'react'

/** Keep the active sheet inside the visible area when the software keyboard opens. */
export function useKeyboardViewport() {
  const [keyboard, setKeyboard] = useState(false)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let frame = 0
    let referenceHeight = window.innerHeight
    let referenceWidth = window.innerWidth
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]') ?? false
        if (window.innerWidth !== referenceWidth) {
          referenceWidth = window.innerWidth
          referenceHeight = window.innerHeight
        }
        const open = editing && Math.max(referenceHeight, window.innerHeight) - viewport.height > 120
        if (!editing) referenceHeight = window.innerHeight
        setKeyboard(open)
        document.documentElement.style.setProperty('--app-height', open ? `${viewport.height}px` : '100%')
      })
    }
    viewport.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    update()
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      document.documentElement.style.removeProperty('--app-height')
    }
  }, [])
  return keyboard
}
