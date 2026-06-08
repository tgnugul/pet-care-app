import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Colors, Radius, Shadow } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/gps';

type Coord = { latitude: number; longitude: number };

interface LiveWalk {
  user_id: string;
  walker_name: string;
  pet_name: string;
  started_at: string;
  distance_km: number;
  duration_sec: number;
  route_coordinates: Coord[];
  updated_at: string;
}

// updated_at 이 5분 이상 지나면 산책 종료된 것으로 간주
const STALE_MS = 5 * 60 * 1000;

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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = null;
    var routeLine = null;
    var markerIcon = null;
    var userMarker = null;

    function initMap(lat, lng) {
      map = L.map('map', { zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      map.setView([lat, lng], 17);
      routeLine = L.polyline([], { color: '#6DB56D', weight: 5, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      userMarker = L.circleMarker([lat, lng], {
        radius: 10, fillColor: '#F5A623', color: '#fff', weight: 3, fillOpacity: 1,
      }).addTo(map);
    }

    function update(lat, lng, route) {
      if (!map) { initMap(lat, lng); return; }
      userMarker.setLatLng([lat, lng]);
      map.setView([lat, lng], map.getZoom(), { animate: true, duration: 0.5 });
      if (route && route.length > 1) {
        routeLine.setLatLngs(route.map(function(c) { return [c.latitude, c.longitude]; }));
      }
    }

    window.addEventListener('message', function(e) {
      try {
        var d = JSON.parse(e.data);
        update(d.lat, d.lng, d.route);
      } catch(err) {}
    });
    document.addEventListener('message', function(e) {
      try {
        var d = JSON.parse(e.data);
        update(d.lat, d.lng, d.route);
      } catch(err) {}
    });
  </script>
</body>
</html>`;

export default function WalkLiveScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [walk, setWalk] = useState<LiveWalk | null>(null);
  const [ended, setEnded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const webViewRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webViewLoaded = useRef(false);

  useEffect(() => {
    if (!userId) return;

    // 초기 데이터 로드
    supabase
      .from('live_walks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setEnded(true); return; }
        applyWalk(data as LiveWalk);
      });

    // Realtime 구독
    const channel = supabase
      .channel(`live_walk:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_walks', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setEnded(true);
            timerRef.current && clearInterval(timerRef.current);
            return;
          }
          applyWalk(payload.new as LiveWalk);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      timerRef.current && clearInterval(timerRef.current);
    };
  }, [userId]);

  function applyWalk(data: LiveWalk) {
    // updated_at이 오래됐으면 산책 종료로 처리
    if (Date.now() - new Date(data.updated_at).getTime() > STALE_MS) {
      setEnded(true);
      return;
    }
    setWalk(data);

    const start = new Date(data.started_at).getTime();
    timerRef.current && clearInterval(timerRef.current);
    setElapsed(Math.floor((Date.now() - start) / 1000));
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    // 지도 업데이트
    const route = data.route_coordinates;
    if (route.length > 0) {
      const last = route[route.length - 1];
      sendMapUpdate(last.latitude, last.longitude, route);
    }
  }

  function sendMapUpdate(lat: number, lng: number, route: Coord[]) {
    if (!webViewLoaded.current || !webViewRef.current) return;
    webViewRef.current.postMessage(JSON.stringify({ lat, lng, route }));
  }

  // webView가 로드된 후 현재 walk 데이터로 지도 초기화
  function handleWebViewLoad() {
    webViewLoaded.current = true;
    if (!walk) return;
    const route = walk.route_coordinates;
    if (route.length > 0) {
      const last = route[route.length - 1];
      sendMapUpdate(last.latitude, last.longitude, route);
    }
  }

  const petName = walk?.pet_name ?? '';
  const walkerName = walk?.walker_name ?? '';

  if (ended) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.endedContainer}>
          <Text style={styles.endedEmoji}>🐾</Text>
          <Text style={styles.endedTitle}>산책이 종료됐어요</Text>
          <Text style={styles.endedSub}>{walkerName || petName}의 산책이 끝났어요</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!walk) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.endedContainer}>
          <Text style={styles.endedEmoji}>🔍</Text>
          <Text style={styles.endedTitle}>산책 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: LEAFLET_HTML }}
        style={styles.map}
        javaScriptEnabled
        originWhitelist={['*']}
        onLoadEnd={handleWebViewLoad}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        {/* 상단 닫기 + 라이브 배지 */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>LIVE</Text>
          </View>
        </View>

        {/* 하단 패널 */}
        <View style={styles.panel}>
          <Text style={styles.walkerLabel}>
            {walkerName}님이 {petName}와 산책 중이에요 🐕
          </Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDuration(elapsed)}</Text>
              <Text style={styles.statUnit}>시간</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{walk.distance_km.toFixed(2)}km</Text>
              <Text style={styles.statUnit}>거리</Text>
            </View>
          </View>
          <Text style={styles.readOnlyNote}>읽기 전용 · 30초마다 업데이트</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },

  map: { flex: 1 },

  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'space-between',
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  closeTxt: { fontSize: 15, color: Colors.sub, fontWeight: '700' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.danger,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5,
    ...Shadow.sm,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveTxt: { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  panel: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    alignItems: 'center', gap: 16,
    ...Shadow.card,
  },
  walkerLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  stats: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 28, fontWeight: '800', color: Colors.text },
  statUnit: { fontSize: 11, color: Colors.sub, fontWeight: '500' },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  readOnlyNote: { fontSize: 12, color: Colors.light },

  endedContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32,
  },
  endedEmoji: { fontSize: 48 },
  endedTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  endedSub: { fontSize: 14, color: Colors.sub },
  backBtn: {
    marginTop: 8, backgroundColor: Colors.primary, borderRadius: Radius.button,
    paddingHorizontal: 36, paddingVertical: 14, ...Shadow.sm,
  },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
