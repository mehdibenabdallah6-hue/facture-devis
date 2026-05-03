import React from 'react';
import { NavLink } from 'react-router-dom';
import PhotofactoWordmark from '../../components/PhotofactoWordmark';

const navItems = [
  { to: '/admin', label: 'Vue globale', end: true },
  { to: '/admin/users', label: 'Utilisateurs' },
  { to: '/admin/events', label: 'Événements' },
  { to: '/admin/errors', label: 'Erreurs' },
];

export function AdminShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fffaf5_0%,#f7f2ec_52%,#eef7f4_100%)] text-on-surface">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl object-contain shadow-sm" />
            <div>
              <PhotofactoWordmark className="text-lg" />
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Admin V2 read-only</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-spark-cta'
                      : 'bg-white/70 text-on-surface-variant hover:-translate-y-0.5 hover:bg-white hover:text-on-surface hover:shadow-sm'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-headline text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

export const AdminCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => {
  return (
    <div className={`rounded-3xl border border-outline-variant/15 bg-white/85 p-5 shadow-spark-sm backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
};
