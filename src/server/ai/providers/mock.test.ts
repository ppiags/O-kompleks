import { describe, expect, it } from 'vitest'
import type { AiAnalysisInput, KnowledgeItem } from '../../../shared/api/contracts'
import knowledgeBase from '../../../shared/data/knowledge-base.json'
import { retrieveKnowledge } from '../../../shared/lib/retrieval'
import { createMockProvider } from './mock'

const kb = knowledgeBase as KnowledgeItem[]

function inputFor(query: string): AiAnalysisInput {
  return { query, history: [], knowledge: retrieveKnowledge(query, kb).map((m) => m.item) }
}

const provider = createMockProvider()

describe('MockAiProvider', () => {
  it('называет себя mock', () => {
    expect(provider.name).toBe('mock')
  })

  it('для сценария «команда + CRM» отвечает по тарифам и CRM', async () => {
    const input = inputFor(
      'Здравствуйте. Хотим подключить ваш тариф для команды из 12 человек. Нужна интеграция с CRM. Сколько будет стоить и как быстро можно начать?',
    )
    const result = await provider.generateAnalysis(input)
    expect(result.customerReply).toContain('CRM')
    expect(result.customerReply).toContain('₽')
    expect(result.managerUpsell.recommended).toBe(true)
    expect(result.managerUpsell.product).toBeTruthy()
    expect(result.usedKnowledgeIds.length).toBeGreaterThan(0)
  })

  it('предлагает аналитику, когда речь о команде менеджеров', async () => {
    const result = await provider.generateAnalysis(inputFor('Хотим аналитику по работе команды менеджеров'))
    expect(result.managerUpsell.recommended).toBe(true)
    expect(result.managerUpsell.product).toContain('аналитик')
  })

  it('для вопроса про обучение отвечает по обучению и предлагает релевантный продукт', async () => {
    const result = await provider.generateAnalysis(
      inputFor('Подскажите, вы проводите обучение для новых сотрудников? У нас отдел продаж 5 человек.'),
    )
    expect(result.customerReply.toLowerCase()).toContain('обучен')
    expect(result.managerUpsell.recommended).toBe(true)
    expect(result.managerUpsell.product).toBeTruthy()
  })

  it('честно отказывается от допродажи при обращении в поддержку', async () => {
    const result = await provider.generateAnalysis(
      inputFor('Здравствуйте, у меня не работает вход в личный кабинет, письмо для сброса пароля не приходит. Помогите, пожалуйста.'),
    )
    expect(result.managerUpsell.recommended).toBe(false)
    expect(result.managerUpsell.product).toBeUndefined()
    expect(result.managerUpsell.reason).toMatch(/навязыв|не стоит|не умест/i)
  })

  it('без найденных статей честно сообщает об отсутствии информации', async () => {
    const result = await provider.generateAnalysis({ query: 'абракадабра ксилофон', history: [], knowledge: [] })
    expect(result.customerReply).toMatch(/нет информации|не располагаем|уточн/i)
    expect(result.managerUpsell.recommended).toBe(false)
    expect(result.usedKnowledgeIds).toEqual([])
  })

  it('не смешивает подсказку менеджеру с ответом клиенту', async () => {
    const result = await provider.generateAnalysis(
      inputFor('Хотим подключить тариф для команды из 12 человек, нужна интеграция с CRM'),
    )
    expect(result.managerUpsell.pitch).toBeTruthy()
    expect(result.customerReply).not.toContain(result.managerUpsell.pitch as string)
  })

  it('оформляет причину допродажи грамматично (каждое условие со строчной буквы)', async () => {
    const result = await provider.generateAnalysis(
      inputFor('Хотим подключить тариф для команды из 12 человек, нужна интеграция с CRM'),
    )
    expect(result.managerUpsell.reason).toBeTruthy()
    expect(result.managerUpsell.reason).not.toMatch(/;\s*[А-ЯЁ]/)
  })

  it('возвращает разные ответы на разные обращения (не hardcode)', async () => {
    const first = await provider.generateAnalysis(inputFor('Сколько стоит тариф для команды из 12 человек?'))
    const second = await provider.generateAnalysis(inputFor('Проводите ли вы обучение для новых сотрудников?'))
    expect(first.customerReply).not.toBe(second.customerReply)
  })

  it('детерминирован: одинаковый вход даёт одинаковый выход', async () => {
    const input = inputFor('Нужна интеграция с CRM')
    const first = await provider.generateAnalysis(input)
    const second = await provider.generateAnalysis(input)
    expect(first).toEqual(second)
  })

  it('использует только переданные knowledge id', async () => {
    const input = inputFor('Нужна интеграция с CRM')
    const allowed = new Set(input.knowledge.map((item) => item.id))
    const result = await provider.generateAnalysis(input)
    for (const id of result.usedKnowledgeIds) expect(allowed.has(id)).toBe(true)
  })
})
