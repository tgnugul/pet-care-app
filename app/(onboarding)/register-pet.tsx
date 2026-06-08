import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore } from '@/stores/pet.store';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type Species = 'dog' | 'cat' | 'rabbit' | 'bird' | 'fish' | 'other';
type Gender = 'male' | 'female' | null;

export default function RegisterPetScreen() {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('dog');
  const [breed, setBreed] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<Gender>(null);
  const [weight, setWeight] = useState('');
  const [neutered, setNeutered] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const { fetchPets } = usePetStore();

  function pickPhoto() {
    setShowPhotoPicker(true);
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setProfilePhotoUri(result.assets[0].uri);
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setProfilePhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('이름을 입력해주세요');
      return;
    }
    if (birthday.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(birthday.trim())) {
      Alert.alert('날짜 형식 오류', 'YYYY-MM-DD 형식으로 입력해주세요. 예) 2022-03-15');
      return;
    }
    if (weight && isNaN(parseFloat(weight))) {
      Alert.alert('몸무게 오류', '올바른 숫자를 입력해주세요.');
      return;
    }

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      Alert.alert('오류', '로그인 정보를 찾을 수 없어요.');
      setLoading(false);
      return;
    }

    let profilePhotoUrl: string | null = null;
    if (profilePhotoUri) {
      const resized = await manipulateAsync(
        profilePhotoUri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: SaveFormat.JPEG, base64: true },
      );
      const filePath = `${session.user.id}/${Date.now()}.jpg`;
      const bytes = base64ToBytes(resized.base64 ?? '');
      const { error: uploadError } = await supabase.storage
        .from('pet-photos')
        .upload(filePath, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) {
        Alert.alert('사진 업로드 실패', '사진을 저장하지 못했어요. 나머지 정보는 저장됩니다.');
      } else {
        const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(filePath);
        profilePhotoUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from('pets').insert({
      user_id: session.user.id,
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      birthday: birthday.trim() || null,
      gender: gender ?? null,
      weight: weight ? parseFloat(weight) : null,
      neutered,
      profile_photo_url: profilePhotoUrl,
    });

    setLoading(false);

    if (error) {
      Alert.alert('저장 실패', '잠시 후 다시 시도해주세요.');
    } else {
      await fetchPets();
      router.replace('/(tabs)');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>반려동물 등록</Text>
          <Text style={styles.sub}>아이의 정보를 입력해주세요</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 프로필 사진 */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoPickerWrap} onPress={pickPhoto} activeOpacity={0.8}>
            {profilePhotoUri ? (
              <>
                <Image source={{ uri: profilePhotoUri }} style={styles.photoPreview} />
                <View style={styles.photoEditBadge}>
                  <Text style={styles.photoEditBadgeText}>수정</Text>
                </View>
              </>
            ) : (
              <View style={styles.photoEmpty}>
                <Image source={require('@/assets/images/camera-add.png')} style={styles.cameraIcon} />
                <Text style={styles.photoEmptyText}>사진 추가</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.photoHint}>반려동물 프로필 사진 (선택)</Text>
        </View>

        {/* 이름 */}
        <Text style={styles.label}>이름 *</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 뽀미"
          placeholderTextColor={Colors.light}
          value={name}
          onChangeText={setName}
        />

        {/* 품종 */}
        <Text style={styles.label}>품종 <Text style={styles.optional}>(선택)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="예) 말티즈, 코리안 숏헤어"
          placeholderTextColor={Colors.light}
          value={breed}
          onChangeText={setBreed}
        />

        {/* 생일 */}
        <Text style={styles.label}>생일 <Text style={styles.optional}>(선택)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD  예) 2022-03-15"
          placeholderTextColor={Colors.light}
          value={birthday}
          onChangeText={setBirthday}
          keyboardType="numbers-and-punctuation"
        />

        {/* 성별 */}
        <Text style={styles.label}>성별 <Text style={styles.optional}>(선택)</Text></Text>
        <View style={styles.genderRow}>
          {([['male', '수컷 ♂'], ['female', '암컷 ♀']] as const).map(([val, lbl]) => (
            <TouchableOpacity
              key={val}
              style={[styles.genderBtn, gender === val && styles.genderBtnActive]}
              onPress={() => setGender(gender === val ? null : val)}
            >
              <Text style={[styles.genderLabel, gender === val && styles.genderLabelActive]}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 몸무게 */}
        <Text style={styles.label}>몸무게 <Text style={styles.optional}>(선택)</Text></Text>
        <View style={styles.weightRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="예) 3.2"
            placeholderTextColor={Colors.light}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
          <Text style={styles.weightUnit}>kg</Text>
        </View>

        {/* 중성화 */}
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.label} >중성화 여부</Text>
            <Text style={styles.switchSub}>중성화 수술을 했나요?</Text>
          </View>
          <Switch
            value={neutered}
            onValueChange={setNeutered}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        </View>

        {/* 저장 버튼 */}
        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || loading) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>등록하기</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.skipBtnText}>나중에 등록할게요</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={showPhotoPicker}
        transparent
        animationType="none"
        onRequestClose={() => setShowPhotoPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowPhotoPicker(false)} />
          <View style={styles.pickerSheet}>
            <TouchableOpacity style={styles.pickerItem} onPress={() => { setShowPhotoPicker(false); pickFromCamera(); }}>
              <Text style={styles.pickerItemText}>카메라로 촬영</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerItem} onPress={() => { setShowPhotoPicker(false); pickFromGallery(); }}>
              <Text style={styles.pickerItemText}>앨범에서 선택</Text>
            </TouchableOpacity>
            {!!profilePhotoUri && (
              <TouchableOpacity style={styles.pickerItem} onPress={() => { setShowPhotoPicker(false); setProfilePhotoUri(null); }}>
                <Text style={[styles.pickerItemText, { color: Colors.danger }]}>사진 제거</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowPhotoPicker(false)}>
              <Text style={styles.pickerCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, color: Colors.text, lineHeight: 32 },
  headerTitles: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  sub: { fontSize: 13, color: Colors.sub, marginTop: 2 },

  content: { padding: 20, gap: 8 },

  photoSection: { alignItems: 'center', marginTop: 8, marginBottom: 4 },
  photoPickerWrap: { position: 'relative' },
  photoPreview: { width: 100, height: 100, borderRadius: 50 },
  photoEmpty: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    borderWidth: 2, borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    gap: 4,
  },
  cameraIcon: { width: 30, height: 30 },
  photoEmptyText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  photoEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: Colors.primary,
    borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 2, borderColor: Colors.white,
  },
  photoEditBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  photoHint: { fontSize: 12, color: Colors.sub, marginTop: 10 },

  label: { fontSize: 13, fontWeight: '700', color: Colors.sub, marginTop: 8 },
  optional: { fontWeight: '400', color: Colors.light },

  input: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: Colors.text,
    backgroundColor: Colors.white,
    marginBottom: 4,
  },

  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  genderBtn: {
    flex: 1, paddingVertical: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.button,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  genderBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  genderLabel: { fontSize: 14, fontWeight: '600', color: Colors.sub },
  genderLabelActive: { color: Colors.primary },

  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  weightUnit: { fontSize: 15, fontWeight: '600', color: Colors.sub },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16, marginVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  switchSub: { fontSize: 12, color: Colors.light, marginTop: 2 },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.button,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    ...Shadow.card,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
  },
  saveBtnDisabled: { backgroundColor: Colors.light, shadowOpacity: 0 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },

  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipBtnText: { fontSize: 13, color: Colors.light },

  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34, overflow: 'hidden',
  },
  pickerItem: {
    paddingVertical: 17, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerItemText: { fontSize: 16, color: Colors.text },
  pickerCancel: { paddingVertical: 17, alignItems: 'center', marginTop: 8 },
  pickerCancelText: { fontSize: 16, fontWeight: '700', color: Colors.sub },
});
