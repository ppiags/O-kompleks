import { describe, expect, it } from 'vitest'
import type { AnalyzeErrorResponse, AnalyzeSuccessResponse, KnowledgeItem } from '../../shared/api/contracts'
import { handleAnalyzeRequest, handleProviderInfoRequest, parseHistory } from './handler'

const TEAM_CRM_QUERY =
  'Здравствуйте. Хотим подключить ваш тариф для команды из 12 человек. Нужна интеграция с CRM. Сколько будет стоить и как быстро можно начать?'

function ok(body: AnalyzeSuccessResponse | AnalyzeErrorResponse): AnalyzeSuccessResponse {
  if ('error' in body) throw new Error('ожидался успешный ответ, получено: ' + body.error.code)
  return body
}

function fail(body: AnalyzeSuccessResponse | AnalyzeErrorResponse): AnalyzeErrorResponse {
  if (!('error' in body)) throw new Error('ожидалась ошибка')
  return body
}

describe('handleAnalyzeRequest', () => {
  it('успешно анализирует обращение в mock-режиме', async () => {
    const { status, body } = await handleAnalyzeRequest({ query: TEAM_CRM_QUERY }, { env: { AI_PROVIDER: 'mock' } })
    expect(status).toBe(200)
    const success = ok(body)
    expect(success.provider).toBe('mock')
    expect(success.knowledgeMatches.length).toBeGreaterThan(0)
    expect(success.result.customerReply.length).toBeGreaterThan(0)
  })

  it('отдаёт не больше трёх совпадений', async () => {
    const { body } = await handleAnalyzeRequest(
      { query: 'тариф команда интеграция crm обучение поддержка аналитика' },
      { env: { AI_PROVIDER: 'mock' } },
    )
    expect(ok(body).knowledgeMatches.length).toBeLessThanOrEqual(3)
  })

  it('обрабатывает пустое обращение', async () => {
    const { status, body } = await handleAnalyzeRequest({ query: '   ' }, { env: { AI_PROVIDER: 'mock' } })
    expect(status).toBe(400)
    expect(fail(body).error.code).toBe('EMPTY_QUERY')
  })

  it('обрабатывает слишком короткое обращение', async () => {
    const { status, body } = await handleAnalyzeRequest({ query: 'ок' }, { env: { AI_PROVIDER: 'mock' } })
    expect(status).toBe(400)
    expect(fail(body).error.code).toBe('QUERY_TOO_SHORT')
  })

  it('обрабатывает неверное тело запроса', async () => {
    const { status, body } = await handleAnalyzeRequest('не объект', { env: { AI_PROVIDER: 'mock' } })
    expect(status).toBe(400)
    expect(fail(body).error.code).toBe('EMPTY_QUERY')
  })

  it('возвращает CONFIG_ERROR при неизвестном провайдере', async () => {
    const { status, body } = await handleAnalyzeRequest({ query: TEAM_CRM_QUERY }, { env: { AI_PROVIDER: 'gemini' } })
    expect(status).toBe(500)
    expect(fail(body).error.code).toBe('CONFIG_ERROR')
  })

  it('возвращает MALFORMED_RESPONSE, если модель вернула мусор', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'не json' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    const { status, body } = await handleAnalyzeRequest(
      { query: TEAM_CRM_QUERY },
      { env: { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' }, fetchImpl: fetchImpl as typeof fetch },
    )
    expect(status).toBe(502)
    expect(fail(body).error.code).toBe('MALFORMED_RESPONSE')
  })

  it('возвращает PROVIDER_TIMEOUT при превышении таймаута', async () => {
    const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    const { status, body } = await handleAnalyzeRequest(
      { query: TEAM_CRM_QUERY },
      {
        env: { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test', AI_REQUEST_TIMEOUT_MS: '15' },
        fetchImpl: fetchImpl as typeof fetch,
      },
    )
    expect(status).toBe(504)
    expect(fail(body).error.code).toBe('PROVIDER_TIMEOUT')
  })

  it('работает при пустой базе знаний и честно сообщает об этом', async () => {
    const { status, body } = await handleAnalyzeRequest(
      { query: TEAM_CRM_QUERY },
      { env: { AI_PROVIDER: 'mock' }, knowledgeBase: [] as KnowledgeItem[] },
    )
    const success = ok(body)
    expect(status).toBe(200)
    expect(success.knowledgeMatches).toEqual([])
    expect(success.result.customerReply).toMatch(/нет информации|уточн/i)
  })

  it('отклоняет слишком длинное обращение', async () => {
    const { status, body } = await handleAnalyzeRequest(
      { query: 'я'.repeat(5000) },
      { env: { AI_PROVIDER: 'mock' } },
    )
    expect(status).toBe(400)
    expect(fail(body).error.code).toBe('QUERY_TOO_LONG')
  })

  it('ограничивает историю диалога по количеству сообщений и их длине', () => {
    const history = Array.from({ length: 40 }, (_value, index) => ({
      id: 'm' + index,
      role: 'client',
      author: 'Клиент',
      time: '10:00',
      text: 'я'.repeat(50_000),
    }))
    const parsed = parseHistory({ history })
    expect(parsed).toHaveLength(20)
    for (const message of parsed) expect(message.text.length).toBeLessThanOrEqual(2000)
  })

  it('ограничивает служебные поля истории (id/author/time)', () => {
    const parsed = parseHistory({
      history: [
        { id: 'x'.repeat(500), role: 'client', author: 'a'.repeat(500), time: 't'.repeat(500), text: 'ok' },
      ],
    })
    expect(parsed[0]?.id.length).toBeLessThanOrEqual(200)
    expect(parsed[0]?.author.length).toBeLessThanOrEqual(200)
    expect(parsed[0]?.time.length).toBeLessThanOrEqual(200)
  })

  it('не отдаёт stack trace, если retrieval сломался', async () => {
    const poisoned = [
      {
        id: 'kb-broken',
        get title(): string {
          throw new Error('boom at Object.title')
        },
      },
    ] as unknown as KnowledgeItem[]

    const { status, body } = await handleAnalyzeRequest(
      { query: TEAM_CRM_QUERY },
      { env: { AI_PROVIDER: 'mock' }, knowledgeBase: poisoned },
    )
    expect(status).toBe(500)
    const failure = fail(body)
    expect(failure.error.code).toBe('INTERNAL_ERROR')
    expect(failure.error.message).not.toMatch(/boom|at Object|stack|Error:/i)
  })

  it('без конфигурации сообщает mock-провайдера', () => {
    expect(handleProviderInfoRequest({ env: {} })).toEqual({ provider: 'mock', live: false })
  })

  it('отражает запрошенного провайдера, даже если ключ не задан, но помечает его как не-live', () => {
    const info = handleProviderInfoRequest({ env: { AI_PROVIDER: 'openai' } })
    expect(info.provider).toBe('openai')
    expect(info.live).toBe(false)
  })

  it('для настроенного реального провайдера сообщает live', () => {
    const info = handleProviderInfoRequest({ env: { AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'ds-x' } })
    expect(info.provider).toBe('deepseek')
    expect(info.live).toBe(true)
  })

  it('не возвращает stack trace в тексте ошибки', async () => {
    const { body } = await handleAnalyzeRequest({ query: TEAM_CRM_QUERY }, { env: { AI_PROVIDER: 'gemini' } })
    expect(fail(body).error.message).not.toMatch(/at |Error:/)
  })
})
