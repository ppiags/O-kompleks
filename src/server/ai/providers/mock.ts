import type { AiAnalysisInput, AiAnalysisResult, AiProvider, KnowledgeItem, ManagerUpsell } from '../../../shared/api/contracts.js'
import { normalizeText } from '../../../shared/lib/normalize.js'

/** Явные признаки обращения в поддержку: допродажа здесь неуместна. */
const SUPPORT_SIGNALS = [
  'не работает',
  'не приходит',
  'не могу',
  'не получается',
  'сброс пароля',
  'сломалось',
  'ошибка',
  'проблема',
  'помогите',
  'баг',
]

/** Признаки, что клиенту действительно может быть полезна аналитика. */
const ANALYTICS_SIGNALS = /аналитик|эффективн|контрол|метрик|kpi|менеджер|команд/

const NO_DATA_REPLY = [
  'Здравствуйте!',
  '',
  'К сожалению, в базе знаний пока нет информации, которая точно отвечает на ваш вопрос. Я передал обращение профильному специалисту: он свяжется с вами и уточнит детали.',
  '',
  'Спасибо за понимание!',
].join('\n')

/**
 * Mock-провайдер для demo-режима. Не отдаёт один и тот же захардкоженный ответ:
 * собирает reply из фактически найденных статей и подбирает upsell по смыслу запроса.
 * Полностью детерминирован — удобно для unit- и E2E-тестов.
 */
export function createMockProvider(): AiProvider {
  return {
    name: 'mock',
    async generateAnalysis(input: AiAnalysisInput): Promise<AiAnalysisResult> {
      const normalizedQuery = normalizeText(input.query)
      const knowledge = input.knowledge

      if (knowledge.length === 0) {
        return {
          customerReply: NO_DATA_REPLY,
          managerUpsell: {
            recommended: false,
            reason:
              'Релевантных статей в базе знаний не найдено, а без подтверждённых фактов предлагать дополнительный продукт не стоит.',
          },
          usedKnowledgeIds: [],
        }
      }

      const isSupport = SUPPORT_SIGNALS.some((signal) => normalizedQuery.includes(signal))
      const customerReply = buildReply(knowledge, isSupport)
      const candidate = pickUpsellCandidate(knowledge, normalizedQuery)
      const usedKnowledgeIds = knowledge.map((item) => item.id)

      if (isSupport || candidate === undefined) {
        return {
          customerReply,
          managerUpsell: {
            recommended: false,
            reason: isSupport
              ? 'Обращение связано с решением проблемы, а не с расширением функциональности. Навязывать дополнительный продукт в такой ситуации не стоит.'
              : 'В найденных материалах нет подходящего дополнительного продукта, поэтому допродажу предлагать не стоит.',
          },
          usedKnowledgeIds,
        }
      }

      return { customerReply, managerUpsell: buildUpsell(candidate), usedKnowledgeIds }
    },
  }
}

function buildReply(knowledge: KnowledgeItem[], isSupport: boolean): string {
  const facts = knowledge.map((item) => `• ${item.title}: ${item.content}`).join('\n')

  if (isSupport) {
    return [
      'Здравствуйте! Спасибо, что написали.',
      '',
      'Уточняем информацию по вашему вопросу:',
      '',
      facts,
      '',
      'Чтобы помочь быстрее, опишите, пожалуйста, что именно происходит, — подключим специалиста поддержки.',
    ].join('\n')
  }

  return [
    'Здравствуйте! Спасибо за обращение.',
    '',
    'По вашему вопросу можем сообщить следующее:',
    '',
    facts,
    '',
    'Если нужно уточнить детали или условия — напишите, я помогу.',
  ].join('\n')
}

function pickUpsellCandidate(knowledge: KnowledgeItem[], normalizedQuery: string): KnowledgeItem | undefined {
  const withUpsell = knowledge.filter((item) => item.upsell !== undefined)
  if (withUpsell.length === 0) return undefined

  if (ANALYTICS_SIGNALS.test(normalizedQuery)) {
    const analytics = withUpsell.find((item) => item.upsell?.product.toLowerCase().includes('аналитик') === true)
    if (analytics) return analytics
  }

  return withUpsell[0]
}

function buildUpsell(item: KnowledgeItem): ManagerUpsell {
  const upsell = item.upsell
  if (!upsell) {
    return { recommended: false, reason: 'Подходящей допродажи не найдено.' }
  }

  return {
    recommended: true,
    product: upsell.product,
    reason: `Обращение клиента связано с темой «${item.title}». ${upsell.description} Предложение уместно, когда ${upsell.conditions.map(lowerFirst).join('; ')}.`,
    pitch: `Если будет полезно, можем также показать «${upsell.product}»: ${upsell.description}`,
  }
}

function lowerFirst(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1)
}
