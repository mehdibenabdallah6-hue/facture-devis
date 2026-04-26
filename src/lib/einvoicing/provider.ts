/**
 * E-invoicing provider abstraction (PDP / PA — réforme 2026/2027).
 *
 * En septembre 2026, toute entreprise française devra recevoir ses factures
 * via une PDP (Plateforme de Dématérialisation Partenaire) ou le PPF
 * (Portail Public de Facturation). En septembre 2027 toutes les entreprises
 * devront aussi émettre via une PDP. Le détail réglementaire bouge encore
 * — voir docs/EINVOICING_2026.md.
 *
 * Cette abstraction sert à :
 *   1. Découpler Photofacto d'une PDP particulière (le founder n'a pas
 *      encore choisi).
 *   2. Permettre le développement avec un provider mock tant que
 *      l'intégration réelle n'est pas branchée.
 *   3. Documenter l'API minimale qu'on attend d'une PDP (envoi, statut,
 *      réception, annulation/correction).
 *
 * IMPORTANT : ce module ne fait PAS d'appels réseau directs à une PDP.
 * Les appels réels doivent passer par une route serveur (api/einvoice-*.ts)
 * qui détient les credentials. Cette interface est utilisée :
 *   - côté serveur pour router vers la bonne implémentation,
 *   - côté client uniquement avec le mock pour l'aperçu.
 */

import type { EInvoiceStatus, Invoice, CompanySettings, Client } from '../../contexts/DataContext';

/** Identifiant stable du provider, persisté sur l'invoice (`eInvoiceProvider`). */
export type EInvoicingProviderId =
  | 'mock'
  | 'chorus' // Chorus Pro — destiné aux factures publiques (déjà en prod côté code legacy)
  | 'pennylane' // exemple de PDP candidate
  | 'sellsy'
  | 'qonto'
  | 'pdp-custom';

export interface EInvoicePayload {
  invoice: Invoice;
  company: CompanySettings;
  client: Client;
  /** PDF Factur-X (CII embedded), encodé en base64 si fourni. */
  facturxPdfBase64?: string;
  /** XML CII brut, si on souhaite l'envoyer séparément. */
  cleanCiiXml?: string;
}

export interface EInvoiceSendResult {
  /** ID externe assigné par la PDP — à persister dans `eInvoiceExternalId`. */
  externalId: string;
  /** Statut initial. Beaucoup de PDPs renvoient 'submitted' synchronously. */
  status: EInvoiceStatus;
  /** ISO timestamp côté PDP (si fourni), sinon now(). */
  submittedAt?: string;
  /** Message ou code de la PDP, en clair, pour debugging. */
  providerMessage?: string;
}

export interface EInvoiceStatusResult {
  status: EInvoiceStatus;
  /** Dernier message du provider (rejet, demande de complément, etc.). */
  providerMessage?: string;
  lastUpdatedAt?: string;
}

/**
 * Représentation minimale d'une facture reçue via PDP. La structure exacte
 * dépend du provider — chaque adapter doit normaliser vers cette forme avant
 * de la persister dans `supplierInvoices`.
 */
export interface InboundInvoice {
  externalId: string;
  receivedAt: string;
  supplierName: string;
  supplierSiret?: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  totalHT?: number;
  totalVAT?: number;
  totalTTC: number;
  currency?: string;
  /** PDF d'origine, URL ou base64. */
  originalFileUrl?: string;
  /** XML CII / Factur-X tel que reçu. */
  facturxXml?: string;
}

/**
 * Contrat minimum pour un adapter PDP/PA.
 *
 * Toute implémentation doit être :
 *   - **idempotente** sur sendInvoice (même invoice envoyée deux fois →
 *     une seule transmission côté PDP, ou erreur claire),
 *   - **non destructive** (pas de mutation côté serveur en dehors du log
 *     `pdpTransmissionHistory`),
 *   - **silencieuse en cas de panne réseau** : retry côté caller, le provider
 *     remonte une erreur typée.
 */
export interface EInvoicingProvider {
  readonly id: EInvoicingProviderId;
  readonly name: string;

  /** Vérifie que les credentials sont OK et que la PDP répond. */
  healthCheck(): Promise<{ ok: boolean; message?: string }>;

  /** Envoie une facture validée. Doit être appelé côté serveur uniquement. */
  sendInvoice(payload: EInvoicePayload): Promise<EInvoiceSendResult>;

  /** Récupère le dernier statut d'une facture envoyée. */
  getInvoiceStatus(externalId: string): Promise<EInvoiceStatusResult>;

  /**
   * Récupère les factures fournisseurs reçues depuis une date donnée.
   * Devrait être appelé périodiquement (cron Vercel) côté serveur.
   * Retourne une liste possiblement vide.
   */
  receiveInvoices(sinceIso?: string): Promise<InboundInvoice[]>;

  /**
   * Annulation ou correction d'une facture déjà transmise. La sémantique
   * exacte dépend de la PDP : certaines exigent un avoir, d'autres
   * acceptent une "correction" tant que la facture n'est pas acceptée.
   *
   * Le caller doit traiter l'erreur "non supporté" et basculer vers la
   * création d'un avoir si besoin.
   */
  cancelOrCorrectInvoice(
    externalId: string,
    reason: string,
    replacement?: EInvoicePayload
  ): Promise<{ ok: boolean; message?: string }>;
}

