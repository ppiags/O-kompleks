import { describe, expect, it } from 'vitest'
import { parseAiAnalysisResult } from './schema'

const valid = {
  customerReply: 'Здравствуйте! Тариф «Команда» стоит 12 900 ₽ в месяц.',
  managerUpsell: {
    recommended: true,
    product: 'Расширенная аналитика',
    reason: 'В команде несколько менеджеров.',
    pitch: 'Можем показать модуль аналитики.',
  },
  usedKnowledgeIds: ['kb-tariffs', 'kb-tariffs'],
}

describe('parseAiAnalysisResult', () => {
  it('принимает корректный ответ модели', () => {
    const result = parseAiAnalysisResult(valid)
    expect(result.customerReply).toContain('12 900')
    expect(result.managerUpsell.product).toBe('Расширенная аналитика')
  })

  it('дедуплицирует usedKnowledgeIds', () => {
    const result = parseAiAnalysisResult(valid)
    expect(result.usedKnowledgeIds).toEqual(['kb-tariffs'])
  })

  it('отклоняет ответ без customerReply', () => {
    const { customerReply: _omitted, ...rest } = valid
    expect(() => parseAiAnalysisResult(rest)).toThrow()
  })

  it('отклоняет пустой customerReply', () => {
    expect(() => parseAiAnalysisResult({ ...valid, customerReply: '   ' })).toThrow()
  })

  it('отклоняет неверный тип recommended', () => {
    expect(() =>
      parseAiAnalysisResult({ ...valid, managerUpsell: { ...valid.managerUpsell, recommended: 'yes' } }),
    ).toThrow()
  })

  it('не теряет ответ клиенту, если модель вернула recommended:false без reason', () => {
    const result = parseAiAnalysisResult({ ...valid, managerUpsell: { recommended: false } })
    expect(result.customerReply).toContain('12 900')
    expect(result.managerUpsell.recommended).toBe(false)
    expect(result.managerUpsell.reason.trim().length).toBeGreaterThan(0)
  })

  it('понижает рекомендацию без product до отказа от допродажи', () => {
    const result = parseAiAnalysisResult({
      ...valid,
      managerUpsell: { recommended: true, reason: 'Команде нужна аналитика.' },
    })
    expect(result.managerUpsell.recommended).toBe(false)
    expect(result.customerReply).toContain('12 900')
    expect(result.managerUpsell.reason.trim().length).toBeGreaterThan(0)
  })

  it('понижает рекомендацию с пустым reason до отказа', () => {
    const result = parseAiAnalysisResult({
      ...valid,
      managerUpsell: { recommended: true, product: 'Расширенная аналитика', reason: '   ' },
    })
    expect(result.managerUpsell.recommended).toBe(false)
  })

  it('убирает product и pitch, когда допродажа не рекомендована', () => {
    const result = parseAiAnalysisResult({
      ...valid,
      managerUpsell: { recommended: false, product: 'Лишнее', pitch: 'Лишнее', reason: 'Не уместно.' },
    })
    expect(result.managerUpsell.product).toBeUndefined()
    expect(result.managerUpsell.pitch).toBeUndefined()
    expect(result.managerUpsell.reason).toBe('Не уместно.')
  })

  it('подставляет пустой список, если usedKnowledgeIds не передан', () => {
    const result = parseAiAnalysisResult({ ...valid, usedKnowledgeIds: undefined })
    expect(result.usedKnowledgeIds).toEqual([])
  })
})
