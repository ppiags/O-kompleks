import { useCallback, useEffect, useState } from "react"
import type { ConversationMessage, ProviderInfoResponse } from "../shared/api/contracts"
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from "../shared/api/contracts"
import { CLIENT_PROFILE, INITIAL_HISTORY } from "../entities/conversation/model/presets"
import { ConversationPanel } from "../entities/conversation/ui/ConversationPanel"
import { AnalysisPanel } from "../features/analyze-request/ui/AnalysisPanel"
import { useAnalyzeRequest } from "../features/analyze-request/model/useAnalyzeRequest"
import { fetchProviderInfo } from "../features/analyze-request/api/analyzeClient"

const PROVIDER_LABELS: Record<ProviderInfoResponse["provider"], string> = {
  mock: "Mock",
  openai: "OpenAI",
  deepseek: "DeepSeek",
}

export function App() {
  const { status, data, error, analyze, reset } = useAnalyzeRequest()
  const [query, setQuery] = useState("")
  const [history, setHistory] = useState<ConversationMessage[]>(INITIAL_HISTORY)
  const [providerInfo, setProviderInfo] = useState<ProviderInfoResponse | undefined>(undefined)
  const [providerInfoFailed, setProviderInfoFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const info = await fetchProviderInfo()
      if (cancelled) return
      if (info) setProviderInfo(info)
      else setProviderInfoFailed(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const isValidationError =
    error?.code === "EMPTY_QUERY" || error?.code === "QUERY_TOO_SHORT" || error?.code === "QUERY_TOO_LONG"
  const analysisStatus = isValidationError ? "idle" : status

  const handleAnalyze = useCallback(() => {
    const trimmed = query.trim()
    const isSendable = trimmed.length >= MIN_QUERY_LENGTH && trimmed.length <= MAX_QUERY_LENGTH

    if (isSendable) {
      // Отправленное сообщение становится частью видимой истории, но в API уходит
      // только предыдущий контекст: текущий query передаётся отдельным полем.
      setHistory((previous) => [
        ...previous,
        {
          id: "msg-local-" + (previous.length + 1),
          role: "client",
          author: CLIENT_PROFILE.name + ", клиент",
          time: "сейчас",
          text: trimmed,
        },
      ])
    }

    void analyze(query, history)
  }, [analyze, history, query])

  const handleReset = useCallback(() => {
    setQuery("")
    setHistory(INITIAL_HISTORY)
    reset()
  }, [reset])

  const providerLabel = providerInfo
    ? PROVIDER_LABELS[providerInfo.provider]
    : providerInfoFailed
      ? "не определён"
      : "…"
  const liveSuffix = providerInfo?.live ? " (live)" : ""
  const knowledgeCount = data ? data.knowledgeMatches.length : 0

  return (
    <div className="app">
      <header className="app__header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            AI
          </span>
          <div>
            <h1 className="brand__title">CRM AI Assistant</h1>
            <p className="brand__subtitle">
              Ответ клиенту и подсказка по допродаже на основе локальной базы знаний
            </p>
          </div>
        </div>
        <span className="chip" data-testid="provider-status">
          AI provider: {providerLabel}
          {liveSuffix}
        </span>
      </header>

      <main className="app__body">
        <ConversationPanel
          query={query}
          history={history}
          validationError={isValidationError ? error?.message : undefined}
          isLoading={status === "loading"}
          canReset={query.length > 0 || status !== "idle"}
          onQueryChange={setQuery}
          onAnalyze={handleAnalyze}
          onReset={handleReset}
        />

        <section className="assistant" aria-label="AI Assistant">
          <div className="assistant__header">
            <h2 className="assistant__title">AI Assistant</h2>
            <span className="status-line" data-testid="status-line">
              AI provider: {providerLabel}
              {liveSuffix} · Knowledge matches: {knowledgeCount}
            </span>
          </div>
          <AnalysisPanel
            status={analysisStatus}
            result={data?.result}
            errorMessage={error?.message}
            knowledgeMatches={data?.knowledgeMatches ?? []}
          />
        </section>
      </main>
    </div>
  )
}
