import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const THEME_KEY = 'axis-theme'
const THEME_EVENT = 'axis-theme-change'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // Sync to DOM + storage whenever this instance changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [theme])

  // Listen for changes from other useTheme instances
  useEffect(() => {
    const handler = () => {
      const current = document.documentElement.getAttribute('data-theme') as Theme
      if (current === 'light' || current === 'dark') setTheme(current)
    }
    window.addEventListener(THEME_EVENT, handler)
    return () => window.removeEventListener(THEME_EVENT, handler)
  }, [])

  return { theme, toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) }
}
