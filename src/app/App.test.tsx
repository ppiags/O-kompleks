/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalyzeSuccessResponse, KnowledgeItem } from '../shared/api/contracts'
import { App } from './App'

const tariffs: KnowledgeItem = {
  id: 'kb-tariffs',
  title: 'Тарифы и стоимость',
  category: 'Тарифы',
  content: 'Тариф «Команда» — 12 900 ₽ в месяц.',
  keywords: ['тариф'],
}

const crm: KnowledgeItem = {
  id: 'kb-crm-integration',
  title: 'Интеграция с CRM',
  category: 'Интеграции',
  content: 'Интеграция с amoCRM занимает 3–5 рабочих дней.',
  keywords: ['crm'],
}

const successBody: AnalyzeSuccessResponse = {
  provider: 'mock',
  result: {
    customerReply: 'Здравствуйте! Тариф «Команда» — 12 900 ₽ в месяц. Интеграция с CRM занимает 3–5 рабочих дней.',
    managerUpsell: {
      recommended: true,
      product: 'Расширенная аналитика',
      reason: 'В команде несколько менеджеров.',
      pitch: 'Можем показать модуль расширенной аналитики.',
    },
    usedKnowledgeIds: ['kb-tariffs', 'kb-crm-integration'],
  },
  knowledgeMatches: [
    { item: tariffs, score: 9, matchedTerms: ['тариф'] },
    { item: crm, score: 7, matchedTerms: ['crm'] },
  ],
}

type FetchCall = { url: string; method: string; body?: string }

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

function stubFetch(analyze: () => Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = []
  const impl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    calls.push({ url: String(input), method, body: typeof init?.body === 'string' ? init.body : undefined })
    if (method === 'GET') return jsonResponse({ provider: 'mock', live: false })
    return analyze()
  }
  vi.stubGlobal('fetch', impl)
  return calls
}

