import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, emptyGrid } from '../../store/gameStore';
import { uploadToDB, updateMapInDB } from '../../lib/firebaseService';
import type { CellData, Difficulty, MapDocument, MapItemDTO } from '../../types/game';
import { Modal, Button, Label, TextInput, TextArea, Select } from '../ui';

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
    const size = mapData.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
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
          gridSize: mapData.length,
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
          gridSize: mapData.length,
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
        const size = mapData.length;
        const grid = emptyGrid(size);
        for (const item of builtMapData) {
          if (item.y >= 0 && item.y < size && item.x >= 0 && item.x < size) {
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
    <Modal
      title={isEdit ? '✏️ 맵 수정하기' : '📤 맵 공유하기'}
      onClose={closeModal}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>취소</Button>
          <Button variant="accent" onClick={handleSubmit} disabled={loading}>
            {loading ? '처리 중...' : isEdit ? '수정' : '공유'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Label>
          제목 *
          <TextInput
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            readOnly={isEdit}
            placeholder="맵 제목"
            maxLength={40}
            className="mt-1"
          />
        </Label>

        <Label>
          작성자
          <TextInput type="text" value={currentUserNickname ?? ''} readOnly className="mt-1" />
        </Label>

        <Label>
          난이도
          <Select
            value={difficulty}
            onChange={e => setDifficulty(e.target.value as Difficulty)}
            className="mt-1"
          >
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Label>

        <Label>
          설명 (선택)
          <TextArea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="맵에 대한 설명을 입력하세요."
            rows={3}
            maxLength={200}
            className="mt-1"
          />
        </Label>
      </div>
    </Modal>
  );
}
