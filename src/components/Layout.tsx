import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { usePlan } from '../hooks/usePlan';
import { LogOut, LayoutDashboard, FileText, Users, Settings, Plus, Crown, WifiOff, CreditCard, Gift } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { OnboardingTutorial } from './OnboardingTutorial';
import { motion, AnimatePresence } from 'motion/react';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { company, invoices } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!window.navigator.onLine);
  const overdueCount = invoices.filter(
    inv =>
      inv.type === 'invoice' &&
      (inv.status === 'overdue' ||
        (inv.status === 'sent' && inv.dueDate && new Date(inv.dueDate) < new Date()))
  ).length;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { to: '/app', icon: LayoutDashboard, label: 'Accueil', end: true, tourId: 'tour-welcome' },
    { to: '/app/invoices', icon: FileText, label: 'Documents', tourId: 'tour-documents' },
    { to: '/app/clients', icon: Users, label: 'Clients', tourId: 'tour-clients' },
    { to: '/app/settings', icon: Settings, label: 'Paramètres', tourId: 'tour-settings' },
  ];

  const { isFree } = usePlan();

  const initials =
    (user?.displayName || user?.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-on-surface font-body">
      {/* ── Desktop Sidebar (white, Spark) ───────────────────────── */}
      <aside className="hidden md:flex flex-col h-screen w-[240px] bg-white py-5 px-3 fixed left-0 top-0 overflow-y-auto z-50 border-r-spark">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2.5 pb-5">
          <div className="w-[34px] h-[34px] rounded-lg bg-primary/5 flex items-center justify-center overflow-hidden">
            <img src="/icons/icon-192.png" alt="Photofacto" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="wordmark-photofacto text-[18px] leading-none">
              <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[1px] text-on-surface-variant mt-1">
              Facturation IA
            </div>
          </div>
        </div>

        {/* Upgrade card */}
        {isFree && (
          <button
            onClick={() => navigate('/app/upgrade')}
            className="text-left mb-3.5 px-3 py-3 rounded-xl bg-primary/[0.06] border border-primary/15 hover:bg-primary/10 hover:border-primary/25 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Crown className="w-[14px] h-[14px] text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-primary leading-none">
                  Plan Gratuit
                </div>
                <div className="text-[11px] font-semibold text-on-surface mt-1">
                  Voir les avantages Pro
                </div>
              </div>
            </div>
          </button>
        )}

        {/* New doc CTA */}
        <button
          id="tour-new-doc"
          onClick={() => navigate('/app/invoices/new')}
          className="btn-glow flex items-center justify-center gap-2 w-full bg-primary text-on-primary font-bold py-2.5 rounded-[10px] text-[13px] shadow-spark-cta mb-2.5 active:scale-[0.98] transition-transform"
        >
          <Plus className="w-[15px] h-[15px]" strokeWidth={2.5} />
          Nouveau document
        </button>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              id={item.tourId}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] transition-colors text-[13px]',
                  isActive
                    ? 'text-primary bg-primary/[0.08] font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-black/[0.03] font-medium'
                )
              }
            >
              <item.icon className="w-[15px] h-[15px]" strokeWidth={2} />
              <span>{item.label}</span>
              {item.to === '/app/invoices' && overdueCount > 0 && (
                <span className="ml-auto bg-error text-white text-[9px] font-bold px-1.5 py-[2px] rounded-full leading-none">
                  {overdueCount > 9 ? '9+' : overdueCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="mt-auto pt-4 border-t-spark flex items-center gap-2.5 px-1">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 overflow-hidden">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-[12px] font-bold text-white">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-on-surface truncate">
              {user?.displayName || user?.email?.split('@')[0] || 'Utilisateur'}
            </div>
            <div className="text-[10px] text-on-surface-variant truncate">{user?.email}</div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="flex-1 md:ml-[240px] min-h-dvh flex flex-col pb-20 md:pb-0">
        {/* Offline banner */}
        {isOffline && (
          <div className="bg-error text-white px-4 py-2.5 text-center text-sm font-bold flex flex-wrap items-center justify-center gap-2 sticky top-0 z-[100] shadow-md">
            <WifiOff className="w-4 h-4" />
            <span>Mode hors-ligne — IA désactivée. Vos données seront synchronisées plus tard.</span>
          </div>
        )}

        {/* Top bar */}
        <header
          className={cn(
            'sticky top-0 z-40 bg-background/90 backdrop-blur-xl flex justify-between items-center w-full mobile-page-gutter md:px-7 py-2 md:py-3 border-b-spark',
            isOffline && 'mt-0'
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="md:hidden w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center overflow-hidden shrink-0">
              <img src="/icons/icon-192.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="wordmark-photofacto text-[17px] md:hidden min-w-0">
              <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="tour-new-doc-mobile"
              onClick={() => navigate('/app/invoices/new')}
              className="min-touch flex md:hidden items-center gap-1.5 bg-primary text-on-primary font-bold px-3 py-1.5 rounded-[10px] text-xs shadow-spark-cta active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Créer
            </button>

            {/* Profile dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="min-touch rounded-full bg-primary/10 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/30 transition"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[12px] font-bold text-primary">{initials}</span>
                )}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border-spark rounded-2xl shadow-spark-lg overflow-hidden z-50 animate-fade-in">
                  <div className="px-4 py-3 border-b-spark">
                    <p className="text-sm font-bold text-on-surface truncate">
                      {user?.displayName || 'Utilisateur'}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/app/settings');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-primary/5 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-on-surface-variant" />
                      Paramètres
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/app/abonnement');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-primary/5 transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-on-surface-variant" />
                      Mon abonnement
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/app/parrainage');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-primary/5 transition-colors"
                    >
                      <Gift className="w-4 h-4 text-on-surface-variant" />
                      Parrainer un confrère
                    </button>
                    <hr className="my-1 border-outline-variant" />
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error/5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 px-3 py-3 md:p-7 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Nav Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 grid grid-cols-4 items-center gap-0.5 px-1.5 pb-safe pt-1.5 bg-white/95 backdrop-blur-xl border-t-spark shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            id={`${item.tourId}-mobile`}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center px-1 py-1 rounded-xl transition-colors min-w-0',
                'min-h-[50px]',
                isActive ? 'text-primary' : 'text-on-surface-variant'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'p-1 rounded-lg mb-0.5 transition-colors',
                    isActive && 'bg-primary/10'
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" strokeWidth={2} />
                </div>
                <span
                  className={cn(
                    'text-[9px] font-medium flex items-center gap-0.5 leading-tight',
                    isActive && 'font-bold'
                  )}
                >
                  {item.label}
                  {item.to === '/app/invoices' && overdueCount > 0 && (
                    <span className="bg-error text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {overdueCount > 9 ? '9+' : overdueCount}
                    </span>
                  )}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <OnboardingTutorial />
    </div>
  );
}
