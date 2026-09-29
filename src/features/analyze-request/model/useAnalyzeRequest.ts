import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  type AnalyzeErrorCode,
  type AnalyzeSuccessResponse,
  type ConversationMessage,
} from '../../../shared/api/contracts'
import { AnalyzeRequestError, analyzeRequest } from '../api/analyzeClient'

export type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AnalyzeErrorState {
  code: AnalyzeErrorCode
  message: string
}

export interface AnalyzeState {
  status: AnalyzeStatus
  data?: AnalyzeSuccessResponse
  error?: AnalyzeErrorState
}

export interface UseAnalyzeRequestResult extends AnalyzeState {
  analyze: (query: string, history?: ConversationMessage[]) => Promise<void>
  reset: () => void
}

/** Локальный state экрана: Redux/стор здесь не нужен. */
export function useAnalyzeRequest(): UseAnalyzeRequestResult {
  const [state, setState] = useState<AnalyzeState>({ status: 'idle' })
  const requestIdRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  const cancelInFlight = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  // Отмена незавершённого запроса при размонтировании.
  useEffect(() => cancelInFlight, [cancelInFlight])

  const analyze = useCallback(
    async (query: string, history: ConversationMessage[] = []) => {
      const trimmed = query.trim()

      const validationError = validateQuery(trimmed)
      if (validationError) {
        cancelInFlight()
        requestIdRef.current += 1
        setState({ status: 'error', error: validationError })
        return
      }

      // Новый анализ отменяет предыдущий незавершённый запрос.
      cancelInFlight()
      const controller = new AbortController()
      controllerRef.current = controller

      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setState({ status: 'loading' })

      try {
        const data = await analyzeRequest(trimmed, history, { signal: controller.signal })
        if (controller.signal.aborted || requestIdRef.current !== requestId) return
        setState({ status: 'success', data })
      } catch (error) {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return
        if (error instanceof AnalyzeRequestError) {
          setState({ status: 'error', error: { code: error.code, message: error.message } })
        } else {
          setState({
            status: 'error',
            error: { code: 'INTERNAL_ERROR', message: 'Не удалось выполнить анализ обращения.' },
          })
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
      }
    },
    [cancelInFlight],
  )

  const reset = useCallback(() => {
    cancelInFlight()
    requestIdRef.current += 1
    setState({ status: 'idle' })
  }, [cancelInFlight])

  return { ...state, analyze, reset }
}

/** Общая с сервером валидация длины: те же границы, что и в /api/ai. */
function validateQuery(query: string): AnalyzeErrorState | undefined {
  if (query.length === 0) {
    return { code: 'EMPTY_QUERY', message: 'Введите обращение клиента.' }
  }
  if (query.length < MIN_QUERY_LENGTH) {
    return {
      code: 'QUERY_TOO_SHORT',
      message: `Обращение слишком короткое. Опишите вопрос подробнее (минимум ${MIN_QUERY_LENGTH} символов).`,
    }
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return {
      code: 'QUERY_TOO_LONG',
      message: `Обращение слишком длинное (максимум ${MAX_QUERY_LENGTH} символов). Сократите текст и повторите.`,
    }
  }
  return undefined
}
