import type { AnalyzeErrorCode } from '../../shared/api/contracts.js'

/** Ошибка уровня BFF: несёт безопасный для клиента код и текст без stack trace. */
export class AiError extends Error {
  readonly code: AnalyzeErrorCode

  constructor(code: AnalyzeErrorCode, message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'AiError'
    this.code = code
    if (options?.cause !== undefined) this.cause = options.cause
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError
}
