import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where, setDoc, addDoc, updateDoc, deleteDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { startOfMonth } from 'date-fns';
import { AppPlan, AppSubscriptionStatus, BillingCycle } from '../lib/billing';

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

export interface Invoice {
  id: string;
  ownerId: string;
  type: 'invoice' | 'quote' | 'deposit' | 'credit';
  clientId: string;
  clientName: string;
  clientEmail?: string;
  number: string;
  date: string;
  dueDate: string;
  serviceDate?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'accepted' | 'converted';
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
  // Chorus Pro / Factur-X e-invoicing fields
  chorusStatus?: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'error';
  chorusFluxId?: string;
  chorusSubmittedAt?: string;
  chorusError?: string;
  // Pennylane alternative
  pennylaneId?: string;
  pennylaneStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Article {
  id: string;
  description: string;
  unitPrice: number;
  vatRate: number;
  usageCount: number;
  updatedAt: string;
}

interface DataContextType {
  company: CompanySettings | null;
  clients: Client[];
  invoices: Invoice[];
  articles: Article[];
  loading: boolean;
  saveCompany: (data: Partial<CompanySettings>) => Promise<void>;
  incrementAiUsage: () => Promise<void>;
  addClient: (data: Omit<Client, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addInvoice: (data: Omit<Invoice, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  shareQuoteForSignature: (invoiceId: string) => Promise<string>;
  activateSubscription: (pendingPlan?: AppPlan, billingCycle?: BillingCycle) => Promise<void>;
  importCatalog: (items: any[]) => Promise<void>;
  addArticle: (data: Omit<Article, 'id' | 'usageCount' | 'updatedAt'>) => Promise<string>;
  updateArticle: (id: string, data: Partial<Article>) => Promise<void>;
  deleteArticle: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCompany(null);
      setClients([]);
      setInvoices([]);
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

    return () => {
      unsubCompany();
      unsubClients();
      unsubInvoices();
      unsubArticles();
    };
  }, [user]);

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
      handleFirestoreError(error, OperationType.WRITE, `companies/${user.uid}`);
    }
  };

  const incrementAiUsage = async () => {
    if (!user) return;
    const companyRef = doc(db, 'companies', user.uid);
    const companySnap = await getDoc(companyRef);
    const companyData = companySnap.exists() ? companySnap.data() : {};
    const currentMonthStart = startOfMonth(new Date()).toISOString();
    const lastReset = companyData.monthlyResetAt;
    const needsReset = !lastReset || new Date(lastReset).getMonth() !== new Date().getMonth();

    if (needsReset) {
      await setDoc(companyRef, {
        monthlyInvoiceCount: companyData.monthlyInvoiceCount || 0,
        monthlyAiUsageCount: 1,
        monthlyResetAt: currentMonthStart,
      }, { merge: true });
    } else {
      await setDoc(companyRef, {
        monthlyAiUsageCount: increment(1),
      }, { merge: true });
    }
  };

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
      const articleId = item.description.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
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
      const articleId = data.description.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
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
    
    for (const item of items) {
      if (!item.description || item.description.trim() === '') continue;
      
      const articleId = item.description.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
      const articleRef = doc(db, 'companies', user.uid, 'articles', articleId);
      
      try {
        await setDoc(articleRef, {
          description: item.description.trim(),
          unitPrice: parseFloat(item.unitPrice) || 0,
          vatRate: parseFloat(item.vatRate) || 20,
          usageCount: increment(1),
          updatedAt: now
        }, { merge: true });
      } catch (error) {
        console.error('Error importing article:', error);
      }
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

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invoices');
      throw error;
    }
  };

  const updateInvoice = async (id: string, data: Partial<Invoice>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'invoices', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });

      if (data.items) {
        syncArticlesFromItems(data.items);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `invoices/${id}`);
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'invoices', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `invoices/${id}`);
    }
  };

  const shareQuoteForSignature = async (invoiceId: string): Promise<string> => {
    if (!user || !company) throw new Error('Not authenticated');
    
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    // Create a public shared quote document
    const sharedData = {
      originalInvoiceId: invoiceId,
      ownerId: user.uid,
      number: invoice.number,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail || '',
      date: invoice.date,
      dueDate: invoice.dueDate,
      items: invoice.items,
      totalHT: invoice.totalHT,
      totalTTC: invoice.totalTTC,
      totalVAT: invoice.totalVAT,
      vatRegime: invoice.vatRegime || 'standard',
      notes: invoice.notes || '',
      companyName: company.name || '',
      companyAddress: company.address || '',
      companyEmail: company.email || '',
      companyPhone: company.phone || '',
      companySiret: company.siret || '',
      status: 'pending_signature',
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'sharedQuotes'), sharedData);
    const shareUrl = `${window.location.origin}/sign/${docRef.id}`;

    // Save the share link back to the invoice
    await updateDoc(doc(db, 'invoices', invoiceId), {
      shareUrl,
      sharedQuoteId: docRef.id,
      updatedAt: new Date().toISOString(),
    });

    return shareUrl;
  };

  return (
    <DataContext.Provider value={{
      company, clients, invoices, articles, loading,
      saveCompany, incrementAiUsage, addClient, updateClient, deleteClient,
      addInvoice, updateInvoice, deleteInvoice,
      shareQuoteForSignature,
      activateSubscription,
      importCatalog,
      addArticle,
      updateArticle,
      deleteArticle
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
