import React from 'react';
import { FileText, Users, Search, Plus, Camera, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ──────────────────────────────────────────────────────────────
   PHOTOFACTO — Empty States
   3 reusable empty-state components for invoices, clients, and
   search. Designed with the warm-artisan design system tokens.
   ────────────────────────────────────────────────────────────── */

// ── Shared card shell ────────────────────────────────────────
function EmptyStateCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-8 text-center md:p-12 ${className}`}
      role="status"
    >
      {children}
      <span className="sr-only">empty state</span>
    </div>
  );
}

// ── Reusable primary button ──────────────────────────────────
function PrimaryButton({
  children,
  onClick,
  href,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const base =
    'btn-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-on-primary shadow-spark-cta transition-all hover:shadow-xl active:scale-95 font-headline';
  if (href) {
    return (
      <a href={href} className={`${base} ${className}`}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={`${base} ${className}`}>
      {children}
    </button>
  );
}

// ── Reusable secondary button ────────────────────────────────
function SecondaryButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const base =
    'inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low px-6 py-3 font-bold text-on-surface shadow-sm transition-all hover:bg-surface-container hover:shadow-md active:scale-95 font-headline';
  return (
    <button onClick={onClick} className={`${base} ${className}`}>
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// 1. EmptyInvoicesState
// ═══════════════════════════════════════════════════════════════

export function EmptyInvoicesState() {
  const navigate = useNavigate();

  return (
    <EmptyStateCard>
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <FileText className="h-9 w-9 text-primary" aria-hidden="true" />
      </div>

      {/* Heading */}
      <h2 className="mb-2 text-2xl font-bold leading-tight text-on-surface font-headline md:text-3xl">
        Aucun document pour le moment
      </h2>

      {/* Description */}
      <p className="mx-auto mb-8 max-w-md leading-relaxed text-on-surface-variant">
        Vos factures, devis et avoirs apparaîtront ici. Décrivez ou photographiez
        votre prestation, l'IA prépare un brouillon à corriger.
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <PrimaryButton onClick={() => navigate('/app/invoices/new')}>
          <Camera className="h-5 w-5" />
          Dicter ou photographier
        </PrimaryButton>
        <SecondaryButton onClick={() => navigate('/app/invoices/new?mode=manual')}>
          <Plus className="h-5 w-5" />
          Saisir manuellement
        </SecondaryButton>
      </div>
    </EmptyStateCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. EmptyClientsState
// ═══════════════════════════════════════════════════════════════

interface EmptyClientsStateProps {
  onAddClient?: () => void;
}

export function EmptyClientsState({ onAddClient }: EmptyClientsStateProps) {
  return (
    <EmptyStateCard>
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-tertiary/10">
        <Users className="h-9 w-9 text-tertiary" aria-hidden="true" />
      </div>

      {/* Heading */}
      <h2 className="mb-2 text-2xl font-bold leading-tight text-on-surface font-headline md:text-3xl">
        Pas encore de clients
      </h2>

      {/* Description */}
      <p className="mx-auto mb-8 max-w-md leading-relaxed text-on-surface-variant">
        Ajoutez votre premier client pour commencer à facturer. Vous pourrez aussi les
        importer depuis un fichier Excel plus tard.
      </p>

      {/* Action */}
      <PrimaryButton onClick={onAddClient}>
        <Plus className="h-5 w-5" />
        Ajouter un client
      </PrimaryButton>
    </EmptyStateCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. EmptySearchState
// ═══════════════════════════════════════════════════════════════

interface EmptySearchStateProps {
  message: string;
  onClear: () => void;
}

export function EmptySearchState({ message, onClear }: EmptySearchStateProps) {
  return (
    <EmptyStateCard>
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-high">
        <Search className="h-9 w-9 text-on-surface-variant" aria-hidden="true" />
      </div>

      {/* Heading */}
      <h2 className="mb-2 text-2xl font-bold leading-tight text-on-surface font-headline md:text-3xl">
        Aucun résultat
      </h2>

      {/* Dynamic description */}
      <p className="mx-auto mb-8 max-w-md leading-relaxed text-on-surface-variant">
        {message}
      </p>

      {/* Action */}
      <SecondaryButton onClick={onClear}>
        <ArrowRight className="h-5 w-5" />
        Effacer la recherche
      </SecondaryButton>
    </EmptyStateCard>
  );
}
