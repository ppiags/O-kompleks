import { AiError } from '../errors.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  timeoutMs?: number
  maxTokens?: number
  fetchImpl?: typeof fetch
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[]
}

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Общий OpenAI-совместимый transport. OpenAI и DeepSeek используют один и тот же
 * протокол, поэтому провайдерная разница вынесена в конфиг (baseUrl/model/key).
 *
 * Таймаут покрывает весь обмен, включая чтение тела: controller не сбрасывается,
 * пока ответ не разобран.
 */
export async function requestChatCompletion(request: ChatCompletionRequest): Promise<string> {
  const fetchImpl = request.fetchImpl ?? fetch
  const url = `${request.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })
    } catch (error) {
      throw mapProviderError(error, controller)
    }

    if (!response.ok) {
      // Тело ошибки провайдера наружу не отдаём: там маскированные ключи,
      // внутренние URL и request-id. Клиент получает только статус.
      throw new AiError(
        'PROVIDER_ERROR',
        `Провайдер вернул ошибку ${response.status}. Проверьте ключ, выбранную модель и доступность API.`,
      )
    }

    let payload: ChatCompletionResponse
    try {
      payload = (await response.json()) as ChatCompletionResponse
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AiError('PROVIDER_TIMEOUT', 'Провайдер не ответил за отведённое время. Попробуйте ещё раз.', {
          cause: error,
        })
      }
      throw new AiError('MALFORMED_RESPONSE', 'Не удалось прочитать ответ провайдера.', { cause: error })
    }

    const content = payload.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new AiError('MALFORMED_RESPONSE', 'Провайдер вернул пустой ответ.')
    }

    return content
  } finally {
    clearTimeout(timer)
  }
}

function mapProviderError(error: unknown, controller: AbortController): AiError {
  if (controller.signal.aborted) {
    return new AiError('PROVIDER_TIMEOUT', 'Провайдер не ответил за отведённое время. Попробуйте ещё раз.', {
      cause: error,
    })
  }
  return new AiError(
    'PROVIDER_ERROR',
    'Не удалось обратиться к AI-провайдеру. Проверьте настройки и доступность API.',
    { cause: error },
  )
}
