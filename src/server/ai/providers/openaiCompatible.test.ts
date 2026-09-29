import { describe, expect, it } from 'vitest'
import { expectAiErrorCode } from '../testing/expectAiError'
import { requestChatCompletion } from './openaiCompatible'

function textResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('requestChatCompletion', () => {
  it('отправляет запрос в /chat/completions и возвращает content', async () => {
    const captured: { url: string; init: RequestInit }[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ url: String(input), init: init ?? {} })
      return textResponse({ choices: [{ message: { content: '{"ok":true}' } }] })
    }

    const content = await requestChatCompletion({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-secret-value',
      model: 'test-model',
      messages: [{ role: 'user', content: 'привет' }],
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(content).toBe('{"ok":true}')
    expect(captured).toHaveLength(1)
    expect(captured[0].url).toBe('https://api.example.com/v1/chat/completions')
    const headers = captured[0].init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-secret-value')
    const payload = JSON.parse(String(captured[0].init.body)) as { model: string; messages: unknown[] }
    expect(payload.model).toBe('test-model')
    expect(payload.messages).toHaveLength(1)
  })

  it('не возвращает клиенту тело ошибки провайдера (маскированный ключ, внутренние детали)', async () => {
    const providerBody = JSON.stringify({
      error: {
        message: 'Incorrect API key provided: sk-proj-abcdefghijklmnop. Find your key at https://platform.openai.com/account/api-keys',
        request_id: 'req_internal_42',
      },
    })
    const fetchImpl = async () => new Response(providerBody, { status: 401 })
    const promise = requestChatCompletion({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-proj-abcdefghijklmnop',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      fetchImpl: fetchImpl as typeof fetch,
    })
    await expectAiErrorCode(promise, 'PROVIDER_ERROR')
    await promise.catch((error: unknown) => {
      const text = String(error) + JSON.stringify(error)
      expect(text).not.toContain('sk-proj-abcdefghijklmnop')
      expect(text).not.toContain('Incorrect API key')
      expect(text).not.toContain('platform.openai.com')
      expect(text).not.toContain('req_internal_42')
    })
  })

  it('прерывает чтение тела ответа по таймауту, а не только получение заголовков', async () => {
    const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              const stall = setTimeout(() => controller.error(new Error('body stalled')), 500)
              init?.signal?.addEventListener('abort', () => {
                clearTimeout(stall)
                controller.error(new DOMException('Aborted', 'AbortError'))
              })
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )

    await expectAiErrorCode(
      requestChatCompletion({
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        model: 'm',
        messages: [{ role: 'user', content: 'x' }],
        timeoutMs: 30,
        fetchImpl: fetchImpl as typeof fetch,
      }),
      'PROVIDER_TIMEOUT',
    )
  })

  it('бросает MALFORMED_RESPONSE, если провайдер вернул пустой ответ', async () => {
    const fetchImpl = async () => textResponse({ choices: [] })
    await expectAiErrorCode(
      requestChatCompletion({
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        model: 'm',
        messages: [{ role: 'user', content: 'x' }],
        fetchImpl: fetchImpl as typeof fetch,
      }),
      'MALFORMED_RESPONSE',
    )
  })

  it('бросает PROVIDER_TIMEOUT по истечении таймаута', async () => {
    const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })

    await expectAiErrorCode(
      requestChatCompletion({
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'k',
        model: 'm',
        messages: [{ role: 'user', content: 'x' }],
        timeoutMs: 20,
        fetchImpl: fetchImpl as typeof fetch,
      }),
      'PROVIDER_TIMEOUT',
    )
  })

  it('нормализует baseUrl с завершающим слешем', async () => {
    const captured: string[] = []
    const fetchImpl = async (input: RequestInfo | URL) => {
      captured.push(String(input))
      return textResponse({ choices: [{ message: { content: '{}' } }] })
    }
    await requestChatCompletion({
      baseUrl: 'https://api.example.com/v1/',
      apiKey: 'k',
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      fetchImpl: fetchImpl as typeof fetch,
    })
    expect(captured[0]).toBe('https://api.example.com/v1/chat/completions')
  })
})
