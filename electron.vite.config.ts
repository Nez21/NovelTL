import { join } from 'node:path'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [
      tsconfigPaths({ configNames: ['tsconfig.web.json'] }),
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: join(__dirname, 'src/renderer/src/routes'),
        generatedRouteTree: join(__dirname, 'src/renderer/src/generated/routeTree.gen.ts')
      }),
      react()
    ]
  }
})
