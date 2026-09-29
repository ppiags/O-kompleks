import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MIN_QUERY_LENGTH,
  type AnalyzeErrorCode,
  type AnalyzeSuccessResponse,
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
  analyze: (query: string) => Promise<void>
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
    async (query: string) => {
      const trimmed = query.trim()

      if (trimmed.length === 0) {
        cancelInFlight()
        requestIdRef.current += 1
        setState({ status: 'error', error: { code: 'EMPTY_QUERY', message: 'Введите обращение клиента.' } })
        return
      }
      if (trimmed.length < MIN_QUERY_LENGTH) {
        cancelInFlight()
        requestIdRef.current += 1
        setState({
          status: 'error',
          error: {
            code: 'QUERY_TOO_SHORT',
            message: `Обращение слишком короткое. Опишите вопрос подробнее (минимум ${MIN_QUERY_LENGTH} символов).`,
          },
        })
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
        const data = await analyzeRequest(trimmed, { signal: controller.signal })
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
