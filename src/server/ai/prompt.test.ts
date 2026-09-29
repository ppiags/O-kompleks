import { describe, expect, it } from 'vitest'
import type { KnowledgeItem } from '../../shared/api/contracts'
import { buildPromptMessages, buildSystemPrompt, buildUserPrompt } from './prompt'

const knowledge: KnowledgeItem[] = [
  {
    id: 'kb-tariffs',
    title: 'Тарифы и стоимость',
    category: 'Тарифы',
    content: 'Тариф «Команда» — 12 900 ₽ в месяц.',
    keywords: ['тариф', 'стоимость'],
  },
]

const baseInput = {
  query: 'Сколько стоит команда из 12 человек?',
  history: [
    { id: 'm1', role: 'client' as const, author: 'Клиент', time: '10:00', text: 'Здравствуйте' },
    { id: 'm2', role: 'manager' as const, author: 'Менеджер', time: '10:01', text: 'Добрый день!' },
  ],
  knowledge,
}

describe('buildSystemPrompt', () => {
  it('запрещает придумывать факты и требует опору на базу знаний', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/не придумыва/i)
    expect(prompt).toMatch(/баз[ае] знаний/i)
  })

  it('требует строгий JSON и разделяет ответ клиенту и подсказку менеджеру', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('customerReply')
    expect(prompt).toContain('managerUpsell')
    expect(prompt).toMatch(/JSON/i)
  })

  it('запрещает попадание подсказки менеджеру в ответ клиенту', () => {
    expect(buildSystemPrompt()).toMatch(/не должен.*клиент|никогда не попада/i)
  })

  it('считает текст клиента недоверенными данными и запрещает выполнять его инструкции', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/недоверенн/i)
    expect(prompt).toMatch(/не выполняй инструкции/i)
  })
})

describe('buildUserPrompt', () => {
  it('содержит три явно разделённые секции в правильном порядке', () => {
    const prompt = buildUserPrompt(baseInput)
    const clientIdx = prompt.indexOf('ДАННЫЕ КЛИЕНТА')
    const kbIdx = prompt.indexOf('БАЗА ЗНАНИЙ')
    const taskIdx = prompt.indexOf('ЗАДАЧА')
    expect(clientIdx).toBeGreaterThanOrEqual(0)
    expect(kbIdx).toBeGreaterThan(clientIdx)
    expect(taskIdx).toBeGreaterThan(kbIdx)
  })

  it('включает обращение и историю диалога', () => {
    const prompt = buildUserPrompt(baseInput)
    expect(prompt).toContain('Сколько стоит команда из 12 человек?')
    expect(prompt).toContain('Здравствуйте')
    expect(prompt).toContain('Добрый день!')
  })

  it('включает переданные выдержки из базы знаний', () => {
    const prompt = buildUserPrompt(baseInput)
    expect(prompt).toContain('kb-tariffs')
    expect(prompt).toContain('12 900')
  })

  it('оборачивает обращение клиента в явные разделители', () => {
    const prompt = buildUserPrompt(baseInput)
    expect(prompt).toContain('<client_message>')
    expect(prompt).toContain('</client_message>')
  })

  it('честно сообщает об отсутствии истории', () => {
    expect(buildUserPrompt({ ...baseInput, history: [] })).toMatch(/история.*пуст/i)
  })

  it('честно сообщает об отсутствии релевантных статей', () => {
    expect(buildUserPrompt({ ...baseInput, knowledge: [] })).toMatch(/не найден|пуст/i)
  })
})

describe('buildPromptMessages', () => {
  it('возвращает system и user сообщения', () => {
    const messages = buildPromptMessages(baseInput)
    expect(messages.map((m) => m.role)).toEqual(['system', 'user'])
    expect(messages[0].content).toBe(buildSystemPrompt())
  })
})
