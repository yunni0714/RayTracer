import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { updateMapInDB, deleteMapWithSuggestions } from '../../lib/firebaseService';
import { DIFFICULTIES, formatDateTime } from '../../lib/adminMaps';
import { MiniGrid } from '../../components/library/MiniGrid';
import { Button, DifficultyPill, Label, TextInput, TextArea, Select, Modal } from '../../components/ui';
import { MapRotationEditor } from './MapRotationEditor';
import type { AdminMapsState } from './useAdminMaps';
import type { Difficulty, MapDocument } from '../../types/game';

/* 맵 한 개의 관리 행 — 요약 + 메타 편집 / 회전 편집 / 소유권 이전 / 영구 삭제.
   ⚠️ 썸네일·편집 그리드는 revealRotation — 어드민은 정답 회전을 봐야 편집할 수 있다.
      (플레이어 화면이 아니므로 은닉 규칙 대상이 아니다.) */

type Panel = 'none' | 'meta' | 'rotation';

interface MetaDraft {
  title: string;
  difficulty: Difficulty;
  author: string;
  description: string;
}

function draftOf(map: MapDocument): MetaDraft {
  return {
    title: map.title ?? '',
    difficulty: map.difficulty,
    author: map.author ?? '',
    description: map.description ?? '',
  };
}

