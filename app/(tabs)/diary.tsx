import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, Modal, StatusBar,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore } from '@/stores/pet.store';
import {
  usePhotoStore, filterByMonth, groupByDate,
  pickAndResize, FREE_LIMIT_BYTES, type Photo, type PickedPhoto,
} from '@/stores/photo.store';

const DAYS_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function startDayOfMonth(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }

export default function DiaryScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { pets, fetchPets } = usePetStore();
  const { photos, loading, uploading, fetchPhotos, fetchGlobalTotal, savePhoto, deletePhoto, globalTotalBytes } = usePhotoStore();

  const [viewing, setViewing] = useState<Photo | null>(null);
  const [pickedPhoto, setPickedPhoto] = useState<PickedPhoto | null>(null);
  const [photoName, setPhotoName] = useState('');
  const [galleryVisible, setGalleryVisible] = useState(false);

  const pet = pets[0] ?? null;

  useEffect(() => {
    if (pets.length === 0) fetchPets();
    fetchGlobalTotal();
  }, []);

  useEffect(() => {
    if (pet) fetchPhotos(pet.id);
  }, [pet?.id]);

  const monthPhotos = filterByMonth(photos, year, month);
  const byDate = groupByDate(monthPhotos);
  const photoDates = new Set(monthPhotos.map(p => p.taken_at));
  const recentPhotos = monthPhotos.slice(0, 5);

  const totalMB = (globalTotalBytes / (1024 * 1024)).toFixed(1);
  const usedFraction = Math.min(globalTotalBytes / FREE_LIMIT_BYTES, 1);
  const isNearLimit = usedFraction >= 0.8;

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  async function handleAdd() {
    if (!pet) { Alert.alert('반려동물을 먼저 등록해주세요.'); return; }
    const picked = await pickAndResize();
    if (!picked) return;
    setPickedPhoto(picked);
    setPhotoName('');
  }

  async function handleSave(name: string | null) {
    if (!pickedPhoto || !pet) return;
    setPickedPhoto(null);
    await savePhoto(pet.id, pickedPhoto, name ?? undefined);
  }

  function handleDeletePhoto(photo: Photo) {
    Alert.alert(
      '사진 삭제',
      `${photo.notes ? `"${photo.notes}" ` : ''}사진을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setViewing(null);
            await deletePhoto(photo.id, photo.storage_path);
          },
        },
      ],
    );
  }

  const totalDays = daysInMonth(year, month);
  const startDay = startDayOfMonth(year, month);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>사진 다이어리</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleAdd}
          disabled={uploading || !!pickedPhoto}
        >
          {uploading
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : <Text style={styles.addBtnText}>+ 추가</Text>
          }
        </TouchableOpacity>
      </View>

      {/* 월 선택 */}
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={prevMonth}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
        <Text style={styles.monthLabel}>{year}년 {month}월</Text>
        <TouchableOpacity onPress={nextMonth}><Text style={styles.arrow}>›</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 캘린더 */}
        <View style={styles.calendarCard}>
          <View style={styles.calRow}>
            {DAYS_LABEL.map((d, i) => (
              <Text key={d} style={[styles.dayHeader, i === 0 && { color: Colors.danger }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.calGrid}>
            {Array.from({ length: startDay }).map((_, i) => (
              <View key={`e${i}`} style={styles.calCell} />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasPhoto = photoDates.has(dateKey);
              const firstPhoto = byDate[dateKey]?.[0];
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.calCell, hasPhoto && styles.calCellPhoto]}
                  activeOpacity={firstPhoto ? 0.75 : 1}
                  onPress={firstPhoto ? () => setViewing(firstPhoto) : undefined}
                >
                  {firstPhoto && (
                    <Image source={{ uri: firstPhoto.photo_url }} style={styles.calThumb} contentFit="cover" />
                  )}
                  <Text style={[styles.calDay, hasPhoto && styles.calDayPhoto]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 이번 달 사진 헤더 */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>이번 달 사진</Text>
          {monthPhotos.length > 0 && (
            <TouchableOpacity onPress={() => setGalleryVisible(true)}>
              <Text style={styles.sectionMore}>전체 {monthPhotos.length}장 보기 ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 가로 스크롤 최근 5장 */}
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />
        ) : monthPhotos.length === 0 ? (
          <TouchableOpacity style={styles.emptyCard} onPress={handleAdd} disabled={uploading}>
            <Text style={styles.emptyEmoji}>📷</Text>
            <Text style={styles.emptyText}>
              {pet ? '사진을 추가해볼까요?' : '반려동물을 먼저 등록해주세요'}
            </Text>
          </TouchableOpacity>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {recentPhotos.map(photo => (
              <TouchableOpacity
                key={photo.id}
                style={styles.hCard}
                activeOpacity={0.85}
                onPress={() => setViewing(photo)}
              >
                <Image source={{ uri: photo.photo_url }} style={styles.hPhoto} contentFit="cover" />
                <View style={styles.hCaption}>
                  {photo.notes
                    ? <Text style={styles.hName} numberOfLines={1}>{photo.notes}</Text>
                    : null}
                  <Text style={styles.hDate}>{photo.taken_at.slice(5).replace('-', '/')}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {monthPhotos.length > 5 && (
              <TouchableOpacity style={styles.hMoreCard} onPress={() => setGalleryVisible(true)}>
                <Text style={styles.hMoreCount}>+{monthPhotos.length - 5}</Text>
                <Text style={styles.hMoreLabel}>더 보기</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* 저장 용량 */}
        <View style={styles.storageCard}>
          <View style={styles.storageHeader}>
            <Text style={styles.storageLabel}>패밀리 저장 용량</Text>
            <Text style={[styles.storageValue, isNearLimit && { color: Colors.danger }]}>
              {`${totalMB}MB / 100MB`}
            </Text>
          </View>
          <View style={styles.storageBar}>
            <View style={[
              styles.storageBarFill,
              { width: `${usedFraction * 100}%` },
              isNearLimit && { backgroundColor: Colors.danger },
            ]} />
          </View>
          <Text style={styles.storageSub}>
            {isNearLimit
              ? '저장 공간이 부족해요. 오래된 사진을 삭제해보세요.'
              : '패밀리 공유 저장공간 100MB. 패밀리 전원의 업로드가 합산돼요.'}
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 전체 갤러리 모달 */}
      <Modal visible={galleryVisible} animationType="slide" onRequestClose={() => setGalleryVisible(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>{year}년 {month}월 전체 사진</Text>
            <TouchableOpacity onPress={() => setGalleryVisible(false)}>
              <Text style={styles.galleryClose}>닫기</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.galleryContent} showsVerticalScrollIndicator={false}>
            <View style={styles.gridRow}>
              {monthPhotos.map(photo => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoCell}
                  activeOpacity={0.85}
                  onPress={() => setViewing(photo)}
                >
                  <Image source={{ uri: photo.photo_url }} style={styles.photoImage} contentFit="cover" />
                  <View style={styles.photoCaption}>
                    {photo.notes
                      ? <Text style={styles.photoName} numberOfLines={1}>{photo.notes}</Text>
                      : null}
                    <Text style={styles.photoDate}>{photo.taken_at.slice(5).replace('-', '/')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 사진 이름 입력 모달 */}
      <Modal visible={!!pickedPhoto} transparent animationType="slide" onRequestClose={() => setPickedPhoto(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.nameOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => handleSave(null)} />
          <View style={styles.nameCard}>
            <Text style={styles.nameTitle}>사진 이름</Text>
            <Text style={styles.nameSub}>이름을 입력하거나 건너뛸 수 있어요</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="예: 첫 목욕 🛁"
              placeholderTextColor={Colors.light}
              value={photoName}
              onChangeText={setPhotoName}
              maxLength={30}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => handleSave(photoName.trim() || null)}
            />
            <View style={styles.nameBtns}>
              <TouchableOpacity style={styles.skipBtn} onPress={() => handleSave(null)}>
                <Text style={styles.skipBtnText}>건너뛰기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(photoName.trim() || null)}>
                <Text style={styles.saveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 전체화면 사진 뷰어 */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <StatusBar hidden />
        <View style={styles.viewer}>
          <Image
            source={{ uri: viewing?.photo_url }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
          />
          <SafeAreaView style={styles.viewerOverlay} pointerEvents="box-none">
            {/* 상단 바 */}
            <View style={styles.viewerTop}>
              <TouchableOpacity style={styles.viewerBtn} onPress={() => setViewing(null)}>
                <Text style={styles.viewerBtnTxt}>✕</Text>
              </TouchableOpacity>
              {viewing && (
                <Text style={styles.viewerDate}>
                  {viewing.notes
                    ? `${viewing.notes}  ·  ${viewing.taken_at.replace(/-/g, '.')}`
                    : viewing.taken_at.replace(/-/g, '.')}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.viewerBtn, styles.viewerDeleteBtn]}
                onPress={() => viewing && handleDeletePhoto(viewing)}
              >
                <Text style={styles.viewerBtnTxt}>🗑</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  addBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    minWidth: 58, alignItems: 'center',
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 16, paddingVertical: 14,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  arrow: { fontSize: 22, color: Colors.sub, lineHeight: 26 },
  monthLabel: { fontSize: 15, fontWeight: '800', color: Colors.text },

  content: { padding: 16, gap: 16 },

  // 캘린더
  calendarCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card, padding: 14, ...Shadow.sm,
  },
  calRow: { flexDirection: 'row', marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: Colors.sub },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 7, overflow: 'hidden',
  },
  calCellPhoto: { backgroundColor: Colors.primaryLight },
  calThumb: { position: 'absolute', width: '100%', height: '100%', opacity: 0.7 },
  calDay: { fontSize: 9, fontWeight: '400', color: Colors.sub },
  calDayPhoto: { fontWeight: '800', color: Colors.primary },

  // 섹션 헤더
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.sub },
  sectionMore: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  // 빈 상태
  emptyCard: {
    backgroundColor: Colors.white, borderRadius: Radius.card,
    paddingVertical: 32, alignItems: 'center', gap: 10, ...Shadow.sm,
  },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontSize: 14, color: Colors.sub, fontWeight: '600' },

  // 가로 스크롤
  hScroll: { paddingVertical: 4, gap: 10 },
  hCard: {
    width: 130,
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  hPhoto: { width: 130, height: 130 },
  hCaption: { paddingHorizontal: 9, paddingTop: 6, paddingBottom: 8, gap: 2 },
  hName: { fontSize: 12, fontWeight: '700', color: Colors.text },
  hDate: { fontSize: 11, color: Colors.sub },
  hMoreCard: {
    width: 130, height: 130 + 44,
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    ...Shadow.sm,
  },
  hMoreCount: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  hMoreLabel: { fontSize: 12, color: Colors.sub, fontWeight: '600' },

  // 저장 용량
  storageCard: {
    backgroundColor: Colors.white, borderRadius: Radius.card, padding: 16, ...Shadow.sm,
  },
  storageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  storageLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  storageValue: { fontSize: 13, fontWeight: '600', color: Colors.sub },
  storageBar: { height: 7, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  storageBarFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 4 },
  storageSub: { fontSize: 11, color: Colors.light },

  // 전체 갤러리 모달
  galleryHeader: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  galleryTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  galleryClose: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  galleryContent: { padding: 16 },

  // 2열 그리드 (갤러리용)
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCell: {
    width: '47.5%', backgroundColor: Colors.white,
    borderRadius: Radius.card, overflow: 'hidden', ...Shadow.sm,
  },
  photoImage: { width: '100%', aspectRatio: 1 },
  photoCaption: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 9, gap: 2 },
  photoName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  photoDate: { fontSize: 11, color: Colors.sub },

  // 이름 입력 모달
  nameOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  nameCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 12,
  },
  nameTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  nameSub: { fontSize: 13, color: Colors.sub, marginTop: -4 },
  nameInput: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, marginTop: 4,
  },
  nameBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  skipBtn: {
    flex: 1, paddingVertical: 13,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  skipBtnText: { fontSize: 14, fontWeight: '700', color: Colors.sub },
  saveBtn: {
    flex: 2, paddingVertical: 13,
    borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  // 전체화면 뷰어
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerOverlay: { flex: 1 },
  viewerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12,
  },
  viewerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerDeleteBtn: { backgroundColor: 'rgba(255,80,80,0.25)' },
  viewerBtnTxt: { fontSize: 15, color: '#fff', fontWeight: '700' },
  viewerDate: { flex: 1, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginHorizontal: 8 },
});
