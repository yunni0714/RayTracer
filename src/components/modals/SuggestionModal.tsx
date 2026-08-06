import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { uploadSuggestionToDB, createSuggestionNotification } from '../../lib/firebaseService';
import {
  SUGGESTION_CATEGORY_LABELS,
  type MapItemDTO, type SuggestionCategory,
} from '../../types/game';
import { Modal, Button, Label, TextArea, Select } from '../ui';

export function SuggestionModal() {
  const [category, setCategory] = useState<SuggestionCategory>('NG');
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
      const nickname = currentUserNickname ?? '익명';
      await uploadSuggestionToDB(currentLoadedMapObj.id, {
        category,
        comment: comment.trim(),
        suggesterUid: currentUserUid,
        suggesterNickname: nickname,
        createdAt: new Date().toISOString(),
        mapData: buildMapData(),
      });

      // 맵 소유자 알림함에 적재 (본인 맵이면 생략).
      // 부가 기능이라 실패해도 제안 등록은 성공으로 처리한다 — firestore.rules
      // 미배포 상태에서는 여기서 권한 거부가 나는 것이 정상이다.
      const ownerUid = currentLoadedMapObj.authorUid;
      if (ownerUid && ownerUid !== currentUserUid) {
        try {
          await createSuggestionNotification(ownerUid, {
            type: 'suggestion',
            read: false,
            createdAt: new Date().toISOString(),
            fromUid: currentUserUid,
            fromNickname: nickname,
            mapId: currentLoadedMapObj.id,
            mapTitle: currentLoadedMapObj.title,
            suggestionCategory: category,
          });
        } catch { /* 알림 실패가 제안 등록을 되돌리지 않는다 */ }
      }

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
            onChange={e => setCategory(e.target.value as SuggestionCategory)}
            className="mt-1"
          >
            {(Object.keys(SUGGESTION_CATEGORY_LABELS) as SuggestionCategory[]).map(c => (
              <option key={c} value={c}>{SUGGESTION_CATEGORY_LABELS[c]}</option>
            ))}
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
