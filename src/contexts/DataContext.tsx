import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where, setDoc, addDoc, updateDoc, deleteDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { startOfMonth } from 'date-fns';
import { AppPlan, AppSubscriptionStatus, BillingCycle } from '../lib/billing';
import { track } from '../services/analytics';
import { articleIdFromDescription } from '../lib/catalogImport';

// Referral tracking + discount rewards — called after user completes onboarding
// Rewards: both referrer & referred get -50% on monthly plan or -15% on annual plan
export async function processReferral(newUserId: string, referrerId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // Valid 1 year

    // 1. Reward the referrer
    const referrerRef = doc(db, 'companies', referrerId);
    await setDoc(referrerRef, {
      referralCount: increment(1),
      // Store referral discount code (can be combined with welcome discount)
      referralDiscountCode: 'PARRAIN50',
      referralDiscountExpiry: validUntil,
      referralDiscountType: '50_monthly_or_15_annual',
      updatedAt: now,
    }, { merge: true });

    // 2. Reward the referred user (also gets the same discount)
    const newUserRef = doc(db, 'companies', newUserId);
    await setDoc(newUserRef, {
      referredBy: referrerId,
      referredAt: now,
      referralDiscountCode: 'PARRAIN50',
      referralDiscountExpiry: validUntil,
      referralDiscountType: '50_monthly_or_15_annual',
    }, { merge: true });

  } catch (err) {
    console.error('Referral processing error:', err);
  }
}

export interface CompanySettings {
  ownerId: string;
  name: string;
  profession?: string;
  trialStartedAt?: string;
  subscriptionStatus?: AppSubscriptionStatus;
  plan?: AppPlan;
  pendingPlan?: AppPlan | null;
  billingCycle?: BillingCycle | null;
  pendingBillingCycle?: BillingCycle | null;
  paddleSubscriptionId?: string;
  paddlePriceId?: string | null;
  paddleLastEventAt?: string | null;
  monthlyInvoiceCount?: number;
  monthlyAiUsageCount?: number;
  monthlyResetAt?: string; // ISO date — quand les compteurs ont été reset pour la dernière fois
  invoiceCounter?: number;
  quoteCounter?: number;
  address?: string;
  email?: string;
  phone?: string;
  siret?: string;
  vatNumber?: string;
  legalForm?: string;
  capital?: number;
  vatRegime?: 'standard' | 'franchise' | 'autoliquidation';
  decennale?: string;
  rcPro?: string;
  logoUrl?: string;
  letterheadUrl?: string;
  hideCompanyInfo?: boolean;
  invoicePrefix?: string;
  defaultPaymentTerms?: number;
  defaultCurrency?: string;
  defaultVat?: number;
  createdAt?: string;
  updatedAt?: string;
  // Referral
  referredBy?: string; // userId of the person who referred this user
  referredAt?: string;
  referralCount?: number; // how many users this person referred
  // Discounts
  referralDiscountCode?: string; // e.g. 'PARRAIN50'
  referralDiscountExpiry?: string; // when the referral discount expires
  referralDiscountType?: string; // '50_monthly_or_15_annual'
  welcomeDiscountExpiry?: string; // welcome discount valid for 48h after signup
  // PDF customization
  pdfTemplate?: 'moderne' | 'classique' | 'chantier'; // visual template for PDF exports
  pdfAccentColor?: string; // hex color for PDF accent bar
  pdfFooterText?: string; // custom footer text on PDF
  pdfShowPaymentTerms?: boolean; // show payment terms on PDF
  pdfShowItemVat?: boolean; // show VAT rate per line item
}

