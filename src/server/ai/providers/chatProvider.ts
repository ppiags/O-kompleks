import type { AiAnalysisInput, AiAnalysisResult, AiProvider, AiProviderName } from '../../../shared/api/contracts.js'
import { parseProviderResult } from '../parseProviderResult.js'
import { buildPromptMessages } from '../prompt.js'
import { requestChatCompletion } from './openaiCompatible.js'

export interface ChatProviderConfig {
  name: AiProviderName
  apiKey: string
  baseUrl: string
  model: string
  env: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}

/** Провайдер поверх OpenAI-совместимого chat completions. */
export function createChatProvider(config: ChatProviderConfig): AiProvider {
  return {
    name: config.name,
    async generateAnalysis(input: AiAnalysisInput): Promise<AiAnalysisResult> {
      const content = await requestChatCompletion({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        messages: buildPromptMessages(input),
        temperature: readNumber(config.env.AI_TEMPERATURE, 0.3),
        timeoutMs: readNumber(config.env.AI_REQUEST_TIMEOUT_MS, 30_000),
        fetchImpl: config.fetchImpl,
      })

      return parseProviderResult(content, input.knowledge)
    },
  }
}

function readNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim().length === 0) return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}
