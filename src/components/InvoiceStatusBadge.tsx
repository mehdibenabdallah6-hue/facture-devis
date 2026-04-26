/**
 * Source unique pour l'affichage du statut + type d'une facture.
 *
 * Pourquoi un composant dédié :
 *   - on distingue désormais `draft` / `validated` / `sent` / `paid` / etc.
 *     ainsi que le type `credit` (avoir) ;
 *   - une facture `isLocked` doit toujours afficher un cadenas, peu importe
 *     son statut courant (paid, sent…) ;
 *   - on évite la duplication des couleurs Tailwind/MD3 dans chaque page.
 */
import React from 'react';
import type { Invoice } from '../contexts/DataContext';

export interface InvoiceStatusBadgeProps {
  invoice: Pick<Invoice, 'type' | 'status' | 'isLocked'> & Partial<Pick<Invoice, 'dueDate'>>;
  /** Plus dense — pour les listes mobiles. */
  compact?: boolean;
  className?: string;
}

interface BadgeStyle {
  label: string;
  classes: string;
}

export function getEffectiveInvoiceStatus(
  invoice: Pick<Invoice, 'type' | 'status'> & Partial<Pick<Invoice, 'dueDate'>>
): Invoice['status'] {
  if (
    invoice.type === 'invoice' &&
    (invoice.status === 'sent' || invoice.status === 'validated') &&
    invoice.dueDate
  ) {
    const due = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    if (!Number.isNaN(due.getTime()) && due < today) {
      return 'overdue';
    }
  }
  return invoice.status;
}

function getBadgeStyle(invoice: InvoiceStatusBadgeProps['invoice']): BadgeStyle {
  // Avoir : prioritaire sur le statut. Un avoir est par nature validé.
  if (invoice.type === 'credit') {
    return {
      label: 'Avoir',
      classes:
        'bg-tertiary-container text-on-tertiary-container border border-tertiary/30',
    };
  }

  switch (getEffectiveInvoiceStatus(invoice)) {
    case 'paid':
      return {
        label: 'Payée',
        classes:
          'bg-tertiary-container text-on-tertiary-container border border-tertiary/20',
      };
    case 'sent':
      return {
        label: 'Envoyée',
        classes:
          'bg-secondary-container text-on-secondary-container border border-secondary/20',
      };
    case 'overdue':
      return {
        label: 'En retard',
        classes:
          'bg-error-container text-on-error-container border border-error/20',
      };
    case 'cancelled':
      return {
        label: 'Annulée',
        classes:
          'bg-surface-container-high text-on-surface-variant border border-outline-variant/30 line-through',
      };
    case 'accepted':
      return {
        label: 'Accepté',
        classes:
          'bg-primary-container text-on-primary-container border border-primary/20',
      };
    case 'converted':
      return {
        label: 'Converti',
        classes:
          'bg-tertiary-container text-tertiary border border-tertiary/20 opacity-70',
      };
    case 'validated':
      return {
        label: 'Validée',
        classes:
          'bg-primary-container text-on-primary-container border border-primary/30',
      };
    case 'draft':
    default:
      return {
        label: 'Brouillon',
        classes:
          'bg-surface-container-high text-on-surface-variant border border-outline-variant/30',
      };
  }
}

export function InvoiceStatusBadge({ invoice, compact, className = '' }: InvoiceStatusBadgeProps) {
  const { label, classes } = getBadgeStyle(invoice);
  const effectiveStatus = getEffectiveInvoiceStatus(invoice);
  const dotClass =
    invoice.type === 'credit'
      ? 'bg-tertiary'
      : effectiveStatus === 'paid'
        ? 'bg-emerald-500'
        : effectiveStatus === 'sent'
          ? 'bg-amber-400'
          : effectiveStatus === 'overdue'
            ? 'bg-red-500'
            : 'bg-on-surface-variant/40';
  const padding = compact ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const text = compact ? 'text-[10px]' : 'text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} rounded-lg ${text} font-bold uppercase tracking-wider ${classes} ${className}`}
    >
      {invoice.isLocked && (
        <svg
          aria-label="Verrouillée"
          className="w-3 h-3 -ml-0.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      )}
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

/**
 * Helper pour les exports CSV — renvoie le label sans markup.
 */
export function getInvoiceStatusLabel(invoice: Pick<Invoice, 'type' | 'status'> & Partial<Pick<Invoice, 'dueDate'>>): string {
  return getBadgeStyle({ ...invoice, isLocked: false }).label;
}
