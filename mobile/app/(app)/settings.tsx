import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Paramètres</Text>

        {/* User info */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.displayName || 'Utilisateur'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Settings options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon compte</Text>
          <Pressable style={styles.settingItem}>
            <Text style={styles.settingText}>Informations entreprise</Text>
          </Pressable>
          <Pressable style={styles.settingItem}>
            <Text style={styles.settingText}>Catalogue produits</Text>
          </Pressable>
          <Pressable style={styles.settingItem}>
            <Text style={styles.settingText}>Papier en-tête & Logo</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abonnement</Text>
          <Pressable style={styles.settingItem}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.settingText}>Plan Actuel</Text>
              <Text style={[styles.settingText, { color: '#6750A4', fontWeight: 'bold' }]}>Gratuit</Text>
            </View>
          </Pressable>
          <Pressable style={styles.settingItem} onPress={() => {/* Navigate to plans */}}>
            <Text style={[styles.settingText, { color: '#D0BCFF' }]}>🚀 Passer au Plan Solo (129€/an)</Text>
          </Pressable>
          <Pressable style={styles.settingItem}>
            <Text style={styles.settingText}>Parrainer un confrère</Text>
          </Pressable>
        </View>

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>

        <Text style={styles.version}>
          Photofacto Mobile v1.0.0
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1B1F',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#E6E1E5',
    marginBottom: 24,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#2B2930',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6750A4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E6E1E5',
  },
  userEmail: {
    fontSize: 14,
    color: '#CAC4D0',
  },
  section: {
    backgroundColor: '#2B2930',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CAC4D0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: 16,
    paddingBottom: 8,
  },
  settingItem: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#49454F',
  },
  settingText: {
    fontSize: 15,
    color: '#E6E1E5',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#93000A',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  logoutText: {
    color: '#FFDAD6',
    fontSize: 15,
    fontWeight: '700',
  },
  version: {
    fontSize: 12,
    color: '#49454F',
    textAlign: 'center',
    marginTop: 32,
  },
});
