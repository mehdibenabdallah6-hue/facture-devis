/**
 * Journal d'événements (audit trail) d'une facture — lecture seule.
 *
 * Ces entrées proviennent de la collection `invoiceEvents`, écrite uniquement
 * côté serveur (api/invoice-validate, api/invoice-credit-note, api/invoice-event)
 * — voir docs/CONFORMITE_FACTURATION_FR.md.
 *
 * Le composant est volontairement léger : il prend la liste filtrée pour
 * l'invoice voulue et l'affiche en timeline. Pas de pagination — l'audit
 * trail d'une facture reste petit (typ. < 50 entrées sur sa durée de vie).
 */
import React from 'react';
import type { InvoiceEvent } from '../contexts/DataContext';

export interface InvoiceHistoryPanelProps {
  events: InvoiceEvent[];
  /** Affiché sous le titre. */
  subtitle?: string;
  className?: string;
  /** Limite l'affichage — utile sur mobile. */
  maxEntries?: number;
}

const TYPE_LABEL: Record<InvoiceEvent['type'], string> = {
  create: 'Brouillon créé',
  update: 'Modification',
  validate: 'Facture validée',
  send: 'Envoyée au client',
  mark_paid: 'Marquée payée',
  mark_unpaid: 'Marquée impayée',
  cancel: 'Annulée',
  credit_note_created: 'Avoir émis',
  export_pdf: 'Export PDF',
  export_facturx: 'Export Factur-X',
  pdp_send: 'Transmission PDP',
  pdp_status_update: 'Statut PDP mis à jour',
  view: 'Consultation',
  sign: 'Signature',
};

const TYPE_DOT_CLASS: Partial<Record<InvoiceEvent['type'], string>> = {
  validate: 'bg-primary',
  credit_note_created: 'bg-tertiary',
  mark_paid: 'bg-emerald-500',
  cancel: 'bg-error',
  pdp_send: 'bg-secondary',
  pdp_status_update: 'bg-secondary',
  sign: 'bg-primary',
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return iso;
  }
}

function formatMetadata(meta: Record<string, any> | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const keys = Object.keys(meta);
  if (keys.length === 0) return null;
  // Affichage simple "key: value" sur 2-3 entrées max.
  return keys
    .slice(0, 3)
    .map(k => {
      const v = meta[k];
      if (v == null) return null;
      if (typeof v === 'string' && v.length > 60) return `${k}: ${v.slice(0, 60)}…`;
      return `${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : v}`;
    })
    .filter(Boolean)
    .join(' · ');
}

export function InvoiceHistoryPanel({ events, subtitle, className = '', maxEntries }: InvoiceHistoryPanelProps) {
  if (events.length === 0) {
    return (
      <div className={`rounded-2xl bg-surface-container border border-outline-variant/30 p-4 ${className}`}>
        <h3 className="text-sm font-bold text-on-surface">Historique</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Aucun événement enregistré pour cette facture.
        </p>
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const visible = maxEntries ? sorted.slice(0, maxEntries) : sorted;
  const hidden = sorted.length - visible.length;

  return (
    <div className={`rounded-2xl bg-surface-container border border-outline-variant/30 ${className}`}>
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-bold text-on-surface tracking-tight">Historique</h3>
        {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      <ol className="px-4 pb-4 space-y-3">
        {visible.map(event => {
          const dotClass = TYPE_DOT_CLASS[event.type] || 'bg-on-surface-variant/40';
          const metaText = formatMetadata(event.metadata);
          return (
            <li key={event.id} className="flex items-start gap-3">
              <span className={`mt-1.5 w-2 h-2 rounded-full ${dotClass} shrink-0`} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-on-surface">
                    {TYPE_LABEL[event.type] || event.type}
                  </span>
                  <span className="text-[11px] text-on-surface-variant tabular-nums">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                {metaText && (
                  <p className="text-xs text-on-surface-variant mt-0.5 break-words">{metaText}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {hidden > 0 && (
        <p className="px-4 pb-4 -mt-2 text-xs text-on-surface-variant">
          + {hidden} événement{hidden > 1 ? 's' : ''} plus ancien{hidden > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
