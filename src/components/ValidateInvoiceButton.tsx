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

/**
 * Build the canonical FR mandatory-mention block that satisfies the
 * compliance checker for a given regime / client kind. Used by the
 * "auto-fix" button so users don't have to know the exact wording.
 */
function buildLegalMentions(
  regime: string | undefined,
  isB2B: boolean,
  isQuote: boolean
): string {
  const lines: string[] = [];
  if (regime === 'franchise') {
    lines.push('TVA non applicable, art. 293 B du CGI.');
  }
  if (regime === 'autoliquidation') {
    lines.push('Autoliquidation — TVA due par le preneur (art. 283-2 nonies du CGI).');
  }
  if (!isQuote) {
    lines.push(
      "En cas de retard de paiement, des pénalités au taux annuel de 3 fois le taux d'intérêt légal seront appliquées."
    );
    if (isB2B) {
      lines.push(
        "Tout retard de paiement entraîne une indemnité forfaitaire pour frais de recouvrement de 40 € (art. D.441-5 Code de commerce)."
      );
    }
  }
  if (isQuote) {
    lines.push('Devis valable 30 jours à compter de sa date d\'émission.');
  }
  return lines.join('\n');
}

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
  const { company, clients, validateInvoice, updateInvoice } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(
    () => clients.find(c => c.id === invoice.clientId) || null,
    [clients, invoice.clientId]
  );

  const report = useMemo(
    () => checkInvoiceCompliance(invoice, company, client),
    [invoice, company, client]
  );

  // Issues whose code starts with `mention.` or `tva.*.mention` or `quote.*`
  // are 100% solvable by appending standard legal text to `invoice.notes`.
  // We surface a single "Insérer les mentions manquantes" button that lets
  // the user fix all of them at once — that was the user's pain point: the
  // checker tells them what's missing but doesn't help them fix it.
  const fixableMentionCodes = new Set([
    'tva.franchise.mention',
    'tva.autoliq.mention',
    'mention.latePenalties',
    'mention.indemnity40',
    'mention.paymentTerms',
    'quote.validity',
    'quote.btp.bonPourAccord',
  ]);
  const hasFixableMentions = report.issues.some(i => fixableMentionCodes.has(i.code));

  const handleAutoFixMentions = async () => {
    setAutoFixing(true);
    setError(null);
    try {
      const regime = invoice.vatRegime || company?.vatRegime || 'standard';
      const isB2B = client?.type === 'B2B';
      const isQuote = invoice.type === 'quote';
      const block = buildLegalMentions(regime, isB2B, isQuote);
      const existing = (invoice.notes || '').trim();
      const merged = existing ? `${existing}\n\n${block}` : block;
      await updateInvoice(invoice.id, { notes: merged });
    } catch (e: any) {
      setError(e?.message || "Impossible d'insérer les mentions automatiques.");
    } finally {
      setAutoFixing(false);
    }
  };

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
        // z-[110] to clear the mobile bottom nav (z-50), the desktop sidebar
        // (z-50) and the sticky page header (z-40). Toasts at z-[9999] still
        // render above us — that's intentional so a "facture validée" toast
        // is visible after we close.
        <div className="fixed inset-0 z-[110] bg-on-surface/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
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

              {hasFixableMentions && (
                <button
                  type="button"
                  onClick={handleAutoFixMentions}
                  disabled={autoFixing || submitting}
                  className="w-full inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary-container text-on-secondary-container font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {autoFixing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                      </svg>
                      Insertion…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                      Insérer les mentions légales manquantes
                    </>
                  )}
                </button>
              )}

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
