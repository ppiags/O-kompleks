import type { ManagerUpsell } from '../../../shared/api/contracts'
import { CopyButton } from '../../../shared/ui/CopyButton'

export interface UpsellCardProps {
  upsell: ManagerUpsell
}

function buildPitchText(upsell: ManagerUpsell): string {
  return [upsell.product, upsell.reason, upsell.pitch].filter(Boolean).join('\n')
}

/** Внутренняя подсказка менеджеру: клиенту автоматически не отправляется. */
export function UpsellCard({ upsell }: UpsellCardProps) {
  if (!upsell.recommended) {
    return (
      <section className="card card--muted" data-testid="upsell-not-recommended">
        <header className="card__header">
          <div>
            <h3 className="card__title">Подсказка менеджеру</h3>
            <p className="card__subtitle">Допродажа не рекомендована</p>
          </div>
          <span className="badge badge--muted">Без допродажи</span>
        </header>
        <p className="card__text">{upsell.reason}</p>
      </section>
    )
  }

  return (
    <section className="card card--upsell" data-testid="upsell-block">
      <header className="card__header">
        <div>
          <h3 className="card__title">Подсказка менеджеру</h3>
          <p className="card__subtitle">Клиенту не отправляется автоматически</p>
        </div>
        <CopyButton text={buildPitchText(upsell)} label="Скопировать" testId="copy-pitch" />
      </header>
      <dl className="upsell">
        <div className="upsell__row">
          <dt>Допродажа</dt>
          <dd>{upsell.product}</dd>
        </div>
        <div className="upsell__row">
          <dt>Почему</dt>
          <dd>{upsell.reason}</dd>
        </div>
        <div className="upsell__row">
          <dt>Как предложить</dt>
          <dd>{upsell.pitch}</dd>
        </div>
      </dl>
    </section>
  )
}
