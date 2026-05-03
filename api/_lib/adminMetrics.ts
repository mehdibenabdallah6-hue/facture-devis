import {
  ADMIN_ALLOWED_EVENTS,
  anonymizeId,
  classifySeverity,
  incrementCounter,
  isErrorLikeType,
  maskEmail,
  monthBucket,
  percent,
  safeActivationStatus,
  safeDocumentStatus,
  safeIsoDate,
  safePlan,
  safeProfession,
  safeSubscriptionStatus,
  sanitizeErrorType,
  sanitizeRoute,
  toDate,
  truncateUid,
} from './adminSanitize.js';
import type { AdminPostHogOverview } from './adminPosthog.js';
import { countForEvent, usersForEvent } from './adminPosthog.js';

export type AdminAuthUser = {
  uid: string;
  email: string;
  createdAt: string;
  lastSignInAt: string;
};

export type AdminDoc = {
  id: string;
  data: Record<string, any>;
};

export type AdminDataset = {
  authUsers: AdminAuthUser[];
  companies: AdminDoc[];
  clients: AdminDoc[];
  invoices: AdminDoc[];
  invoiceEvents: AdminDoc[];
  auditEvents: AdminDoc[];
};

export type AdminUserRow = {
  userKey: string;
  uidShort: string;
  emailMasked: string;
  createdAt: string;
  lastActivityAt: string;
  createdMonth: string;
  plan: string;
  subscriptionStatus: string;
  profession: string;
  hasCompany: boolean;
  hasClient: boolean;
  quoteCount: number;
  invoiceCount: number;
  validatedInvoiceCount: number;
  signedQuoteCount: number;
  aiUsed: boolean;
  quotaReached: boolean;
  upgradeClicked: boolean;
  checkoutStarted: boolean;
  paid: boolean;
  errors7d: number;
  activationStatus: string;
  invoiceUsageBucket: string;
  aiUsageBucket: string;
};

export async function loadAdminDataset(db: any, auth: any): Promise<AdminDataset> {
  const [authUsers, companies, clients, invoices, invoiceEvents, auditEvents] = await Promise.all([
    listAuthUsers(auth),
    readCollection(db, 'companies', 3000),
    readCollection(db, 'clients', 8000),
    readCollection(db, 'invoices', 12000),
    readCollection(db, 'invoiceEvents', 8000),
    readCollection(db, 'auditTrail', 3000),
  ]);

  return { authUsers, companies, clients, invoices, invoiceEvents, auditEvents };
}

