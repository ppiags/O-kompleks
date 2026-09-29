import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig, type Plugin } from 'vitest/config'
import type { Connect } from 'vite'

/**
 * В dev/preview сервер Vite не умеет Vercel Functions.
 * Этот middleware отдаёт тот же самый /api/ai, что и serverless-функция в api/ai.ts,
 * чтобы весь флоу (включая реальные провайдеры) работал через `npm run dev`.
 */
function aiApiPlugin(serverEnv: Record<string, string>): Plugin {
  const attach = (middlewares: Connect.Server): void => {
    middlewares.use('/api/ai', (req, res, next) => {
      void (async () => {
        try {
          const { handleAnalyzeRequest, handleProviderInfoRequest } = await import('./src/server/ai/handler')
          // Явные переменные окружения важнее значений из .env — так можно
          // локально принудительно включить mock: AI_PROVIDER=mock npm run dev
          const env: NodeJS.ProcessEnv = { ...serverEnv, ...process.env }
          res.setHeader('content-type', 'application/json; charset=utf-8')

          if (req.method === 'GET') {
            res.statusCode = 200
            res.end(JSON.stringify(handleProviderInfoRequest({ env })))
            return
          }

          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Метод не поддерживается.' } }))
            return
          }

          const body = await readJsonBody(req)
          const { status, body: responseBody } = await handleAnalyzeRequest(body, { env })
          res.statusCode = status
          res.end(JSON.stringify(responseBody))
        } catch (error) {
          next(error)
        }
      })()
    })
  }

  return {
    name: 'ai-crm-api',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

async function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (raw.length === 0) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), aiApiPlugin(serverEnv)],
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    test: {
      environment: 'node',
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      css: false,
    },
  }
})
