import { expect } from 'vitest'
import type { AnalyzeErrorCode } from '../../../shared/api/contracts'
import { isAiError } from '../errors'

/** Проверяет, что промис отклонён именно AiError с ожидаемым кодом. */
export async function expectAiErrorCode(promise: Promise<unknown>, code: AnalyzeErrorCode): Promise<void> {
  let caught: unknown
  try {
    await promise
  } catch (error) {
    caught = error
  }
  expect(isAiError(caught), 'ожидалась ошибка AiError, получено: ' + String(caught)).toBe(true)
  if (isAiError(caught)) expect(caught.code).toBe(code)
}