export function buildAdminUserRows(dataset: AdminDataset, posthog?: AdminPostHogOverview): AdminUserRow[] {
  const uidSet = new Set<string>();
  dataset.authUsers.forEach(user => uidSet.add(user.uid));
  dataset.companies.forEach(company => uidSet.add(company.id));
  dataset.clients.forEach(client => {
    const ownerId = String(client.data.ownerId || '');
    if (ownerId) uidSet.add(ownerId);
  });
  dataset.invoices.forEach(invoice => {
    const ownerId = String(invoice.data.ownerId || '');
    if (ownerId) uidSet.add(ownerId);
  });

  const authByUid = new Map(dataset.authUsers.map(user => [user.uid, user]));
  const companyByUid = new Map(dataset.companies.map(company => [company.id, company.data]));
  const clientsByUid = groupByOwner(dataset.clients);
  const invoicesByUid = groupByOwner(dataset.invoices);
  const eventsByUid = groupByOwner(dataset.invoiceEvents);
  const recentPostHog = posthog?.recent || [];
  const upgradeUsers = new Set(recentPostHog.filter(row => row.event === 'clicked_upgrade_plan').map(row => row.userKey));
  const checkoutUsers = new Set(recentPostHog.filter(row => row.event === 'checkout_started').map(row => row.userKey));
  const quotaUsers = new Set(recentPostHog.filter(row => row.event === 'quota_limit_reached').map(row => row.userKey));

  return Array.from(uidSet).map(uid => {
    const authUser = authByUid.get(uid);
    const company = companyByUid.get(uid) || {};
    const userClients = clientsByUid.get(uid) || [];
    const userInvoices = invoicesByUid.get(uid) || [];
    const userEvents = eventsByUid.get(uid) || [];
    const userKey = anonymizeId(uid);
    const quoteCount = userInvoices.filter(doc => doc.data.type === 'quote').length;
    const invoiceCount = userInvoices.filter(doc => doc.data.type === 'invoice').length;
    const validatedInvoiceCount = userInvoices.filter(doc => isValidatedInvoice(doc.data)).length;
    const signedQuoteCount = userInvoices.filter(doc => isSignedQuote(doc.data)).length;
    const sentOrValidatedCount = userInvoices.filter(doc => isSentSignedOrValidated(doc.data)).length;
    const errors7d = userEvents.filter(doc => isRecent(doc.data.timestamp || doc.data.createdAt, 7) && isErrorLikeType(doc.data.type)).length;
    const quotaReached = quotaUsers.has(userKey) || userEvents.some(doc => /quota/i.test(String(doc.data.type || '')));
    const paid = isPaying(company);
    const aiUsed = Number(company.monthlyAiUsageCount || 0) > 0 ||
      recentPostHog.some(row => row.userKey === userKey && row.event.startsWith('ai_extraction_'));
    const upgradeClicked = upgradeUsers.has(userKey);
    const checkoutStarted = checkoutUsers.has(userKey);
    const lastActivityAt = maxIso([
      authUser?.lastSignInAt,
      company.updatedAt,
      ...userClients.map(doc => doc.data.updatedAt || doc.data.createdAt),
      ...userInvoices.map(doc => doc.data.updatedAt || doc.data.createdAt || doc.data.date),
      ...userEvents.map(doc => doc.data.timestamp || doc.data.createdAt),
    ]);
    const activationStatus = computeActivationStatus({
      paid,
      hasCompany: Boolean(companyByUid.has(uid)),
      hasClient: userClients.length > 0,
      docCount: userInvoices.length,
      sentOrValidatedCount,
      quoteCount,
      invoiceCount,
      signedQuoteCount,
      validatedInvoiceCount,
      quotaReached,
      errors7d,
      checkoutStarted,
    });

    return {
      userKey,
      uidShort: truncateUid(uid),
      emailMasked: maskEmail(authUser?.email || company.email),
      createdAt: safeIsoDate(authUser?.createdAt || company.createdAt),
      lastActivityAt,
      createdMonth: monthBucket(authUser?.createdAt || company.createdAt),
      plan: safePlan(company.plan),
      subscriptionStatus: safeSubscriptionStatus(company.subscriptionStatus),
      profession: safeProfession(company.profession),
      hasCompany: Boolean(companyByUid.has(uid)),
      hasClient: userClients.length > 0,
      quoteCount,
      invoiceCount,
      validatedInvoiceCount,
      signedQuoteCount,
      aiUsed,
      quotaReached,
      upgradeClicked,
      checkoutStarted,
      paid,
      errors7d,
      activationStatus,
      invoiceUsageBucket: bucketCount(company.monthlyInvoiceCount),
      aiUsageBucket: bucketCount(company.monthlyAiUsageCount),
    };
  }).sort((a, b) => (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''));
}

