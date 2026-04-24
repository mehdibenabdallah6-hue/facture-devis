/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { ToastProvider } from './contexts/ToastContext';
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Onboarding from './pages/Onboarding';
import OnboardingSuccess from './pages/OnboardingSuccess';
import MentionsLegales from './pages/MentionsLegales';
import CGV from './pages/CGV';
import PrivacyPolicy from './pages/PrivacyPolicy';
import NotFound from './pages/NotFound';
import PublicSignature from './pages/PublicSignature';
import { initPostHog, initSentry, identifyUser } from './services/analytics';

// Initialize analytics (no-op if env vars not set)
initPostHog();
initSentry();

// Lazy-loaded pages (code-splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const InvoicesList = lazy(() => import('./pages/InvoicesList'));
const InvoiceCreate = lazy(() => import('./pages/InvoiceCreate'));
const ClientsList = lazy(() => import('./pages/ClientsList'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const Contact = lazy(() => import('./pages/Contact'));
const Changelog = lazy(() => import('./pages/Changelog'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));

// Loading fallback for lazy routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium">Chargement...</span>
    </div>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: dataLoading } = useData();
  const location = useLocation();

  // Identify user in analytics
  useEffect(() => {
    if (user) {
      identifyUser(user.uid, user.email || undefined);
    }
  }, [user]);
  
  if (authLoading || dataLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface">Chargement...</div>;
  }
  
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Check if onboarding is needed
  const needsOnboarding = !company || !company.profession || !company.name || company.name === 'Mon Entreprise';
  const isOnboardingRoute = location.pathname === '/app/onboarding' || location.pathname === '/app/onboarding-success';

  if (needsOnboarding && !isOnboardingRoute) {
    return <Navigate to="/app/onboarding" replace />;
  }

  if (!needsOnboarding && location.pathname === '/app/onboarding') {
    return <Navigate to="/app" replace />;
  }

  // Plan-based access: all plans (free/starter/pro) can access the app.
  // Limits are enforced in InvoiceCreate and other pages via usePlan() gates.
  
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/plombier" element={<LandingPage profession="plombier" />} />
              <Route path="/electricien" element={<LandingPage profession="electricien" />} />
              <Route path="/macon" element={<LandingPage profession="macon" />} />
              <Route path="/peintre" element={<LandingPage profession="peintre" />} />
              <Route path="/carreleur" element={<LandingPage profession="carreleur" />} />
              <Route path="/couvreur" element={<LandingPage profession="couvreur" />} />
              <Route path="/menuisier" element={<LandingPage profession="menuisier" />} />
              <Route path="/serrurier" element={<LandingPage profession="serrurier" />} />
              <Route path="/plaquiste" element={<LandingPage profession="plaquiste" />} />
              <Route path="/chauffagiste" element={<LandingPage profession="chauffagiste" />} />
              <Route path="/paysagiste" element={<LandingPage profession="paysagiste" />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="/cgv" element={<CGV />} />
              <Route path="/confidentialite" element={<PrivacyPolicy />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/nouveautes" element={<Changelog />} />
              <Route path="/sign/:quoteId" element={<PublicSignature />} />
              <Route path="*" element={<NotFound />} />
              <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                <Route path="invoices" element={<Suspense fallback={<PageLoader />}><InvoicesList /></Suspense>} />
                <Route path="invoices/new" element={<Suspense fallback={<PageLoader />}><InvoiceCreate /></Suspense>} />
                <Route path="invoices/:id" element={<Suspense fallback={<PageLoader />}><InvoiceCreate /></Suspense>} />
                <Route path="clients" element={<Suspense fallback={<PageLoader />}><ClientsList /></Suspense>} />
                <Route path="clients/:id" element={<Suspense fallback={<PageLoader />}><ClientDetail /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
                <Route path="abonnement" element={<Suspense fallback={<PageLoader />}><Subscription /></Suspense>} />
                <Route path="parrainage" element={<Suspense fallback={<PageLoader />}><ReferralPage /></Suspense>} />
                <Route path="upgrade" element={<Suspense fallback={<PageLoader />}><Upgrade /></Suspense>} />
              </Route>
              <Route path="/app/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/app/onboarding-success" element={<ProtectedRoute><OnboardingSuccess /></ProtectedRoute>} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
