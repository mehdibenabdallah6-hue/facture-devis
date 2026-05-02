import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';

export default function Onboarding() {
  const { loginWithGoogle, loginAsGuest } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>📸</Text>
        </View>
        <Text style={styles.title}>Photofacto</Text>
        <Text style={styles.subtitle}>Devis, factures, signature et relances pour artisans</Text>
      </View>

      <View style={styles.buttonContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            pressed && styles.loginButtonPressed,
          ]}
          onPress={loginWithGoogle}
        >
          <Text style={styles.loginButtonText}>Se connecter avec Google</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.guestButton,
            pressed && styles.loginButtonPressed,
          ]}
          onPress={loginAsGuest}
        >
          <Text style={styles.guestButtonText}>Mode Développeur (Aperçu direct) 🚀</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1B1F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#6750A4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#6750A4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: {
    fontSize: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#E6E1E5',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#CAC4D0',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  loginButton: {
    backgroundColor: '#6750A4',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#6750A4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  guestButton: {
    backgroundColor: '#2B2930',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#49454F',
  },
  loginButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  guestButtonText: {
    color: '#CAC4D0',
    fontSize: 14,
    fontWeight: '600',
  },
});
