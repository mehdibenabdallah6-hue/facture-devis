import { Redirect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1B1F' }}>
        <ActivityIndicator size="large" color="#6750A4" />
      </View>
    );
  }

  return user ? <Redirect href="/(app)" /> : <Redirect href="/(auth)/onboarding" />;
}
