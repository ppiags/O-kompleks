import type {
  AnalyzeErrorCode,
  AnalyzeSuccessResponse,
  KnowledgeItem,
  KnowledgeMatch,
  ManagerUpsell,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
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
    Array.isArray(value.keywords)
  )
}

function isKnowledgeMatch(value: unknown): value is KnowledgeMatch {
  if (!isRecord(value)) return false
  return isKnowledgeItem(value.item) && typeof value.score === 'number' && Array.isArray(value.matchedTerms)
}

/** Runtime-проверка успешного ответа: клиент не доверяет 200 вслепую. */
export function isAnalyzeSuccessResponse(value: unknown): value is AnalyzeSuccessResponse {
  if (!isRecord(value)) return false
  if (!isRecord(value.result)) return false

  const result = value.result
  if (!isNonEmptyString(result.customerReply)) return false
  if (!isManagerUpsell(result.managerUpsell)) return false
  if (!Array.isArray(result.usedKnowledgeIds)) return false
  if (!Array.isArray(value.knowledgeMatches)) return false

  return value.knowledgeMatches.every(isKnowledgeMatch)
}

function isAnalyzeErrorCode(value: unknown): value is AnalyzeErrorCode {
  return typeof value === 'string' && (ANALYZE_ERROR_CODES as readonly string[]).includes(value)
}

/** Клиент вызывает только /api/ai: ключи и провайдерная логика живут на сервере. */
export async function analyzeRequest(
  query: string,
  options: AnalyzeRequestOptions = {},
): Promise<AnalyzeSuccessResponse> {
  const fetchImpl = options.fetchImpl ?? fetch

  let response: Response
  try {
    response = await fetchImpl('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query }),
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
