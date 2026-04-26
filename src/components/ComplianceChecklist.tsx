/**
 * Checklist des mentions obligatoires françaises avant validation d'une facture.
 *
 * Utilisation :
 *   - en mode "modal" devant le bouton "Valider la facture",
 *   - en mode "inline" sur la page de réglages pour pré-remplir.
 *
 * Source des règles : src/lib/compliance.ts (cf. docs/CONFORMITE_FACTURATION_FR.md).
 */
import React from 'react';
import type {
  ComplianceIssue,
  ComplianceReport,
  ComplianceSeverity,
} from '../lib/compliance';

export interface ComplianceChecklistProps {
  report: ComplianceReport;
  /** Affiché si tout est vert. */
  okMessage?: string;
  /** Permet de remonter un click vers la page de réglages / d'édition. */
  onFixClick?: (issue: ComplianceIssue) => void;
  className?: string;
}

const SEVERITY_ICON: Record<ComplianceSeverity, React.ReactNode> = {
  error: (
    <svg className="w-4 h-4 text-error shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 text-on-surface-variant shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const SEVERITY_LABEL: Record<ComplianceSeverity, string> = {
  error: 'Bloquant',
  warning: 'Recommandé',
  info: 'Suggéré',
};

export function ComplianceChecklist({ report, okMessage, onFixClick, className = '' }: ComplianceChecklistProps) {
  if (report.issues.length === 0) {
    return (
      <div className={`rounded-2xl bg-tertiary-container/50 border border-tertiary/30 p-4 flex items-start gap-3 ${className}`}>
        <svg className="w-5 h-5 text-tertiary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <div>
          <p className="text-sm font-bold text-on-tertiary-container">Toutes les mentions obligatoires sont présentes.</p>
          {okMessage && <p className="text-xs text-on-tertiary-container/80 mt-0.5">{okMessage}</p>}
        </div>
      </div>
    );
  }

  // Tri : erreurs d'abord, puis warnings, puis info.
  const order: ComplianceSeverity[] = ['error', 'warning', 'info'];
  const sorted = [...report.issues].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
  );

  return (
    <div className={`rounded-2xl bg-surface-container border border-outline-variant/30 ${className}`}>
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-bold text-on-surface tracking-tight">
          Conformité : {report.canValidate ? 'validation possible' : 'corrections requises'}
        </h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {report.canValidate
            ? "Aucun blocage. Quelques recommandations pour atteindre la conformité maximale."
            : "Impossible de valider tant qu'un point bloquant subsiste."}
        </p>
      </div>
      <ul className="divide-y divide-outline-variant/20">
        {sorted.map(issue => (
          <li key={issue.code} className="flex items-start gap-3 px-4 py-3">
            {SEVERITY_ICON[issue.severity]}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-on-surface">{issue.message}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded">
                  {SEVERITY_LABEL[issue.severity]}
                </span>
              </div>
              {issue.hint && (
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{issue.hint}</p>
              )}
              {onFixClick && (
                <button
                  type="button"
                  onClick={() => onFixClick(issue)}
                  className="text-xs font-bold text-primary hover:underline mt-1.5"
                >
                  Corriger →
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
