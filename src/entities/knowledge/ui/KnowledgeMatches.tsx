import type { KnowledgeMatch } from '../../../shared/api/contracts'

export interface KnowledgeMatchesProps {
  matches: KnowledgeMatch[]
}

/** Показывает, какие именно статьи базы знаний подкрепляют ответ. */
export function KnowledgeMatches({ matches }: KnowledgeMatchesProps) {
  return (
    <section className="knowledge" data-testid="knowledge-matches">
      <h3 className="knowledge__title">Найдено в базе знаний</h3>
      {matches.length === 0 ? (
        <p className="knowledge__empty">Совпадений не найдено — модель обязана честно сказать об этом клиенту.</p>
      ) : (
        <ul className="knowledge__list">
          {matches.map((match) => (
            <li key={match.item.id} className="knowledge__item">
              <span className="badge">{match.item.title}</span>
              <span className="knowledge__meta">
                {match.item.category} · релевантность {match.score}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
