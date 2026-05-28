import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, emptyGrid } from '../../store/gameStore';
import { uploadToDB, updateMapInDB } from '../../lib/firebaseService';
import type { CellData, Difficulty, MapDocument, MapItemDTO } from '../../types/game';
import { GRID_SIZE } from '../../lib/svgArt';

const DIFFICULTIES: Difficulty[] = ['Tutor', 'Easy', 'Normal', 'Hard', 'Insane'];

export function UploadModal() {
  const {
    currentUserUid, currentUserNickname, currentLoadedMapObj,
    mapData, closeModal, showNotification,
    exitMapEditMode, patchCurrentLoadedMap, loadMapForPlay,
  } = useGameStore(useShallow(s => ({
    currentUserUid: s.currentUserUid,
    currentUserNickname: s.currentUserNickname,
    currentLoadedMapObj: s.currentLoadedMapObj,
    mapData: s.mapData,
    closeModal: s.closeModal,
    showNotification: s.showNotification,
    exitMapEditMode: s.exitMapEditMode,
    patchCurrentLoadedMap: s.patchCurrentLoadedMap,
    loadMapForPlay: s.loadMapForPlay,
  })));

  const isEdit = currentLoadedMapObj !== null;
  const [title, setTitle] = useState(isEdit ? currentLoadedMapObj!.title : '');
  const [description, setDescription] = useState(isEdit ? (currentLoadedMapObj!.description ?? '') : '');
  const [difficulty, setDifficulty] = useState<Difficulty>(isEdit ? currentLoadedMapObj!.difficulty : 'Normal');
  const [loading, setLoading] = useState(false);

  function buildMapData(): MapItemDTO[] {
    const items: MapItemDTO[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = mapData[r][c];
        if (cell) {
          items.push({ x: c, y: r, ...cell, rotation: cell.canRotate ? 0 : cell.rotation });
        }
      }
    }
    return items;
  }

  async function handleSubmit() {
    if (!title.trim()) { showNotification('제목을 입력해주세요.', '#e74c3c'); return; }
    if (!currentUserUid) { showNotification('로그인이 필요합니다.', '#e74c3c'); return; }

    setLoading(true);
    try {
      const author = currentUserNickname ?? '익명';
      const trimmedTitle = title.trim();
      const trimmedDescription = description.trim();
      const builtMapData = buildMapData();

      if (isEdit) {
        const nextVersion = (currentLoadedMapObj!.version ?? 1) + 1;
        const editPatch = {
          title: trimmedTitle,
          author,
          description: trimmedDescription,
          difficulty,
          mapData: builtMapData,
          version: nextVersion,
        };
        await updateMapInDB(currentLoadedMapObj!.id, editPatch);
        patchCurrentLoadedMap(editPatch);
        exitMapEditMode({ restore: false });
        showNotification('맵이 수정되었습니다!');
      } else {
        const newDocBody = {
          title: trimmedTitle,
          author,
          authorUid: currentUserUid,
          description: trimmedDescription,
          difficulty,
          mapData: builtMapData,
          reactionOk: 0,
          reactionGod: 0,
          diffVotes: {} as MapDocument['diffVotes'],
          createdAt: new Date().toISOString(),
          version: 1,
        };
        const newId = await uploadToDB(newDocBody);
        const shareUrl = `${window.location.origin}${window.location.pathname}?mapId=${newId}`;
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
        const newDoc: MapDocument = { id: newId, ...newDocBody };
        const grid = emptyGrid();
        for (const item of builtMapData) {
          if (item.y >= 0 && item.y < GRID_SIZE && item.x >= 0 && item.x < GRID_SIZE) {
            grid[item.y][item.x] = {
              type: item.type, rotation: item.rotation,
              canMove: item.canMove, canRotate: item.canRotate,
              isInventory: item.isInventory,
            } as CellData;
          }
        }
        loadMapForPlay(grid, newDoc);
        showNotification('맵이 업로드되었습니다! 링크가 복사됨.');
      }

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
        <h3 className="text-lg font-bold text-gray-800">
          {isEdit ? '✏️ 맵 수정하기' : '📤 맵 공유하기'}
        </h3>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700">
            제목 *
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              readOnly={isEdit}
              placeholder="맵 제목"
              maxLength={40}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-ray-purple disabled:bg-gray-50"
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            작성자
            <input
              type="text"
              value={currentUserNickname ?? ''}
              readOnly
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50"
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            난이도
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as Difficulty)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none"
            >
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            설명 (선택)
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="맵에 대한 설명을 입력하세요."
              rows={3}
              maxLength={200}
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
            className="px-4 py-2 bg-ray-purple text-white text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '처리 중...' : isEdit ? '수정' : '공유'}
          </button>
        </div>
      </div>
    </div>
  );
}