function typeRequest(text: string): void {
  fireEvent.change(screen.getByTestId('request-input'), { target: { value: text } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('показывает статус провайдера и пустое состояние до анализа', async () => {
    stubFetch(async () => jsonResponse(successBody))
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('provider-status')).toHaveTextContent('Mock'))
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.queryByTestId('customer-reply')).not.toBeInTheDocument()
  })

  it('показывает безопасный fallback, если provider info повреждён', async () => {
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'GET') return jsonResponse({ provider: 'gemini', live: 'yes' })
      return jsonResponse(successBody)
    })
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('provider-status')).toHaveTextContent('не определён'))
  })

  it('не отправляет пустое обращение и показывает подсказку', async () => {
    const calls = stubFetch(async () => jsonResponse(successBody))
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('provider-status')).toHaveTextContent('Mock'))
    fireEvent.click(screen.getByTestId('analyze-button'))
    expect(await screen.findByTestId('validation-error')).toHaveTextContent(/введите обращение/i)
    expect(calls.some((call) => call.method === 'POST')).toBe(false)
  })

  it('основной поток: показывает ответ клиенту, допродажу и совпадения', async () => {
    stubFetch(async () => jsonResponse(successBody))
    render(<App />)
    typeRequest('Хотим тариф для команды из 12 человек и интеграцию с CRM')
    fireEvent.click(screen.getByTestId('analyze-button'))

    const reply = await screen.findByTestId('customer-reply')
    expect(reply).toHaveTextContent('12 900 ₽')
    expect(screen.getByTestId('upsell-block')).toHaveTextContent('Расширенная аналитика')
    expect(screen.getByTestId('upsell-block')).toHaveTextContent('Можем показать модуль')
    expect(screen.getByTestId('knowledge-matches')).toHaveTextContent('Интеграция с CRM')
    expect(screen.getByTestId('status-line')).toHaveTextContent('Knowledge matches: 2')
  })

  it('показывает индикатор загрузки во время анализа', async () => {
    let resolveRequest: ((response: Response) => void) | undefined
    stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        }),
    )
    render(<App />)
    typeRequest('Хотим тариф для команды из 12 человек')
    fireEvent.click(screen.getByTestId('analyze-button'))
    expect(await screen.findByTestId('loading')).toBeInTheDocument()

    resolveRequest?.(jsonResponse(successBody))
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
    expect(screen.getByTestId('customer-reply')).toBeInTheDocument()
  })

  it('показывает понятную ошибку провайдера', async () => {
    stubFetch(async () => jsonResponse({ error: { code: 'PROVIDER_ERROR', message: 'Провайдер недоступен.' } }, 502))
    render(<App />)
    typeRequest('Хотим тариф для команды из 12 человек')
    fireEvent.click(screen.getByTestId('analyze-button'))
    const errorState = await screen.findByTestId('error-state')
    expect(errorState).toHaveTextContent(/провайдер недоступен/i)
    expect(screen.queryByTestId('customer-reply')).not.toBeInTheDocument()
  })

  it('demo preset заполняет поле обращения', async () => {
    stubFetch(async () => jsonResponse(successBody))
    render(<App />)
    fireEvent.click(screen.getByTestId('preset-team-crm'))
    const input = screen.getByTestId('request-input') as HTMLTextAreaElement
    expect(input.value).toContain('12 человек')
    expect(input.value).toContain('CRM')
  })

  it('передаёт видимую историю диалога в /api/ai, не дублируя текущий запрос', async () => {
    const calls = stubFetch(async () => jsonResponse(successBody))
    render(<App />)
    typeRequest('Хотим тариф для команды из 12 человек и интеграцию с CRM')
    fireEvent.click(screen.getByTestId('analyze-button'))
    await screen.findByTestId('customer-reply')

    const post = calls.find((call) => call.method === 'POST')
    expect(post).toBeDefined()
    const payload = JSON.parse(post?.body ?? '{}') as { query: string; history: Array<{ text: string }> }
    expect(payload.query).toBe('Хотим тариф для команды из 12 человек и интеграцию с CRM')
    expect(payload.history.map((message) => message.text)).toEqual([
      'Добрый день! Изучаем варианты для отдела продаж.',
      'Здравствуйте! Расскажите, пожалуйста, сколько человек в команде и какие задачи важны в первую очередь.',
    ])
    expect(payload.history.some((message) => message.text === payload.query)).toBe(false)
  })

  it('после первого анализа предыдущая реплика уходит в следующий запрос как history', async () => {
    const calls = stubFetch(async () => jsonResponse(successBody))
    render(<App />)
    typeRequest('Первый вопрос про тариф для команды')
    fireEvent.click(screen.getByTestId('analyze-button'))
    await screen.findByTestId('customer-reply')

    typeRequest('Второй вопрос про интеграцию с CRM')
    fireEvent.click(screen.getByTestId('analyze-button'))
    await waitFor(() => expect(calls.filter((call) => call.method === 'POST')).toHaveLength(2))

    const posts = calls.filter((call) => call.method === 'POST')
    const payload = JSON.parse(posts[1]?.body ?? '{}') as { query: string; history: Array<{ text: string }> }
    const texts = payload.history.map((message) => message.text)
    expect(payload.query).toBe('Второй вопрос про интеграцию с CRM')
    expect(texts).toContain('Первый вопрос про тариф для команды')
    expect(texts).not.toContain('Второй вопрос про интеграцию с CRM')
  })

  it('очистка сбрасывает результат анализа', async () => {
    stubFetch(async () => jsonResponse(successBody))
    render(<App />)
    typeRequest('Хотим тариф для команды из 12 человек')
    fireEvent.click(screen.getByTestId('analyze-button'))
    await screen.findByTestId('customer-reply')
    fireEvent.click(screen.getByTestId('reset-button'))
    expect(screen.queryByTestId('customer-reply')).not.toBeInTheDocument()
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('показывает честный отказ от допродажи', async () => {
    const noUpsell: AnalyzeSuccessResponse = {
      provider: 'mock',
      result: {
        customerReply: 'Здравствуйте! Опишите проблему подробнее, мы подключим поддержку.',
        managerUpsell: { recommended: false, reason: 'Обращение про сбой доступа — навязывать дополнительный продукт не стоит.' },
        usedKnowledgeIds: [],
      },
      knowledgeMatches: [],
    }
    stubFetch(async () => jsonResponse(noUpsell))
    render(<App />)
    typeRequest('Не работает вход в личный кабинет, помогите')
    fireEvent.click(screen.getByTestId('analyze-button'))
    expect(await screen.findByTestId('upsell-not-recommended')).toHaveTextContent(/не стоит/i)
    expect(screen.queryByTestId('upsell-block')).not.toBeInTheDocument()
  })
})
