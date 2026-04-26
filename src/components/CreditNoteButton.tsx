/**
 * Bouton "Créer un avoir" — disponible uniquement sur une facture
 * verrouillée (isLocked) qui n'a pas déjà fait l'objet d'un avoir.
 *
 * Demande une raison (obligatoire pour la traçabilité — l'API la
 * persiste dans `invoiceEvents.metadata.reason`), puis appelle
 * `createCreditNote(id, reason)` qui POST /api/invoice-credit-note.
 */
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import type { Invoice } from '../contexts/DataContext';

export interface CreditNoteButtonProps {
  invoice: Invoice;
  /** Appelé après création réussie. */
  onCreated?: (creditNoteId: string, number: string) => void;
  className?: string;
  /** Cache le bouton si la facture n'est pas éligible. Utile dans les listes. */
  hideWhenIneligible?: boolean;
}

export function CreditNoteButton({
  invoice,
  onCreated,
  className = '',
  hideWhenIneligible,
}: CreditNoteButtonProps) {
  const { createCreditNote } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Éligibilité : facture validée, pas un avoir, pas déjà créditée.
  const eligible =
    invoice.type === 'invoice' &&
    invoice.isLocked === true &&
    !invoice.creditedBy;

  if (!eligible) {
    if (hideWhenIneligible) return null;
    if (invoice.creditedBy) {
      return (
        <span className={`text-xs text-on-surface-variant ${className}`}>
          Avoir déjà émis
        </span>
      );
    }
    return null;
  }

  const handleSubmit = async () => {
    if (reason.trim().length < 3) {
      setError('Précisez une raison (3 caractères minimum).');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { creditNoteId, number } = await createCreditNote(invoice.id, reason.trim());
      setIsOpen(false);
      setReason('');
      onCreated?.(creditNoteId, number);
    } catch (e: any) {
      setError(e?.message || "Échec de la création de l'avoir. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-3 rounded-xl bg-tertiary-container text-on-tertiary-container font-bold text-sm hover:opacity-90 transition ${className}`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        Créer un avoir
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-surface-container-lowest w-full md:max-w-md md:rounded-3xl shadow-xl rounded-t-3xl"
          >
            <div className="p-5 md:p-6 space-y-4">
              <header className="space-y-1">
                <h2 className="font-headline text-xl font-extrabold text-on-surface tracking-tight">
                  Créer un avoir
                </h2>
                <p className="text-sm text-on-surface-variant">
                  L'avoir reprendra les lignes de la facture <strong>{invoice.number || invoice.id}</strong> avec
                  des montants négatifs. Il sera émis avec son propre numéro légal (série AV).
                </p>
              </header>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Raison (obligatoire)
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex. Erreur de quantité, prestation annulée…"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="text-[11px] text-on-surface-variant">
                  Cette raison sera enregistrée dans le journal d'audit.
                </p>
              </div>

              {error && (
                <div className="rounded-xl bg-error-container text-on-error-container border border-error/30 p-3 text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse md:flex-row gap-2 md:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-tertiary text-on-tertiary font-bold text-sm disabled:opacity-50"
                >
                  {submitting ? 'Création…' : 'Créer l\'avoir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
