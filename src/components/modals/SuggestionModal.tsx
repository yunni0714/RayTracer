import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { uploadSuggestionToDB } from '../../lib/firebaseService';
import type { MapItemDTO } from '../../types/game';
import { Modal, Button, Label, TextArea, Select } from '../ui';

export function SuggestionModal() {
  const [category, setCategory] = useState<'NG' | 'ABCD'>('NG');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    currentUserUid, currentUserNickname, currentLoadedMapObj, mapData,
    closeModal, showNotification,
  } = useGameStore(useShallow(s => ({
    currentUserUid: s.currentUserUid,
    currentUserNickname: s.currentUserNickname,
    currentLoadedMapObj: s.currentLoadedMapObj,
    mapData: s.mapData,
    closeModal: s.closeModal,
    showNotification: s.showNotification,
  })));

  function buildMapData(): MapItemDTO[] {
    const items: MapItemDTO[] = [];
    const size = mapData.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = mapData[r][c];
        if (cell) items.push({ x: c, y: r, ...cell });
      }
    }
    return items;
  }

  async function handleSubmit() {
    if (!currentUserUid) { showNotification('로그인이 필요합니다.', '#e74c3c'); return; }
    if (!currentLoadedMapObj) return;

    setLoading(true);
    try {
      await uploadSuggestionToDB(currentLoadedMapObj.id, {
        category,
        comment: comment.trim(),
        suggesterUid: currentUserUid,
        suggesterNickname: currentUserNickname ?? '익명',
        createdAt: new Date().toISOString(),
        mapData: buildMapData(),
      });
      showNotification('새로운 풀이 제안이 등록되었습니다!', '#f39c12');
      closeModal();
    } catch {
      showNotification('오류가 발생했습니다.', '#e74c3c');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="💡 풀이 제안 등록"
      onClose={closeModal}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>취소</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '등록 중...' : '제안 등록'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Label>
          카테고리
          <Select
            value={category}
            onChange={e => setCategory(e.target.value as 'NG' | 'ABCD')}
            className="mt-1"
          >
            <option value="NG">NG — 맵 자체 문제</option>
            <option value="ABCD">ABCD — 다른 풀이</option>
          </Select>
        </Label>

        <Label>
          코멘트 (선택)
          <TextArea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="현재 맵 배치 기준으로 제안이 등록됩니다."
            rows={4}
            maxLength={300}
            className="mt-1"
          />
        </Label>
      </div>
    </Modal>
  );
}
