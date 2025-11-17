import { NovelCard } from './novel-card'

interface NovelListProps {
  novels: Array<{
    id: string
    title: string
    metadata: string[]
    language: 'korean' | 'english' | 'japanese'
  }>
}

export function NovelList({ novels }: NovelListProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.5rem'
      }}
    >
      {novels.map((novel) => (
        <NovelCard key={novel.id} novel={novel} />
      ))}
    </div>
  )
}
