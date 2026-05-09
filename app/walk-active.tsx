import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { calcDistance, formatDuration } from '@/lib/gps';
import { Colors, Radius, Shadow } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { useWalkStore } from '@/stores/walk.store';

type Coord = { latitude: number; longitude: number };

export default function WalkActiveScreen() {
  const { fetchLogs } = useWalkStore();
  const [isTracking, setIsTracking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [route, setRoute] = useState<Coord[]>([]);
  const [region, setRegion] = useState<{
    latitude: number; longitude: number;
    latitudeDelta: number; longitudeDelta: number;
  } | null>(null);
  const [permGranted, setPermGranted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const lastCoord = useRef<Coord | null>(null);
  const mapRef = useRef<MapView>(null);
  const startedAt = useRef<string | null>(null);

  function stopAll() {
    timerRef.current && clearInterval(timerRef.current);
    locationSub.current?.remove();
  }

  useEffect(() => {
    initMap();
    return () => stopAll();
  }, []);

  async function initMap() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('위치 권한 필요', '산책 기록을 위해 위치 권한이 필요해요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
      return;
    }
    setPermGranted(true);
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const initCoord: Coord = { latitude: current.coords.latitude, longitude: current.coords.longitude };
    setRegion({ ...initCoord, latitudeDelta: 0.003, longitudeDelta: 0.003 });
    lastCoord.current = initCoord;
  }

  async function handleStart() {
    if (!permGranted) return;
    setIsTracking(true);
    startedAt.current = new Date().toISOString();
    if (lastCoord.current) setRoute([lastCoord.current]);

    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
      ({ coords }) => {
        if (coords.accuracy !== null && coords.accuracy > 25) return;
        const next: Coord = { latitude: coords.latitude, longitude: coords.longitude };
        if (lastCoord.current) {
          const delta = calcDistance(
            lastCoord.current.latitude, lastCoord.current.longitude,
            next.latitude, next.longitude,
          );
          setDistance(d => d + delta);
        }
        lastCoord.current = next;
        setRoute(prev => [...prev, next]);
        mapRef.current?.animateToRegion(
          { ...next, latitudeDelta: 0.003, longitudeDelta: 0.003 },
          300,
        );
      },
    );
  }

  async function handleStop() {
    stopAll();
    const endedAt = new Date().toISOString();
    const { data: { session } } = await supabase.auth.getSession();
    if (session && distance > 0) {
      await supabase.from('walk_logs').insert({
        user_id: session.user.id,
        started_at: startedAt.current ?? endedAt,
        ended_at: endedAt,
        duration_minutes: Math.round((elapsed / 60) * 10) / 10,
        distance_km: Math.round(distance * 1000) / 1000,
        route_coordinates: route,
      });
      await fetchLogs();
    }
    Alert.alert(
      '산책 완료! 🐾',
      `시간: ${formatDuration(elapsed)}\n거리: ${distance.toFixed(2)}km`,
      [{ text: '확인', onPress: () => router.back() }],
    );
  }

  function handleClose() {
    if (isTracking && elapsed > 0) {
      Alert.alert('산책을 종료할까요?', '지금까지의 기록은 저장되지 않아요.', [
        { text: '계속 산책', style: 'cancel' },
        { text: '종료', style: 'destructive', onPress: () => { stopAll(); router.back(); } },
      ]);
    } else {
      stopAll();
      router.back();
    }
  }

  return (
    <View style={styles.container}>
      {region ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton={false}
          scrollEnabled={false}
          rotateEnabled={false}
        >
          {route.length > 1 && (
            <Polyline
              coordinates={route}
              strokeColor={Colors.primary}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>
      ) : (
        <View style={[styles.map, styles.mapPlaceholder]}>
          <Text style={styles.mapPlaceholderText}>📍 위치 확인 중...</Text>
        </View>
      )}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <Text style={styles.closeTxt}>✕</Text>
        </TouchableOpacity>

        <View style={styles.panel}>
          {isTracking ? (
            <>
              <Text style={styles.timer}>{formatDuration(elapsed)}</Text>
              <View style={styles.distanceBox}>
                <Text style={styles.statValue}>{distance.toFixed(2)}</Text>
                <Text style={styles.statUnit}>km</Text>
                <Text style={styles.statLabel}>거리</Text>
              </View>
              <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
                <View style={styles.stopIcon} />
                <Text style={styles.actionLabel}>산책 종료</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.startBtn, !permGranted && styles.startBtnDisabled]}
              onPress={handleStart}
              disabled={!permGranted}
            >
              <Text style={styles.actionLabel}>
                {permGranted ? '산책 시작' : '위치 확인 중...'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  map: { position: 'absolute', inset: 0 },
  mapPlaceholder: {
    backgroundColor: '#e8f0e8',
    alignItems: 'center', justifyContent: 'center',
  },
  mapPlaceholderText: { fontSize: 16, color: Colors.sub },

  overlay: { flex: 1, justifyContent: 'space-between' },

  closeBtn: {
    alignSelf: 'flex-end',
    margin: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  closeTxt: { fontSize: 15, color: Colors.sub, fontWeight: '700' },

  panel: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    alignItems: 'center', gap: 20,
    ...Shadow.card,
  },
  timer: { fontSize: 56, fontWeight: '800', color: Colors.text, letterSpacing: -1 },

  distanceBox: { alignItems: 'center', gap: 2, paddingVertical: 8 },
  statValue: { fontSize: 28, fontWeight: '800', color: Colors.text },
  statUnit: { fontSize: 12, color: Colors.sub, fontWeight: '500' },
  statLabel: { fontSize: 11, color: Colors.light },

  startBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.card,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
  },
  startBtnDisabled: { backgroundColor: Colors.border, shadowOpacity: 0 },

  stopBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    ...Shadow.card,
    shadowColor: Colors.danger,
    shadowOpacity: 0.35,
  },
  stopIcon: { width: 20, height: 20, borderRadius: 4, backgroundColor: Colors.white },
  actionLabel: { fontSize: 10, color: Colors.white, fontWeight: '700' },
});
