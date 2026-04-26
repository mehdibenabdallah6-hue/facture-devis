/**
 * Bouton "Valider la facture" — orchestre la chaîne :
 *   1. exécuter `checkInvoiceCompliance` côté client,
 *   2. si bloquant → afficher la checklist, refuser de partir,
 *   3. sinon → appeler `validateInvoice(id)` qui POST /api/invoice-validate,
 *   4. afficher le numéro légal renvoyé par le serveur.
 *
 * On garde la logique réseau dans DataContext (callApi + validateInvoice)
 * pour que ce composant reste UI-only et puisse être réutilisé partout
 * (page édition, liste, détail).
 */
import React, { useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import type { Invoice } from '../contexts/DataContext';
import { checkInvoiceCompliance } from '../lib/compliance';
import { ComplianceChecklist } from './ComplianceChecklist';

export interface ValidateInvoiceButtonProps {
  invoice: Invoice;
  /** Appelé après succès, avec le numéro assigné. */
  onValidated?: (assignedNumber: string) => void;
  /** Override du libellé du bouton. */
  label?: string;
  className?: string;
}

export function ValidateInvoiceButton({
  invoice,
  onValidated,
  label = 'Valider la facture',
  className = '',
}: ValidateInvoiceButtonProps) {
  const { company, clients, validateInvoice } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(
    () => clients.find(c => c.id === invoice.clientId) || null,
    [clients, invoice.clientId]
  );

  const report = useMemo(
    () => checkInvoiceCompliance(invoice, company, client),
    [invoice, company, client]
  );

  // Une facture déjà verrouillée ne peut pas être re-validée.
  if (invoice.isLocked) {
    return (
      <span className={`inline-flex items-center gap-2 text-sm text-on-surface-variant ${className}`}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Facture verrouillée — n° {invoice.number}
      </span>
    );
  }

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { number } = await validateInvoice(invoice.id);
      setIsOpen(false);
      onValidated?.(number);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la validation. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-sm hover:shadow transition disabled:opacity-50 ${className}`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {label}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-surface-container-lowest w-full md:max-w-lg md:rounded-3xl shadow-xl max-h-[90vh] overflow-y-auto rounded-t-3xl"
          >
            <div className="p-5 md:p-6 space-y-4">
              <header className="space-y-1">
                <h2 className="font-headline text-xl font-extrabold text-on-surface tracking-tight">
                  Valider la facture
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Une fois validée, la facture sera <strong>scellée</strong>. Toute correction devra
                  passer par un avoir. Le numéro légal sera attribué par le serveur.
                </p>
              </header>

              <ComplianceChecklist
                report={report}
                okMessage="Vous pouvez valider en toute sérénité."
              />

              {error && (
                <div className="rounded-xl bg-error-container text-on-error-container border border-error/30 p-3 text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse md:flex-row gap-2 md:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm"
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!report.canValidate || submitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Validation…' : 'Confirmer la validation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
