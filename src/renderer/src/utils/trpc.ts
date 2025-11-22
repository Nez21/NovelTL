import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { parse as deserialize, stringify as serialize } from 'devalue'
import type { AppRouter } from 'src/main/api'
import { ipcLink } from 'trpc-electron/renderer'

export const queryClient = new QueryClient()

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    ipcLink({
      transformer: {
        deserialize,
        serialize
      }
    })
  ]
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient
})
