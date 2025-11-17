import { Theme } from '@radix-ui/themes'
import { queryClient } from '@renderer/utils/trpc'
import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider, useTheme } from 'next-themes'
import { Navbar } from '../features/navbar/navbar'

function RootContent() {
  const { theme } = useTheme()

  return (
    <Theme accentColor={theme === 'dark' ? 'orange' : 'blue'}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1, padding: '2.5rem', backgroundColor: 'var(--gray-2)' }}>
          <Outlet />c
        </main>
      </div>
    </Theme>
  )
}

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class">
        <RootContent />
      </ThemeProvider>
    </QueryClientProvider>
  )
})
