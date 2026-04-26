import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithRedirect } from 'firebase/auth';
import { auth, GoogleAuthProvider } from '../firebase';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      // Ne met à jour que si on n'a pas forcé un utilisateur "Invité"
      setUser(prev => prev ? prev : u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error("Erreur de connexion Google :", e);
      alert("Erreur de connexion. Vérifiez vos clés Firebase.");
    }
  };

  // Fonction spéciale pour tester l'interface sans Google
  const loginAsGuest = () => {
    setUser({ uid: 'guest-123', email: 'artisan@photofacto.fr', displayName: 'Artisan Test' });
  };

  const logout = () => {
    setUser(null);
    auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, loginAsGuest, logout }}>
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
