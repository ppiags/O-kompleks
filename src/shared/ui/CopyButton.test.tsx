/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyButton } from './CopyButton'

function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CopyButton', () => {
  it('копирует переданный текст', async () => {
    const writeText = vi.fn(async () => undefined)
    stubClipboard(writeText)
    render(<CopyButton text="Готовый ответ" label="Скопировать" />)
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }))
    expect(writeText).toHaveBeenCalledWith('Готовый ответ')
    expect(await screen.findByText('Скопировано')).toBeInTheDocument()
  })

  it('сообщает об ошибке копирования без падения', async () => {
    stubClipboard(async () => {
      throw new Error('clipboard denied')
    })
    render(<CopyButton text="Готовый ответ" label="Скопировать" />)
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }))
    expect(await screen.findByText('Не удалось скопировать')).toBeInTheDocument()
  })

  it('не падает, если clipboard API недоступен', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    render(<CopyButton text="Готовый ответ" label="Скопировать" />)
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }))
    expect(await screen.findByText('Не удалось скопировать')).toBeInTheDocument()
  })
})
