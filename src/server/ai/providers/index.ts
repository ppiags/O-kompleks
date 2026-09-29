import type { AiProvider } from '../../../shared/api/contracts'
import { AiError } from '../errors'
import { createDeepSeekProvider } from './deepseek'
import { createMockProvider } from './mock'
import { createOpenAiProvider } from './openai'

export type { ProviderFactoryOptions } from './openai'

/**
 * Выбирает провайдера по конфигурации окружения.
 * Чтобы добавить OpenRouter/Gemini/Anthropic, достаточно зарегистрировать
 * новую ветку здесь — UI и контракт остаются неизменными.
 */
export function createAiProvider(env: NodeJS.ProcessEnv = {}, fetchImpl?: typeof fetch): AiProvider {
  const requested = (env.AI_PROVIDER ?? 'auto').trim().toLowerCase()

  switch (requested) {
    case 'mock':
      return createMockProvider()
    case 'openai':
      return createOpenAiProvider({ env, fetchImpl })
    case 'deepseek':
      return createDeepSeekProvider({ env, fetchImpl })
    case '':
    case 'auto':
      if (env.OPENAI_API_KEY) return createOpenAiProvider({ env, fetchImpl })
      if (env.DEEPSEEK_API_KEY) return createDeepSeekProvider({ env, fetchImpl })
      return createMockProvider()
    default:
      throw new AiError(
        'CONFIG_ERROR',
        `Неизвестный AI_PROVIDER: «${requested}». Допустимо: auto, mock, openai, deepseek.`,
      )
  }
}
