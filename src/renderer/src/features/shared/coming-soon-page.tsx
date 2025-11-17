import { Button, Heading, Text } from '@radix-ui/themes'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

interface ComingSoonPageProps {
  pageKey: 'documents' | 'settings'
}

export function ComingSoonPage({ pageKey }: ComingSoonPageProps) {
  const { t } = useTranslation()

  return (
    <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <Heading size="9" mb="3">
        {t(`pages.${pageKey}.title`)}
      </Heading>
      <Text size="4" color="gray" mb="6">
        {t(`pages.${pageKey}.comingSoon`)}
      </Text>
      <Link to="/">
        <Button size="3">{t(`pages.${pageKey}.backToDashboard`)}</Button>
      </Link>
    </div>
  )
}
