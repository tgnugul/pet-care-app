import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Colors, Radius, Shadow } from '@/constants/design';
import { useWalkStore, walkEmoji, formatWalkDate } from '@/stores/walk.store';
import { formatDuration } from '@/lib/gps';

type Coord = { latitude: number; longitude: number };

function buildLeafletHtml(route: Coord[]): string {
  const coords = JSON.stringify(route.map(c => [c.latitude, c.longitude]));
  const center = route.length > 0
    ? [route[Math.floor(route.length / 2)].latitude, route[Math.floor(route.length / 2)].longitude]
    : [37.5665, 126.9780];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { height: 100%; width: 100%; background: #e8f0e8; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var coords = ${coords};

    if (coords.length > 1) {
      var line = L.polyline(coords, {
        color: '#6DB56D', weight: 5, lineCap: 'round', lineJoin: 'round',
      }).addTo(map);

      var start = coords[0];
      var end = coords[coords.length - 1];

      L.circleMarker(start, {
        radius: 8, fillColor: '#6DB56D', color: '#fff', weight: 3, fillOpacity: 1,
      }).addTo(map);

      L.circleMarker(end, {
        radius: 8, fillColor: '#F5A623', color: '#fff', weight: 3, fillOpacity: 1,
      }).addTo(map);

      map.fitBounds(line.getBounds(), { padding: [24, 24] });
    } else {
      map.setView(${JSON.stringify(center)}, 15);
    }
  </script>
</body>
</html>`;
}

export default function WalkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { logs, deleteLog } = useWalkStore();
  const webViewRef = useRef<any>(null);
  const [mapHtml, setMapHtml] = useState('');

  const log = logs.find(l => l.id === id);

  useEffect(() => {
    if (!log) return;
    const route = log.route_coordinates ?? [];
    setMapHtml(buildLeafletHtml(route));
  }, [log?.id]);

  function handleDelete() {
    Alert.alert('산책 기록 삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          if (log) await deleteLog(log.id);
          router.back();
        },
      },
    ]);
  }

  if (!log) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>‹ 뒤로</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>기록을 찾을 수 없어요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasRoute = (log.route_coordinates?.length ?? 0) > 1;
  const durationSec = Math.round(log.duration_minutes * 60);

  return (
    <View style={styles.container}>
      {/* 지도 */}
      <View style={styles.mapWrap}>
        {mapHtml ? (
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={styles.map}
            javaScriptEnabled
            originWhitelist={['*']}
          />
        ) : (
          <View style={[styles.map, styles.mapFallback]}>
            <Text style={styles.mapFallbackTxt}>
              {hasRoute ? '지도 불러오는 중...' : '경로 데이터 없음'}
            </Text>
          </View>
        )}
      </View>

      {/* 하단 패널 */}
      <SafeAreaView style={styles.panel}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.panelInner}>
            {/* 헤더 */}
            <View style={styles.panelHeader}>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.backTxt}>‹ 뒤로</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <Text style={styles.deleteTxt}>삭제</Text>
              </TouchableOpacity>
            </View>

            {/* 날짜 */}
            <View style={styles.dateRow}>
              <Text style={styles.dateEmoji}>{walkEmoji(log)}</Text>
              <Text style={styles.dateText}>{formatWalkDate(log.started_at)}</Text>
            </View>

            {/* 통계 */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{log.distance_km.toFixed(2)}</Text>
                <Text style={styles.statUnit}>km</Text>
                <Text style={styles.statLabel}>거리</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatDuration(durationSec)}</Text>
                <Text style={styles.statUnit}>분:초</Text>
                <Text style={styles.statLabel}>시간</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {log.duration_minutes > 0
                    ? (log.distance_km / (log.duration_minutes / 60)).toFixed(1)
                    : '-'}
                </Text>
                <Text style={styles.statUnit}>km/h</Text>
                <Text style={styles.statLabel}>평균 속도</Text>
              </View>
            </View>

            {log.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{log.notes}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  mapWrap: { flex: 1 },
  map: { flex: 1 },
  mapFallback: {
    backgroundColor: '#e8f0e8',
    alignItems: 'center', justifyContent: 'center',
  },
  mapFallbackTxt: { fontSize: 14, color: Colors.sub },

  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },

  panel: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '45%',
    ...Shadow.card,
  },
  panelInner: { padding: 20, paddingBottom: 8 },

  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: { paddingVertical: 4 },
  backTxt: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  deleteTxt: { fontSize: 14, color: Colors.danger, fontWeight: '600' },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20,
  },
  dateEmoji: { fontSize: 24 },
  dateText: { fontSize: 18, fontWeight: '800', color: Colors.text },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bg,
    borderRadius: Radius.card,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 12 },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statUnit: { fontSize: 10, color: Colors.sub, fontWeight: '500' },
  statLabel: { fontSize: 11, color: Colors.light },

  notesBox: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.card,
    padding: 14,
  },
  notesText: { fontSize: 14, color: Colors.sub, lineHeight: 20 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { fontSize: 15, color: Colors.sub },
});
