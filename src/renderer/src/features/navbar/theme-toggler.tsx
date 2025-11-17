import { MoonIcon, SunIcon } from '@radix-ui/react-icons'
import { IconButton } from '@radix-ui/themes'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggler() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <IconButton
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      color={theme === 'dark' ? 'orange' : 'blue'}
      variant="ghost"
      size="3"
    >
      {theme === 'light' ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  )
}
