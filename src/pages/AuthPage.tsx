import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requiresEmailVerification } from '../lib/authVerification';

function getAuthMessage(code?: string) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cet email. Connectez-vous plutôt.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email ou mot de passe incorrect.';
    case 'auth/weak-password':
      return 'Choisissez un mot de passe d’au moins 6 caractères.';
    case 'auth/operation-not-allowed':
      return 'La connexion email/mot de passe doit être activée dans Firebase.';
    default:
      return 'Impossible de continuer pour le moment. Réessayez.';
  }
}

export default function AuthPage() {
  const { user, login, loginWithEmail, registerWithEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    navigate(requiresEmailVerification(user) ? '/verify-email' : '/app', { replace: true });
  }, [navigate, user]);

  const title = mode === 'register' ? 'Créer votre compte' : 'Se connecter';
  const cta = mode === 'register' ? 'Créer mon compte' : 'Me connecter';
  const switchText = mode === 'register' ? 'Déjà un compte ?' : 'Pas encore de compte ?';
  const switchLabel = mode === 'register' ? 'Se connecter' : 'Créer un compte';
  const helper = useMemo(
    () =>
      mode === 'register'
        ? 'Email, mot de passe, puis vérification de votre adresse avant accès à l’app.'
        : 'Connectez-vous avec votre email ou Google. La session est mémorisée.',
    [mode]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(email, password);
        navigate('/verify-email', { replace: true });
      } else {
        const signedInUser = await loginWithEmail(email, password);
        navigate(requiresEmailVerification(signedInUser) ? '/verify-email' : '/app', { replace: true });
      }
    } catch (err: any) {
      setError(getAuthMessage(err?.code));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await login();
      navigate('/app', { replace: true });
    } catch (err: any) {
      setError(getAuthMessage(err?.code));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf7f2] text-on-surface flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[460px]">
        <main className="bg-white rounded-[2rem] shadow-2xl shadow-black/10 border border-black/5 p-6 sm:p-8">
          <Link to="/" className="inline-flex items-center gap-2 font-headline font-black text-xl mb-6">
            PHOTO<span className="text-primary">FACTO</span>
          </Link>
          <div className="mb-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-2">
              Espace artisan
            </p>
            <h1 className="font-headline font-black text-3xl sm:text-4xl text-on-surface">{title}</h1>
            <p className="text-on-surface-variant mt-2">{helper}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Email</span>
              <div className="mt-2 flex items-center gap-3 bg-surface-container-low rounded-2xl px-4 py-3 border border-outline-variant/10">
                <Mail className="w-5 h-5 text-on-surface-variant" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent outline-none font-semibold text-on-surface placeholder:text-on-surface-variant"
                  placeholder="vous@entreprise.fr"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Mot de passe</span>
              <div className="mt-2 flex items-center gap-3 bg-surface-container-low rounded-2xl px-4 py-3 border border-outline-variant/10">
                <Lock className="w-5 h-5 text-on-surface-variant" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent outline-none font-semibold text-on-surface placeholder:text-on-surface-variant"
                  placeholder="6 caractères minimum"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="min-touch text-on-surface-variant hover:text-on-surface"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-2xl bg-error/10 border border-error/20 text-error px-4 py-3 text-sm font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-touch inline-flex items-center justify-center gap-2 bg-primary text-white rounded-2xl px-5 py-4 font-black shadow-spark-cta-lg active:scale-[0.98] transition disabled:opacity-60"
            >
              {cta}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            <div className="h-px flex-1 bg-outline-variant/20" />
            ou
            <div className="h-px flex-1 bg-outline-variant/20" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isSubmitting}
            className="w-full min-touch inline-flex items-center justify-center gap-3 rounded-2xl border border-outline-variant/20 bg-white px-5 py-4 font-black text-on-surface hover:bg-surface-container-low active:scale-[0.98] transition disabled:opacity-60"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.52z" />
              <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.44l-3.24-2.51c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22z" />
              <path fill="#FBBC05" d="M6.41 13.88A6 6 0 0 1 6.1 12c0-.65.11-1.28.31-1.88V7.53H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.47l3.35-2.59z" />
              <path fill="#EA4335" d="M12 6c1.47 0 2.8.51 3.84 1.51l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.94 5.53l3.35 2.59C7.2 7.76 9.4 6 12 6z" />
            </svg>
            Continuer avec Google
          </button>

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            {switchText}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'register' ? 'login' : 'register');
                setError('');
              }}
              className="font-black text-primary hover:underline"
            >
              {switchLabel}
            </button>
          </p>
        </main>
      </div>
    </div>
  );
}
