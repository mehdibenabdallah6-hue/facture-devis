import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkClaim() {
      if (!user) {
        if (mounted) {
          setIsAdmin(false);
          setChecking(false);
        }
        return;
      }
      try {
        const token = await user.getIdTokenResult();
        if (mounted) setIsAdmin(token.claims.admin === true);
      } catch {
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setChecking(false);
      }
    }
    setChecking(true);
    checkClaim();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface">
        Vérification des droits admin...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" replace />;
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-surface px-6 py-12 text-on-surface">
        <div className="mx-auto max-w-lg rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-8 text-center shadow-spark-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Admin</p>
          <h1 className="font-headline text-2xl font-extrabold mb-2">Accès refusé</h1>
          <p className="text-sm text-on-surface-variant">
            Votre compte est connecté, mais le claim Firebase <code>admin</code> n’est pas activé.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
