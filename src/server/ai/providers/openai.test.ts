import { describe, expect, it } from 'vitest'
import type { KnowledgeItem } from '../../../shared/api/contracts'
import { expectAiErrorCode } from '../testing/expectAiError'
import { createOpenAiProvider } from './openai'

const knowledge: KnowledgeItem[] = [
  { id: 'kb-tariffs', title: 'Тарифы', category: 'Тарифы', content: 'Команда — 12 900 ₽.', keywords: ['тариф'] },
]

const validResult = {
  customerReply: 'Здравствуйте! Тариф «Команда» — 12 900 ₽ в месяц.',
  managerUpsell: { recommended: true, product: 'Аналитика', reason: 'Команда', pitch: 'Показать аналитику?' },
  usedKnowledgeIds: ['kb-tariffs', 'kb-unknown'],
}

function completion(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('OpenAiProvider', () => {
  it('разбирает корректный JSON и отфильтровывает неизвестные knowledge id', async () => {
    const captured: string[] = []
    const fetchImpl = async (input: RequestInfo | URL) => {
      captured.push(String(input))
      return completion(JSON.stringify(validResult))
    }
    const provider = createOpenAiProvider({
      env: { OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'gpt-test' },
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(provider.name).toBe('openai')
    const result = await provider.generateAnalysis({ query: 'Сколько стоит?', history: [], knowledge })
    expect(result.customerReply).toContain('12 900')
    expect(result.usedKnowledgeIds).toEqual(['kb-tariffs'])
    expect(captured[0]).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('снимает markdown-обёртку вокруг JSON', async () => {
    const fenced = '```json\n' + JSON.stringify(validResult) + '\n```'
    const fetchImpl = async () => completion(fenced)
    const provider = createOpenAiProvider({ env: { OPENAI_API_KEY: 'k' }, fetchImpl: fetchImpl as typeof fetch })
    const result = await provider.generateAnalysis({ query: 'x', history: [], knowledge })
    expect(result.customerReply).toContain('12 900')
  })

  it('бросает MALFORMED_RESPONSE на не-JSON', async () => {
    const fetchImpl = async () => completion('извините, не могу')
    const provider = createOpenAiProvider({ env: { OPENAI_API_KEY: 'k' }, fetchImpl: fetchImpl as typeof fetch })
    await expectAiErrorCode(
      provider.generateAnalysis({ query: 'x', history: [], knowledge }),
      'MALFORMED_RESPONSE',
    )
  })

  it('бросает MALFORMED_RESPONSE на JSON, не прошедший валидацию', async () => {
    const fetchImpl = async () => completion(JSON.stringify({ customerReply: '' }))
    const provider = createOpenAiProvider({ env: { OPENAI_API_KEY: 'k' }, fetchImpl: fetchImpl as typeof fetch })
    await expectAiErrorCode(
      provider.generateAnalysis({ query: 'x', history: [], knowledge }),
      'MALFORMED_RESPONSE',
    )
  })

  it('бросает CONFIG_ERROR без ключа', () => {
    expect(() => createOpenAiProvider({ env: {} })).toThrowError(/OPENAI_API_KEY/)
  })

  it('прокидывает таймаут из окружения', async () => {
    const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    const provider = createOpenAiProvider({
      env: { OPENAI_API_KEY: 'k', AI_REQUEST_TIMEOUT_MS: '15' },
      fetchImpl: fetchImpl as typeof fetch,
    })
    await expectAiErrorCode(
      provider.generateAnalysis({ query: 'x', history: [], knowledge }),
      'PROVIDER_TIMEOUT',
    )
  })
})
