/**
 * French mandatory-mentions checker for invoices and quotes.
 *
 * Sources :
 *   - Code de commerce, art. L.441-9 (mentions obligatoires d'une facture)
 *   - Code général des impôts (CGI), art. 242 nonies A annexe II
 *   - CGI art. 293 B (franchise en base de TVA)
 *   - CGI art. 283-2 / Directive TVA 2006/112/CE (autoliquidation BTP)
 *   - Loi Hamon (information précontractuelle, devis BTP > 1500€)
 *   - Loi LME (délais de paiement, indemnité forfaitaire 40€, pénalités de retard)
 *   - Code des assurances, art. L.241-1 (obligation décennale BTP)
 *   - Loi n° 2014-790 du 10 juillet 2014 (mention assurance pro pour artisans BTP)
 *
 * IMPORTANT — disclaimer :
 *   Cette checklist couvre les mentions courantes mais N'EST PAS un audit
 *   juridique exhaustif. Le founder doit faire valider la liste finale par
 *   un expert-comptable ou un avocat fiscaliste avant production.
 *
 *   Voir docs/CONFORMITE_FACTURATION_FR.md pour la traçabilité réglementaire
 *   et les points laissés au choix de l'éditeur.
 */

import type { CompanySettings, Client, Invoice } from '../contexts/DataContext';

export type ComplianceSeverity = 'error' | 'warning' | 'info';

export interface ComplianceIssue {
  /** Stable identifier — used in tests & UI for highlight links. */
  code: string;
  severity: ComplianceSeverity;
  /** Short label shown to the user (FR). */
  message: string;
  /** Optional longer explanation / legal reference. */
  hint?: string;
  /** Which entity must be edited to resolve it. */
  fixTarget: 'company' | 'client' | 'invoice';
}

export interface ComplianceReport {
  issues: ComplianceIssue[];
  /** True iff there is no `error`-level issue. Warnings are tolerated. */
  canValidate: boolean;
  /** True iff there is also no `warning` — full green flag. */
  isFullyCompliant: boolean;
}

const SIRET_REGEX = /^\d{14}$/;
const SIREN_REGEX = /^\d{9}$/;
const TVA_FR_REGEX = /^FR\d{11}$/i;

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === 'string' && v.trim().length === 0);
}

/**
 * Heuristic to decide whether an invoice triggers the BTP-specific mentions
 * (décennale, assurance professionnelle, autoliquidation). We look at the
 * company profession and a few keywords. The user can override per-invoice
 * via the `vatRegime` field — autoliquidation set explicitly always wins.
 */
function isBuildingTrade(company: CompanySettings | null | undefined): boolean {
  const p = (company?.profession || '').toLowerCase();
  if (!p) return false;
  const keywords = [
    'btp',
    'bâtiment',
    'batiment',
    'maçon',
    'macon',
    'plomb',
    'électric',
    'electric',
    'menuis',
    'peintre',
    'peinture',
    'couvr',
    'charpent',
    'plâtr',
    'platr',
    'carrel',
    'chauff',
    'isol',
    'rénov',
    'renov',
    'construction',
    'travaux',
  ];
  return keywords.some(k => p.includes(k));
}

/**
 * Compute the compliance report for an invoice/quote.
 *
 * The check runs against the **current** company + client snapshot, so it
 * reflects what the user will actually print on the PDF. Call this right
 * before validation: if there are `error`-level issues, block the
 * "Valider la facture" button and surface the fix list.
 */
