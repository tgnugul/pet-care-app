import { useEffect, useState, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert, ActivityIndicator, Modal, TextInput, Image } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Colors, Radius, Shadow } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { usePetStore, SPECIES_EMOJI, formatAge } from '@/stores/pet.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useFamilyStore } from '@/stores/family.store';
import { useSubscriptionStore } from '@/stores/subscription.store';

const STATIC_MENU = [
  { emoji: '📊', label: '월간 건강 리포트', sub: '프리미엄 기능' },
  { emoji: '🏥', label: '동물병원 즐겨찾기', sub: '저장된 병원 0곳' },
  { emoji: '⚙️', label: '앱 설정', sub: '' },
];

export default function MyPageScreen() {
  const { pets, loading, fetchPets, deletePet, updatePetPhoto, updatePet } = usePetStore();
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const { loadSettings } = useSettingsStore();
  const { family, members, myUserId, loading: familyLoading, fetchFamily, createFamily, joinFamily, leaveFamily, removeMember, dissolveFamily } = useFamilyStore();
  const { isPremium, fetchStatus } = useSubscriptionStore();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [familyActionLoading, setFamilyActionLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    fetchPets();
    loadSettings();
    fetchFamily();
    fetchStatus();
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
      setDisplayName(data.session?.user?.user_metadata?.display_name ?? null);
    });
  }, []);

  async function handleCreateFamily() {
    if (!familyNameInput.trim()) return;
    setFamilyActionLoading(true);
    const ok = await createFamily(familyNameInput.trim());
    setFamilyActionLoading(false);
    if (ok) {
      setCreateModalVisible(false);
      setFamilyNameInput('');
    } else {
      Alert.alert('오류', '이미 패밀리에 속해 있거나 생성에 실패했어요.');
    }
  }

  async function handleJoinFamily() {
    if (!codeInput.trim()) return;
    setFamilyActionLoading(true);
    const result = await joinFamily(codeInput.trim());
    setFamilyActionLoading(false);
    if (result === 'success') {
      setJoinModalVisible(false);
      setCodeInput('');
    } else {
      const msg: Record<string, string> = {
        not_found: '초대 코드를 찾을 수 없어요.',
        full: '패밀리 인원이 가득 찼어요. (최대 4명)',
        already_member: '이미 패밀리에 속해 있어요.',
        error: '오류가 발생했어요. 다시 시도해주세요.',
      };
      Alert.alert('참여 실패', msg[result] ?? '오류가 발생했어요.');
    }
  }

  function handleLeaveOrDissolve() {
    const isOwner = family?.owner_id === myUserId;
    if (isOwner && members.length > 1) {
      Alert.alert('패밀리 해산', '패밀리를 해산하면 모든 멤버가 제거돼요. 계속할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '해산', style: 'destructive', onPress: dissolveFamily },
      ]);
    } else if (isOwner) {
      Alert.alert('패밀리 해산', '패밀리를 해산할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '해산', style: 'destructive', onPress: dissolveFamily },
      ]);
    } else {
      Alert.alert('패밀리 탈퇴', '패밀리에서 탈퇴할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '탈퇴', style: 'destructive', onPress: leaveFamily },
      ]);
    }
  }

  async function handleCopyCode(code: string) {
    await Clipboard.setStringAsync(code);
    setCodeCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCodeCopied(false), 2000);
  }

  function handleChangePetPhoto(petId: string) {
    const hasPhoto = !!pets.find(p => p.id === petId)?.profile_photo_url;
    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: '카메라로 촬영', onPress: () => pickPetPhotoFromCamera(petId) },
      { text: '앨범에서 선택', onPress: () => pickPetPhotoFromGallery(petId) },
    ];
    if (hasPhoto) {
      buttons.push({ text: '사진 제거', style: 'destructive', onPress: () => updatePet(petId, { profile_photo_url: null }) });
    }
    buttons.push({ text: '취소', style: 'cancel' });
    Alert.alert('프로필 사진 변경', '사진을 선택하는 방법을 선택해주세요', buttons);
  }

  async function pickPetPhotoFromCamera(petId: string) {
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
    if (!result.canceled) uploadPetPhoto(petId, result.assets[0].uri);
  }

  async function pickPetPhotoFromGallery(petId: string) {
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
    if (!result.canceled) uploadPetPhoto(petId, result.assets[0].uri);
  }

  async function uploadPetPhoto(petId: string, uri: string) {
    setUploadingPhotoId(petId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resized = await manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: SaveFormat.JPEG, base64: true },
      );
      const filePath = `${session.user.id}/${petId}.jpg`;
      const binary = atob(resized.base64 ?? '');
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error: uploadError } = await supabase.storage
        .from('pet-photos')
        .upload(filePath, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) { Alert.alert('업로드 실패', uploadError.message); return; }

      const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(filePath);
      await updatePetPhoto(petId, urlData.publicUrl);
    } finally {
      setUploadingPhotoId(null);
    }
  }

  function handleDeletePet(id: string, name: string) {
    Alert.alert(
      `${name} 삭제`,
      `${name}의 모든 정보(케어 일정, 사진, 산책 기록)가 함께 삭제돼요. 정말 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => deletePet(id) },
      ],
    );
  }

  function handleOpenEditProfile() {
    setNicknameInput(displayName ?? '');
    setEditProfileVisible(true);
  }

  async function handleSaveProfile() {
    if (!nicknameInput.trim()) return;
    setProfileSaving(true);
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: nicknameInput.trim() },
    });
    setProfileSaving(false);
    if (!error && data.user) {
      setDisplayName(data.user.user_metadata?.display_name ?? null);
      setEditProfileVisible(false);
    } else {
      Alert.alert('저장 실패', '다시 시도해주세요.');
    }
  }

  function handleRemoveMember(userId: string, email: string) {
    Alert.alert('멤버 내보내기', `${email}을 패밀리에서 내보낼까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '내보내기', style: 'destructive', onPress: () => removeMember(userId) },
    ]);
  }

  function handleLogout() {
    Alert.alert('로그아웃', '정말 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  const profileName = displayName
    ? `${displayName}님`
    : pets[0] ? `${pets[0].name} 보호자님` : '보호자님';

  return (
    <SafeAreaView style={styles.safe}>
      {/* 프로필 헤더 */}
      <View style={styles.profileHeader}>
        <View style={styles.profileCircleBg} />
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{profileName}</Text>
            <Text style={styles.userEmail}>{userEmail ?? ''}</Text>
          </View>
          <TouchableOpacity style={styles.editProfileBtn} onPress={handleOpenEditProfile}>
            <Text style={styles.editProfileTxt}>편집</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 프리미엄 상태 */}
        {isPremium ? (
          <View style={styles.premiumBadgeRow}>
            <Text style={styles.premiumBadgeTxt}>✨ 프리미엄 구독 중</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.upgradeBanner} onPress={() => router.push('/paywall' as any)}>
            <Text style={styles.upgradeTxt}>✨ 프리미엄으로 업그레이드</Text>
            <Text style={styles.upgradeChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* 반려동물 */}
        <Text style={styles.sectionTitle}>나의 반려동물</Text>

        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : pets.length === 0 ? (
          <View style={[styles.petCard, { justifyContent: 'center', paddingVertical: 24 }]}>
            <Text style={{ color: Colors.sub, fontSize: 14, textAlign: 'center' }}>
              등록된 반려동물이 없어요
            </Text>
          </View>
        ) : (
          pets.map(pet => {
            const age = formatAge(pet.birthday);
            const genderLabel = pet.gender === 'male' ? '♂' : pet.gender === 'female' ? '♀' : null;
            return (
              <TouchableOpacity
                key={pet.id}
                style={styles.petCard}
                onPress={() => router.push(`/pet/${pet.id}` as any)}
                activeOpacity={0.85}
              >
                <TouchableOpacity style={styles.petAvatar} onPress={() => handleChangePetPhoto(pet.id)} activeOpacity={0.8}>
                  {uploadingPhotoId === pet.id ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : pet.profile_photo_url ? (
                    <Image source={{ uri: pet.profile_photo_url }} style={styles.petAvatarPhoto} />
                  ) : (
                    <Text style={{ fontSize: 30 }}>{SPECIES_EMOJI[pet.species]}</Text>
                  )}
                  <Image source={require('@/assets/images/camera-add.png')} style={styles.petAvatarCameraIcon} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={styles.petNameRow}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    {genderLabel && <Text style={styles.petGender}>{genderLabel}</Text>}
                  </View>
                  {pet.breed && (
                    <View style={styles.breedPill}>
                      <Text style={styles.breedText}>{pet.breed}</Text>
                    </View>
                  )}
                  <View style={styles.petMetaRow}>
                    {age && <Text style={styles.petMeta}>{age}</Text>}
                    {pet.weight && <Text style={styles.petMeta}>{pet.weight}kg</Text>}
                    <Text style={[styles.petMeta, { color: Colors.accent, fontWeight: '600' }]}>
                      {pet.neutered ? '중성화 ✓' : '미중성화'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 18, color: Colors.light }}>›</Text>
              </TouchableOpacity>
            );
          })
        )}

        {/* 반려동물 추가 */}
        <TouchableOpacity
          style={styles.addPetBtn}
          onPress={() => {
            if (!isPremium && pets.length >= 1) {
              router.push('/paywall' as any);
            } else {
              router.push('/(onboarding)/register-pet');
            }
          }}
        >
          <Text style={styles.addPetPlus}>+</Text>
          <Text style={styles.addPetLabel}>
            {!isPremium && pets.length >= 1 ? '반려동물 추가 (프리미엄)' : '반려동물 추가하기'}
          </Text>
        </TouchableOpacity>

        {/* 패밀리 그룹 */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>우리 가족</Text>

        {familyLoading ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : family ? (
          <View style={styles.familyCard}>
            {/* 패밀리 이름 */}
            <View style={styles.familyHeader}>
              <Text style={styles.familyName}>🏠 {family.name}</Text>
              <Text style={styles.memberCount}>{members.length}/4명</Text>
            </View>

            {/* 멤버 목록 */}
            {members.map(m => (
              <View key={m.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={{ fontSize: 16 }}>{m.role === 'owner' ? '👑' : '🐾'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberEmail}>{m.display_name || m.email}</Text>
                  <Text style={styles.memberRole}>{m.role === 'owner' ? '방장' : '멤버'}{m.user_id === myUserId ? ' (나)' : ''}</Text>
                </View>
                {family.owner_id === myUserId && m.user_id !== myUserId && (
                  <TouchableOpacity onPress={() => handleRemoveMember(m.user_id, m.email)}>
                    <Text style={styles.removeBtn}>내보내기</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* 초대 코드 */}
            <View style={styles.inviteBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteLabel}>초대 코드</Text>
                <Text style={styles.inviteCode}>{family.invite_code}</Text>
              </View>
              <TouchableOpacity onPress={() => handleCopyCode(family.invite_code)} style={styles.regenBtn}>
                <Text style={styles.regenTxt}>{codeCopied ? '복사됨 ✓' : '복사'}</Text>
              </TouchableOpacity>
            </View>

            {/* 탈퇴/해산 */}
            <TouchableOpacity onPress={handleLeaveOrDissolve} style={styles.leaveBtn}>
              <Text style={styles.leaveTxt}>
                {family.owner_id === myUserId ? '패밀리 해산' : '패밀리 탈퇴'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.familyEmptyCard}>
            <Text style={styles.familyEmptyDesc}>반려동물을 함께 관리할 가족을 초대해보세요</Text>
            <View style={styles.familyBtnRow}>
              <TouchableOpacity style={styles.familyCreateBtn} onPress={() => setCreateModalVisible(true)}>
                <Text style={styles.familyCreateTxt}>+ 패밀리 만들기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.familyJoinBtn} onPress={() => setJoinModalVisible(true)}>
                <Text style={styles.familyJoinTxt}>코드로 참여</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 메뉴 */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>설정</Text>
        <View style={styles.menuCard}>
          {STATIC_MENU.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.menuRow, i < STATIC_MENU.length - 1 && styles.menuDivider]}
              activeOpacity={0.7}
              onPress={
              item.label === '앱 설정' ? () => router.push('/settings') :
              item.label === '월간 건강 리포트' ? () => router.push('/health-report' as any) :
              undefined
            }
            >
              <Text style={styles.menuEmoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.sub ? <Text style={styles.menuSub}>{item.sub}</Text> : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 프로필 편집 모달 */}
      <Modal visible={editProfileVisible} transparent animationType="slide" onRequestClose={() => setEditProfileVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditProfileVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>프로필 편집</Text>
            <Text style={styles.modalSub}>닉네임</Text>
            <TextInput
              style={styles.textInput}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder="닉네임을 입력해주세요"
              maxLength={20}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalSaveBtn, (!nicknameInput.trim() || profileSaving) && { opacity: 0.5 }]}
              onPress={handleSaveProfile}
              disabled={!nicknameInput.trim() || profileSaving}
            >
              {profileSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalSaveTxt}>저장</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 패밀리 만들기 모달 */}
      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCreateModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>패밀리 만들기</Text>
            <Text style={styles.modalSub}>패밀리 이름을 입력해주세요</Text>
            <TextInput
              style={styles.textInput}
              placeholder="예: 우리집 멍멍이들"
              value={familyNameInput}
              onChangeText={setFamilyNameInput}
              maxLength={20}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalSaveBtn, (!familyNameInput.trim() || familyActionLoading) && { opacity: 0.5 }]}
              onPress={handleCreateFamily}
              disabled={!familyNameInput.trim() || familyActionLoading}
            >
              {familyActionLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalSaveTxt}>만들기</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 코드로 참여 모달 */}
      <Modal visible={joinModalVisible} transparent animationType="slide" onRequestClose={() => setJoinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setJoinModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>코드로 참여하기</Text>
            <Text style={styles.modalSub}>6자리 초대 코드를 입력해주세요</Text>
            <TextInput
              style={[styles.textInput, { letterSpacing: 4, fontSize: 20, fontWeight: '700', textAlign: 'center' }]}
              placeholder="XXXXXX"
              value={codeInput}
              onChangeText={t => setCodeInput(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalSaveBtn, (!codeInput.trim() || familyActionLoading) && { opacity: 0.5 }]}
              onPress={handleJoinFamily}
              disabled={!codeInput.trim() || familyActionLoading}
            >
              {familyActionLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalSaveTxt}>참여하기</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  profileHeader: {
    backgroundColor: Colors.primary,
    padding: 24, paddingTop: 20,
    overflow: 'hidden', position: 'relative',
  },
  profileCircleBg: {
    position: 'absolute', right: -30, top: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarEmoji: { fontSize: 28 },
  userName: { fontSize: 18, fontWeight: '800', color: Colors.white },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  content: { padding: 20, gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.sub, marginBottom: 4 },

  petCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card + 2,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadow.sm,
  },
  petAvatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: Colors.primary,
    flexShrink: 0,
  },
  petAvatarPhoto: { width: 60, height: 60, borderRadius: 30 },
  petAvatarCameraIcon: { position: 'absolute', bottom: -4, right: -4, width: 24, height: 24 },
  petNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  petName: { fontSize: 17, fontWeight: '800', color: Colors.text },
  petGender: { fontSize: 13, color: Colors.sub },
  breedPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6,
  },
  breedText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  petMetaRow: { flexDirection: 'row', gap: 10 },
  petMeta: { fontSize: 12, color: Colors.sub },
  chevron: { fontSize: 22, color: Colors.light },

  editProfileBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  editProfileTxt: { fontSize: 13, fontWeight: '700', color: Colors.white },

  petDeleteBtn: {
    padding: 4,
    justifyContent: 'center',
  },
  petDeleteTxt: { fontSize: 18 },

  addPetBtn: {
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
    borderRadius: Radius.card,
    paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addPetPlus: { fontSize: 20, color: Colors.primary, fontWeight: '300' },
  addPetLabel: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuEmoji: { fontSize: 20 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  menuSub: { fontSize: 12, color: Colors.sub, marginTop: 1 },

  logoutBtn: {
    alignItems: 'center', paddingVertical: 14,
  },
  logoutText: { fontSize: 14, color: Colors.sub, fontWeight: '500' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.sub },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  modalSaveTxt: { fontSize: 15, fontWeight: '800', color: Colors.white },

  // 패밀리
  familyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
    ...Shadow.sm,
  },
  familyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  familyName: { fontSize: 16, fontWeight: '800', color: Colors.text },
  memberCount: { fontSize: 12, color: Colors.sub, fontWeight: '600' },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  memberEmail: { fontSize: 14, fontWeight: '600', color: Colors.text },
  memberRole: { fontSize: 12, color: Colors.sub, marginTop: 1 },
  removeBtn: { fontSize: 12, color: Colors.danger, fontWeight: '600' },

  inviteBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg,
    borderRadius: Radius.icon,
    padding: 12, gap: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  inviteLabel: { fontSize: 11, color: Colors.sub, marginBottom: 4 },
  inviteCode: { fontSize: 22, fontWeight: '800', color: Colors.primary, letterSpacing: 3 },
  regenBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.icon,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  regenTxt: { fontSize: 12, color: Colors.primary, fontWeight: '700' },

  leaveBtn: { alignItems: 'center', paddingTop: 4 },
  leaveTxt: { fontSize: 13, color: Colors.danger, fontWeight: '600' },

  familyEmptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 20,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  familyEmptyDesc: { fontSize: 13, color: Colors.sub, textAlign: 'center' },
  familyBtnRow: { flexDirection: 'row', gap: 10 },
  familyCreateBtn: {
    flex: 1, backgroundColor: Colors.primary,
    borderRadius: Radius.button, paddingVertical: 12,
    alignItems: 'center',
  },
  familyCreateTxt: { fontSize: 14, fontWeight: '700', color: Colors.white },
  familyJoinBtn: {
    flex: 1, backgroundColor: Colors.primaryLight,
    borderRadius: Radius.button, paddingVertical: 12,
    alignItems: 'center',
  },
  familyJoinTxt: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  textInput: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text,
    marginTop: 4,
  },

  premiumBadgeRow: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  premiumBadgeTxt: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  upgradeBanner: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.card,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  upgradeTxt: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  upgradeChevron: { fontSize: 20, color: Colors.primary },
});
