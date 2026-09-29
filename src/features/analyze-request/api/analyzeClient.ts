import type {
  AiProviderName,
  AnalyzeErrorCode,
  AnalyzeSuccessResponse,
  ConversationMessage,
  KnowledgeItem,
  KnowledgeMatch,
  ManagerUpsell,
  ProviderInfoResponse,
} from '../../../shared/api/contracts'

/** Ошибка обращения к BFF: код + безопасный для показа текст. */
export class AnalyzeRequestError extends Error {
  readonly code: AnalyzeErrorCode

  constructor(code: AnalyzeErrorCode, message: string) {
    super(message)
    this.name = 'AnalyzeRequestError'
    this.code = code
  }
}

export interface AnalyzeRequestOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

export const ANALYZE_ERROR_CODES: readonly AnalyzeErrorCode[] = [
  'EMPTY_QUERY',
  'QUERY_TOO_SHORT',
  'QUERY_TOO_LONG',
  'PROVIDER_ERROR',
  'PROVIDER_TIMEOUT',
  'MALFORMED_RESPONSE',
  'CONFIG_ERROR',
  'NETWORK_ERROR',
  'INTERNAL_ERROR',
]

const PROVIDER_NAMES: readonly AiProviderName[] = ['mock', 'openai', 'deepseek']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isProviderName(value: unknown): value is AiProviderName {
  return typeof value === 'string' && (PROVIDER_NAMES as readonly string[]).includes(value)
}

function isManagerUpsell(value: unknown): value is ManagerUpsell {
  if (!isRecord(value)) return false
  if (typeof value.recommended !== 'boolean') return false
  if (!isNonEmptyString(value.reason)) return false
  if (value.product !== undefined && typeof value.product !== 'string') return false
  if (value.pitch !== undefined && typeof value.pitch !== 'string') return false
  return true
}

function isKnowledgeItem(value: unknown): value is KnowledgeItem {
  if (!isRecord(value)) return false
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    typeof value.category === 'string' &&
    typeof value.content === 'string' &&
    isStringArray(value.keywords)
  )
}

function isKnowledgeMatch(value: unknown): value is KnowledgeMatch {
  if (!isRecord(value)) return false
  return isKnowledgeItem(value.item) && isFiniteNumber(value.score) && isStringArray(value.matchedTerms)
}

/** Runtime-проверка успешного ответа: клиент не доверяет 200 вслепую. */
export function isAnalyzeSuccessResponse(value: unknown): value is AnalyzeSuccessResponse {
  if (!isRecord(value)) return false
  if (!isProviderName(value.provider)) return false
  if (!isRecord(value.result)) return false

  const result = value.result
  if (!isNonEmptyString(result.customerReply)) return false
  if (!isManagerUpsell(result.managerUpsell)) return false
  if (!isStringArray(result.usedKnowledgeIds)) return false
  if (!Array.isArray(value.knowledgeMatches)) return false

  return value.knowledgeMatches.every(isKnowledgeMatch)
}

/** Runtime-проверка GET /api/ai: malformed ответ не должен попасть в UI. */
export function isProviderInfoResponse(value: unknown): value is ProviderInfoResponse {
  if (!isRecord(value)) return false
  if (!isProviderName(value.provider)) return false
  return typeof value.live === 'boolean'
}

function isAnalyzeErrorCode(value: unknown): value is AnalyzeErrorCode {
  return typeof value === 'string' && (ANALYZE_ERROR_CODES as readonly string[]).includes(value)
}

/** Информация о провайдере для индикатора. При malformed ответе — undefined. */
export async function fetchProviderInfo(options: AnalyzeRequestOptions = {}): Promise<ProviderInfoResponse | undefined> {
  const fetchImpl = options.fetchImpl ?? fetch
  try {
    const response = await fetchImpl('/api/ai', { headers: { accept: 'application/json' }, signal: options.signal })
    if (!response.ok) return undefined
    const payload: unknown = await response.json()
    return isProviderInfoResponse(payload) ? payload : undefined
  } catch {
    return undefined
  }
}

/** Клиент вызывает только /api/ai: ключи и провайдерная логика живут на сервере. */
export async function analyzeRequest(
  query: string,
  history: ConversationMessage[] = [],
  options: AnalyzeRequestOptions = {},
): Promise<AnalyzeSuccessResponse> {
  const fetchImpl = options.fetchImpl ?? fetch

  let response: Response
  try {
    response = await fetchImpl('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query, history }),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AnalyzeRequestError('PROVIDER_TIMEOUT', 'Запрос отменён. Попробуйте ещё раз.')
    }
    throw new AnalyzeRequestError(
      'NETWORK_ERROR',
      'Не удалось связаться с сервером анализа. Проверьте соединение и повторите попытку.',
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    if (!response.ok) {
      throw new AnalyzeRequestError('INTERNAL_ERROR', 'Сервер вернул некорректный ответ. Попробуйте позже.')
    }
    throw new AnalyzeRequestError('MALFORMED_RESPONSE', 'Сервер вернул некорректный ответ. Попробуйте ещё раз.')
  }

  if (!response.ok) {
    const failure = isRecord(payload) ? payload : {}
    const rawError = isRecord(failure.error) ? failure.error : {}
    const code = isAnalyzeErrorCode(rawError.code) ? rawError.code : 'INTERNAL_ERROR'
    const message = isNonEmptyString(rawError.message)
      ? rawError.message
      : 'Не удалось выполнить анализ обращения.'
    throw new AnalyzeRequestError(code, message)
  }

  if (!isAnalyzeSuccessResponse(payload)) {
    throw new AnalyzeRequestError(
      'MALFORMED_RESPONSE',
      'Сервер вернул некорректный ответ. Попробуйте ещё раз.',
    )
  }

  return payload
}
