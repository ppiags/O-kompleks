import type { ConversationMessage } from "../../../shared/api/contracts"
import { CLIENT_PROFILE, DEMO_PRESETS, INITIAL_HISTORY } from "../model/presets"

export interface ConversationPanelProps {
  query: string
  submittedQuery?: string
  validationError?: string
  isLoading: boolean
  canReset: boolean
  onQueryChange: (value: string) => void
  onAnalyze: () => void
  onReset: () => void
}

/** Левая область: карточка клиента, история диалога, ввод и быстрые сценарии. */
export function ConversationPanel({
  query,
  submittedQuery,
  validationError,
  isLoading,
  canReset,
  onQueryChange,
  onAnalyze,
  onReset,
}: ConversationPanelProps) {
  const history: ConversationMessage[] = submittedQuery
    ? [
        ...INITIAL_HISTORY,
        {
          id: "msg-submitted",
          role: "client",
          author: CLIENT_PROFILE.name + ", клиент",
          time: "сейчас",
          text: submittedQuery,
        },
      ]
    : INITIAL_HISTORY

  return (
    <section className="dialog" aria-label="Диалог с клиентом">
      <header className="dialog__header">
        <div className="client-card" data-testid="client-card">
          <span className="client-card__avatar" aria-hidden="true">
            {CLIENT_PROFILE.name.charAt(0)}
          </span>
          <div className="client-card__info">
            <p className="client-card__name">{CLIENT_PROFILE.name}</p>
            <p className="client-card__company">{CLIENT_PROFILE.company}</p>
          </div>
          <span className="badge badge--accent">{CLIENT_PROFILE.status}</span>
        </div>
        <dl className="client-meta">
          <div>
            <dt>Тариф</dt>
            <dd>{CLIENT_PROFILE.plan}</dd>
          </div>
          <div>
            <dt>Ответственный</dt>
            <dd>{CLIENT_PROFILE.owner}</dd>
          </div>
        </dl>
      </header>

      <div className="messages" data-testid="message-list">
        {history.map((message) => (
          <article key={message.id} className={"message message--" + message.role}>
            <header className="message__meta">
              <span>{message.author}</span>
              <time>{message.time}</time>
            </header>
            <p className="message__text">{message.text}</p>
          </article>
        ))}
      </div>

      <div className="presets">
        <p className="presets__label">Быстрые сценарии</p>
        <div className="presets__list">
          {DEMO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset"
              data-testid={"preset-" + preset.id}
              title={preset.hint}
              onClick={() => onQueryChange(preset.text)}
            >
              <span className="preset__label">{preset.label}</span>
              <span className="preset__hint">{preset.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="composer">
        <label className="composer__label" htmlFor="request-input">
          Новое обращение клиента
        </label>
        <textarea
          id="request-input"
          data-testid="request-input"
          className="composer__input"
          rows={4}
          value={query}
          placeholder="Вставьте обращение клиента…"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {validationError ? (
          <p className="composer__error" data-testid="validation-error" role="alert">
            {validationError}
          </p>
        ) : null}
        <div className="composer__actions">
          <button
            type="button"
            className="button button--primary"
            data-testid="analyze-button"
            onClick={onAnalyze}
            disabled={isLoading}
          >
            {isLoading ? "Анализируем…" : "Проанализировать обращение"}
          </button>
          <button type="button" className="button" data-testid="reset-button" onClick={onReset} disabled={!canReset}>
            Очистить
          </button>
        </div>
      </div>
    </section>
  )
}
