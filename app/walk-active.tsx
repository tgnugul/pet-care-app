import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Pressable, BackHandler,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { calcDistance, formatDuration } from '@/lib/gps';
import { Colors, Radius, Shadow } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { useWalkStore } from '@/stores/walk.store';
import { usePetStore } from '@/stores/pet.store';
import { useFamilyStore } from '@/stores/family.store';
import { WALK_LOCATION_TASK, WALK_ROUTE_KEY, WALK_META_KEY, WALK_LAST_PUSHED_KEY } from '@/lib/walk-task';
import { setWalkState, clearWalkState, getWalkState } from '@/lib/widget-storage';
import { notifyFamilyWalkCompleted, notifyFamilyWalkStarted } from '@/lib/notifications';

type Coord = { latitude: number; longitude: number };

// iOS: Apple Maps (API 키 불필요). Android: Google Maps API 키 필요.
const USE_NATIVE_MAP = Platform.OS === 'ios' || !!(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY);

const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: #e8f0e8; }
    #map { height: 100vh; width: 100%; }
    .loading {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #e8f0e8; font-family: sans-serif;
      color: #888; gap: 12px; z-index: 9999;
    }
    .loading-dot {
      width: 48px; height: 48px;
      border: 4px solid #F5A623;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loading" class="loading">
    <div class="loading-dot"></div>
    <span>지도 불러오는 중...</span>
  </div>
  <div id="map"></div>
  <script>
    var map = null;
    var routeLine = null;
    var userMarker = null;
    var accuracyCircle = null;
    var initialized = false;

    function initMap(lat, lng) {
      if (initialized) return;
      initialized = true;

      document.getElementById('loading').style.display = 'none';

      map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      map.setView([lat, lng], 17);

      routeLine = L.polyline([], {
        color: '#6DB56D',
        weight: 5,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      userMarker = L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: '#F5A623',
        color: '#fff',
        weight: 3,
        fillOpacity: 1,
      }).addTo(map);
    }

    function updateMap(lat, lng, route, accuracy) {
      if (!initialized) {
        initMap(lat, lng);
        return;
      }

      var latlng = [lat, lng];
      map.setView(latlng, map.getZoom(), { animate: true, duration: 0.5 });
      userMarker.setLatLng(latlng);

      if (route && route.length > 1) {
        var latlngs = route.map(function(c) { return [c.latitude, c.longitude]; });
        routeLine.setLatLngs(latlngs);
      }
    }

    function handleMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'init') {
          initMap(data.latitude, data.longitude);
        } else if (data.type === 'update') {
          updateMap(data.latitude, data.longitude, data.route, data.accuracy);
        }
      } catch (e) {}
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>`;

function LeafletMapSection({ region, route, webViewRef }: {
  region: { latitude: number; longitude: number } | null;
  route: Coord[];
  webViewRef: React.MutableRefObject<any>;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded || !region || !webViewRef.current) return;
    webViewRef.current.postMessage(JSON.stringify({
      type: 'init',
      latitude: region.latitude,
      longitude: region.longitude,
    }));
  }, [loaded]);

  useEffect(() => {
    if (!loaded || !region || !webViewRef.current) return;
    webViewRef.current.postMessage(JSON.stringify({
      type: 'update',
      latitude: region.latitude,
      longitude: region.longitude,
      route,
    }));
  }, [region, route, loaded]);

  return (
    <WebView
      ref={webViewRef}
      source={{ html: LEAFLET_HTML }}
      style={styles.map}
      javaScriptEnabled
      originWhitelist={['*']}
      onLoadEnd={() => setLoaded(true)}
    />
  );
}

function NativeMapSection({ region, route, mapRef }: {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null;
  route: Coord[];
  mapRef: React.MutableRefObject<any>;
}) {
  if (!region) {
    return (
      <View style={[styles.map, styles.mapPlaceholder]}>
        <Text style={styles.mapPlaceholderText}>📍 위치 확인 중...</Text>
      </View>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: MapView, Polyline } = require('react-native-maps');
  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={region}
      showsUserLocation
      showsMyLocationButton={false}
      scrollEnabled={false}
      rotateEnabled={false}
    >
      {route.length > 1 && (
        <Polyline
          coordinates={route}
          strokeColor={Colors.accent}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
      )}
    </MapView>
  );
}

function MapSection({ region, route, mapRef, webViewRef }: {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null;
  route: Coord[];
  mapRef: React.MutableRefObject<any>;
  webViewRef: React.MutableRefObject<any>;
}) {
  if (USE_NATIVE_MAP) {
    return <NativeMapSection region={region} route={route} mapRef={mapRef} />;
  }
  return <LeafletMapSection region={region} route={route} webViewRef={webViewRef} />;
}

export default function WalkActiveScreen() {
  const { fetchLogs } = useWalkStore();
  const { pets } = usePetStore();
  const { family, myUserId, members } = useFamilyStore();
  const { autostart, autostop } = useLocalSearchParams<{ autostart?: string; autostop?: string }>();
  const [isTracking, setIsTracking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [route, setRoute] = useState<Coord[]>([]);
  const [region, setRegion] = useState<{
    latitude: number; longitude: number;
    latitudeDelta: number; longitudeDelta: number;
  } | null>(null);
  const [permGranted, setPermGranted] = useState(false);
  const [completion, setCompletion] = useState<{ elapsed: number; dist: number } | null>(null);

  const navigation = useNavigation();
  const autostartDismissRef = useRef(false);

  function goBack() {
    setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
      else router.replace('/');
    }, 0);
  }

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoord = useRef<Coord | null>(null);
  const startedAt = useRef<string | null>(null);
  const startTimestamp = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const mapRef = useRef<any>(null);
  const webViewRef = useRef<any>(null);

  function stopAll() {
    timerRef.current && clearInterval(timerRef.current);
    pollRef.current && clearInterval(pollRef.current);
    Location.stopLocationUpdatesAsync(WALK_LOCATION_TASK).catch(() => {});
  }

  useEffect(() => {
    initMap();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      pollRef.current && clearInterval(pollRef.current);
      // autostart 모드로 dismiss할 때는 GPS를 유지 (백그라운드에서 계속 추적)
      if (!autostartDismissRef.current) {
        Location.stopLocationUpdatesAsync(WALK_LOCATION_TASK).catch(() => {});
      }
    };
  }, []);

  // 위젯에서 autostart=true로 진입하면 권한 확인 후 자동 시작 → GPS 시작 후 화면 닫기
  useEffect(() => {
    if (autostart === 'true' && permGranted && !isTracking) {
      (async () => {
        await handleStart();
        autostartDismissRef.current = true; // GPS 유지하면서 화면만 닫음
        setTimeout(() => goBack(), 300);
      })();
    }
  }, [permGranted]);

  // 위젯 종료 버튼으로 진입하면 산책 복원 후 자동 종료
  useEffect(() => {
    if (autostop === 'true' && isTracking) {
      handleStop();
    }
  }, [isTracking]);

  // 산책 중 뒤로 가기 → GPS 유지하고 백그라운드로 최소화
  useEffect(() => {
    if (!isTracking) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      autostartDismissRef.current = true;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [isTracking]);

  async function initMap() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('위치 권한 필요', '산책 기록을 위해 위치 권한이 필요해요.', [
        { text: '확인', onPress: () => router.dismiss() },
      ]);
      return;
    }
    await Location.requestBackgroundPermissionsAsync();

    // 위젯에서 시작한 산책이 진행 중인지 확인 (앱 재진입 시 복원)
    try {
      const walkStateRaw = await AsyncStorage.getItem('@pawmate/walk_state');
      if (walkStateRaw) {
        const ws = JSON.parse(walkStateRaw);
        if (ws?.isWalking && ws.startedAt) {
          setIsTracking(true);
          startedAt.current = ws.startedAt;
          startTimestamp.current = new Date(ws.startedAt).getTime();
          setElapsed(Math.floor((Date.now() - startTimestamp.current) / 1000));

          const storedRoute = await AsyncStorage.getItem(WALK_ROUTE_KEY);
          const existingRoute: Coord[] = storedRoute ? JSON.parse(storedRoute) : [];
          setRoute(existingRoute);

          if (existingRoute.length > 0) {
            const last = existingRoute[existingRoute.length - 1];
            setRegion({ ...last, latitudeDelta: 0.003, longitudeDelta: 0.003 });
            lastCoord.current = last;
          }

          let initDist = 0;
          for (let i = 1; i < existingRoute.length; i++) {
            initDist += calcDistance(
              existingRoute[i - 1].latitude, existingRoute[i - 1].longitude,
              existingRoute[i].latitude, existingRoute[i].longitude,
            );
          }
          setDistance(initDist);
          distanceRef.current = initDist;

          const isTaskRunning = await TaskManager.isTaskRegisteredAsync(WALK_LOCATION_TASK);
          if (!isTaskRunning) {
            await Location.startLocationUpdatesAsync(WALK_LOCATION_TASK, {
              accuracy: Location.Accuracy.BestForNavigation,
              distanceInterval: 5,
              timeInterval: 30000,
              foregroundService: {
                notificationTitle: '뽀시래기 산책 중',
                notificationBody: '산책 경로를 기록하고 있어요.',
                notificationColor: '#F5A623',
              },
              pausesUpdatesAutomatically: false,
            });
          }

          timerRef.current = setInterval(() => {
            if (startTimestamp.current !== null)
              setElapsed(Math.floor((Date.now() - startTimestamp.current) / 1000));
          }, 1000);

          pollRef.current = setInterval(async () => {
            const walkState = await getWalkState();
            if (!walkState) {
              stopAll();
              const finalElapsed = startTimestamp.current
                ? Math.floor((Date.now() - startTimestamp.current) / 1000)
                : 0;
              setIsTracking(false);
              setCompletion({ elapsed: finalElapsed, dist: distanceRef.current });
              fetchLogs();
              return;
            }
            const stored = await AsyncStorage.getItem(WALK_ROUTE_KEY);
            if (!stored) return;
            const newRoute: Coord[] = JSON.parse(stored);
            setRoute(newRoute);
            if (newRoute.length > 0) {
              const last = newRoute[newRoute.length - 1];
              setRegion(r => r ? { ...r, latitude: last.latitude, longitude: last.longitude } : null);
              mapRef.current?.animateCamera({ center: last }, { duration: 500 });
              let total = 0;
              for (let i = 1; i < newRoute.length; i++) {
                total += calcDistance(newRoute[i - 1].latitude, newRoute[i - 1].longitude, newRoute[i].latitude, newRoute[i].longitude);
              }
              setDistance(total);
              distanceRef.current = total;
            }
          }, 2000);

          setPermGranted(true);
          return; // 기존 산책 복원 완료 — autostart 무시
        }
      }
    } catch {}

    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const initCoord: Coord = { latitude: current.coords.latitude, longitude: current.coords.longitude };
    setRegion({ ...initCoord, latitudeDelta: 0.003, longitudeDelta: 0.003 });
    lastCoord.current = initCoord;
    setPermGranted(true);
  }

  async function handleStart() {
    if (!permGranted) return;
    setIsTracking(true);
    const now = new Date();
    startedAt.current = now.toISOString();
    startTimestamp.current = now.getTime();
    const initialRoute = lastCoord.current ? [lastCoord.current] : [];
    await AsyncStorage.setItem(WALK_ROUTE_KEY, JSON.stringify(initialRoute));
    setRoute(initialRoute);
    await setWalkState({ isWalking: true, startedAt: now.toISOString(), distanceKm: 0, durationSec: 0 });

    if (family && myUserId) {
      const doerName = members.find(m => m.user_id === myUserId)?.display_name ?? '가족';
      const petName = pets[0]?.name ?? '반려동물';
      notifyFamilyWalkStarted(family.id, myUserId, doerName, petName);

      // 가족 공유용 메타 저장 + 초기 live_walks 행 upsert
      const meta = { familyId: family.id, walkerId: myUserId, walkerName: doerName, petName };
      await AsyncStorage.setItem(WALK_META_KEY, JSON.stringify(meta));
      await AsyncStorage.removeItem(WALK_LAST_PUSHED_KEY);
      await supabase.from('live_walks').upsert({
        user_id: myUserId,
        family_id: family.id,
        walker_name: doerName,
        pet_name: petName,
        started_at: now.toISOString(),
        distance_km: 0,
        duration_sec: 0,
        route_coordinates: initialRoute,
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' });
      await AsyncStorage.setItem(WALK_LAST_PUSHED_KEY, String(Date.now()));
    }

    timerRef.current = setInterval(() => {
      if (startTimestamp.current !== null) {
        setElapsed(Math.floor((Date.now() - startTimestamp.current) / 1000));
      }
    }, 1000);

    await Location.startLocationUpdatesAsync(WALK_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 30000,
      foregroundService: {
        notificationTitle: '뽀시래기 산책 중',
        notificationBody: '산책 경로를 기록하고 있어요.',
        notificationColor: '#F5A623',
      },
      pausesUpdatesAutomatically: false,
    });

    pollRef.current = setInterval(async () => {
      const walkState = await getWalkState();
      if (!walkState) {
        stopAll();
        const finalElapsed = startTimestamp.current
          ? Math.floor((Date.now() - startTimestamp.current) / 1000)
          : 0;
        setIsTracking(false);
        setCompletion({ elapsed: finalElapsed, dist: distanceRef.current });
        fetchLogs();
        return;
      }
      const stored = await AsyncStorage.getItem(WALK_ROUTE_KEY);
      if (!stored) return;
      const newRoute: Coord[] = JSON.parse(stored);
      setRoute(newRoute);
      if (newRoute.length > 0) {
        const last = newRoute[newRoute.length - 1];
        setRegion(r => r ? { ...r, latitude: last.latitude, longitude: last.longitude } : null);
        mapRef.current?.animateCamera({ center: last }, { duration: 500 });
        let total = 0;
        for (let i = 1; i < newRoute.length; i++) {
          total += calcDistance(newRoute[i - 1].latitude, newRoute[i - 1].longitude, newRoute[i].latitude, newRoute[i].longitude);
        }
        setDistance(total);
        distanceRef.current = total;
      }
    }, 2000);
  }

  async function handleStop() {
    stopAll();
    await clearWalkState();
    const endedAt = new Date().toISOString();

    const stored = await AsyncStorage.getItem(WALK_ROUTE_KEY);
    const finalRoute: Coord[] = stored ? JSON.parse(stored) : route;
    await AsyncStorage.removeItem(WALK_ROUTE_KEY);

    let totalDistance = 0;
    for (let i = 1; i < finalRoute.length; i++) {
      totalDistance += calcDistance(finalRoute[i - 1].latitude, finalRoute[i - 1].longitude, finalRoute[i].latitude, finalRoute[i].longitude);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session && elapsed > 0) {
      await supabase.from('walk_logs').insert({
        user_id: session.user.id,
        started_at: startedAt.current ?? endedAt,
        ended_at: endedAt,
        duration_minutes: Math.round((elapsed / 60) * 10) / 10,
        distance_km: Math.round(totalDistance * 1000) / 1000,
        route_coordinates: finalRoute,
      });
      await fetchLogs();
      if (family && myUserId) {
        const doerName = members.find(m => m.user_id === myUserId)?.display_name ?? '가족';
        const petName = pets[0]?.name ?? '반려동물';
        notifyFamilyWalkCompleted(family.id, myUserId, doerName, petName, Math.round(totalDistance * 1000) / 1000, elapsed);
        // 가족 공유 행 삭제 및 메타 정리
        await supabase.from('live_walks').delete().eq('user_id', myUserId);
        await AsyncStorage.multiRemove([WALK_META_KEY, WALK_LAST_PUSHED_KEY]);
      }
    }

    if (Platform.OS === 'android') {
      try {
        const { requestWidgetUpdate } = await import('react-native-android-widget');
        const { WalkWidget } = await import('@/widgets/WalkWidget');
        await requestWidgetUpdate({
          widgetName: 'WalkWidget',
          renderWidget: () => WalkWidget({ state: null }),
          widgetNotFound: () => {},
        });
      } catch {}
    }

    setCompletion({ elapsed, dist: totalDistance });
  }

  async function handleClose() {
    if (isTracking && elapsed > 0) {
      Alert.alert('산책을 종료할까요?', '지금까지의 기록은 저장되지 않아요.', [
        { text: '계속 산책', style: 'cancel' },
        {
          text: '종료', style: 'destructive', onPress: async () => {
            stopAll();
            await clearWalkState();
            if (myUserId) {
              await supabase.from('live_walks').delete().eq('user_id', myUserId);
              await AsyncStorage.multiRemove([WALK_META_KEY, WALK_LAST_PUSHED_KEY]);
            }
            if (Platform.OS === 'android') {
              try {
                const { requestWidgetUpdate } = await import('react-native-android-widget');
                const { WalkWidget } = await import('@/widgets/WalkWidget');
                await requestWidgetUpdate({
                  widgetName: 'WalkWidget',
                  renderWidget: () => WalkWidget({ state: null }),
                  widgetNotFound: () => {},
                });
              } catch {}
            }
            goBack();
          },
        },
      ]);
    } else {
      stopAll();
      await clearWalkState();
      if (Platform.OS === 'android') {
        try {
          const { requestWidgetUpdate } = await import('react-native-android-widget');
          const { WalkWidget } = await import('@/widgets/WalkWidget');
          await requestWidgetUpdate({
            widgetName: 'WalkWidget',
            renderWidget: () => WalkWidget({ state: null }),
            widgetNotFound: () => {},
          });
        } catch {}
      }
      goBack();
    }
  }

  return (
    <View style={styles.container}>
      <MapSection region={region} route={route} mapRef={mapRef} webViewRef={webViewRef} />

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

      {/* 산책 완료 오버레이 — Alert 대신 컴포넌트 내 UI로 처리 (navigation 안정성) */}
      {completion && (
        <Pressable style={styles.completionOverlay} onPress={goBack}>
          <View style={styles.completionCard}>
            <Text style={styles.completionEmoji}>🐾</Text>
            <Text style={styles.completionTitle}>산책 완료!</Text>
            <Text style={styles.completionStat}>
              {formatDuration(completion.elapsed)}  ·  {completion.dist.toFixed(2)}km
            </Text>
            <TouchableOpacity style={styles.completionBtn} onPress={goBack}>
              <Text style={styles.completionBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  map: { flex: 1 },
  mapPlaceholder: {
    backgroundColor: '#e8f0e8',
    alignItems: 'center', justifyContent: 'center',
  },
  mapPlaceholderText: { fontSize: 16, color: Colors.sub },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' },

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

  completionOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  completionCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingVertical: 36, paddingHorizontal: 40,
    alignItems: 'center', gap: 12,
    ...Shadow.card,
  },
  completionEmoji: { fontSize: 48 },
  completionTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  completionStat: { fontSize: 16, color: Colors.sub, fontWeight: '600' },
  completionBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 40, paddingVertical: 14,
    ...Shadow.sm,
  },
  completionBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