export function checkInvoiceCompliance(
  invoice: Invoice,
  company: CompanySettings | null,
  client: Client | null
): ComplianceReport {
  const issues: ComplianceIssue[] = [];

  const isQuote = invoice.type === 'quote';
  const isCredit = invoice.type === 'credit';
  const isB2B = client?.type === 'B2B';
  const btp = isBuildingTrade(company);

  // ---- Émetteur (entreprise) ----
  if (!company) {
    issues.push({
      code: 'company.missing',
      severity: 'error',
      message: 'Profil entreprise non configuré',
      hint: 'Allez dans Réglages > Entreprise et renseignez SIRET, adresse et coordonnées.',
      fixTarget: 'company',
    });
    // No point checking individual fields if we have no company.
    return finalize(issues);
  }

  if (isBlank(company.name)) {
    issues.push({
      code: 'company.name',
      severity: 'error',
      message: "Nom ou raison sociale manquant",
      fixTarget: 'company',
    });
  }
  if (isBlank(company.address)) {
    issues.push({
      code: 'company.address',
      severity: 'error',
      message: 'Adresse de votre entreprise manquante',
      hint: 'Mention obligatoire art. L.441-9 Code de commerce.',
      fixTarget: 'company',
    });
  }
  if (isBlank(company.siret)) {
    issues.push({
      code: 'company.siret',
      severity: 'error',
      message: 'SIRET manquant',
      hint: 'Le SIRET (14 chiffres) est obligatoire sur toute facture.',
      fixTarget: 'company',
    });
  } else if (!SIRET_REGEX.test((company.siret || '').replace(/\s/g, ''))) {
    issues.push({
      code: 'company.siret.format',
      severity: 'warning',
      message: 'Le SIRET doit comporter 14 chiffres',
      fixTarget: 'company',
    });
  }
  if (company.legalForm && !isBlank(company.capital) && (company.capital || 0) <= 0) {
    issues.push({
      code: 'company.capital',
      severity: 'warning',
      message: 'Capital social à 0 alors qu\'une forme juridique est renseignée',
      fixTarget: 'company',
    });
  }

  // TVA : si le régime est "standard", on attend un n° TVA intracom ;
  // si franchise, c'est l'inverse — voir bloc TVA plus bas.
  const regime = invoice.vatRegime || company.vatRegime || 'standard';
  if (regime === 'standard') {
    if (isBlank(company.vatNumber)) {
      issues.push({
        code: 'company.vatNumber',
        severity: 'warning',
        message: 'Numéro de TVA intracommunautaire manquant',
        hint: 'Obligatoire si vous facturez plus de 150€ HT à un client B2B (art. 242 nonies A).',
        fixTarget: 'company',
      });
    } else if (!TVA_FR_REGEX.test((company.vatNumber || '').replace(/\s/g, ''))) {
      issues.push({
        code: 'company.vatNumber.format',
        severity: 'info',
        message: 'Format n° TVA inattendu (attendu : FR + 11 chiffres)',
        fixTarget: 'company',
      });
    }
  }

  // ---- Client ----
  if (!client && isBlank(invoice.clientName)) {
    issues.push({
      code: 'client.missing',
      severity: 'error',
      message: 'Aucun client associé',
      fixTarget: 'invoice',
    });
  }
  if (client) {
    if (isBlank(client.name)) {
      issues.push({
        code: 'client.name',
        severity: 'error',
        message: 'Nom du client manquant',
        fixTarget: 'client',
      });
    }
    if (isBlank(client.address)) {
      issues.push({
        code: 'client.address',
        severity: 'error',
        message: 'Adresse du client manquante',
        hint: 'Mention obligatoire art. L.441-9 Code de commerce.',
        fixTarget: 'client',
      });
    }
    if (isB2B) {
      if (isBlank(client.siren) && isBlank(client.vatNumber)) {
        issues.push({
          code: 'client.siren',
          severity: 'warning',
          message: 'SIREN ou n° TVA du client B2B manquant',
          hint: 'Recommandé pour toute relation B2B, obligatoire au-delà de 150€ HT.',
          fixTarget: 'client',
        });
      } else if (client.siren && !SIREN_REGEX.test((client.siren || '').replace(/\s/g, ''))) {
        issues.push({
          code: 'client.siren.format',
          severity: 'info',
          message: 'Le SIREN du client doit comporter 9 chiffres',
          fixTarget: 'client',
        });
      }
    }
  }

  // ---- Facture / devis ----
  if (isBlank(invoice.date)) {
    issues.push({
      code: 'invoice.date',
      severity: 'error',
      message: 'Date d\'émission manquante',
      fixTarget: 'invoice',
    });
  }
  if (!isQuote && !isCredit && isBlank(invoice.dueDate)) {
    issues.push({
      code: 'invoice.dueDate',
      severity: 'error',
      message: 'Date d\'échéance manquante',
      hint: 'Loi LME : la date d\'échéance doit figurer sur toute facture B2B.',
      fixTarget: 'invoice',
    });
  }

  // Lignes
  if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
    issues.push({
      code: 'invoice.items.empty',
      severity: 'error',
      message: 'Aucune ligne sur la facture',
      fixTarget: 'invoice',
    });
  } else {
    for (let i = 0; i < invoice.items.length; i++) {
      const it = invoice.items[i];
      if (isBlank(it.description)) {
        issues.push({
          code: `invoice.item.${i}.description`,
          severity: 'error',
          message: `Ligne ${i + 1} : désignation manquante`,
          fixTarget: 'invoice',
        });
      }
      // Pour un avoir les quantités sont attendues négatives ; pour le reste,
      // un 0 ou un négatif est suspect.
      if (!isCredit && (typeof it.quantity !== 'number' || it.quantity <= 0)) {
        issues.push({
          code: `invoice.item.${i}.quantity`,
          severity: 'warning',
          message: `Ligne ${i + 1} : quantité invalide`,
          fixTarget: 'invoice',
        });
      }
    }
  }

  // ---- TVA — cohérence régime / lignes ----
  const hasVat = (invoice.items || []).some(
    it => typeof it.vatRate === 'number' && it.vatRate > 0
  );
  const totalVat = invoice.totalVAT || 0;

  if (regime === 'franchise') {
    if (hasVat || totalVat !== 0) {
      issues.push({
        code: 'tva.franchise.hasVat',
        severity: 'error',
        message: 'Régime franchise en base : la TVA doit être à 0',
        hint: 'Vous êtes en franchise (art. 293 B CGI) — n\'appliquez pas de TVA.',
        fixTarget: 'invoice',
      });
    }
    // La mention "TVA non applicable, art. 293 B du CGI" doit apparaître.
    if (!hasMention(invoice.notes, ['293 B', '293B', 'TVA non applicable'])) {
      issues.push({
        code: 'tva.franchise.mention',
        severity: 'error',
        message: 'Mention « TVA non applicable, art. 293 B du CGI » manquante',
        hint: 'À ajouter dans les notes / pied de page de la facture.',
        fixTarget: 'invoice',
      });
    }
  }

  if (regime === 'autoliquidation') {
    if (hasVat || totalVat !== 0) {
      issues.push({
        code: 'tva.autoliq.hasVat',
        severity: 'error',
        message: 'Autoliquidation : la TVA doit être à 0 (le client la déclare)',
        fixTarget: 'invoice',
      });
    }
    if (!hasMention(invoice.notes, ['autoliquidation', 'auto-liquidation', 'art. 283'])) {
      issues.push({
        code: 'tva.autoliq.mention',
        severity: 'error',
        message: 'Mention « Autoliquidation » manquante',
        hint: 'Pour les sous-traitants BTP : mention obligatoire art. 283-2 nonies CGI.',
        fixTarget: 'invoice',
      });
    }
    if (!isB2B) {
      issues.push({
        code: 'tva.autoliq.b2c',
        severity: 'warning',
        message: 'Autoliquidation déclarée pour un client non-B2B',
        hint: 'Le mécanisme d\'autoliquidation ne s\'applique qu\'entre assujettis.',
        fixTarget: 'invoice',
      });
    }
  }

  // ---- Mentions de paiement (factures uniquement, pas pour les avoirs ni les devis) ----
  if (!isQuote && !isCredit) {
    if (!hasMention(invoice.notes, ['pénalité', 'penalite', 'retard'])) {
      issues.push({
        code: 'mention.latePenalties',
        severity: 'warning',
        message: 'Mention des pénalités de retard manquante',
        hint: 'Loi LME : indiquer le taux applicable en cas de retard de paiement.',
        fixTarget: 'invoice',
      });
    }
    if (isB2B && !hasMention(invoice.notes, ['40', 'forfaitaire', 'recouvrement'])) {
      issues.push({
        code: 'mention.indemnity40',
        severity: 'warning',
        message: 'Mention de l\'indemnité forfaitaire de 40 € manquante',
        hint: 'Obligatoire B2B depuis 2013 (D.441-5 Code de commerce).',
        fixTarget: 'invoice',
      });
    }
    if (isBlank(company.defaultPaymentTerms) && !hasMention(invoice.notes, ['paiement', 'échéance', 'echeance'])) {
      issues.push({
        code: 'mention.paymentTerms',
        severity: 'info',
        message: 'Conditions de paiement non précisées',
        hint: 'Renseignez un délai de paiement par défaut dans les réglages.',
        fixTarget: 'company',
      });
    }
  }

  // ---- Mentions BTP (assurance décennale, RC pro) ----
  if (btp && !isCredit) {
    if (isBlank(company.decennale)) {
      issues.push({
        code: 'btp.decennale',
        severity: 'warning',
        message: 'Assurance décennale non renseignée',
        hint: 'Loi du 10 juillet 2014 : mention obligatoire pour les artisans du bâtiment.',
        fixTarget: 'company',
      });
    }
    if (isBlank(company.rcPro)) {
      issues.push({
        code: 'btp.rcpro',
        severity: 'info',
        message: 'Assurance responsabilité civile professionnelle non renseignée',
        fixTarget: 'company',
      });
    }
  }

  // ---- Devis : mentions précontractuelles ----
  if (isQuote) {
    if (!hasMention(invoice.notes, ['validité', 'validite', 'valable'])) {
      issues.push({
        code: 'quote.validity',
        severity: 'info',
        message: 'Durée de validité du devis non indiquée',
        hint: 'Recommandé : préciser combien de temps les prix sont garantis.',
        fixTarget: 'invoice',
      });
    }
    // Devis BTP > 1500€ : mention "bon pour accord" + signature.
    if (btp && (invoice.totalTTC || 0) >= 1500 && !hasMention(invoice.notes, ['bon pour', 'accord'])) {
      issues.push({
        code: 'quote.btp.bonPourAccord',
        severity: 'warning',
        message: 'Mention « Bon pour accord » manquante (devis BTP > 1500 €)',
        hint: 'Loi Hamon : devis BTP au-delà de 1500€ TTC = signature obligatoire.',
        fixTarget: 'invoice',
      });
    }
  }

  // ---- Avoir : référence à la facture d'origine ----
  if (isCredit) {
    if (isBlank(invoice.linkedInvoiceId) || isBlank(invoice.linkedInvoiceNumber)) {
      issues.push({
        code: 'credit.linkedInvoice',
        severity: 'error',
        message: 'L\'avoir doit référencer la facture d\'origine',
        fixTarget: 'invoice',
      });
    }
    if ((invoice.totalTTC || 0) >= 0) {
      issues.push({
        code: 'credit.totalSign',
        severity: 'warning',
        message: 'Le total TTC d\'un avoir doit être négatif',
        fixTarget: 'invoice',
      });
    }
  }

  // ---- Numéro ----
  // Pour les brouillons on accepte un numéro provisoire ou vide ; à la
  // validation, c'est /api/invoice-validate qui assigne le bon numéro.
  if (invoice.isLocked && isBlank(invoice.number)) {
    issues.push({
      code: 'invoice.number.missing',
      severity: 'error',
      message: 'Facture validée sans numéro — incident technique',
      fixTarget: 'invoice',
    });
  }

  return finalize(issues);
}

