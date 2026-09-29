import type { AiAnalysisResult, KnowledgeItem } from '../../shared/api/contracts'
import { AiError } from './errors'
import { parseAiAnalysisResult } from './schema'

const CODE_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i

function stripCodeFence(content: string): string {
  const trimmed = content.trim()
  const fenced = CODE_FENCE.exec(trimmed)
  return fenced ? fenced[1].trim() : trimmed
}

/**
 * Превращает сырой ответ LLM в валидный AiAnalysisResult.
 * Любой мусор (не JSON, отсутствующие поля) — это MALFORMED_RESPONSE,
 * а не падение serverless-функции.
 */
export function parseProviderResult(content: string, knowledge: KnowledgeItem[]): AiAnalysisResult {
  let raw: unknown
  try {
    raw = JSON.parse(stripCodeFence(content))
  } catch (error) {
    throw new AiError('MALFORMED_RESPONSE', 'Модель вернула ответ не в формате JSON. Попробуйте ещё раз.', { cause: error })
  }

  let parsed: AiAnalysisResult
  try {
    parsed = parseAiAnalysisResult(raw)
  } catch (error) {
    throw new AiError('MALFORMED_RESPONSE', 'Ответ модели не прошёл проверку структуры. Попробуйте ещё раз.', { cause: error })
  }

  const allowed = new Set(knowledge.map((item) => item.id))
  return { ...parsed, usedKnowledgeIds: parsed.usedKnowledgeIds.filter((id) => allowed.has(id)) }
}
