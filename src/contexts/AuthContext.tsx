import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  browserLocalPersistence,
  setPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from '../firebase';
import { track, identifyUser } from '../services/analytics';
import { requiresEmailVerification } from '../lib/authVerification';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<User>;
  registerWithEmail: (email: string, password: string) => Promise<User>;
  resendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const provider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setAuthRefreshTick] = useState(0);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      // Identify the user in PostHog so all subsequent events join on uid.
      // We call this on every auth-change tick; identifyUser is idempotent
      // and lazy-loads PostHog so this is fire-and-forget.
      if (firebaseUser?.uid) {
        identifyUser(firebaseUser.uid);
      }
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithPopup(auth, provider);
    // Distinguish first-time signup vs returning login. Firebase exposes
    // creationTime / lastSignInTime; if they're equal (within ~5 s) it's a
    // brand new account, which is the funnel-defining moment.
    const creation = result.user.metadata.creationTime
      ? new Date(result.user.metadata.creationTime).getTime()
      : 0;
    const lastSignIn = result.user.metadata.lastSignInTime
      ? new Date(result.user.metadata.lastSignInTime).getTime()
      : 0;
    const isNewUser = Math.abs(creation - lastSignIn) < 5000;
    if (isNewUser) {
      track('user_signed_up', { provider: 'google' });
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    return result.user;
  };

  const registerWithEmail = async (email: string, password: string) => {
    await setPersistence(auth, browserLocalPersistence);
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await sendEmailVerification(result.user);
    track('user_signed_up', { provider: 'password' });
    return result.user;
  };

  const resendVerificationEmail = async () => {
    const current = auth.currentUser;
    if (!current) throw new Error('Session expirée. Reconnectez-vous.');
    if (!requiresEmailVerification(current)) return;
    await sendEmailVerification(current);
  };

  const refreshUser = async () => {
    const current = auth.currentUser;
    if (!current) return null;
    await current.reload();
    await current.getIdToken(true).catch(() => undefined);
    setUser(auth.currentUser);
    setAuthRefreshTick(tick => tick + 1);
    return auth.currentUser;
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithEmail, registerWithEmail, resendVerificationEmail, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
