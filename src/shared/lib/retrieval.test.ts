import { describe, expect, it } from 'vitest'
import type { KnowledgeItem } from '../api/contracts'
import knowledgeBase from '../data/knowledge-base.json'
import { retrieveKnowledge } from './retrieval'

const kb = knowledgeBase as KnowledgeItem[]

describe('retrieveKnowledge', () => {
  it('поднимает релевантную статью выше нерелевантных', () => {
    const matches = retrieveKnowledge('Нужна интеграция с CRM', kb)
    expect(matches[0]?.item.id).toBe('kb-crm-integration')
  })

  it('возвращает пустой список для пустого запроса', () => {
    expect(retrieveKnowledge('   ', kb)).toEqual([])
  })

  it('находит статью про CRM по запросу про CRM', () => {
    const ids = retrieveKnowledge('Как настроить интеграцию с CRM?', kb).map((m) => m.item.id)
    expect(ids).toContain('kb-crm-integration')
  })

  it('находит upsell-запись по запросу про команду и аналитику', () => {
    const matches = retrieveKnowledge('Хотим аналитику по работе команды менеджеров', kb)
    expect(matches.map((m) => m.item.id)).toContain('kb-analytics')
    const withUpsell = matches.find((m) => m.item.upsell !== undefined)
    expect(withUpsell).toBeDefined()
    expect(matches[0]?.item.id).toBe('kb-analytics')
  })

  it('находит тарифы по вопросу о цене', () => {
    const matches = retrieveKnowledge('Сколько стоит тариф для команды', kb)
    expect(matches.map((m) => m.item.id)).toContain('kb-tariffs')
  })

  it('находит обучение по запросу про обучение', () => {
    const ids = retrieveKnowledge('Проводите ли вы обучение для новых сотрудников?', kb).map((m) => m.item.id)
    expect(ids).toContain('kb-training')
  })

  it('ограничивает выдачу тремя статьями', () => {
    const matches = retrieveKnowledge('тариф команда интеграция crm обучение поддержка аналитика', kb)
    expect(matches.length).toBeLessThanOrEqual(3)
  })

  it('не возвращает совпадений для запроса без общих терминов', () => {
    expect(retrieveKnowledge('абракадабра ксилофон зюйдвест', kb)).toEqual([])
  })

  it('детерминирован при равном счёте: tie-break по id не зависит от порядка входа', () => {
    const make = (id: string): KnowledgeItem => ({
      id,
      title: 'Синтетическая статья',
      category: 'Тест',
      content: 'синтетика',
      keywords: ['тарификатор'],
    })
    const alpha = make('kb-a')
    const beta = make('kb-b')
    expect(retrieveKnowledge('тарификатор', [beta, alpha]).map((m) => m.item.id)).toEqual(['kb-a', 'kb-b'])
    expect(retrieveKnowledge('тарификатор', [alpha, beta]).map((m) => m.item.id)).toEqual(['kb-a', 'kb-b'])
  })

  it('находит статью поддержки по короткому запросу «не работает»', () => {
    expect(retrieveKnowledge('не работает', kb).map((m) => m.item.id)).toContain('kb-support')
  })

  it('возвращает ненулевой score и совпавшие термины у найденной статьи', () => {
    const [match] = retrieveKnowledge('Нужна интеграция с CRM', kb)
    expect(match.score).toBeGreaterThan(0)
    expect(match.matchedTerms.length).toBeGreaterThan(0)
  })
})
