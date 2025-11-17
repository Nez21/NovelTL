import { createFileRoute } from '@tanstack/react-router'
import { ComingSoonPage } from '../features/shared'

export const Route = createFileRoute('/documents')({
  component: () => <ComingSoonPage pageKey="documents" />
})
