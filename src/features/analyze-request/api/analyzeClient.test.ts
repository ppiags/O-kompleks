// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { AnalyzeSuccessResponse, ConversationMessage } from '../../../shared/api/contracts'
import {
  AnalyzeRequestError,
  analyzeRequest,
  fetchProviderInfo,
  isProviderInfoResponse,
} from './analyzeClient'

const successBody: AnalyzeSuccessResponse = {
  provider: 'mock',
  result: {
    customerReply: 'Здравствуйте!',
    managerUpsell: { recommended: false, reason: 'Не уместно.' },
    usedKnowledgeIds: [],
  },
  knowledgeMatches: [],
}

const history: ConversationMessage[] = [
  { id: 'msg-1', role: 'client', author: 'Клиент', time: '09:41', text: 'Добрый день!' },
  { id: 'msg-2', role: 'manager', author: 'Менеджер', time: '09:43', text: 'Здравствуйте!' },
]

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
  it('отправляет POST /api/ai с query и history и возвращает разобранный ответ', async () => {
    const captured: { url: string; init: RequestInit }[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ url: String(input), init: init ?? {} })
      return jsonResponse(successBody)
    }
    const result = await analyzeRequest('Сколько стоит тариф?', history, { fetchImpl: fetchImpl as typeof fetch })

    expect(result.provider).toBe('mock')
    expect(captured[0].url).toBe('/api/ai')
    expect(captured[0].init.method).toBe('POST')
    expect(JSON.parse(String(captured[0].init.body))).toEqual({ query: 'Сколько стоит тариф?', history })
  })

  it('по умолчанию отправляет пустую историю', async () => {
    const captured: string[] = []
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured.push(String(init?.body))
      return jsonResponse(successBody)
    }
    await analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch })
    expect(JSON.parse(captured[0])).toEqual({ query: 'Сколько стоит тариф?', history: [] })
  })

  it('пробрасывает код ошибки сервера', async () => {
    const fetchImpl = async () =>
      jsonResponse({ error: { code: 'PROVIDER_TIMEOUT', message: 'Модель не ответила вовремя.' } }, 504)
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('PROVIDER_TIMEOUT')
    expect(error.message).toBe('Модель не ответила вовремя.')
  })

  it('на не-JSON ответе с ошибкой отдаёт INTERNAL_ERROR', async () => {
    const fetchImpl = async () => new Response('<html>500</html>', { status: 500 })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('INTERNAL_ERROR')
  })

  it('на не-JSON успешном ответе отдаёт MALFORMED_RESPONSE', async () => {
    const fetchImpl = async () => new Response('<html>ok</html>', { status: 200 })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет успешному 200 без result', async () => {
    const fetchImpl = async () => jsonResponse({ provider: 'mock' })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет 200 с неверным типом result', async () => {
    const fetchImpl = async () => jsonResponse({ ...successBody, result: { customerReply: 42 } })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет неизвестному provider в успешном ответе', async () => {
    const fetchImpl = async () => jsonResponse({ ...successBody, provider: 'gemini' })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет 200 с невалидным knowledgeMatches', async () => {
    const fetchImpl = async () => jsonResponse({ ...successBody, knowledgeMatches: 'нет' })
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет 200 с нечисловым score или не-массивом matchedTerms', async () => {
    const badScore = {
      ...successBody,
      knowledgeMatches: [
        {
          item: { id: 'kb-a', title: 'A', category: 'c', content: 'x', keywords: ['k'] },
          score: 'высокий',
          matchedTerms: ['k'],
        },
      ],
    }
    const fetchImpl = async () => jsonResponse(badScore)
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет 200 с не-строковым keywords у статьи', async () => {
    const badKeywords = {
      ...successBody,
      knowledgeMatches: [
        {
          item: { id: 'kb-a', title: 'A', category: 'c', content: 'x', keywords: [1, 2] },
          score: 5,
          matchedTerms: ['k'],
        },
      ],
    }
    const fetchImpl = async () => jsonResponse(badKeywords)
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не доверяет 200 с не-строковым usedKnowledgeIds', async () => {
    const badIds = { ...successBody, result: { ...successBody.result, usedKnowledgeIds: [1] } }
    const fetchImpl = async () => jsonResponse(badIds)
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('MALFORMED_RESPONSE')
  })

  it('не пробрасывает неизвестный код ошибки из ответа', async () => {
    const fetchImpl = async () => jsonResponse({ error: { code: 'HACKED_CODE', message: 'что-то' } }, 502)
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('INTERNAL_ERROR')
  })

  it('на сетевой ошибке отдаёт NETWORK_ERROR', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }
    const error = await catchError(analyzeRequest('Сколько стоит тариф?', [], { fetchImpl: fetchImpl as typeof fetch }))
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toMatch(/связаться с сервером/i)
  })
})

describe('fetchProviderInfo', () => {
  it('возвращает provider info для корректного ответа', async () => {
    const fetchImpl = async () => jsonResponse({ provider: 'deepseek', live: true })
    await expect(fetchProviderInfo({ fetchImpl: fetchImpl as typeof fetch })).resolves.toEqual({
      provider: 'deepseek',
      live: true,
    })
  })

  it('возвращает undefined на неизвестный provider', async () => {
    const fetchImpl = async () => jsonResponse({ provider: 'gemini', live: true })
    await expect(fetchProviderInfo({ fetchImpl: fetchImpl as typeof fetch })).resolves.toBeUndefined()
  })

  it('возвращает undefined на неверный тип live', async () => {
    const fetchImpl = async () => jsonResponse({ provider: 'mock', live: 'yes' })
    await expect(fetchProviderInfo({ fetchImpl: fetchImpl as typeof fetch })).resolves.toBeUndefined()
  })

  it('возвращает undefined при ошибке или не-JSON', async () => {
    const failing = async () => new Response('nope', { status: 500 })
    const broken = async () => new Response('<html>', { status: 200 })
    await expect(fetchProviderInfo({ fetchImpl: failing as typeof fetch })).resolves.toBeUndefined()
    await expect(fetchProviderInfo({ fetchImpl: broken as typeof fetch })).resolves.toBeUndefined()
  })
})

describe('isProviderInfoResponse', () => {
  it('отклоняет мусор', () => {
    expect(isProviderInfoResponse(null)).toBe(false)
    expect(isProviderInfoResponse({ provider: 'openai' })).toBe(false)
    expect(isProviderInfoResponse({ provider: 'openai', live: false })).toBe(true)
  })
})
