import { DotsVerticalIcon, PlusIcon } from '@radix-ui/react-icons'
import { Button, Flex, Heading, IconButton } from '@radix-ui/themes'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddNovelForm, NovelList } from '../features/novel'

export const Route = createFileRoute('/')({
  component: DashboardPage
})

// Mock novel data
const novels = [
  { id: '1', title: '32131', metadata: ['434141', '44145543535'], language: 'korean' as const },
  { id: '2', title: 'ddddddddddd', metadata: ['ddd', 'dsadadsadssa'], language: 'korean' as const },
  {
    id: '3',
    title: 'Adventure Quest',
    metadata: ['Fantasy', 'Completed'],
    language: 'english' as const
  },
  {
    id: '4',
    title: 'Samurai Chronicles',
    metadata: ['Action', 'Ongoing'],
    language: 'japanese' as const
  }
]

function DashboardPage() {
  const { t } = useTranslation()
  const [showAddForm, setShowAddForm] = useState(false)
  const [novelsList, setNovelsList] = useState(novels)

  const handleAddNovel = (novelData: {
    title: string
    author: string
    sourceLanguage: 'korean' | 'english' | 'japanese'
    description: string
  }) => {
    const newNovel = {
      id: Date.now().toString(),
      title: novelData.title,
      metadata: [novelData.author, novelData.description],
      language: novelData.sourceLanguage
    }
    setNovelsList((prev) => [...prev, newNovel])
  }

  return (
    <div>
      {/* Dashboard Header */}
      <Flex justify="between" align="center" mb="6">
        <Heading size="8">{t('dashboard.title')}</Heading>
        <Flex gap="3">
          <Button size="3" onClick={() => setShowAddForm(true)}>
            <PlusIcon width="16" height="16" />
            {t('dashboard.addNovel')}
          </Button>
          <IconButton variant="soft" size="3">
            <DotsVerticalIcon width="16" height="16" />
          </IconButton>
        </Flex>
      </Flex>

      {/* Novel List */}
      <NovelList novels={novelsList} />

      {/* Add Novel Form Modal */}
      {showAddForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
        >
          <AddNovelForm onClose={() => setShowAddForm(false)} onSubmit={handleAddNovel} />
        </div>
      )}
    </div>
  )
}
