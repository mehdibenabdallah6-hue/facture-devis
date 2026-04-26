import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function InvoicesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.subtitle}>Vos factures et devis apparaîtront ici</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => router.push('/(app)/camera')}
        >
          <Text style={styles.createButtonText}>Créer une facture</Text>
        </Pressable>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#E6E1E5',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#CAC4D0',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#6750A4',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