export function AdminMapRow({ map, admin }: { map: MapDocument; admin: AdminMapsState }) {
  const { currentUserUid, showNotification, requestConfirm } = useGameStore(useShallow(s => ({
    currentUserUid: s.currentUserUid,
    showNotification: s.showNotification,
    requestConfirm: s.requestConfirm,
  })));

  const [panel, setPanel] = useState<Panel>('none');
  const [meta, setMeta] = useState<MetaDraft>(() => draftOf(map));
  const [saving, setSaving] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUid, setTransferUid] = useState('');

  function togglePanel(next: Panel) {
    setPanel(p => {
      const opening = p !== next;
      if (opening && next === 'meta') setMeta(draftOf(map));
      return opening ? next : 'none';
    });
  }

  async function saveMeta() {
    const title = meta.title.trim();
    if (!title) { showNotification('제목은 비울 수 없습니다.', '#e74c3c'); return; }
    setSaving(true);
    try {
      const patch = {
        title,
        difficulty: meta.difficulty,
        author: meta.author.trim(),
        description: meta.description.trim(),
      };
      await updateMapInDB(map.id, patch);
      admin.patchMap(map.id, patch);
      setPanel('none');
      showNotification(`[${title}] 메타데이터 저장 완료.`);
    } catch (err) {
      showNotification(`저장 실패 — ${errText(err)}`, '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  async function transferOwner() {
    const uid = transferUid.trim();
    if (!uid) { showNotification('이전할 UID 를 입력하세요.', '#e74c3c'); return; }
    setSaving(true);
    try {
      await updateMapInDB(map.id, { authorUid: uid });
      admin.patchMap(map.id, { authorUid: uid });
      setTransferOpen(false);
      showNotification('소유권 이전 완료 — 해당 사용자가 이 맵을 편집·삭제할 수 있습니다.');
    } catch (err) {
      showNotification(`이전 실패 — ${errText(err)}`, '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  async function deleteMap() {
    const ok = await requestConfirm({
      message: `[${map.title}] 맵을 영구 삭제할까요?\n하위 풀이 제안도 모두 삭제되며 되돌릴 수 없습니다.`,
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await deleteMapWithSuggestions(map.id);
      admin.removeMap(map.id);
      showNotification(`[${map.title}] 삭제 완료.`, '#e74c3c');
    } catch (err) {
      showNotification(`삭제 실패 — ${errText(err)} · 새로고침으로 상태를 확인하세요.`, '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  const gridSize = map.gridSize ?? 5;

  return (
    <div className="bg-surface border border-line rounded-tile overflow-hidden">
      {/* 요약 행 */}
      <div className="flex items-center gap-3 p-3 flex-wrap">
        <MiniGrid mapData={map.mapData} revealRotation variant="v1" size={84} gridSize={gridSize} />

        <div className="flex-1 min-w-[220px] flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-extrabold tracking-tight">{map.title || '제목 없음'}</h3>
            <code className="text-[10px] text-ink-muted">{map.id}</code>
            <DifficultyPill difficulty={map.difficulty} />
          </div>
          <p className="text-[11px] text-ink-muted">
            작성자 <strong className="text-ink">{map.author || '없음'}</strong>
            {' · '}UID <code className="text-[10px]">{map.authorUid || '없음'}</code>
          </p>
          <p className="text-[11px] text-ink-muted">
            {formatDateTime(map.createdAt)} · {gridSize}×{gridSize} · 기물 {map.mapData?.length ?? 0}
            {' · '}👍 {map.reactionOk ?? 0} · 🌟 {map.reactionGod ?? 0}
          </p>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <Button variant="secondary" className="!text-xs" onClick={() => togglePanel('meta')}>
            📝 메타 편집
          </Button>
          <Button variant="secondary" className="!text-xs" onClick={() => togglePanel('rotation')}>
            🎛 회전 편집
          </Button>
          <Button
            variant="secondary"
            className="!text-xs"
            onClick={() => { setTransferUid(currentUserUid ?? ''); setTransferOpen(true); }}
          >
            👑 소유권 이전
          </Button>
          <Button variant="danger" className="!text-xs" onClick={deleteMap} disabled={saving}>
            🗑 영구 삭제
          </Button>
        </div>
      </div>

      {/* 메타 편집 */}
      {panel === 'meta' && (
        <div className="border-t border-line p-3 flex flex-col gap-3 bg-surface-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label>
              제목
              <TextInput
                value={meta.title}
                maxLength={50}
                onChange={e => setMeta({ ...meta, title: e.target.value })}
                className="mt-1"
              />
            </Label>
            <Label>
              난이도
              <Select
                value={meta.difficulty}
                onChange={e => setMeta({ ...meta, difficulty: e.target.value as Difficulty })}
                className="mt-1"
              >
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Label>
            <Label>
              작성자명
              <TextInput
                value={meta.author}
                maxLength={30}
                onChange={e => setMeta({ ...meta, author: e.target.value })}
                className="mt-1"
              />
            </Label>
            <Label>
              설명
              <TextArea
                value={meta.description}
                rows={3}
                onChange={e => setMeta({ ...meta, description: e.target.value })}
                className="mt-1"
              />
            </Label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setPanel('none')}>취소</Button>
            <Button variant="success" onClick={saveMeta} disabled={saving}>
              {saving ? '저장 중…' : '💾 저장'}
            </Button>
          </div>
        </div>
      )}

      {/* 회전 편집 */}
      {panel === 'rotation' && (
        <div className="border-t border-line p-3 bg-surface-2">
          <MapRotationEditor map={map} admin={admin} onClose={() => setPanel('none')} />
        </div>
      )}

      {/* 소유권 이전 */}
      {transferOpen && (
        <Modal
          title="👑 소유권 이전"
          onClose={() => setTransferOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setTransferOpen(false)}>취소</Button>
              <Button variant="success" onClick={transferOwner} disabled={saving}>
                {saving ? '이전 중…' : '이전'}
              </Button>
            </>
          }
        >
          <p className="text-xs text-ink-muted">
            [{map.title}] 의 소유자를 바꿉니다. 새 소유자는 에디터에서 이 맵을 수정·삭제할 수 있습니다.
          </p>
          <Label>
            새 소유자 UID
            <TextInput
              autoFocus
              value={transferUid}
              onChange={e => setTransferUid(e.target.value)}
              className="mt-1 font-mono !text-xs"
            />
          </Label>
          <Button
            variant="ghost"
            className="!text-xs self-start"
            onClick={() => setTransferUid(currentUserUid ?? '')}
            disabled={!currentUserUid}
          >
            내 UID 넣기
          </Button>
        </Modal>
      )}
    </div>
  );
}

function errText(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    return `${code ?? err.name}: ${err.message.slice(0, 200)}`;
  }
  return '권한(firestore.rules) 또는 네트워크를 확인하세요.';
}
