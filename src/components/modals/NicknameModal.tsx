import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { createUserProfile, updateUserNickname } from '../../lib/firebaseService';

interface Props {
  mode: 'set' | 'change';
}

export function NicknameModal({ mode }: Props) {
  const [value, setValue] = useState('');
  const { currentUserUid, setNickname, closeModal, showNotification } = useGameStore(s => ({
    currentUserUid: s.currentUserUid,
    setNickname: s.setNickname,
    closeModal: s.closeModal,
    showNotification: s.showNotification,
  }));

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80 flex flex-col gap-4">
        <h3 className="text-lg font-bold text-gray-800">
          {mode === 'set' ? '👤 닉네임 설정' : '✏️ 닉네임 변경'}
        </h3>
        <p className="text-sm text-gray-500">
          {mode === 'set' ? '처음 로그인하셨습니다! 사용할 닉네임을 설정해주세요.' : '새 닉네임을 입력해주세요.'}
        </p>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="2~16자"
          maxLength={16}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-ray-purple"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          {mode === 'change' && (
            <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors">
              취소
            </button>
          )}
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-ray-purple text-white text-sm rounded hover:opacity-90 transition-opacity"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
