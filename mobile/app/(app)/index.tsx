import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour 👋</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <Pressable onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Déconnexion</Text>
          </Pressable>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Factures ce mois</Text>
          </View>
          <View style={[styles.statCard, styles.statCardSecondary]}>
            <Text style={styles.statNumber}>0€</Text>
            <Text style={styles.statLabel}>Chiffre d'affaires</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.actionsContainer}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => router.push('/(app)/camera')}
          >
            <Text style={styles.actionIcon}>📸</Text>
            <Text style={styles.actionText}>Photo d'un brouillon</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => router.push('/(app)/camera')}
          >
            <Text style={styles.actionIcon}>🎤</Text>
            <Text style={styles.actionText}>Dicter une facture</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => router.push('/(app)/invoices')}
          >
            <Text style={styles.actionIcon}>📄</Text>
            <Text style={styles.actionText}>Saisir manuellement</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1B1F',
  },
  scrollContent: {
    padding: 20,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#E6E1E5',
  },
  email: {
    fontSize: 14,
    color: '#CAC4D0',
    marginTop: 4,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#383842',
  },
  logoutText: {
    color: '#CAC4D0',
    fontWeight: '600',
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
  },
  statCardPrimary: {
    backgroundColor: '#6750A4',
  },
  statCardSecondary: {
    backgroundColor: '#2B2930',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#E6E1E5',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CAC4D0',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6E1E5',
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#2B2930',
    borderRadius: 16,
    padding: 20,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
  },
  actionIcon: {
    fontSize: 28,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E6E1E5',
  },
});
