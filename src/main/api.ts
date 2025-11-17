import { initTRPC } from '@trpc/server'
import { parse as deserialize, stringify as serialize } from 'devalue'
import { z } from 'zod'

const t = initTRPC.create({
  transformer: {
    deserialize,
    serialize
  }
})

export const router = t.router({
  hello: t.procedure.input(z.string()).query(({ input }) => `Hello, ${input}!`)
})

export type AppRouter = typeof router
