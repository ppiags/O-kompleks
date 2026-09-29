import type { AiAnalysisResult, KnowledgeMatch } from "../../../shared/api/contracts"
import { KnowledgeMatches } from "../../../entities/knowledge/ui/KnowledgeMatches"
import type { AnalyzeStatus } from "../model/useAnalyzeRequest"
import { CustomerReplyCard } from "./CustomerReplyCard"
import { UpsellCard } from "./UpsellCard"

export interface AnalysisPanelProps {
  status: AnalyzeStatus
  result?: AiAnalysisResult
  errorMessage?: string
  knowledgeMatches: KnowledgeMatch[]
}

/** Правая область: idle / loading / error / success. */
export function AnalysisPanel({ status, result, errorMessage, knowledgeMatches }: AnalysisPanelProps) {
  if (status === "loading") {
    return (
      <div className="placeholder placeholder--loading" data-testid="loading">
        <span className="spinner" aria-hidden="true" />
        <p>Анализируем обращение и сверяемся с базой знаний…</p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="alert alert--error" data-testid="error-state" role="alert">
        <strong>Не удалось получить ответ</strong>
        <p>{errorMessage ?? "Попробуйте ещё раз."}</p>
      </div>
    )
  }

  if (status === "success" && result) {
    return (
      <div className="analysis">
        <CustomerReplyCard result={result} />
        <UpsellCard upsell={result.managerUpsell} />
        <KnowledgeMatches matches={knowledgeMatches} />
      </div>
    )
  }

  return (
    <div className="placeholder" data-testid="empty-state">
      <h3>AI Assistant</h3>
      <p>
        Выберите готовый сценарий или вставьте обращение клиента и нажмите «Проанализировать обращение». Ассистент
        сверится с локальной базой знаний и подготовит ответ клиенту и подсказку по допродаже.
      </p>
    </div>
  )
}
