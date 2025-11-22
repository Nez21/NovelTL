import { camel, mapKeys } from 'radash'
import { z } from 'zod'

const configSchema = z
  .record(z.string(), z.any())
  .transform((record) => mapKeys(record, (key) => camel(key)))
  .pipe(
    z.object({
      openrouterApiKey: z.string()
    })
  )

export const cfg = configSchema.parse(structuredClone(process.env))
