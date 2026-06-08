import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, StatusBar,
  TextInput, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore } from '@/stores/pet.store';
import {
  usePhotoStore, filterByMonth, groupByDate,
  pickMultipleAndResize, type Photo, type PickedPhoto,
} from '@/stores/photo.store';

const DAYS_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function startDayOfMonth(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

export default function DiaryScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { pets, fetchPets } = usePetStore();
  const { photos, loading, uploading, uploadProgress, fetchPhotos, savePhoto, savePhotos, deletePhoto } = usePhotoStore();

  const [viewing, setViewing] = useState<Photo | null>(null);
  const [pickedPhoto, setPickedPhoto] = useState<PickedPhoto | null>(null);

  const SCREEN_WIDTH = Dimensions.get('window').width;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const slideX = useSharedValue(0);

  const viewerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value + slideX.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  function resetViewer() {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    tx.value = withSpring(0);
    ty.value = withSpring(0);
    savedTx.value = 0;
    savedTy.value = 0;
    slideX.value = 0;
  }

  function navigateTo(photo: Photo) {
    setViewing(photo);
    slideX.value = 0;
  }

  function handleSwipeEnd(translationX: number) {
    const idx = monthPhotos.findIndex(p => p.id === viewing?.id);
    const THRESHOLD = 60;
    if (translationX < -THRESHOLD && idx < monthPhotos.length - 1) {
      slideX.value = withTiming(-SCREEN_WIDTH, { duration: 180 }, () => {
        runOnJS(navigateTo)(monthPhotos[idx + 1]);
      });
    } else if (translationX > THRESHOLD && idx > 0) {
      slideX.value = withTiming(SCREEN_WIDTH, { duration: 180 }, () => {
        runOnJS(navigateTo)(monthPhotos[idx - 1]);
      });
    } else {
      slideX.value = withSpring(0);
    }
  }

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => { scale.value = Math.max(1, Math.min(5, savedScale.value * e.scale)); })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) resetViewer();
    });

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      if (scale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      } else {
        slideX.value = e.translationX;
      }
    })
    .onEnd(e => {
      if (scale.value > 1) {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      } else {
        runOnJS(handleSwipeEnd)(e.translationX);
      }
    });

  const doubleTapGesture = Gesture.Tap().numberOfTaps(2).onStart(() => {
    if (scale.value > 1) {
      resetViewer();
    } else {
      scale.value = withSpring(2.5);
      savedScale.value = 2.5;
    }
  });

  const viewerGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  async function downloadPhoto(url: string) {
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진을 저장하려면 갤러리 접근 권한이 필요해요.');
      return;
    }
    try {
      const fileUri = FileSystem.documentDirectory + `pawmate_${Date.now()}.jpg`;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('저장 완료', '사진이 갤러리에 저장됐어요.');
    } catch (e) {
      console.error('download error', e);
      Alert.alert('오류', '사진 저장에 실패했어요.');
    }
  }
  const [photoName, setPhotoName] = useState('');
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  const pet = pets[0] ?? null;

  useEffect(() => {
    if (pets.length === 0) fetchPets();
  }, []);

  useEffect(() => {
    if (pet) fetchPhotos(pet.id);
  }, [pet?.id]);

  const monthPhotos = filterByMonth(photos, year, month);
  const byDate = groupByDate(monthPhotos);
  const photoDates = new Set(monthPhotos.map(p => p.taken_at));
  const recentPhotos = monthPhotos.slice(0, 5);


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
    const picks = await pickMultipleAndResize();
    if (picks.length === 0) return;
    if (picks.length === 1) {
      setPickedPhoto(picks[0]);
      setPhotoName('');
    } else {
      await savePhotos(pet.id, picks);
    }
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>사진 다이어리</Text>
        {pet && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAdd}
            disabled={uploading || !!pickedPhoto}
          >
            {uploadProgress
              ? <Text style={styles.addBtnText}>{uploadProgress.done}/{uploadProgress.total} 업로드 중</Text>
              : uploading
                ? <ActivityIndicator color={Colors.primary} size="small" />
                : <Text style={styles.addBtnText}>+ 추가</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {!pet ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🐾</Text>
          <Text style={{ fontSize: 15, color: Colors.sub, fontWeight: '600' }}>반려동물을 먼저 등록해주세요</Text>
        </View>
      ) : (<>
      {/* 월 선택 */}
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 16, bottom: 16, left: 24, right: 24 }}>
          <Text style={styles.arrow}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setPickerYear(year); setMonthPickerVisible(true); }}>
          <Text style={styles.monthLabel}>{year}년 {month}월 ▾</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 16, bottom: 16, left: 24, right: 24 }}>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
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


        {photos.length > 0 && (
          <TouchableOpacity style={styles.allPhotosBtn} onPress={() => setGalleryVisible(true)}>
            <Text style={styles.allPhotosBtnText}>전체 사진 보기</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 월 선택 피커 */}
      <Modal
        visible={monthPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setMonthPickerVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.pickerCard}>
            {/* 연도 네비게이션 */}
            <View style={styles.pickerYearRow}>
              <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={styles.pickerArrowBtn}>
                <Text style={styles.pickerArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.pickerYearText}>{pickerYear}년</Text>
              <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={styles.pickerArrowBtn}>
                <Text style={styles.pickerArrow}>›</Text>
              </TouchableOpacity>
            </View>
            {/* 월 그리드 */}
            <View style={styles.pickerMonthGrid}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                const isSelected = m === month && pickerYear === year;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerMonthBtn, isSelected && styles.pickerMonthBtnActive]}
                    onPress={() => {
                      setYear(pickerYear);
                      setMonth(m);
                      setMonthPickerVisible(false);
                    }}
                  >
                    <Text style={[styles.pickerMonthText, isSelected && styles.pickerMonthTextActive]}>
                      {m}월
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 전체 갤러리 모달 — 타임라인 뷰 */}
      <Modal visible={galleryVisible} animationType="slide" onRequestClose={() => setGalleryVisible(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>전체 사진</Text>
            <TouchableOpacity onPress={() => setGalleryVisible(false)}>
              <Text style={styles.galleryClose}>닫기</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.galleryContent} showsVerticalScrollIndicator={false}>
            {Object.entries(groupByDate(photos))
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([date, datePhotos]) => (
                <View key={date} style={styles.timelineSection}>
                  <Text style={styles.timelineDateHeader}>{formatDate(date)}</Text>
                  <View style={styles.timelineGrid}>
                    {datePhotos.map(photo => (
                      <TouchableOpacity
                        key={photo.id}
                        style={styles.timelineCell}
                        activeOpacity={0.85}
                        onPress={() => setViewing(photo)}
                      >
                        <Image source={{ uri: photo.photo_url }} style={styles.timelinePhoto} contentFit="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))
            }
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 사진 이름 입력 모달 */}
      <Modal visible={!!pickedPhoto} transparent animationType="slide" onRequestClose={() => setPickedPhoto(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.nameOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPickedPhoto(null)} />
          <View style={styles.nameCard}>
            <Text style={styles.nameTitle}>사진 이름</Text>
            <Text style={styles.nameSub}>이름을 입력하거나 비워두고 저장할 수 있어요</Text>
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
              <TouchableOpacity style={styles.skipBtn} onPress={() => setPickedPhoto(null)}>
                <Text style={styles.skipBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(photoName.trim() || null)}>
                <Text style={styles.saveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 전체화면 사진 뷰어 */}
      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
        onShow={() => { scale.value = 1; savedScale.value = 1; tx.value = 0; ty.value = 0; savedTx.value = 0; savedTy.value = 0; slideX.value = 0; }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar hidden />
        <GestureDetector gesture={viewerGesture}>
          <View style={styles.viewer}>
            <Animated.View style={[StyleSheet.absoluteFill, viewerAnimatedStyle]}>
              <Image
                source={{ uri: viewing?.photo_url }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
            </Animated.View>
            <SafeAreaView style={[StyleSheet.absoluteFill, styles.viewerOverlay]} pointerEvents="box-none">
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
              <View style={styles.viewerActions}>
                <TouchableOpacity
                  style={styles.viewerBtn}
                  onPress={() => viewing && downloadPhoto(viewing.photo_url)}
                >
                  <Text style={styles.viewerBtnTxt}>⬇</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewerBtn, styles.viewerDeleteBtn]}
                  onPress={() => viewing && handleDeletePhoto(viewing)}
                >
                  <Text style={styles.viewerBtnTxt}>🗑</Text>
                </TouchableOpacity>
              </View>
              {monthPhotos.length > 1 && viewing && (
                <View style={styles.pageIndicator} pointerEvents="none">
                  <Text style={styles.pageIndicatorTxt}>
                    {monthPhotos.findIndex(p => p.id === viewing.id) + 1} / {monthPhotos.length}
                  </Text>
                </View>
              )}
              </View>
            </SafeAreaView>
          </View>
        </GestureDetector>
        </GestureHandlerRootView>
      </Modal>
      </>)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
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

  // 타임라인 갤러리
  timelineSection: { marginBottom: 20 },
  timelineDateHeader: { fontSize: 13, fontWeight: '700', color: Colors.sub, marginBottom: 8 },
  timelineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  timelineCell: { width: '32.3%', aspectRatio: 1, borderRadius: 6, overflow: 'hidden' },
  timelinePhoto: { width: '100%', height: '100%' },

  // 전체 사진 보기 버튼
  allPhotosBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadow.sm,
  },
  allPhotosBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

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
  viewerOverlay: { justifyContent: 'space-between' },
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
  viewerActions: { flexDirection: 'row', gap: 8 },
  // 월 피커
  pickerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 20, width: 300, ...Shadow.card,
  },
  pickerYearRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  pickerArrowBtn: { padding: 8 },
  pickerArrow: { fontSize: 22, color: Colors.sub },
  pickerYearText: { fontSize: 17, fontWeight: '800', color: Colors.text },
  pickerMonthGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  pickerMonthBtn: {
    width: '22%', paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', backgroundColor: Colors.bg,
  },
  pickerMonthBtnActive: { backgroundColor: Colors.primary },
  pickerMonthText: { fontSize: 14, fontWeight: '600', color: Colors.sub },
  pickerMonthTextActive: { color: Colors.white, fontWeight: '800' },

  pageIndicator: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginTop: 10,
  },
  pageIndicatorTxt: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
});
