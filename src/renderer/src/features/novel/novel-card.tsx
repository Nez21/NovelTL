import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

interface NovelCardProps {
  novel: {
    id: string
    title: string
    metadata: string[]
    language: 'korean' | 'english' | 'japanese'
  }
}

export function NovelCard({ novel }: NovelCardProps) {
  const { t } = useTranslation()

  return (
    <Card
      size="3"
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-6)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <Flex direction="column" gap="2">
        <Flex justify="between" align="start">
          <Heading size="6" weight="bold">
            {novel.title}
          </Heading>
          <Button variant="soft" size="1" style={{ fontSize: '0.75rem' }}>
            {t(`dashboard.novel.language.${novel.language}`)}
          </Button>
        </Flex>
        <Flex direction="column" gap="1">
          {novel.metadata.map((meta) => (
            <Text key={meta} size="2" color="gray">
              {meta}
            </Text>
          ))}
        </Flex>
      </Flex>
    </Card>
  )
}
