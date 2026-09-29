// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { AnalyzeSuccessResponse } from '../../../shared/api/contracts'
import { AnalyzeRequestError, analyzeRequest } from './analyzeClient'

const successBody: AnalyzeSuccessResponse = {
  provider: 'mock',
  result: {
    customerReply: 'Здравствуйте!',
    managerUpsell: { recommended: false, reason: 'Не уместно.' },
    usedKnowledgeIds: [],
  },
  knowledgeMatches: [],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

async function catchError(promise: Promise<unknown>): Promise<AnalyzeRequestError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AnalyzeRequestError) return error
    throw error
  }
  throw new Error('ожидалась ошибка AnalyzeRequestError')
}

describe('analyzeRequest', () => {
  it('отправляет POST /api/ai и возвращает разобранный ответ', async () => {
    const captured: { url: string; init: RequestInit }[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ url: String(input), init: init ?? {} })
      return jsonResponse(successBody)
    }
    const result = await analyzeRequest('Сколько стоит тариф?', { fetchImpl: fetchImpl as typeof fetch })
    expect(result.provider).toBe('mock')
    expect(captured[0].url).toBe('/api/ai')
    expect(captured[0].init.method).toBe('POST')
    expect(JSON.parse(String(captured[0].init.body))).toEqual({ query: 'Сколько стоит тариф?' })
  })

  it('пробрасывает код ошибки сервера', async () => {
    const fetchImpl = async () =>
      jsonResponse({ error: { code: 'PROVIDER_TIMEOUT', message: 'Модель не ответила вовремя.' } }, 504)
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('PROVIDER_TIMEOUT')
    expect(error.message).toBe('Модель не ответила вовремя.')
  })

  it('на не-JSON ответе с ошибкой отдаёт INTERNAL_ERROR', async () => {
    const fetchImpl = async () => new Response('<html>500</html>', { status: 500 })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('INTERNAL_ERROR')
  })

  it('на не-JSON успешном ответе отдаёт MALFORMED_RESPONSE', async () => {
    const fetchImpl = async () => new Response('<html>ok</html>', { status: 200 })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет успешному 200 без result', async () => {
    const fetchImpl = async () => jsonResponse({ provider: 'mock' })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет 200 с неверным типом result', async () => {
    const fetchImpl = async () => jsonResponse({ ...successBody, result: { customerReply: 42 } })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет 200 с невалидным knowledgeMatches', async () => {
    const fetchImpl = async () => jsonResponse({ ...successBody, knowledgeMatches: 'нет' })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не пробрасывает неизвестный код ошибки из ответа', async () => {
    const fetchImpl = async () => jsonResponse({ error: { code: 'HACKED_CODE', message: 'что-то' } }, 502)
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('INTERNAL_ERROR')
  })

  it('на сетевой ошибке отдаёт NETWORK_ERROR', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toMatch(/связаться с сервером/i)
  })
})
