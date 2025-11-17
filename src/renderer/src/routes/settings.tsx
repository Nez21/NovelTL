import { createFileRoute } from '@tanstack/react-router'
import { ComingSoonPage } from '../features/shared'

export const Route = createFileRoute('/settings')({
  component: () => <ComingSoonPage pageKey="settings" />
})
