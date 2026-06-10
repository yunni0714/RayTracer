import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { createUserProfile, updateUserNickname } from '../../lib/firebaseService';
import { Modal, Button, TextInput } from '../ui';

interface Props {
  mode: 'set' | 'change';
}

export function NicknameModal({ mode }: Props) {
  const [value, setValue] = useState('');

  const { currentUserUid, setNickname, closeModal, showNotification } = useGameStore(useShallow(s => ({
    currentUserUid: s.currentUserUid,
    setNickname: s.setNickname,
    closeModal: s.closeModal,
    showNotification: s.showNotification,
  })));

  async function handleSubmit() {
    const nick = value.trim();
    if (!nick || nick.length < 2 || nick.length > 16) {
      showNotification('닉네임은 2~16자로 입력해주세요.', '#e74c3c');
      return;
    }
    if (!currentUserUid) return;

    try {
      if (mode === 'set') {
        await createUserProfile(currentUserUid, nick);
      } else {
        await updateUserNickname(currentUserUid, nick);
      }
      setNickname(nick);
      closeModal();
      showNotification('닉네임이 저장되었습니다!');
    } catch {
      showNotification('저장에 실패했습니다.', '#e74c3c');
    }
  }

  return (
    <Modal
      title={mode === 'set' ? '👤 닉네임 설정' : '✏️ 닉네임 변경'}
      onClose={closeModal}
      dismissable={mode !== 'set'}
      footer={
        <>
          {mode === 'change' && <Button variant="ghost" onClick={closeModal}>취소</Button>}
          <Button variant="accent" onClick={handleSubmit}>저장</Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">
        {mode === 'set' ? '처음 로그인하셨습니다! 사용할 닉네임을 설정해주세요.' : '새 닉네임을 입력해주세요.'}
      </p>
      <TextInput
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="2~16자"
        maxLength={16}
        autoFocus
      />
    </Modal>
  );
}