export function buildAdminSummary(dataset: AdminDataset, posthog: AdminPostHogOverview) {
  const users = buildAdminUserRows(dataset, posthog);
  const companiesByUid = new Map(dataset.companies.map(company => [company.id, company.data]));
  const activeSubscriptions = users.filter(user => user.paid).length;
  const plans: Record<string, number> = {};
  const subscriptions: Record<string, number> = {};
  const documentsByType: Record<string, number> = {};
  const documentsByStatus: Record<string, number> = {};
  const errors = buildAdminErrors(dataset).recent;

  dataset.companies.forEach(company => {
    incrementCounter(plans, safePlan(company.data.plan));
    incrementCounter(subscriptions, safeSubscriptionStatus(company.data.subscriptionStatus));
  });
  dataset.invoices.forEach(invoice => {
    incrementCounter(documentsByType, documentType(invoice.data));
    incrementCounter(documentsByStatus, safeDocumentStatus(invoice.data.status));
  });

  const totalUsers = users.length || dataset.authUsers.length || dataset.companies.length;
  const activatedUsers = users.filter(user => ['activated', 'power_user', 'paying'].includes(user.activationStatus)).length;
  const quoteCreated7d = countDocs(dataset.invoices, 7, doc => doc.type === 'quote');
  const quoteCreated30d = countDocs(dataset.invoices, 30, doc => doc.type === 'quote');
  const invoiceCreated7d = countDocs(dataset.invoices, 7, doc => doc.type === 'invoice');
  const invoiceCreated30d = countDocs(dataset.invoices, 30, doc => doc.type === 'invoice');
  const invoiceValidated7d = countDocs(dataset.invoices, 7, isValidatedInvoice);
  const invoiceValidated30d = countDocs(dataset.invoices, 30, isValidatedInvoice);
  const quoteSigned7d = countDocs(dataset.invoices, 7, isSignedQuote);
  const quoteSigned30d = countDocs(dataset.invoices, 30, isSignedQuote);
  const emailsSent7d = countEvents(dataset.invoiceEvents, 7, event => /email_sent|reminder_sent|send/i.test(String(event.type || '')));
  const emailsSent30d = countEvents(dataset.invoiceEvents, 30, event => /email_sent|reminder_sent|send/i.test(String(event.type || '')));
  const errors24h = errors.filter(error => isRecent(error.timestamp, 1)).length;
  const errors7d = errors.filter(error => isRecent(error.timestamp, 7)).length;

  const aiStarted7d = countForEvent(posthog.counts7d, 'ai_extraction_started');
  const aiSucceeded7d = countForEvent(posthog.counts7d, 'ai_extraction_succeeded');
  const aiFailed7d = countForEvent(posthog.counts7d, 'ai_extraction_failed');
  const checkoutStarted7d = countForEvent(posthog.counts7d, 'checkout_started');
  const subscriptionStarted7d = countForEvent(posthog.counts7d, 'subscription_started');

  return {
    acquisition: {
      totalUsers,
      newUsersToday: users.filter(user => isRecent(user.createdAt, 1)).length,
      newUsers7d: users.filter(user => isRecent(user.createdAt, 7)).length,
      newUsers30d: users.filter(user => isRecent(user.createdAt, 30)).length,
      activeUsers24h: users.filter(user => isRecent(user.lastActivityAt, 1)).length,
      activeUsers7d: users.filter(user => isRecent(user.lastActivityAt, 7)).length,
      activeUsers30d: users.filter(user => isRecent(user.lastActivityAt, 30)).length,
      companiesCreated: dataset.companies.length,
      usersWithCompany: users.filter(user => user.hasCompany).length,
      usersWithoutCompany: users.filter(user => !user.hasCompany).length,
    },
    activation: {
      activatedUsers,
      activationRate: percent(activatedUsers, totalUsers),
      nonActivatedUsers: Math.max(totalUsers - activatedUsers, 0),
      signedUpNoDocument: users.filter(user => user.quoteCount + user.invoiceCount === 0).length,
      companyNoDocument: users.filter(user => user.hasCompany && user.quoteCount + user.invoiceCount === 0).length,
      documentNoSendSignatureValidation: users.filter(user => user.quoteCount + user.invoiceCount > 0 && user.signedQuoteCount + user.validatedInvoiceCount === 0).length,
    },
    documents: {
      total: dataset.invoices.length,
      byType: documentsByType,
      byStatus: documentsByStatus,
      quotesCreated7d: quoteCreated7d,
      quotesCreated30d: quoteCreated30d,
      invoicesCreated7d: invoiceCreated7d,
      invoicesCreated30d: invoiceCreated30d,
      invoicesValidated7d: invoiceValidated7d,
      invoicesValidated30d: invoiceValidated30d,
      quotesSigned7d: quoteSigned7d,
      quotesSigned30d: quoteSigned30d,
      emailsSent7d,
      emailsSent30d,
    },
    ai: {
      started7d: aiStarted7d,
      started30d: countForEvent(posthog.counts30d, 'ai_extraction_started'),
      succeeded7d: aiSucceeded7d,
      succeeded30d: countForEvent(posthog.counts30d, 'ai_extraction_succeeded'),
      failed7d: aiFailed7d,
      failed30d: countForEvent(posthog.counts30d, 'ai_extraction_failed'),
      successRate7d: percent(aiSucceeded7d, aiSucceeded7d + aiFailed7d),
      usersUsedAi: users.filter(user => user.aiUsed).length,
      quotaReachedUsers: users.filter(user => user.quotaReached).length,
      recentErrors: errors.filter(error => /ai|gemini|quota/i.test(error.type)).slice(0, 8),
    },
    business: {
      plans,
      subscriptions,
      checkoutStarted7d,
      checkoutStarted30d: countForEvent(posthog.counts30d, 'checkout_started'),
      subscriptionStarted7d,
      subscriptionStarted30d: countForEvent(posthog.counts30d, 'subscription_started'),
      checkoutToSubscriptionRate7d: percent(subscriptionStarted7d, checkoutStarted7d),
      upgradeClicked7d: countForEvent(posthog.counts7d, 'clicked_upgrade_plan'),
      upgradeClicked30d: countForEvent(posthog.counts30d, 'clicked_upgrade_plan'),
      clickedUpgradeNoPaying: users.filter(user => user.upgradeClicked && !user.paid).length,
      activeSubscriptions,
      cancelledSubscriptions: users.filter(user => user.subscriptionStatus === 'cancelled').length,
      pastDueSubscriptions: users.filter(user => user.subscriptionStatus === 'past_due').length,
    },
    errors: {
      errors24h,
      errors7d,
      bySeverity: countBy(errors, row => row.severity),
    },
    funnel: buildFunnel([
      ['user_signed_up', totalUsers],
      ['company_created', users.filter(user => user.hasCompany).length],
      ['client_created', users.filter(user => user.hasClient).length],
      ['quote_or_invoice_created', users.filter(user => user.quoteCount + user.invoiceCount > 0).length],
      ['sent_or_validated', users.filter(user => user.signedQuoteCount + user.validatedInvoiceCount > 0).length],
      ['checkout_started', usersForEvent(posthog.counts30d, 'checkout_started')],
      ['subscription_started', activeSubscriptions],
    ]),
    blockedUsersSummary: {
      noCompany24h: users.filter(user => !user.hasCompany && olderThan(user.createdAt, 1)).length,
      companyNoClient: users.filter(user => user.hasCompany && !user.hasClient).length,
      clientNoDocument: users.filter(user => user.hasClient && user.quoteCount + user.invoiceCount === 0).length,
      documentNeverSent: users.filter(user => user.quoteCount + user.invoiceCount > 0 && user.signedQuoteCount + user.validatedInvoiceCount === 0).length,
      quotaReached: users.filter(user => user.quotaReached).length,
      recentError: users.filter(user => user.errors7d > 0).length,
      checkoutNoPayment: users.filter(user => user.checkoutStarted && !user.paid).length,
    },
    posthog: {
      configured: posthog.configured,
      warning: posthog.warning || '',
    },
  };
}

