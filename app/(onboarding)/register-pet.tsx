import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch, Image,
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

const SPECIES_OPTIONS: { value: Species; label: string; emoji: string }[] = [
  { value: 'dog', label: '강아지', emoji: '🐶' },
  { value: 'cat', label: '고양이', emoji: '🐱' },
  { value: 'rabbit', label: '토끼', emoji: '🐰' },
  { value: 'bird', label: '새', emoji: '🐦' },
  { value: 'fish', label: '물고기', emoji: '🐟' },
  { value: 'other', label: '기타', emoji: '🐾' },
];

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
  const { fetchPets } = usePetStore();

  function pickPhoto() {
    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: '카메라로 촬영', onPress: pickFromCamera },
      { text: '앨범에서 선택', onPress: pickFromGallery },
    ];
    if (profilePhotoUri) {
      buttons.push({ text: '사진 제거', style: 'destructive', onPress: () => setProfilePhotoUri(null) });
    }
    buttons.push({ text: '취소', style: 'cancel' });
    Alert.alert('프로필 사진', '사진을 선택하는 방법을 선택해주세요', buttons);
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
        <Text style={styles.title}>반려동물 등록</Text>
        <Text style={styles.sub}>아이의 정보를 입력해주세요</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 프로필 사진 */}
        <TouchableOpacity style={styles.photoPickerWrap} onPress={pickPhoto} activeOpacity={0.8}>
          {profilePhotoUri ? (
            <Image source={{ uri: profilePhotoUri }} style={styles.photoPreview} />
          ) : (
            <Image source={require('@/assets/images/camera-add.png')} style={styles.photoPreview} />
          )}
        </TouchableOpacity>

        {/* 종류 */}
        <Text style={styles.label}>종류 *</Text>
        <View style={styles.speciesRow}>
          {SPECIES_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.speciesBtn, species === opt.value && styles.speciesBtnActive]}
              onPress={() => setSpecies(opt.value)}
            >
              <Text style={styles.speciesEmoji}>{opt.emoji}</Text>
              <Text style={[styles.speciesLabel, species === opt.value && styles.speciesLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  sub: { fontSize: 13, color: Colors.sub, marginTop: 4 },

  content: { padding: 20, gap: 8 },

  photoPickerWrap: { alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  photoPreview: { width: 96, height: 96, borderRadius: 48 },

  label: { fontSize: 13, fontWeight: '700', color: Colors.sub, marginTop: 8 },
  optional: { fontWeight: '400', color: Colors.light },

  speciesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  speciesBtn: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', gap: 4,
    backgroundColor: Colors.white,
    minWidth: 72,
  },
  speciesBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  speciesEmoji: { fontSize: 22 },
  speciesLabel: { fontSize: 12, fontWeight: '600', color: Colors.sub },
  speciesLabelActive: { color: Colors.primary },

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
});
