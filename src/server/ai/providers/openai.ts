import type { AiProvider } from '../../../shared/api/contracts.js'
import { AiError } from '../errors.js'
import { createChatProvider } from './chatProvider.js'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'

export interface ProviderFactoryOptions {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}

export function createOpenAiProvider(options: ProviderFactoryOptions = {}): AiProvider {
  const env = options.env ?? {}
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    throw new AiError(
      'CONFIG_ERROR',
      'Не задан OPENAI_API_KEY. Добавьте ключ в .env на сервере или включите mock-режим (AI_PROVIDER=mock).',
    )
  }

  return createChatProvider({
    name: 'openai',
    apiKey,
    baseUrl: env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    model: env.OPENAI_MODEL || DEFAULT_MODEL,
    env,
    fetchImpl: options.fetchImpl,
  })
}
