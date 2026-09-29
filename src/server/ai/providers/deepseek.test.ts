import { describe, expect, it } from 'vitest'
import { expectAiErrorCode } from '../testing/expectAiError'
import { createDeepSeekProvider } from './deepseek'

const validResult = {
  customerReply: 'Здравствуйте!',
  managerUpsell: { recommended: false, reason: 'Допродажа не уместна.' },
  usedKnowledgeIds: [],
}

describe('DeepSeekProvider', () => {
  it('использует base URL и модель DeepSeek по умолчанию', async () => {
    const captured: { url: string; model: string }[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model: string }
      captured.push({ url: String(input), model: body.model })
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validResult) } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    const provider = createDeepSeekProvider({
      env: { DEEPSEEK_API_KEY: 'ds-test' },
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(provider.name).toBe('deepseek')
    await provider.generateAnalysis({ query: 'x', history: [], knowledge: [] })
    expect(captured[0].url).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(captured[0].model).toBe('deepseek-chat')
  })

  it('бросает CONFIG_ERROR без ключа', () => {
    expect(() => createDeepSeekProvider({ env: {} })).toThrowError(/DEEPSEEK_API_KEY/)
  })

  it('не подставляет OPENAI_API_KEY вместо DEEPSEEK_API_KEY', () => {
    expect(() => createDeepSeekProvider({ env: { OPENAI_API_KEY: 'sk-openai' } })).toThrow()
  })

  it('сообщает MALFORMED_RESPONSE при невалидном JSON', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    const provider = createDeepSeekProvider({ env: { DEEPSEEK_API_KEY: 'k' }, fetchImpl: fetchImpl as typeof fetch })
    await expectAiErrorCode(
      provider.generateAnalysis({ query: 'x', history: [], knowledge: [] }),
      'MALFORMED_RESPONSE',
    )
  })
})
