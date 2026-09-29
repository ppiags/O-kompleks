/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalyzeSuccessResponse } from '../../../shared/api/contracts'
import { useAnalyzeRequest } from './useAnalyzeRequest'

const successBody: AnalyzeSuccessResponse = {
  provider: 'mock',
  result: {
    customerReply: 'Здравствуйте! Тариф «Команда» — 12 900 ₽.',
    managerUpsell: { recommended: true, product: 'Аналитика', reason: 'Команда', pitch: 'Показать?' },
    usedKnowledgeIds: ['kb-tariffs'],
  },
  knowledgeMatches: [],
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

/** fetch, который не завершается сам и отклоняется только по AbortSignal. */
function abortableFetch(): AbortSignal[] {
  const signals: AbortSignal[] = []
  const impl = (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (signal) signals.push(signal)
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
  vi.stubGlobal('fetch', impl)
  return signals
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAnalyzeRequest', () => {
  it('стартует в состоянии idle', () => {
    const { result } = renderHook(() => useAnalyzeRequest())
    expect(result.current.status).toBe('idle')
  })

  it('не обращается к сети на пустом обращении', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    const { result } = renderHook(() => useAnalyzeRequest())
    await act(async () => {
      await result.current.analyze('   ')
    })
    expect(fetchStub).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('EMPTY_QUERY')
  })

  it('не обращается к сети на слишком коротком обращении', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    const { result } = renderHook(() => useAnalyzeRequest())
    await act(async () => {
      await result.current.analyze('ок')
    })
    expect(fetchStub).not.toHaveBeenCalled()
    expect(result.current.error?.code).toBe('QUERY_TOO_SHORT')
  })

  it('показывает loading, затем success', async () => {
    let resolveRequest: ((response: Response) => void) | undefined
    const fetchStub = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchStub)

    const { result } = renderHook(() => useAnalyzeRequest())
    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.analyze('Сколько стоит тариф для команды из 12 человек?')
    })
    expect(result.current.status).toBe('loading')

    await act(async () => {
      resolveRequest?.(jsonResponse(successBody))
      await pending
    })

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data?.result.customerReply).toContain('12 900')
  })

  it('переводит ошибку сервера в состояние error', async () => {
    const fetchStub = async () =>
      jsonResponse({ error: { code: 'PROVIDER_ERROR', message: 'Провайдер недоступен.' } }, 502)
    vi.stubGlobal('fetch', fetchStub)
    const { result } = renderHook(() => useAnalyzeRequest())
    await act(async () => {
      await result.current.analyze('Сколько стоит тариф для команды?')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('PROVIDER_ERROR')
  })

  it('reset отменяет незавершённый запрос и не даёт ему перезаписать состояние', async () => {
    const signals = abortableFetch()
    const { result } = renderHook(() => useAnalyzeRequest())

    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.analyze('Первый достаточно длинный запрос')
    })
    expect(result.current.status).toBe('loading')

    await act(async () => {
      result.current.reset()
      await pending
    })

    expect(result.current.status).toBe('idle')
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(true)
  })

  it('новый анализ отменяет предыдущий незавершённый запрос', async () => {
    const signals = abortableFetch()
    const { result } = renderHook(() => useAnalyzeRequest())

    act(() => {
      void result.current.analyze('Первый достаточно длинный запрос')
    })
    act(() => {
      void result.current.analyze('Второй достаточно длинный запрос')
    })

    expect(signals).toHaveLength(2)
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
    expect(result.current.status).toBe('loading')
  })

  it('reset возвращает состояние idle', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse(successBody))
    const { result } = renderHook(() => useAnalyzeRequest())
    await act(async () => {
      await result.current.analyze('Сколько стоит тариф для команды?')
    })
    expect(result.current.status).toBe('success')
    act(() => {
      result.current.reset()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})
