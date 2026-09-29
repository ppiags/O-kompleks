import type {
  AiProviderName,
  AnalyzeErrorCode,
  AnalyzeErrorResponse,
  AnalyzeSuccessResponse,
  ConversationMessage,
  KnowledgeItem,
  KnowledgeMatch,
  ProviderInfoResponse,
} from '../../shared/api/contracts.js'
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from '../../shared/api/contracts.js'
import knowledgeBaseJson from '../../shared/data/knowledge-base.json' with { type: 'json' }
import { retrieveKnowledge } from '../../shared/lib/retrieval.js'
import { isAiError } from './errors.js'
import { createAiProvider } from './providers/index.js'

const DEFAULT_KNOWLEDGE_BASE = knowledgeBaseJson as KnowledgeItem[]

/** Верхние границы входа: прототип не должен превращаться в бесплатный LLM-прокси. */
export const MAX_HISTORY_MESSAGES = 20
export const MAX_HISTORY_MESSAGE_LENGTH = 2000
export const MAX_HISTORY_FIELD_LENGTH = 200

export interface HandleAnalyzeOptions {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  knowledgeBase?: KnowledgeItem[]
}

export interface HandleAnalyzeResult {
  status: number
  body: AnalyzeSuccessResponse | AnalyzeErrorResponse
}

export interface HandleProviderInfoOptions {
  env?: NodeJS.ProcessEnv
}

const ERROR_STATUS: Record<AnalyzeErrorCode, number> = {
  EMPTY_QUERY: 400,
  QUERY_TOO_SHORT: 400,
  QUERY_TOO_LONG: 400,
  CONFIG_ERROR: 500,
  PROVIDER_ERROR: 502,
  MALFORMED_RESPONSE: 502,
  PROVIDER_TIMEOUT: 504,
  NETWORK_ERROR: 500,
  INTERNAL_ERROR: 500,
}

/**
 * Framework-agnostic ядро BFF. Один и тот же код используют
 * serverless-функция Vercel (api/ai.ts) и dev-сервер Vite.
 */
export async function handleAnalyzeRequest(
  rawBody: unknown,
  options: HandleAnalyzeOptions = {},
): Promise<HandleAnalyzeResult> {
  const env = options.env ?? process.env
  const knowledgeBase = options.knowledgeBase ?? DEFAULT_KNOWLEDGE_BASE
  const query = readQuery(rawBody)

  if (query.length === 0) {
    return errorResult('EMPTY_QUERY', 'Введите обращение клиента.')
  }
  if (query.length < MIN_QUERY_LENGTH) {
    return errorResult(
      'QUERY_TOO_SHORT',
      `Обращение слишком короткое. Опишите вопрос подробнее (минимум ${MIN_QUERY_LENGTH} символов).`,
    )
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return errorResult(
      'QUERY_TOO_LONG',
      `Обращение слишком длинное (максимум ${MAX_QUERY_LENGTH} символов). Сократите текст и повторите.`,
    )
  }

  let knowledgeMatches: KnowledgeMatch[]
  try {
    knowledgeMatches = retrieveKnowledge(query, knowledgeBase)
  } catch {
    // Даже при битой базе знаний наружу уходит понятное сообщение, а не stack trace.
    return errorResult('INTERNAL_ERROR', 'Не удалось выполнить поиск по базе знаний. Попробуйте позже.')
  }

  const history = parseHistory(rawBody)

  let provider
  try {
    provider = createAiProvider(env, options.fetchImpl)
  } catch (error) {
    if (isAiError(error)) return errorResult(error.code, error.message)
    return errorResult('CONFIG_ERROR', 'Не удалось настроить AI-провайдера.')
  }

  try {
    const result = await provider.generateAnalysis({
      query,
      history,
      knowledge: knowledgeMatches.map((match) => match.item),
    })
    return { status: 200, body: { provider: provider.name, result, knowledgeMatches } }
  } catch (error) {
    if (isAiError(error)) return errorResult(error.code, error.message)
    return errorResult('INTERNAL_ERROR', 'Не удалось выполнить анализ обращения.')
  }
}

/** Безопасная информация о выбранном провайдере для индикатора в UI. */
export function handleProviderInfoRequest(options: HandleProviderInfoOptions = {}): ProviderInfoResponse {
  const env = options.env ?? process.env
  try {
    const provider = createAiProvider(env)
    return { provider: provider.name, live: provider.name !== 'mock' }
  } catch {
    // Конфигурация сломана (например, AI_PROVIDER=openai без ключа).
    // Не выдаём mock за рабочий провайдер: показываем запрошенного, но live: false.
    const requested = (env.AI_PROVIDER ?? '').trim().toLowerCase()
    const provider: AiProviderName = requested === 'openai' || requested === 'deepseek' ? requested : 'mock'
    return { provider, live: false }
  }
}

function errorResult(code: AnalyzeErrorCode, message: string): HandleAnalyzeResult {
  return { status: ERROR_STATUS[code], body: { error: { code, message } } }
}

function readQuery(rawBody: unknown): string {
  if (typeof rawBody !== 'object' || rawBody === null) return ''
  const value = (rawBody as { query?: unknown }).query
  return typeof value === 'string' ? value.trim() : ''
}

/** Ограничивает историю диалога: не больше N сообщений и не длиннее M символов каждое. */
export function parseHistory(rawBody: unknown): ConversationMessage[] {
  if (typeof rawBody !== 'object' || rawBody === null) return []
  const value = (rawBody as { history?: unknown }).history
  if (!Array.isArray(value)) return []

  return value
    .filter(isConversationMessage)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      ...message,
      id: trimField(message.id),
      author: trimField(message.author),
      time: trimField(message.time),
      text: message.text.slice(0, MAX_HISTORY_MESSAGE_LENGTH),
    }))
}

/** Ограничивает служебные строки history: id/author/time не должны быть безразмерными. */
function trimField(value: string): string {
  return value.trim().slice(0, MAX_HISTORY_FIELD_LENGTH)
}

function isConversationMessage(value: unknown): value is ConversationMessage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ConversationMessage>
  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'client' || candidate.role === 'manager') &&
    typeof candidate.author === 'string' &&
    typeof candidate.time === 'string' &&
    typeof candidate.text === 'string'
  )
}