/**
 * Lighter check that runs only on the company + client setup, useful
 * before letting a user create their first invoice or as a "dashboard
 * health" indicator. Same shape as `checkInvoiceCompliance`.
 */
export function checkCompanyReadiness(
  company: CompanySettings | null
): ComplianceReport {
  const issues: ComplianceIssue[] = [];
  if (!company) {
    issues.push({
      code: 'company.missing',
      severity: 'error',
      message: 'Profil entreprise non configuré',
      fixTarget: 'company',
    });
    return finalize(issues);
  }
  if (isBlank(company.name)) {
    issues.push({ code: 'company.name', severity: 'error', message: 'Nom de l\'entreprise manquant', fixTarget: 'company' });
  }
  if (isBlank(company.siret)) {
    issues.push({ code: 'company.siret', severity: 'error', message: 'SIRET manquant', fixTarget: 'company' });
  }
  if (isBlank(company.address)) {
    issues.push({ code: 'company.address', severity: 'error', message: 'Adresse manquante', fixTarget: 'company' });
  }
  if (isBlank(company.vatRegime)) {
    issues.push({
      code: 'company.vatRegime',
      severity: 'warning',
      message: 'Régime de TVA non configuré',
      hint: 'Choisissez entre régime normal, franchise en base ou autoliquidation.',
      fixTarget: 'company',
    });
  }
  return finalize(issues);
}

// ----------------------------------------------------------------------------

function hasMention(text: string | undefined, keywords: string[]): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return keywords.some(k => t.includes(k.toLowerCase()));
}

function finalize(issues: ComplianceIssue[]): ComplianceReport {
  const hasError = issues.some(i => i.severity === 'error');
  const hasWarning = issues.some(i => i.severity === 'warning');
  return {
    issues,
    canValidate: !hasError,
    isFullyCompliant: !hasError && !hasWarning,
  };
}
