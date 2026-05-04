import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, LogOut, Mail, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requiresEmailVerification } from '../lib/authVerification';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const { user, loading, logout, refreshUser, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'checking' | 'resending'>('idle');
  const [message, setMessage] = useState("Nous avons envoyé un email de vérification. Cliquez sur le lien reçu pour continuer.");
  const [error, setError] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState(() => Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
  const [, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && user && !requiresEmailVerification(user)) {
      navigate('/app', { replace: true });
    }
  }, [loading, navigate, user]);

  const cooldown = useMemo(
    () => Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)),
    [resendAvailableAt],
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#fbf7f2] text-on-surface">Chargement...</div>;
  }

  if (!user) {
    return <Navigate to="/connexion" replace />;
  }

  const handleCheck = async () => {
    setStatus('checking');
    setError('');
    try {
      const refreshed = await refreshUser();
      if (refreshed && !requiresEmailVerification(refreshed)) {
        navigate('/app', { replace: true });
        return;
      }
      setMessage("Votre email n'est pas encore vérifié. Ouvrez le lien reçu, puis cliquez à nouveau ici.");
    } catch (err: any) {
      setError(err?.message || "Impossible de vérifier l'état du compte.");
    } finally {
      setStatus('idle');
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setStatus('resending');
    setError('');
    try {
      await resendVerificationEmail();
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setMessage('Nouvel email envoyé. Pensez à vérifier vos spams si vous ne le voyez pas.');
    } catch (err: any) {
      setError(err?.message || "Impossible de renvoyer l'email de vérification.");
    } finally {
      setStatus('idle');
    }
  };

  return (
    <main className="min-h-screen bg-[#fbf7f2] px-4 py-8 text-on-surface flex items-center justify-center">
      <section className="w-full max-w-xl rounded-[2rem] border border-black/5 bg-white p-6 sm:p-8 shadow-2xl shadow-black/10">
        <Link to="/" className="inline-flex items-center gap-2 font-headline font-black text-xl mb-8">
          PHOTO<span className="text-primary">FACTO</span>
        </Link>

        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
          <Mail className="w-8 h-8" />
        </div>

        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-2">Vérification email</p>
        <h1 className="font-headline font-black text-3xl sm:text-4xl mb-3">Vérifiez votre adresse email</h1>
        <p className="text-on-surface-variant leading-relaxed">
          {message}
        </p>

        <div className="mt-5 rounded-2xl bg-surface-container-low border border-outline-variant/10 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Email utilisé</p>
          <p className="font-bold text-on-surface mt-1 break-all">{user.email || 'Email non disponible'}</p>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl bg-error/10 border border-error/20 text-error px-4 py-3 text-sm font-semibold">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={handleCheck}
            disabled={status !== 'idle'}
            className="min-touch inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-black text-white shadow-spark-cta-lg transition active:scale-[0.98] disabled:opacity-60"
          >
            {status === 'checking' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            J’ai vérifié mon email
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={status !== 'idle' || cooldown > 0}
            className="min-touch inline-flex items-center justify-center gap-2 rounded-2xl border border-outline-variant/20 bg-white px-5 py-4 font-black text-on-surface transition hover:bg-surface-container-low active:scale-[0.98] disabled:opacity-60"
          >
            {status === 'resending' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer l'email de vérification"}
          </button>

          <button
            type="button"
            onClick={logout}
            className="min-touch inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 font-black text-on-surface-variant transition hover:bg-surface-container-low active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5" />
            Se déconnecter
          </button>
        </div>
      </section>
    </main>
  );
}