export function buildAdminErrors(dataset: AdminDataset) {
  const raw = [...dataset.invoiceEvents, ...dataset.auditEvents];
  const recent = raw
    .map(doc => {
      const data = doc.data || {};
      const type = sanitizeErrorType(data.type);
      if (!isErrorLikeType(type)) return null;
      const metadata = typeof data.metadata === 'object' && data.metadata ? data.metadata : {};
      return {
        type,
        route: sanitizeRoute(metadata.route || metadata.path || metadata.source || data.route),
        severity: classifySeverity(type),
        userKey: anonymizeId(data.ownerId || data.actorId || data.userId || 'unknown'),
        timestamp: safeIsoDate(data.timestamp || data.createdAt),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || '')) as Array<{
      type: string;
      route: string;
      severity: 'critical' | 'warning' | 'info';
      userKey: string;
      timestamp: string;
    }>;

  return {
    recent: recent.slice(0, 100),
    byType: countBy(recent, row => row.type),
    byRoute: countBy(recent, row => row.route),
    bySeverity: countBy(recent, row => row.severity),
    affectedUsers: new Set(recent.map(row => row.userKey)).size,
  };
}

function buildFunnel(steps: Array<[string, number]>) {
  const signupCount = steps[0]?.[1] || 0;
  return steps.map(([event, count], index) => {
    const previous = index === 0 ? count : steps[index - 1][1];
    return {
      event,
      count,
      conversionFromPrevious: index === 0 ? 100 : percent(count, previous),
      conversionFromSignup: index === 0 ? 100 : percent(count, signupCount),
    };
  });
}

function countBy<T>(rows: T[], getKey: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  rows.forEach(row => incrementCounter(counts, getKey(row)));
  return counts;
}

function countDocs(docs: AdminDoc[], days: number, predicate: (data: Record<string, any>) => boolean): number {
  return docs.filter(doc => predicate(doc.data) && isRecent(doc.data.createdAt || doc.data.updatedAt || doc.data.date, days)).length;
}

function countEvents(docs: AdminDoc[], days: number, predicate: (data: Record<string, any>) => boolean): number {
  return docs.filter(doc => predicate(doc.data) && isRecent(doc.data.timestamp || doc.data.createdAt, days)).length;
}

function documentType(data: Record<string, any>): string {
  if (data.type === 'quote') return 'quote';
  if (data.type === 'credit') return 'credit';
  if (data.type === 'deposit') return 'deposit';
  return 'invoice';
}

function isValidatedInvoice(data: Record<string, any>): boolean {
  return data.type === 'invoice' && (
    data.isLocked === true ||
    Boolean(data.validatedAt) ||
    ['validated', 'sent', 'paid', 'overdue', 'cancelled'].includes(String(data.status || ''))
  );
}

function isSignedQuote(data: Record<string, any>): boolean {
  return data.type === 'quote' && (
    Boolean(data.signedAt) ||
    data.status === 'accepted'
  );
}

function isSentSignedOrValidated(data: Record<string, any>): boolean {
  return isValidatedInvoice(data) || isSignedQuote(data) || ['sent', 'accepted', 'converted'].includes(String(data.status || ''));
}

function computeActivationStatus(opts: {
  paid: boolean;
  hasCompany: boolean;
  hasClient: boolean;
  docCount: number;
  sentOrValidatedCount: number;
  quoteCount: number;
  invoiceCount: number;
  signedQuoteCount: number;
  validatedInvoiceCount: number;
  quotaReached: boolean;
  errors7d: number;
  checkoutStarted: boolean;
}): string {
  if (opts.paid) return 'paying';
  if (opts.quotaReached || opts.errors7d > 0 || (opts.checkoutStarted && !opts.paid)) return 'blocked';
  if (opts.docCount >= 5 || (opts.signedQuoteCount > 0 && opts.validatedInvoiceCount > 0)) return 'power_user';
  if (opts.hasCompany && opts.hasClient && opts.docCount > 0) return 'activated';
  if (opts.hasCompany) return 'company_created';
  if (opts.hasClient || opts.docCount > 0) return 'onboarding_started';
  return safeActivationStatus('new');
}

function isPaying(company: Record<string, any>): boolean {
  const plan = safePlan(company.plan);
  const status = safeSubscriptionStatus(company.subscriptionStatus);
  return ['starter', 'pro'].includes(plan) && ['active', 'trialing'].includes(status);
}

function groupByOwner(docs: AdminDoc[]): Map<string, AdminDoc[]> {
  const map = new Map<string, AdminDoc[]>();
  docs.forEach(doc => {
    const ownerId = String(doc.data.ownerId || doc.id || '');
    if (!ownerId) return;
    if (!map.has(ownerId)) map.set(ownerId, []);
    map.get(ownerId)!.push(doc);
  });
  return map;
}

async function readCollection(db: any, name: string, limit: number): Promise<AdminDoc[]> {
  try {
    const ref = db.collection(name);
    const snap = typeof ref.limit === 'function'
      ? await ref.limit(limit).get()
      : await ref.get();
    return (snap.docs || []).map((doc: any) => ({
      id: String(doc.id || ''),
      data: doc.data ? (doc.data() || {}) : {},
    }));
  } catch {
    return [];
  }
}

async function listAuthUsers(auth: any): Promise<AdminAuthUser[]> {
  if (!auth || typeof auth.listUsers !== 'function') return [];
  const users: AdminAuthUser[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    (page.users || []).forEach((user: any) => {
      users.push({
        uid: String(user.uid || ''),
        email: String(user.email || ''),
        createdAt: safeIsoDate(user.metadata?.creationTime),
        lastSignInAt: safeIsoDate(user.metadata?.lastSignInTime),
      });
    });
    pageToken = page.pageToken;
  } while (pageToken && users.length < 5000);
  return users.filter(user => user.uid);
}

function isRecent(value: unknown, days: number): boolean {
  const date = toDate(value);
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function olderThan(value: unknown, days: number): boolean {
  const date = toDate(value);
  if (!date) return false;
  return Date.now() - date.getTime() > days * 24 * 60 * 60 * 1000;
}

function maxIso(values: unknown[]): string {
  let max = 0;
  values.forEach(value => {
    const date = toDate(value);
    if (date && date.getTime() > max) max = date.getTime();
  });
  return max ? new Date(max).toISOString() : '';
}

function bucketCount(value: unknown): string {
  const count = Math.max(0, Math.round(Number(value || 0)));
  if (count === 0) return '0';
  if (count <= 2) return '1_2';
  if (count <= 5) return '3_5';
  if (count <= 10) return '6_10';
  if (count <= 20) return '11_20';
  return '21_plus';
}
