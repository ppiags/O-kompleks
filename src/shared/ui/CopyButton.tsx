import { useCallback, useEffect, useRef, useState } from 'react'

export interface CopyButtonProps {
  text: string
  label: string
  testId?: string
  variant?: 'ghost' | 'solid'
}

type CopyStatus = 'idle' | 'copied' | 'failed'

const FEEDBACK_TIMEOUT_MS = 2500

/** Копирование с честной обработкой отказа clipboard и без падения UI. */
export function CopyButton({ text, label, testId, variant = 'ghost' }: CopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>('idle')
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const handleClick = useCallback(() => {
    void (async () => {
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
          throw new Error('clipboard unavailable')
        }
        await navigator.clipboard.writeText(text)
        setStatus('copied')
      } catch {
        setStatus('failed')
      }

      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setStatus('idle'), FEEDBACK_TIMEOUT_MS)
    })()
  }, [text])

  const visibleLabel = status === 'copied' ? 'Скопировано' : status === 'failed' ? 'Не удалось скопировать' : label

  return (
    <button
      type="button"
      className={`copy-button copy-button--${variant}`}
      onClick={handleClick}
      data-testid={testId}
      aria-label={label}
    >
      {visibleLabel}
    </button>
  )
}