// ----------------------------------------------------------------------------
// Mock provider — utilisé en dev et pour les tests côté UI.
// ----------------------------------------------------------------------------

/**
 * Implementation mock : tout reste en mémoire, aucun appel réseau.
 * Utile pour :
 *   - démontrer le flux dans l'UI sans avoir branché une vraie PDP,
 *   - tester `pdpTransmissionHistory` sans frais.
 *
 * NE PAS utiliser en production (l'état est perdu au refresh).
 */
class MockEInvoicingProvider implements EInvoicingProvider {
  readonly id = 'mock' as const;
  readonly name = 'Mock PDP (dev)';

  // Stockage en mémoire des factures "envoyées" pour simuler un suivi.
  private store = new Map<
    string,
    { sent: EInvoicePayload; status: EInvoiceStatus; lastUpdatedAt: string }
  >();
  private inbox: InboundInvoice[] = [];

  async healthCheck() {
    return { ok: true, message: 'Mock provider toujours OK' };
  }

  async sendInvoice(payload: EInvoicePayload): Promise<EInvoiceSendResult> {
    if (!payload.invoice.isLocked) {
      throw new Error('Mock PDP refuse une facture non validée (isLocked=false).');
    }
    const externalId = `mock-${payload.invoice.id}-${Date.now()}`;
    const submittedAt = new Date().toISOString();
    this.store.set(externalId, {
      sent: payload,
      status: 'submitted',
      lastUpdatedAt: submittedAt,
    });
    return {
      externalId,
      status: 'submitted',
      submittedAt,
      providerMessage: 'Transmission simulée (mock). Voir docs/EINVOICING_2026.md.',
    };
  }

  async getInvoiceStatus(externalId: string): Promise<EInvoiceStatusResult> {
    const rec = this.store.get(externalId);
    if (!rec) {
      return {
        status: 'error',
        providerMessage: `Aucune facture mock avec id ${externalId}.`,
      };
    }
    return {
      status: rec.status,
      lastUpdatedAt: rec.lastUpdatedAt,
      providerMessage: 'Statut simulé — le mock ne progresse pas tout seul.',
    };
  }

  async receiveInvoices(sinceIso?: string): Promise<InboundInvoice[]> {
    if (!sinceIso) return [...this.inbox];
    return this.inbox.filter(inv => inv.receivedAt >= sinceIso);
  }

  async cancelOrCorrectInvoice(externalId: string, reason: string) {
    const rec = this.store.get(externalId);
    if (!rec) {
      return { ok: false, message: 'Facture inconnue côté mock.' };
    }
    rec.status = 'rejected';
    rec.lastUpdatedAt = new Date().toISOString();
    return { ok: true, message: `Annulation simulée (${reason}).` };
  }

  // Utilitaires de test — non exposés sur l'interface publique.
  _injectInbound(inv: InboundInvoice) {
    this.inbox.push(inv);
  }
  _setStatus(externalId: string, status: EInvoiceStatus) {
    const rec = this.store.get(externalId);
    if (rec) {
      rec.status = status;
      rec.lastUpdatedAt = new Date().toISOString();
    }
  }
}

// Singleton — utilisé par l'UI dev et par les tests.
export const mockProvider: EInvoicingProvider = new MockEInvoicingProvider();

// ----------------------------------------------------------------------------
// Factory — résolution du provider à utiliser.
// ----------------------------------------------------------------------------

/**
 * Renvoie l'adapter PDP/PA correspondant à un identifiant. Pour l'instant
 * seul le mock est implémenté ; les autres lèvent une erreur explicite
 * pour éviter qu'on déploie en pensant que ça marche.
 *
 * Les vraies implémentations (Chorus, Pennylane, etc.) doivent vivre côté
 * serveur (api/einvoice/<provider>.ts) car elles dépendent de credentials
 * et de SDKs Node-only.
 */
export function getProvider(id: EInvoicingProviderId | undefined): EInvoicingProvider {
  switch (id) {
    case 'mock':
    case undefined:
      return mockProvider;
    case 'chorus':
    case 'pennylane':
    case 'sellsy':
    case 'qonto':
    case 'pdp-custom':
      throw new Error(
        `Provider "${id}" non encore implémenté. Voir docs/EINVOICING_2026.md pour le plan d'intégration.`
      );
    default:
      throw new Error(`Provider e-invoicing inconnu : ${id}`);
  }
}

/**
 * Map une Invoice + Company + Client vers le payload générique attendu
 * par les providers. Centralisé ici pour qu'un changement de schéma
 * Invoice se répercute en un seul endroit.
 */
export function mapInvoiceToProviderPayload(
  invoice: Invoice,
  company: CompanySettings,
  client: Client,
  opts?: { facturxPdfBase64?: string; cleanCiiXml?: string }
): EInvoicePayload {
  return {
    invoice,
    company,
    client,
    facturxPdfBase64: opts?.facturxPdfBase64,
    cleanCiiXml: opts?.cleanCiiXml,
  };
}
