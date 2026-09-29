import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAnalyzeRequest, handleProviderInfoRequest } from '../src/server/ai/handler'

/**
 * Тонкий serverless-слой Vercel. Вся провайдерная логика и API-ключи остаются
 * на сервере: клиент получает только разобранный AiAnalysisResult.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')

  if (req.method === 'GET') {
    res.status(200).json(handleProviderInfoRequest({ env: process.env }))
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { code: 'INTERNAL_ERROR', message: 'Метод не поддерживается.' } })
    return
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
  const { status, body: responseBody } = await handleAnalyzeRequest(body, { env: process.env })
  res.status(status).json(responseBody)
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
