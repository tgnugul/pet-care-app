import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="register-pet" />
      <Stack.Screen name="survey" />
      <Stack.Screen name="result" />
    </Stack>
  );
}
