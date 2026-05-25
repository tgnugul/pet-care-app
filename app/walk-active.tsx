import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { calcDistance, formatDuration } from '@/lib/gps';
import { Colors, Radius, Shadow } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { useWalkStore } from '@/stores/walk.store';

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
  }, [region, route]);

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
  const startedAt = useRef<string | null>(null);
  const mapRef = useRef<any>(null);
  const webViewRef = useRef<any>(null);

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
        setRegion(r => r ? { ...r, latitude: next.latitude, longitude: next.longitude } : null);
        mapRef.current?.animateCamera(
          { center: { latitude: next.latitude, longitude: next.longitude } },
          { duration: 500 },
        );
      },
    );
  }

  async function handleStop() {
    stopAll();
    const endedAt = new Date().toISOString();
    const { data: { session } } = await supabase.auth.getSession();
    if (session && elapsed > 0) {
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
});
