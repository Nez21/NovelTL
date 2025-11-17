import { Flex, Heading, TabNav, Text } from '@radix-ui/themes'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './language-switcher'
import { ThemeToggler } from './theme-toggler'

export function Navbar() {
  const router = useRouterState()
  const { t } = useTranslation()

  const isActive = (path: string) => router.location.pathname === path

  return (
    <div
      style={{
        padding: '1rem 2.5rem',
        backgroundColor: 'var(--gray-1)',
        borderBottom: '1px solid var(--gray-4)'
      }}
    >
      <Flex justify="between" align="center">
        <Flex align="center" gap="4">
          <Flex align="center" gap="3">
            <Heading size="6" weight="bold" style={{ color: 'var(--accent-11)' }}>
              {'N'}
              <Text color="gray" highContrast>
                ovelTL
              </Text>
            </Heading>
          </Flex>
          <TabNav.Root size="2">
            <Link to="/" style={{ textDecoration: 'none' }}>
              <TabNav.Link active={isActive('/')}>{t('nav.dashboard')}</TabNav.Link>
            </Link>
            <Link to="/documents" style={{ textDecoration: 'none' }}>
              <TabNav.Link active={isActive('/documents')}>{t('nav.documents')}</TabNav.Link>
            </Link>
            <Link to="/settings" style={{ textDecoration: 'none' }}>
              <TabNav.Link active={isActive('/settings')}>{t('nav.settings')}</TabNav.Link>
            </Link>
          </TabNav.Root>
        </Flex>
        <Flex align="center" gap="3">
          <LanguageSwitcher />
          <ThemeToggler />
        </Flex>
      </Flex>
    </div>
  )
}
