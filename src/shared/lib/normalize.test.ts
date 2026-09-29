import { describe, expect, it } from 'vitest'
import { normalizeText, tokenize } from './normalize'

describe('normalizeText', () => {
  it('приводит регистр и ё к единому виду', () => {
    expect(normalizeText('  ЁЖИК  ')).toBe('ежик')
  })

  it('убирает пунктуацию и лишние пробелы', () => {
    expect(normalizeText('Интеграция с CRM?! — да.')).toBe('интеграция с crm да')
  })

  it('сохраняет цифры', () => {
    expect(normalizeText('Команда из 12 человек')).toBe('команда из 12 человек')
  })
})

describe('tokenize', () => {
  it('выбрасывает стоп-слова и короткие токены', () => {
    const tokens = tokenize('Хотим подключить интеграцию с CRM')
    expect(tokens).not.toContain('хотим')
    expect(tokens).not.toContain('с')
    expect(tokens).toContain('crm')
  })

  it('возвращает пустой массив для пустой строки', () => {
    expect(tokenize('   ')).toEqual([])
  })

  it('сохраняет содержательное слово «работает» — оно есть в базе знаний', () => {
    expect(tokenize('не работает')).toContain('работает')
  })

  it('отбрасывает стоп-слово до стемминга', () => {
    expect(tokenize('этого тариф')).not.toContain('этого')
  })
})
