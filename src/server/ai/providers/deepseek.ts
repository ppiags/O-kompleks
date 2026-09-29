import type { AiProvider } from '../../../shared/api/contracts.js'
import { AiError } from '../errors.js'
import { createChatProvider } from './chatProvider.js'
import type { ProviderFactoryOptions } from './openai.js'

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_MODEL = 'deepseek-chat'

export function createDeepSeekProvider(options: ProviderFactoryOptions = {}): AiProvider {
  const env = options.env ?? {}
  const apiKey = env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new AiError(
      'CONFIG_ERROR',
      'Не задан DEEPSEEK_API_KEY. Добавьте ключ в .env на сервере или включите mock-режим (AI_PROVIDER=mock).',
    )
  }

  return createChatProvider({
    name: 'deepseek',
    apiKey,
    baseUrl: env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
    model: env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    env,
    fetchImpl: options.fetchImpl,
  })
}
