import type { KnowledgeItem, KnowledgeMatch } from '../api/contracts'
import { normalizeText, tokenize } from './normalize'

/** Веса полей: заголовок и ключевые слова важнее длинного текста статьи. */
const FIELD_WEIGHTS = { title: 5, keywords: 4, category: 3, content: 1 } as const

/** Бонус за точное вхождение заголовка статьи в запрос. */
const TITLE_PHRASE_BONUS = 6

interface FieldMatch {
  count: number
  terms: string[]
}

function matchField(queryTokens: string[], text: string): FieldMatch {
  const textTokens = new Set(tokenize(text))
  const terms = queryTokens.filter((token) => textTokens.has(token))
  return { count: terms.length, terms }
}

function scoreItem(queryTokens: string[], normalizedQuery: string, item: KnowledgeItem): KnowledgeMatch {
  const title = matchField(queryTokens, item.title)
  const keywords = matchField(queryTokens, item.keywords.join(' '))
  const category = matchField(queryTokens, item.category)
  const content = matchField(queryTokens, item.content)

  let score =
    title.count * FIELD_WEIGHTS.title +
    keywords.count * FIELD_WEIGHTS.keywords +
    category.count * FIELD_WEIGHTS.category +
    content.count * FIELD_WEIGHTS.content

  const normalizedTitle = normalizeText(item.title)
  if (normalizedTitle.length > 0 && normalizedQuery.includes(normalizedTitle)) {
    score += TITLE_PHRASE_BONUS
  }

  const matchedTerms = Array.from(new Set([...title.terms, ...keywords.terms, ...category.terms, ...content.terms]))

  return { item, score, matchedTerms }
}

/**
 * Поиск по локальной базе знаний: совпадения по title/category/keywords/content,
 * взвешенный score, top-N. Полностью детерминирован и не требует vector DB.
 */
export function retrieveKnowledge(query: string, items: KnowledgeItem[], limit = 3): KnowledgeMatch[] {
  const normalizedQuery = normalizeText(query)
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  return items
    .map((item) => scoreItem(queryTokens, normalizedQuery, item))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, limit)
}