export interface Client {
  id: string;
  ownerId: string;
  type: 'B2B' | 'B2C';
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  siren?: string;
  vatNumber?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export type InvoiceType = 'invoice' | 'quote' | 'deposit' | 'credit';

/**
 * Invoice lifecycle status:
 *   - draft       : work in progress, freely editable, not yet a legal invoice.
 *                   No final number is assigned.
 *   - validated   : sealed by /api/invoice-validate. Number is final, document
 *                   is locked (`isLocked === true`). To correct, issue an avoir.
 *   - sent        : validated + transmitted to the client (email, link, PDP).
 *   - paid / overdue / cancelled : downstream business states; the invoice
 *                   stays locked.
 *   - accepted / converted : quote-only states (client accepted, or quote
 *                   was converted into an invoice).
 */
export type InvoiceStatus =
  | 'draft'
  | 'validated'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'accepted'
  | 'converted';

/**
 * E-invoicing transmission state. Independent of the legal `status` above —
 * a sent invoice can still be in `pending` PDP transmission. See
 * docs/EINVOICING_2026.md for the full lifecycle.
 */
export type EInvoiceStatus =
  | 'not_applicable'
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'error';

export interface Invoice {
  id: string;
  ownerId: string;
  type: InvoiceType;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  number: string;
  date: string;
  dueDate: string;
  serviceDate?: string;
  status: InvoiceStatus;
  vatRegime?: 'standard' | 'franchise' | 'autoliquidation';
  items: InvoiceItem[];
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  notes?: string;
  paymentMethod?: string;
  signature?: string;
  signedAt?: string;
  signedByName?: string;
  chantierPhotos?: string[];
  // ---- Validation lock (set by /api/invoice-validate) ----
  /** True once the invoice has been validated and assigned a final number.
   *  Locked invoices cannot be edited or deleted by the client; corrections
   *  must go through a credit note (avoir). */
  isLocked?: boolean;
  validatedAt?: string;
  validatedBy?: string;
  // ---- Credit note linkage ----
  /** If this is a credit note (`type === 'credit'`), the source invoice id. */
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
  /** If this invoice has been (partly or fully) credited, the credit note id. */
  creditedBy?: string;
  creditedAt?: string;
  // ---- E-invoicing (PDP / PA — réforme 2026/2027) ----
  /** Generic PDP/PA transmission status, replaces chorus-only fields long-term. */
  eInvoiceStatus?: EInvoiceStatus;
  /** Identifier of the provider that handled the transmission (chorus, pennylane,
   *  custom-pdp, mock, etc.). See src/lib/einvoicing/provider.ts. */
  eInvoiceProvider?: string;
  /** External id assigned by the provider (flux id, dossier id, etc.). */
  eInvoiceExternalId?: string;
  /** Last sync ISO timestamp. */
  eInvoiceLastSyncAt?: string;
  /** Last error from the provider, if any. */
  eInvoiceErrors?: string;
  /** Per-attempt history (push events). Capped by writers — keep small. */
  pdpTransmissionHistory?: Array<{
    timestamp: string;
    provider: string;
    status: EInvoiceStatus;
    externalId?: string;
    error?: string;
  }>;
  // ---- Legacy provider-specific fields (kept for backwards compatibility) ----
  chorusStatus?: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'error';
  chorusFluxId?: string;
  chorusSubmittedAt?: string;
  chorusError?: string;
  pennylaneId?: string;
  pennylaneStatus?: string;
  // ---- Sharing ----
  shareUrl?: string;
  sharedQuoteId?: string;
  // ---- Bookkeeping ----
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Audit-trail event written by the API — never directly by the client.
 * See api/invoice-validate.ts, api/invoice-credit-note.ts, api/invoice-event.ts.
 */
export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  ownerId: string;
  type:
    | 'create'
    | 'update'
    | 'validate'
    | 'send'
    | 'mark_paid'
    | 'mark_unpaid'
    | 'cancel'
    | 'credit_note_created'
    | 'export_pdf'
    | 'export_facturx'
    | 'pdp_send'
    | 'pdp_status_update'
    | 'view'
    | 'sign';
  actorId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Inbound supplier invoice (réception de factures fournisseurs — réforme 2026).
 * Minimal model so we can persist what we receive from a PDP without yet doing
 * the full reception flow. See docs/EINVOICING_2026.md.
 */
export interface SupplierInvoice {
  id: string;
  ownerId: string;
  supplierName: string;
  supplierSiret?: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  totalHT?: number;
  totalVAT?: number;
  totalTTC: number;
  currency?: string;
  status: 'received' | 'reviewed' | 'approved' | 'paid' | 'rejected' | 'archived';
  /** PDP that delivered the invoice. */
  providerId?: string;
  /** External id from the PDP. */
  providerExternalId?: string;
  /** URL of the original PDF, hosted on Firebase Storage or the provider. */
  originalFileUrl?: string;
  /** Embedded Factur-X / Chorus XML, if extracted. */
  facturxXml?: string;
  /** When we received it from the PDP. */
  receivedAt: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Article {
  id: string;
  description: string;
  unitPrice: number;
  vatRate: number;
  unit?: string;
  category?: string;
  notes?: string;
  source?: 'ai_import' | 'spreadsheet_import' | 'manual';
  importedAt?: string;
  usageCount: number;
  updatedAt: string;
}

/**
 * Error thrown when the client tries to mutate a locked (validated) invoice.
 * UI layers should catch this specifically and prompt the user to issue a
 * credit note (avoir) instead of editing the invoice.
 */
export class InvoiceLockedError extends Error {
  constructor(message = 'Cette facture est validée et ne peut plus être modifiée. Pour la corriger, créez un avoir.') {
    super(message);
    this.name = 'InvoiceLockedError';
  }
}

interface DataContextType {
  company: CompanySettings | null;
  clients: Client[];
  invoices: Invoice[];
  invoiceEvents: InvoiceEvent[];
  supplierInvoices: SupplierInvoice[];
  articles: Article[];
  loading: boolean;
  saveCompany: (data: Partial<CompanySettings>) => Promise<void>;
  addClient: (data: Omit<Client, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addInvoice: (data: Omit<Invoice, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  updateInvoiceLegalMentions: (id: string, notes: string) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  /**
   * Validate a draft invoice/quote/credit/deposit. Server-side only:
   *   - Assigns the next legal number (atomic counter).
   *   - Sets isLocked=true, status='validated'.
   *   - Writes an audit-trail event.
   * Returns the assigned number. Idempotent — re-calling on an already
   * validated invoice returns the existing number without re-incrementing.
   */
  validateInvoice: (invoiceId: string, draft?: Partial<Invoice>) => Promise<{ number: string; alreadyValidated: boolean }>;
  /**
   * Create a credit note (avoir) from a validated invoice. The original
   * invoice MUST be locked. Returns the new credit-note id and number.
   */
  createCreditNote: (invoiceId: string, reason?: string) => Promise<{ creditNoteId: string; number: string }>;
  /**
   * Append an event to the invoice's audit trail (server-side write, server timestamp).
   * Use this from PDF export, send-by-email, mark-paid, etc. so the trail is complete.
   */
  logInvoiceEvent: (invoiceId: string, type: InvoiceEvent['type'], metadata?: Record<string, any>) => Promise<void>;
  shareQuoteForSignature: (invoiceId: string) => Promise<string>;
  activateSubscription: (pendingPlan?: AppPlan, billingCycle?: BillingCycle) => Promise<void>;
  importCatalog: (items: any[]) => Promise<void>;
  addArticle: (data: Omit<Article, 'id' | 'usageCount' | 'updatedAt'>) => Promise<string>;
  updateArticle: (id: string, data: Partial<Article>) => Promise<void>;
  deleteArticle: (id: string) => Promise<void>;
  /**
   * Supplier-invoice CRUD. The "received" path (PDP push) is server-side
   * and writes directly via api/einvoice-receive (todo). These helpers
   * cover the manual-entry path: a user uploading a PDF or typing a
   * fournisseur invoice they got by email.
   */
  addSupplierInvoice: (data: Omit<SupplierInvoice, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateSupplierInvoice: (id: string, data: Partial<SupplierInvoice>) => Promise<void>;
  deleteSupplierInvoice: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceEvents, setInvoiceEvents] = useState<InvoiceEvent[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCompany(null);
      setClients([]);
      setInvoices([]);
      setInvoiceEvents([]);
      setSupplierInvoices([]);
      setArticles([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubCompany = onSnapshot(
      doc(db, 'companies', user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setCompany(docSnap.data() as CompanySettings);
        } else {
          setCompany(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `companies/${user.uid}`)
    );

    const unsubClients = onSnapshot(
      query(collection(db, 'clients'), where('ownerId', '==', user.uid)),
      (snapshot) => {
        const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        setClients(clientsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'clients')
    );

    const unsubInvoices = onSnapshot(
      query(collection(db, 'invoices'), where('ownerId', '==', user.uid)),
      (snapshot) => {
        const invoicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
        setInvoices(invoicesData);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    const unsubArticles = onSnapshot(
      collection(db, 'companies', user.uid, 'articles'),
      (snapshot) => {
        const articlesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
        setArticles(articlesData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `companies/${user.uid}/articles`)
    );

    // Audit-trail events. Read-only on the client — writes happen via API
    // routes (api/invoice-validate, api/invoice-credit-note, api/invoice-event)
    // so the journal cannot be tampered with from the browser.
    const unsubEvents = onSnapshot(
      query(collection(db, 'invoiceEvents'), where('ownerId', '==', user.uid)),
      (snapshot) => {
        const eventsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceEvent));
        // Sort by timestamp ASC so the UI can render a chronological history.
        eventsData.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        setInvoiceEvents(eventsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoiceEvents')
    );

    // Supplier invoices (factures fournisseurs reçues / saisies manuellement).
    // Pour la réforme 2026/2027, ces docs seront aussi écrits par le serveur
    // (cron PDP). Côté client : lecture seule sur les docs poussés par PDP,
    // CRUD libre sur ceux saisis à la main (distinction par `providerId`).
    const unsubSupplier = onSnapshot(
      query(collection(db, 'supplierInvoices'), where('ownerId', '==', user.uid)),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupplierInvoice));
        data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setSupplierInvoices(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'supplierInvoices')
    );

    return () => {
      unsubCompany();
      unsubClients();
      unsubInvoices();
      unsubArticles();
      unsubEvents();
      unsubSupplier();
    };
  }, [user]);

  // ---- Helper: call an authenticated API route with the user's Firebase ID token. ----
  // We re-fetch the token each call so it cannot go stale (Firebase rotates them
  // every ~1h). Throws an Error with .status set when the server returns non-2xx.
  const callApi = async <T = any>(path: string, body: any): Promise<T> => {
    if (!user) throw new Error('Non authentifié');
    const current = auth.currentUser;
    if (!current) throw new Error('Session expirée. Veuillez vous reconnecter.');
    const token = await current.getIdToken();
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      // ignore parse error
    }
    if (!res.ok) {
      const err: any = new Error(payload?.error || `${path} a échoué (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return payload as T;
  };

  const saveCompany = async (data: Partial<CompanySettings>) => {
    if (!user) return;
    const companyRef = doc(db, 'companies', user.uid);
    const now = new Date().toISOString();
    try {
      await setDoc(companyRef, {
        ...data,
        ownerId: user.uid,
        updatedAt: now,
        ...(company ? {} : { createdAt: now })
      }, { merge: true });
    } catch (error) {
      // handleFirestoreError surfaces a toast for the user but historically
      // swallowed the throw — which made the Design page show "Sauvegardé"
      // even when nothing was actually written (most often: a letterhead /
      // logo data-URL pushing the doc past Firestore's 1 MiB limit). We now
      // re-throw so callers can keep their UI in sync with reality.
      handleFirestoreError(error, OperationType.WRITE, `companies/${user.uid}`);
      throw error;
    }
  };

  // NOTE: AI quota increments now happen atomically server-side inside
  // /api/gemini.ts (see reserveAiQuota / refundAiQuota). The previous
  // client-side increment was bypassable by simply not calling it.

  const activateSubscription = async (pendingPlan?: AppPlan, billingCycle?: BillingCycle) => {
    if (!user) return;
    try {
      const companyRef = doc(db, 'companies', user.uid);
      await setDoc(companyRef, { 
        subscriptionStatus: 'pending_activation',
        pendingPlan: pendingPlan || null,
        pendingBillingCycle: billingCycle || null,
        updatedAt: new Date().toISOString() 
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `companies/${user.uid}`);
    }
  };

  const addClient = async (data: Omit<Client, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) throw new Error('Not authenticated');
    const now = new Date().toISOString();
    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        ...data,
        ownerId: user.uid,
        createdAt: now,
        updatedAt: now
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'clients');
      throw error;
    }
  };

  const updateClient = async (id: string, data: Partial<Client>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'clients', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${id}`);
    }
  };

  const deleteClient = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clients/${id}`);
    }
  };

  const syncArticlesFromItems = async (items: InvoiceItem[]) => {
    if (!user) return;
    const now = new Date().toISOString();
    
    for (const item of items) {
      if (!item.description || item.description.trim() === '') continue;
      
      // Slugify/Sanitize description for use as ID
      const articleId = articleIdFromDescription(item.description);
      const articleRef = doc(db, 'companies', user.uid, 'articles', articleId);
      
      try {
        await setDoc(articleRef, {
          description: item.description.trim(),
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          usageCount: increment(1),
          updatedAt: now
        }, { merge: true });
      } catch (error) {
        console.error('Error syncing article:', error);
      }
    }
  };

  const addArticle = async (data: Omit<Article, 'id' | 'usageCount' | 'updatedAt'>) => {
    if (!user) throw new Error('Non authentifié');
    try {
      const articleId = articleIdFromDescription(data.description);
      const articleRef = doc(db, 'companies', user.uid, 'articles', articleId);
      
      await setDoc(articleRef, {
        ...data,
        description: data.description.trim(),
        usageCount: 0,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return articleId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'articles');
      throw error;
    }
  };

  const updateArticle = async (id: string, data: Partial<Article>) => {
    if (!user) return;
    try {
      const articleRef = doc(db, 'companies', user.uid, 'articles', id);
      await setDoc(articleRef, {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `articles/${id}`);
    }
  };

  const deleteArticle = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'companies', user.uid, 'articles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `articles/${id}`);
    }
  };

  const importCatalog = async (items: any[]) => {
    if (!user) return;
    const now = new Date().toISOString();
    const errors: unknown[] = [];
    
    for (const item of items) {
      if (item.selected === false) continue;
      if (!item.description || item.description.trim() === '') continue;
      
      const articleId = item.duplicateOfId || articleIdFromDescription(item.description);
      const articleRef = doc(db, 'companies', user.uid, 'articles', articleId);
      
      try {
        const vatRate = Number.parseFloat(String(item.vatRate));
        await setDoc(articleRef, {
          description: item.description.trim(),
          unitPrice: parseFloat(item.unitPrice) || 0,
          vatRate: Number.isFinite(vatRate) ? vatRate : 20,
          unit: item.unit || 'unité',
          category: item.category || '',
          notes: item.notes || '',
          source: item.source || 'spreadsheet_import',
          importedAt: item.importedAt || now,
          usageCount: increment(1),
          updatedAt: now
        }, { merge: true });
      } catch (error) {
        console.error('Error importing article:', error);
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new Error("Certaines prestations n'ont pas pu être importées. Réessayez.");
    }
  };

  const addInvoice = async (data: Omit<Invoice, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) throw new Error('Not authenticated');
    const now = new Date().toISOString();
    try {
      // Check if we need to reset monthly counters
      const companyRef = doc(db, 'companies', user.uid);
      const companySnap = await getDoc(companyRef);
      const companyData = companySnap.exists() ? companySnap.data() : {};
      const currentMonthStart = startOfMonth(new Date()).toISOString();
      const lastReset = companyData.monthlyResetAt;

      const needsReset = !lastReset || new Date(lastReset).getMonth() !== new Date().getMonth();

      if (needsReset) {
        await setDoc(companyRef, {
          monthlyInvoiceCount: 1,
          monthlyAiUsageCount: 0,
          monthlyResetAt: currentMonthStart,
        }, { merge: true });
      } else {
        await setDoc(companyRef, {
          monthlyInvoiceCount: increment(1),
        }, { merge: true });
      }

      const docRef = await addDoc(collection(db, 'invoices'), {
        ...data,
        ownerId: user.uid,
        createdAt: now,
        updatedAt: now
      });

      // Auto-learn articles from this invoice
      syncArticlesFromItems(data.items);

      // Funnel signal — fired client-side. We track creation count, type and
      // total TTC bucket so PostHog can show conversion-from-first-doc rates.
      track('invoice_created', {
        type: data.type || 'invoice',
        total_ttc: Math.round(data.totalTTC || 0),
        item_count: Array.isArray(data.items) ? data.items.length : 0,
        plan: companyData.plan || 'free',
        is_first: (companyData.monthlyInvoiceCount || 0) === 0 && !companyData.lifetimeInvoiceCount,
      });

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invoices');
      throw error;
    }
  };

  const updateInvoice = async (id: string, data: Partial<Invoice>) => {
    if (!user) return;

    // Validation lock: a sealed invoice cannot be freely edited. Only a
    // narrow whitelist of post-validation status transitions is allowed
    // client-side (e.g. mark as paid/overdue/cancelled, log share URL,
    // record provider sync metadata). Anything that would alter the legal
    // content of the invoice MUST go through a credit note.
    //
    // The Firestore security rules enforce the same constraint server-side;
    // this guard is a UX layer so we surface a clear French error before
    // the request even leaves the browser.
    const existing = invoices.find(inv => inv.id === id);
    if (existing?.isLocked) {
      const POST_LOCK_ALLOWED_KEYS = new Set<keyof Invoice>([
        'status',
        'paymentMethod',
        'signature',
        'signedAt',
        'signedByName',
        'shareUrl',
        'sharedQuoteId',
        'eInvoiceStatus',
        'eInvoiceProvider',
        'eInvoiceExternalId',
        'eInvoiceLastSyncAt',
        'eInvoiceErrors',
        'pdpTransmissionHistory',
        'chorusStatus',
        'chorusFluxId',
        'chorusSubmittedAt',
        'chorusError',
        'pennylaneId',
        'pennylaneStatus',
        'creditedBy',
        'creditedAt',
        'chantierPhotos',
      ]);
      const offending = Object.keys(data).filter(
        k => !POST_LOCK_ALLOWED_KEYS.has(k as keyof Invoice)
      );
      if (offending.length > 0) {
        throw new InvoiceLockedError(
          `Facture validée : impossible de modifier ${offending.join(', ')}. Pour corriger, créez un avoir.`
        );
      }
    }

    try {
      await updateDoc(doc(db, 'invoices', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });

      if (data.items) {
        syncArticlesFromItems(data.items);
      }

      // ---- Audit trail wiring ----
      // We log AFTER the write succeeds (no point logging a failure), and
      // fire-and-forget — `logInvoiceEvent` swallows its own errors so a
      // log failure never breaks the user flow. We deliberately log only
      // semantically meaningful changes:
      //  - status transitions on locked invoices (mark_paid, send, cancel)
      //  - content updates that touch legal fields (items, totals, dates,
      //    client, VAT regime, notes) — the kind of edit that would be
      //    suspect on a validated doc, even though our rules already block
      //    those after lock.
      try {
        const prevStatus = existing?.status;
        if (data.status && data.status !== prevStatus) {
          if (data.status === 'paid') {
            void logInvoiceEvent(id, 'mark_paid', { previousStatus: prevStatus });
          } else if (data.status === 'sent') {
            void logInvoiceEvent(id, 'send', { previousStatus: prevStatus });
          } else if (data.status === 'cancelled') {
            void logInvoiceEvent(id, 'cancel', { previousStatus: prevStatus });
          }
        }
        const CONTENT_KEYS: (keyof Invoice)[] = [
          'items', 'totalHT', 'totalVAT', 'totalTTC',
          'date', 'dueDate', 'serviceDate',
          'clientId', 'vatRegime', 'notes',
        ];
        const changedContentKeys = CONTENT_KEYS.filter(k => k in data);
        if (changedContentKeys.length > 0) {
          void logInvoiceEvent(id, 'update', { fields: changedContentKeys });
        }
      } catch {
        // Pure defensive guard — logInvoiceEvent already swallows its
        // network errors. This catch handles anything thrown synchronously
        // before the await (e.g. a serialization issue).
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `invoices/${id}`);
      throw error;
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!user) return;

    // Same legal rationale as updateInvoice: a validated invoice has been
    // assigned a number in a continuous legal sequence. Deleting it would
    // leave a gap, which is suspect under URSSAF/DGFIP audit. To "remove"
    // a validated invoice, the user must issue a credit note.
    const existing = invoices.find(inv => inv.id === id);
    if (existing?.isLocked) {
      throw new InvoiceLockedError(
        'Facture validée : suppression impossible. Pour annuler, créez un avoir.'
      );
    }

    // Log BEFORE the delete: the API endpoint needs to read the invoice to
    // verify ownership. If we deleted first, the audit log call would fail
    // with "not found" and we'd lose the trace of the deletion entirely.
    // `logInvoiceEvent` swallows its own errors, so a failed log won't
    // block the deletion.
    await logInvoiceEvent(id, 'cancel', {
      action: 'delete_draft',
      previousStatus: existing?.status,
    });

    try {
      await deleteDoc(doc(db, 'invoices', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `invoices/${id}`);
    }
  };

  // ---- Server-side validation: assigns the legal number, locks the invoice. ----
  const validateInvoice = async (
    invoiceId: string,
    draft?: Partial<Invoice>
  ): Promise<{ number: string; alreadyValidated: boolean }> => {
    return callApi<{ ok: true; number: string; alreadyValidated: boolean }>(
      '/api/invoice-validate',
      { invoiceId, ...(draft ? { draft } : {}) }
    ).then(r => ({ number: r.number, alreadyValidated: r.alreadyValidated }));
  };

  const updateInvoiceLegalMentions = async (id: string, notes: string): Promise<void> => {
    await callApi<{ ok: true; notes: string }>(
      '/api/invoice-legal-mentions',
      { invoiceId: id, notes }
    );
  };

  // ---- Server-side credit-note creation. ----
  const createCreditNote = async (
    invoiceId: string,
    reason?: string
  ): Promise<{ creditNoteId: string; number: string }> => {
    return callApi<{ ok: true; creditNoteId: string; number: string }>(
      '/api/invoice-credit-note',
      { invoiceId, reason: reason || '' }
    ).then(r => ({ creditNoteId: r.creditNoteId, number: r.number }));
  };

  // ---- Server-side audit-trail event append. ----
  // Failures are NOT thrown — logging an event must never break the user
  // flow (e.g. exporting a PDF). They're surfaced as a console error so we
  // notice in dev/Sentry, but the app keeps working.
  const logInvoiceEvent = async (
    invoiceId: string,
    type: InvoiceEvent['type'],
    metadata?: Record<string, any>
  ): Promise<void> => {
    try {
      await callApi('/api/invoice-event', { invoiceId, type, metadata: metadata || {} });
    } catch (e) {
      console.error('logInvoiceEvent failed:', e);
    }
  };

  // ---- Supplier invoices (factures fournisseurs) ----
  // CRUD client autorisé uniquement pour les docs saisis à la main
  // (providerId vide ou 'manual'). Les docs poussés par PDP sont en
  // lecture seule — les rules Firestore appliquent la même règle.
  const addSupplierInvoice = async (
    data: Omit<SupplierInvoice, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    if (!user) throw new Error('Non authentifié');
    const now = new Date().toISOString();
    try {
      const docRef = await addDoc(collection(db, 'supplierInvoices'), {
        ...data,
        ownerId: user.uid,
        providerId: data.providerId || 'manual',
        receivedAt: data.receivedAt || now,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'supplierInvoices');
      throw error;
    }
  };

  const updateSupplierInvoice = async (id: string, data: Partial<SupplierInvoice>) => {
    if (!user) return;
    const existing = supplierInvoices.find(s => s.id === id);
    // Refuse de modifier un doc poussé par PDP — le source of truth reste la PDP.
    if (existing && existing.providerId && existing.providerId !== 'manual') {
      throw new Error(
        'Cette facture fournisseur a été reçue via une PDP et ne peut être modifiée localement.'
      );
    }
    try {
      await updateDoc(doc(db, 'supplierInvoices', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supplierInvoices/${id}`);
    }
  };

  const deleteSupplierInvoice = async (id: string) => {
    if (!user) return;
    const existing = supplierInvoices.find(s => s.id === id);
    if (existing && existing.providerId && existing.providerId !== 'manual') {
      throw new Error(
        'Cette facture fournisseur provient d\'une PDP et ne peut pas être supprimée localement (vous pouvez l\'archiver).'
      );
    }
    try {
      await deleteDoc(doc(db, 'supplierInvoices', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `supplierInvoices/${id}`);
    }
  };

  const shareQuoteForSignature = async (invoiceId: string): Promise<string> => {
    if (!user || !company) throw new Error('Not authenticated');
    
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.type !== 'quote') throw new Error('Seuls les devis peuvent être envoyés pour signature.');

    const token = await user.getIdToken();
    const response = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'share', invoiceId }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || 'Impossible de créer le lien de signature.');
    }

    return data.shareUrl;
  };

  return (
    <DataContext.Provider value={{
      company, clients, invoices, invoiceEvents, supplierInvoices, articles, loading,
      saveCompany, addClient, updateClient, deleteClient,
      addInvoice, updateInvoice, updateInvoiceLegalMentions, deleteInvoice,
      validateInvoice, createCreditNote, logInvoiceEvent,
      shareQuoteForSignature,
      activateSubscription,
      importCatalog,
      addArticle,
      updateArticle,
      deleteArticle,
      addSupplierInvoice,
      updateSupplierInvoice,
      deleteSupplierInvoice,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
