import { useEffect, useState, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Colors, Radius, Shadow } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { usePetStore, formatAge } from '@/stores/pet.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useFamilyStore } from '@/stores/family.store';

const MP = {
  bg: Colors.bg,
  text: '#33281D',
  sub: '#9B8B7A',
  muted: '#BCAE9F',
  border: '#F0E7DC',
  orange: Colors.primary,
  chipBg: '#FCEAD0',
  tintBox: '#FEF5E8',
  green: '#2EA56A',
  red: '#DE5B4E',
  genderBlue: '#6FA8DC',
  genderPink: '#E88BA6',
};

const MENU_ITEMS = [
  { icon: '📊', label: '월간 건강 리포트', sub: '', chipBg: '#EEF4FF', route: '/health-report' },
  { icon: '🏥', label: '동물병원 즐겨찾기', sub: '저장된 병원 0곳', chipBg: '#EDF7F2', route: null },
  { icon: '⚙', label: '앱 설정', sub: '', chipBg: '#F3EEFF', route: '/settings' },
];

export default function MyPageScreen() {
  const { pets, loading, fetchPets, deletePet, updatePetPhoto, updatePet } = usePetStore();
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const { loadSettings } = useSettingsStore();
  const {
    family, members, pendingRequests, myPendingRequest, myUserId,
    loading: familyLoading,
    fetchFamily, createFamily, requestJoin, cancelMyRequest,
    approveRequest, rejectRequest,
    leaveFamily, removeMember, dissolveFamily,
  } = useFamilyStore();
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
  const [pendingPetPhotoUri, setPendingPetPhotoUri] = useState<string | null>(null);
  const [pendingPetPhotoId, setPendingPetPhotoId] = useState<string | null>(null);
  const [photoPickerPetId, setPhotoPickerPetId] = useState<string | null>(null);

  useEffect(() => {
    fetchPets();
    loadSettings();
    fetchFamily();
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
    const result = await requestJoin(codeInput.trim());
    setFamilyActionLoading(false);
    if (result === 'pending') {
      setJoinModalVisible(false);
      setCodeInput('');
    } else {
      const msg: Record<string, string> = {
        not_found: '초대 코드를 찾을 수 없어요.',
        already_member: '이미 패밀리에 속해 있어요.',
        error: '오류가 발생했어요. 다시 시도해주세요.',
      };
      Alert.alert('참여 실패', msg[result] ?? '오류가 발생했어요.');
    }
  }

  async function handleApproveRequest(request: import('@/stores/family.store').JoinRequest) {
    const result = await approveRequest(request);
    if (result === 'full') {
      Alert.alert('인원 초과', '패밀리 인원이 가득 찼어요. (최대 4명)');
    }
  }

  function handleRejectRequest(requestId: string, name: string) {
    Alert.alert('신청 거절', `${name}의 참여 신청을 거절할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '거절', style: 'destructive', onPress: () => rejectRequest(requestId) },
    ]);
  }

  function handleCancelMyRequest() {
    Alert.alert('신청 취소', '참여 신청을 취소할까요?', [
      { text: '아니요', style: 'cancel' },
      { text: '취소하기', style: 'destructive', onPress: cancelMyRequest },
    ]);
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
    setPhotoPickerPetId(petId);
  }

  function cancelPendingPhoto() {
    setPendingPetPhotoUri(null);
    setPendingPetPhotoId(null);
  }

  function confirmPendingPhoto() {
    if (pendingPetPhotoId && pendingPetPhotoUri) {
      uploadPetPhoto(pendingPetPhotoId, pendingPetPhotoUri);
    }
    cancelPendingPhoto();
  }

  async function pickPetPhotoFromCamera(petId: string) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) {
      setPendingPetPhotoId(petId);
      setPendingPetPhotoUri(result.assets[0].uri);
    }
  }

  async function pickPetPhotoFromGallery(petId: string) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) {
      setPendingPetPhotoId(petId);
      setPendingPetPhotoUri(result.assets[0].uri);
    }
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
    const trimmed = nicknameInput.trim();
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
    if (!error && data.user) {
      await supabase.from('profiles').upsert(
        { user_id: data.user.id, nickname: trimmed },
        { onConflict: 'user_id' }
      );
    }
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
  const profileInitial = (displayName ?? userEmail ?? '?')[0].toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarInitial}>{profileInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{profileName}</Text>
            <Text style={styles.userEmail}>{userEmail ?? ''}</Text>
          </View>
          <TouchableOpacity style={styles.editProfileBtn} onPress={handleOpenEditProfile}>
            <Text style={styles.editIcon}>✎</Text>
            <Text style={styles.editProfileTxt}>편집</Text>
          </TouchableOpacity>
        </View>

        {/* 나의 반려동물 */}
        <Text style={styles.sectionTitle}>나의 반려동물</Text>

        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={MP.orange} />
          </View>
        ) : pets.length === 0 ? (
          <View style={[styles.emptyCard, { paddingVertical: 24 }]}>
            <Text style={{ color: MP.sub, fontSize: 14, textAlign: 'center' }}>
              등록된 반려동물이 없어요
            </Text>
          </View>
        ) : (
          pets.map(pet => {
            const age = formatAge(pet.birthday);
            const genderLabel = pet.gender === 'male' ? '♂' : pet.gender === 'female' ? '♀' : null;
            const genderColor = pet.gender === 'male' ? MP.genderBlue : MP.genderPink;
            return (
              <View key={pet.id} style={styles.petCard}>
                <TouchableOpacity
                  style={styles.petTopRow}
                  onPress={() => router.push(`/pet/${pet.id}` as any)}
                  activeOpacity={0.85}
                >
                  <TouchableOpacity
                    style={styles.petAvatar}
                    onPress={() => handleChangePetPhoto(pet.id)}
                    activeOpacity={0.8}
                  >
                    {uploadingPhotoId === pet.id ? (
                      <ActivityIndicator color={MP.orange} />
                    ) : pet.profile_photo_url ? (
                      <Image source={{ uri: pet.profile_photo_url }} style={styles.petAvatarPhoto} />
                    ) : (
                      <Text style={styles.petAvatarLetter}>{pet.name.charAt(0)}</Text>
                    )}
                    <Image source={require('@/assets/images/camera-add.png')} style={styles.petCameraIcon} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={styles.petNameRow}>
                      <Text style={styles.petName}>{pet.name}</Text>
                      {genderLabel && (
                        <Text style={[styles.petGender, { color: genderColor }]}>{genderLabel}</Text>
                      )}
                    </View>
                    {pet.breed && (
                      <View style={styles.breedChip}>
                        <Text style={styles.breedText}>{pet.breed}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>

                <View style={styles.statDivider} />
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>나이</Text>
                    <Text style={styles.statValue}>{age ?? '-'}</Text>
                  </View>
                  <View style={styles.statSep} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>몸무게</Text>
                    <Text style={styles.statValue}>{pet.weight ? `${pet.weight}kg` : '-'}</Text>
                  </View>
                  <View style={styles.statSep} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>중성화</Text>
                    <Text style={[styles.statValue, pet.neutered ? { color: MP.green } : {}]}>
                      {pet.neutered ? '✓ 완료' : '미완료'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* 반려동물 추가 */}
        <TouchableOpacity
          style={styles.addPetBtn}
          onPress={() => router.push('/(onboarding)/register-pet')}
        >
          <Text style={styles.addPetPlus}>+</Text>
          <Text style={styles.addPetLabel}>반려동물 추가하기</Text>
        </TouchableOpacity>

        {/* 우리 가족 */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>우리 가족</Text>

        {familyLoading ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator color={MP.orange} />
          </View>
        ) : family ? (
          <View style={styles.familyCard}>
            <View style={styles.familyHeader}>
              <Text style={styles.familyName}>{family.name}</Text>
              <View style={styles.memberCountChip}>
                <Text style={styles.memberCountText}>{members.length}/4</Text>
              </View>
            </View>

            {members.map(m => {
              const initial = (m.display_name || m.email || '?')[0].toUpperCase();
              return (
                <View key={m.id} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, m.role === 'owner' && styles.ownerAvatar]}>
                    <Text style={[styles.memberAvatarText, m.role === 'owner' && styles.ownerAvatarText]}>
                      {m.role === 'owner' ? '★' : initial}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>
                        {m.display_name || m.email}{m.user_id === myUserId ? ' (나)' : ''}
                      </Text>
                      <View style={[styles.roleBadge, m.role === 'owner' && styles.ownerBadge]}>
                        <Text style={[styles.roleBadgeTxt, m.role === 'owner' && styles.ownerBadgeTxt]}>
                          {m.role === 'owner' ? '방장' : '멤버'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.memberEmailSub}>{m.email}</Text>
                  </View>
                  {family.owner_id === myUserId && m.user_id !== myUserId && (
                    <TouchableOpacity onPress={() => handleRemoveMember(m.user_id, m.email)}>
                      <Text style={styles.removeBtn}>내보내기</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {family.owner_id === myUserId && pendingRequests.length > 0 && (
              <View style={styles.pendingSection}>
                <Text style={styles.pendingTitle}>참여 신청 {pendingRequests.length}건</Text>
                {pendingRequests.map(req => (
                  <View key={req.id} style={styles.pendingRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>+</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{req.display_name || req.email}</Text>
                      <Text style={styles.memberEmailSub}>{req.email}</Text>
                    </View>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveRequest(req)}>
                      <Text style={styles.approveTxt}>승인</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectRequest(req.id, req.display_name || req.email)}>
                      <Text style={styles.rejectTxt}>거절</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.inviteBox}>
              <View>
                <Text style={styles.inviteLabel}>초대 코드</Text>
                <Text style={styles.inviteCode}>{family.invite_code}</Text>
              </View>
              <TouchableOpacity
                style={[styles.copyBtn, codeCopied && styles.copyBtnDone]}
                onPress={() => handleCopyCode(family.invite_code)}
              >
                <Text style={styles.copyBtnTxt}>{codeCopied ? '복사됨 ✓' : '복사'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleLeaveOrDissolve} style={styles.leaveBtn}>
              <Text style={styles.leaveTxt}>
                {family.owner_id === myUserId ? '패밀리 해산' : '패밀리 탈퇴'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : myPendingRequest ? (
          <View style={styles.pendingCard}>
            <View style={styles.pendingIconWrap}>
              <Text style={styles.pendingIconText}>◷</Text>
            </View>
            <Text style={styles.pendingCardTitle}>승인 대기 중이에요</Text>
            <Text style={styles.pendingCardDesc}>그룹장이 승인하면 패밀리에 합류돼요</Text>
            <TouchableOpacity style={styles.cancelRequestBtn} onPress={handleCancelMyRequest}>
              <Text style={styles.cancelRequestTxt}>신청 취소</Text>
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

        {/* 설정 */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>설정</Text>
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.menuRow, i < MENU_ITEMS.length - 1 && styles.menuDivider]}
              activeOpacity={0.7}
              onPress={item.route ? () => router.push(item.route! as any) : undefined}
            >
              <View style={[styles.menuIconChip, { backgroundColor: item.chipBg }]}>
                <Text style={styles.menuIconText}>{item.icon}</Text>
              </View>
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

      {/* 반려동물 사진 변경 확인 모달 */}
      <Modal
        visible={!!pendingPetPhotoUri}
        transparent
        animationType="slide"
        onRequestClose={cancelPendingPhoto}
      >
        <View style={styles.photoConfirmOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={cancelPendingPhoto} />
          <View style={styles.photoConfirmCard}>
            <View style={styles.photoConfirmHeader}>
              <Text style={styles.photoConfirmTitle}>프로필 사진 변경</Text>
              <TouchableOpacity onPress={cancelPendingPhoto} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.photoConfirmClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {pendingPetPhotoUri && (
              <Image source={{ uri: pendingPetPhotoUri }} style={styles.photoConfirmPreview} />
            )}
            <View style={styles.photoConfirmBtns}>
              <TouchableOpacity style={styles.photoConfirmCancelBtn} onPress={cancelPendingPhoto}>
                <Text style={styles.photoConfirmCancelTxt}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoConfirmOkBtn} onPress={confirmPendingPhoto}>
                <Text style={styles.photoConfirmOkTxt}>변경하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 반려동물 사진 피커 */}
      <Modal
        visible={!!photoPickerPetId}
        transparent
        animationType="none"
        onRequestClose={() => setPhotoPickerPetId(null)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPhotoPickerPetId(null)} />
          <View style={styles.pickerSheet}>
            <TouchableOpacity style={styles.pickerItem} onPress={() => { const id = photoPickerPetId!; setPhotoPickerPetId(null); pickPetPhotoFromCamera(id); }}>
              <Text style={styles.pickerItemText}>카메라로 촬영</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerItem} onPress={() => { const id = photoPickerPetId!; setPhotoPickerPetId(null); pickPetPhotoFromGallery(id); }}>
              <Text style={styles.pickerItemText}>앨범에서 선택</Text>
            </TouchableOpacity>
            {!!pets.find(p => p.id === photoPickerPetId)?.profile_photo_url && (
              <TouchableOpacity style={styles.pickerItem} onPress={() => { const id = photoPickerPetId!; setPhotoPickerPetId(null); updatePet(id, { profile_photo_url: null }); }}>
                <Text style={[styles.pickerItemText, { color: Colors.danger }]}>사진 제거</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setPhotoPickerPetId(null)}>
              <Text style={styles.pickerCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  safe: { flex: 1, backgroundColor: MP.bg },
  content: { padding: 20, gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: MP.sub, marginBottom: 4 },
  chevron: { fontSize: 22, color: MP.muted },

  // 프로필 카드
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: MP.border,
    ...Shadow.sm,
    marginBottom: 4,
  },
  avatarWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: MP.chipBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: MP.orange,
    flexShrink: 0,
  },
  avatarInitial: { fontSize: 22, fontWeight: '800', color: MP.orange },
  userName: { fontSize: 18, fontWeight: '800', color: MP.text },
  userEmail: { fontSize: 12, color: MP.sub, marginTop: 2 },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: MP.orange,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  editIcon: { fontSize: 13, color: MP.orange },
  editProfileTxt: { fontSize: 13, fontWeight: '600', color: MP.orange },

  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: MP.border,
  },

  // 반려동물 카드
  petCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card + 2,
    borderWidth: 1, borderColor: MP.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  petTopRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 14,
  },
  petAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: MP.chipBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: MP.orange,
    flexShrink: 0,
  },
  petAvatarPhoto: { width: 72, height: 72, borderRadius: 36 },
  petAvatarLetter: { fontSize: 26, fontWeight: '800', color: MP.orange },
  petCameraIcon: { position: 'absolute', bottom: -3, right: -3, width: 24, height: 24 },
  petNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  petName: { fontSize: 18, fontWeight: '800', color: MP.text },
  petGender: { fontSize: 15, fontWeight: '700' },
  breedChip: {
    alignSelf: 'flex-start',
    backgroundColor: MP.chipBg,
    borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  breedText: { fontSize: 12, color: MP.orange, fontWeight: '600' },

  statDivider: { height: 1, backgroundColor: MP.border },
  statRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statSep: { width: 1, backgroundColor: MP.border, marginVertical: 4 },
  statLabel: { fontSize: 11, color: MP.muted, fontWeight: '600' },
  statValue: { fontSize: 13, fontWeight: '700', color: MP.text },

  addPetBtn: {
    borderWidth: 2, borderColor: MP.border, borderStyle: 'dashed',
    borderRadius: Radius.card,
    paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addPetPlus: { fontSize: 20, color: MP.orange, fontWeight: '300' },
  addPetLabel: { fontSize: 14, fontWeight: '700', color: MP.orange },

  // 패밀리 카드
  familyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16, gap: 12,
    borderWidth: 1, borderColor: MP.border,
    ...Shadow.sm,
  },
  familyHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: MP.border,
  },
  familyName: { fontSize: 15, fontWeight: '800', color: MP.text, flex: 1 },
  memberCountChip: {
    backgroundColor: MP.chipBg, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  memberCountText: { fontSize: 12, fontWeight: '700', color: MP.orange },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0ECE7',
    alignItems: 'center', justifyContent: 'center',
  },
  ownerAvatar: { backgroundColor: MP.chipBg },
  memberAvatarText: { fontSize: 14, fontWeight: '700', color: MP.sub },
  ownerAvatarText: { color: MP.orange },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  memberName: { fontSize: 14, fontWeight: '600', color: MP.text },
  roleBadge: {
    backgroundColor: '#EDE9E4', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  ownerBadge: { backgroundColor: MP.chipBg },
  roleBadgeTxt: { fontSize: 10, fontWeight: '700', color: MP.sub },
  ownerBadgeTxt: { color: MP.orange },
  memberEmailSub: { fontSize: 11, color: MP.muted },
  removeBtn: { fontSize: 12, color: MP.red, fontWeight: '600' },

  inviteBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: MP.tintBox,
    borderRadius: Radius.icon, padding: 14,
    borderWidth: 1, borderColor: '#F5E0C0',
    marginTop: 4,
  },
  inviteLabel: { fontSize: 11, color: MP.sub, marginBottom: 4, fontWeight: '600' },
  inviteCode: { fontSize: 22, fontWeight: '800', color: MP.text, letterSpacing: 3 },
  copyBtn: {
    backgroundColor: MP.orange,
    borderRadius: Radius.pill,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  copyBtnDone: { backgroundColor: MP.green },
  copyBtnTxt: { fontSize: 13, fontWeight: '700', color: Colors.white },

  leaveBtn: { alignItems: 'center', paddingTop: 4 },
  leaveTxt: { fontSize: 13, color: MP.red, fontWeight: '600' },

  familyEmptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card, padding: 20,
    alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: MP.border, borderStyle: 'dashed',
  },
  familyEmptyDesc: { fontSize: 13, color: MP.sub, textAlign: 'center' },
  familyBtnRow: { flexDirection: 'row', gap: 10 },
  familyCreateBtn: {
    flex: 1, backgroundColor: Colors.primary,
    borderRadius: Radius.button, paddingVertical: 12, alignItems: 'center',
  },
  familyCreateTxt: { fontSize: 14, fontWeight: '700', color: Colors.white },
  familyJoinBtn: {
    flex: 1, backgroundColor: MP.chipBg,
    borderRadius: Radius.button, paddingVertical: 12, alignItems: 'center',
  },
  familyJoinTxt: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  // 참여 신청 목록
  pendingSection: {
    borderTopWidth: 1, borderTopColor: MP.border,
    paddingTop: 10, gap: 8,
  },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: MP.sub },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.icon,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  approveTxt: { fontSize: 12, fontWeight: '700', color: Colors.white },
  rejectBtn: {
    backgroundColor: MP.bg,
    borderRadius: Radius.icon,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: MP.border,
  },
  rejectTxt: { fontSize: 12, fontWeight: '600', color: MP.sub },

  // 승인 대기 중 카드
  pendingCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card, padding: 24,
    alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary,
    ...Shadow.sm,
  },
  pendingIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: MP.chipBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  pendingIconText: { fontSize: 28, color: MP.orange },
  pendingCardTitle: { fontSize: 16, fontWeight: '800', color: MP.text },
  pendingCardDesc: { fontSize: 13, color: MP.sub, textAlign: 'center' },
  cancelRequestBtn: { marginTop: 8, paddingVertical: 4 },
  cancelRequestTxt: { fontSize: 13, color: MP.red, fontWeight: '600' },

  // 설정 메뉴
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card, overflow: 'hidden',
    borderWidth: 1, borderColor: MP.border,
    ...Shadow.sm,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: MP.border },
  menuIconChip: {
    width: 40, height: 40, borderRadius: Radius.icon,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconText: { fontSize: 20 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: MP.text },
  menuSub: { fontSize: 12, color: MP.sub, marginTop: 1 },

  logoutBtn: { alignItems: 'center', paddingVertical: 14 },
  logoutText: { fontSize: 14, color: MP.sub, fontWeight: '500' },

  // 사진 피커
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34, overflow: 'hidden',
  },
  pickerItem: {
    paddingVertical: 17, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: MP.border,
  },
  pickerItemText: { fontSize: 16, color: MP.text },
  pickerCancel: { paddingVertical: 17, alignItems: 'center', marginTop: 8 },
  pickerCancelText: { fontSize: 16, fontWeight: '700', color: MP.sub },

  // 사진 변경 확인 모달
  photoConfirmOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  photoConfirmCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    alignItems: 'center', gap: 20,
  },
  photoConfirmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  photoConfirmTitle: { fontSize: 17, fontWeight: '800', color: MP.text },
  photoConfirmClose: { fontSize: 18, color: MP.sub, paddingLeft: 8 },
  photoConfirmPreview: { width: 160, height: 160, borderRadius: 80, backgroundColor: MP.chipBg },
  photoConfirmBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  photoConfirmCancelBtn: {
    flex: 1, paddingVertical: 14,
    borderRadius: Radius.button, borderWidth: 1.5, borderColor: MP.border, alignItems: 'center',
  },
  photoConfirmCancelTxt: { fontSize: 15, fontWeight: '700', color: MP.sub },
  photoConfirmOkBtn: {
    flex: 2, paddingVertical: 14,
    borderRadius: Radius.button, backgroundColor: Colors.primary, alignItems: 'center',
  },
  photoConfirmOkTxt: { fontSize: 15, fontWeight: '700', color: Colors.white },

  // 공통 모달
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: MP.text },
  modalSub: { fontSize: 13, color: MP.sub },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  modalSaveTxt: { fontSize: 15, fontWeight: '800', color: Colors.white },
  textInput: {
    borderWidth: 1.5, borderColor: MP.border,
    borderRadius: Radius.button,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: MP.text,
    marginTop: 4,
  },
});
