import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { uploadSuggestionToDB } from '../../lib/firebaseService';
import type { MapItemDTO } from '../../types/game';
import { GRID_SIZE } from '../../lib/svgArt';

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
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
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
      showNotification('풀이 제안이 등록되었습니다!');
      closeModal();
    } catch {
      showNotification('오류가 발생했습니다.', '#e74c3c');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-96 flex flex-col gap-4">
        <h3 className="text-lg font-bold text-gray-800">💡 풀이 제안 등록</h3>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700">
            카테고리
            <select
              value={category}
              onChange={e => setCategory(e.target.value as 'NG' | 'ABCD')}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none"
            >
              <option value="NG">NG — 맵 자체 문제</option>
              <option value="ABCD">ABCD — 다른 풀이</option>
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            코멘트 (선택)
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="현재 맵 배치 기준으로 제안이 등록됩니다."
              rows={4}
              maxLength={300}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-ray-purple resize-none"
            />
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-ray-blue text-white text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '등록 중...' : '제안 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
