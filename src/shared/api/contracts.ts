/**
 * Единый контракт между UI, BFF-слоем (/api/ai) и AI-провайдерами.
 * Здесь только типы — секретов и runtime-кода нет, модуль безопасен для клиента.
 */

export type ChatRole = 'client' | 'manager'

export interface ConversationMessage {
  id: string
  role: ChatRole
  author: string
  time: string
  text: string
}

export interface KnowledgeUpsell {
  product: string
  conditions: string[]
  description: string
}

export interface KnowledgeItem {
  id: string
  title: string
  category: string
  content: string
  keywords: string[]
  upsell?: KnowledgeUpsell
}

export interface KnowledgeMatch {
  item: KnowledgeItem
  score: number
  matchedTerms: string[]
}

export interface AiAnalysisInput {
  /** Текущее обращение клиента. */
  query: string
  /** История диалога (может быть пустой). */
  history: ConversationMessage[]
  /** Только релевантные выдержки из базы знаний (top-N после retrieval). */
  knowledge: KnowledgeItem[]
}

export interface ManagerUpsell {
  recommended: boolean
  product?: string
  reason: string
  pitch?: string
}

export interface AiAnalysisResult {
  customerReply: string
  managerUpsell: ManagerUpsell
  usedKnowledgeIds: string[]
}

export interface AiProvider {
  readonly name: AiProviderName
  generateAnalysis(input: AiAnalysisInput): Promise<AiAnalysisResult>
}

export type AiProviderName = 'mock' | 'openai' | 'deepseek'

export interface AnalyzeSuccessResponse {
  provider: AiProviderName
  result: AiAnalysisResult
  knowledgeMatches: KnowledgeMatch[]
}

export type AnalyzeErrorCode =
  | 'EMPTY_QUERY'
  | 'QUERY_TOO_SHORT'
  | 'QUERY_TOO_LONG'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'MALFORMED_RESPONSE'
  | 'CONFIG_ERROR'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR'

/** Публичная информация о выбранном провайдере (без секретов) для индикатора в UI. */
export interface ProviderInfoResponse {
  provider: AiProviderName
  live: boolean
}

export interface AnalyzeErrorResponse {
  error: {
    code: AnalyzeErrorCode
    message: string
  }
}

/** Минимальная длина обращения: защищает от случайного «привет» вместо вопроса. */
export const MIN_QUERY_LENGTH = 5
