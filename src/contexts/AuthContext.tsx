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
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../firebase';
import { track, identifyUser } from '../services/analytics';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const provider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      // Identify the user in PostHog so all subsequent events join on uid.
      // We call this on every auth-change tick; identifyUser is idempotent
      // and lazy-loads PostHog so this is fire-and-forget.
      if (firebaseUser?.uid) {
        identifyUser(firebaseUser.uid, firebaseUser.email || undefined);
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
    track(isNewUser ? 'signup_completed' : 'login_completed', {
      provider: 'google',
      uid: result.user.uid,
    });
  };

  const loginWithEmail = async (email: string, password: string) => {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    track('login_completed', {
      provider: 'password',
      uid: result.user.uid,
    });
  };

  const registerWithEmail = async (email: string, password: string) => {
    await setPersistence(auth, browserLocalPersistence);
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    track('signup_completed', {
      provider: 'password',
      uid: result.user.uid,
    });
  };

  const logout = async () => {
    track('logout');
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithEmail, registerWithEmail, logout }}>
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
