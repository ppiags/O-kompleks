import type { AiAnalysisResult } from '../../../shared/api/contracts'
import { CopyButton } from '../../../shared/ui/CopyButton'

export interface CustomerReplyCardProps {
  result: AiAnalysisResult
}

/** Готовый ответ клиенту — отдельная сущность, которую можно отправить как есть. */
export function CustomerReplyCard({ result }: CustomerReplyCardProps) {
  return (
    <section className="card card--reply" data-testid="customer-reply">
      <header className="card__header">
        <div>
          <h3 className="card__title">Ответ клиенту</h3>
          <p className="card__subtitle">Черновик — проверьте перед отправкой</p>
        </div>
        <CopyButton text={result.customerReply} label="Скопировать" testId="copy-reply" variant="solid" />
      </header>
      <p className="card__text">{result.customerReply}</p>
    </section>
  )
}
