import { z } from 'zod'
import type { AiAnalysisResult } from '../../shared/api/contracts.js'

const nonEmptyString = z
  .string()
  .refine((value) => value.trim().length > 0, { message: 'Поле не может быть пустым' })

export const managerUpsellSchema = z.object({
  recommended: z.boolean(),
  product: z.string().optional(),
  reason: z.string().optional(),
  pitch: z.string().optional(),
})

export const aiAnalysisResultSchema = z.object({
  customerReply: nonEmptyString,
  managerUpsell: managerUpsellSchema,
  usedKnowledgeIds: z.array(z.string()).optional(),
})

const NO_UPSELL_REASON = 'Подходящей допродажи не найдено.'
const INCOMPLETE_UPSELL_REASON =
  'Модель не предложила конкретный продукт с обоснованием, поэтому допродажа не рекомендована.'

/**
 * Runtime-валидация ответа LLM. Модели доверять нельзя: malformed JSON,
 * лишние поля и пустые строки отсекаются здесь, до попадания в UI.
 *
 * Важно: основную ценность несёт customerReply. Неполную допродажу понижаем
 * до честного отказа, а не выбрасываем из-за неё весь ответ модели.
 */
export function parseAiAnalysisResult(raw: unknown): AiAnalysisResult {
  const parsed = aiAnalysisResultSchema.parse(raw)
  const usedKnowledgeIds = Array.from(new Set(parsed.usedKnowledgeIds ?? []))
  const upsell = parsed.managerUpsell
  const customerReply = parsed.customerReply.trim()

  const product = upsell.product?.trim()
  const reason = upsell.reason?.trim() ?? ''
  const pitch = upsell.pitch?.trim()

  if (upsell.recommended && product && reason.length > 0) {
    return {
      customerReply,
      managerUpsell: {
        recommended: true,
        product,
        reason,
        pitch: pitch && pitch.length > 0 ? pitch : undefined,
      },
      usedKnowledgeIds,
    }
  }

  const fallbackReason = reason.length > 0 ? reason : upsell.recommended ? INCOMPLETE_UPSELL_REASON : NO_UPSELL_REASON

  return {
    customerReply,
    managerUpsell: { recommended: false, reason: fallbackReason },
    usedKnowledgeIds,
  }
}
