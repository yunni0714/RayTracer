import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { updateMapInDB } from '../../lib/firebaseService';
import { getSvgArt } from '../../lib/svgArt';
import { getPieceLabel } from '../../lib/pieceActions';
import {
  ROTATIONS, collectPieceTypeCounts, planBulkEdit,
  type BulkFilter, type BulkOp, type BulkRotationOp,
} from '../../lib/adminMaps';
import { Button, Modal, Pill, Select, cx } from '../../components/ui';
import type { AdminMapsState } from './useAdminMaps';
import type { MapDocument } from '../../types/game';

/* 일괄 편집 — 여러 맵의 특정 기물 타입에 같은 연산을 한 번에 건다.
   연산 2종: 🎛 회전(각도 상대/절대) · ✨ 특성 삭제(유저지급·이동·회전 끄기).
   단일 맵 정밀 편집은 MapRotationEditor, 여기는 스코프(선택/검색결과/단일 맵) × 기물 타입 단위.
   저장된 rotation = 정답 회전이므로 정규화 금지 — 연산 대상 외 필드는 건드리지 않는다.
   계산은 전부 lib/adminMaps 의 순수 함수(planBulkEdit), 여기는 선택 UI + 저장 루프만. */

export interface BulkScope {
  id: string;
  label: string;
  maps: MapDocument[];
}

const DELTAS = [-90, -45, 45, 90, 180] as const;

type OpKind = BulkOp['kind'];

interface Props {
  scopes: BulkScope[];
  admin: AdminMapsState;
  onClose: () => void;
}

export function BulkEditModal({ scopes, admin, onClose }: Props) {
  const { showNotification, requestConfirm } = useGameStore(useShallow(s => ({
    showNotification: s.showNotification,
    requestConfirm: s.requestConfirm,
  })));

  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? '');
  const [types, setTypes] = useState<string[]>([]);
  const [includeInventory, setIncludeInventory] = useState(false);
  const [rotatableOnly, setRotatableOnly] = useState(false);
  const [opKind, setOpKind] = useState<OpKind>('rotate');
  const [rotationOp, setRotationOp] = useState<BulkRotationOp>({ mode: 'delta', delta: 90 });
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  const isClear = opKind === 'clearTraits';

  const scope = scopes.find(s => s.id === scopeId) ?? scopes[0];
  const scopeMaps = useMemo(() => scope?.maps ?? [], [scope]);

  const counts = useMemo(
    () => collectPieceTypeCounts(scopeMaps, { includeInventory, rotatableOnly }),
    [scopeMaps, includeInventory, rotatableOnly],
  );

  // 스코프/필터가 바뀌면 사라진 타입은 자동으로 빠진다 (선택 상태를 되돌리지 않고 교집합만 사용)
  const activeTypes = useMemo(
    () => types.filter(t => counts.some(c => c.type === t)),
    [types, counts],
  );

  const plan = useMemo(() => {
    if (activeTypes.length === 0) return [];
    const filter: BulkFilter = { types: activeTypes, includeInventory, rotatableOnly };
    const op: BulkOp = isClear ? { kind: 'clearTraits' } : { kind: 'rotate', op: rotationOp };
    return planBulkEdit(scopeMaps, filter, op);
  }, [scopeMaps, activeTypes, includeInventory, rotatableOnly, isClear, rotationOp]);

  const totalPieces = plan.reduce((n, p) => n + p.changed, 0);

  function toggleType(type: string) {
    setTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  }

  // 특성 삭제의 주 대상은 🎒 유저 지급 기물이다 — 기본값(제외)이면 정작 지울 기물이
  // 집계·계획에서 통째로 빠지므로 전환 시 켜 준다 (체크박스로 다시 끌 수 있다).
  function selectOpKind(kind: OpKind) {
    setOpKind(kind);
    if (kind === 'clearTraits') setIncludeInventory(true);
  }

  async function apply() {
    if (plan.length === 0) return;
    const ok = await requestConfirm({
      message: isClear
        ? `맵 ${plan.length}개의 기물 ${totalPieces}개에서 특성을 지울까요?\n` +
          '🎒 유저 지급 · 🔄 회전 가능 · 🖐 이동 가능 이 모두 꺼지고, 유저 지급 기물은 ' +
          '고정 기물이 되어 저장된 회전(정답 회전)이 플레이 화면에 드러납니다. ' +
          '되돌리려면 맵마다 다시 지정해야 합니다.'
        : `맵 ${plan.length}개의 기물 ${totalPieces}개 회전을 저장할까요?\n` +
          '저장된 회전은 각 맵의 정답 회전입니다 — 되돌리려면 반대로 다시 적용해야 합니다.',
      danger: true,
    });
    if (!ok) return;

    setSaving(true);
    setFailures([]);
    setProgress({ done: 0, total: plan.length });
    const failed: string[] = [];
    let saved = 0;

    for (const entry of plan) {
      try {
        await updateMapInDB(entry.id, { mapData: entry.items });
        admin.patchMap(entry.id, { mapData: entry.items });
        saved += 1;
      } catch (err) {
        const code = err instanceof Error ? ((err as { code?: string }).code ?? err.message) : String(err);
        failed.push(`${entry.title || entry.id} — ${code}`);
      }
      setProgress(p => (p ? { ...p, done: p.done + 1 } : p));
    }

    setSaving(false);
    setProgress(null);
    setFailures(failed);

    if (failed.length === 0) {
      showNotification(
        isClear
          ? `맵 ${saved}개 · 기물 ${totalPieces}개 특성 삭제 완료.`
          : `맵 ${saved}개 · 기물 ${totalPieces}개 회전 저장 완료.`,
      );
      onClose();
    } else {
      showNotification(`${saved}개 저장 · ${failed.length}개 실패 — 아래 목록을 확인하세요.`, '#e74c3c');
    }
  }

  return (
    <Modal
      title="🎛 일괄 편집"
      width="lg"
      dismissable={!saving}
      onClose={onClose}
      footer={
        <>
          {progress && (
            <span className="mr-auto text-[11px] text-ink-muted">
              저장 중… {progress.done}/{progress.total}
            </span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>닫기</Button>
          <Button variant="success" onClick={apply} disabled={saving || plan.length === 0}>
            {saving ? '저장 중…' : `💾 ${plan.length}개 맵 저장`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 max-h-[68vh] overflow-y-auto pr-0.5">
        {/* 1. 대상 맵 */}
        <section className="flex flex-col gap-1.5">
          <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
            1. 대상 맵
          </h5>
          <div className="flex gap-1.5 flex-wrap">
            {scopes.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScopeId(s.id)}
                className={cx(
                  'px-2 py-1 rounded-tile border text-xs transition-colors',
                  s.id === scope?.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2',
                )}
              >
                {s.label} <span className="text-ink-muted">({s.maps.length})</span>
              </button>
            ))}
          </div>
        </section>

        {/* 2. 대상 기물 */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
              2. 대상 기물
            </h5>
            <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">{activeTypes.length}종 선택</Pill>
            <Button
              variant="ghost"
              className="!text-[11px] !px-1.5 !py-0.5 ml-auto"
              onClick={() => setTypes(counts.map(c => c.type))}
            >전체 선택</Button>
            <Button
              variant="ghost"
              className="!text-[11px] !px-1.5 !py-0.5"
              onClick={() => setTypes([])}
            >해제</Button>
          </div>

          <div className="flex gap-3 flex-wrap text-[11px] text-ink-muted">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={includeInventory}
                onChange={e => setIncludeInventory(e.target.checked)}
              />
              🎒 인벤토리(유저 지급) 기물 포함
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={rotatableOnly}
                onChange={e => setRotatableOnly(e.target.checked)}
              />
              🔄 회전 가능 기물만
            </label>
          </div>

          {counts.length === 0 ? (
            <p className="text-[11px] text-ink-muted py-2">대상 맵에 조건을 만족하는 기물이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-1">
              {counts.map(c => {
                const on = activeTypes.includes(c.type);
                return (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => toggleType(c.type)}
                    className={cx(
                      'flex items-center gap-1.5 px-1.5 py-1 rounded-tile border text-left transition-colors',
                      on ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2',
                    )}
                    title={c.type}
                  >
                    <span
                      className="w-5 h-5 shrink-0"
                      dangerouslySetInnerHTML={{ __html: getSvgArt(c.type) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold">
                      {getPieceLabel(c.type)}
                    </span>
                    <span className="text-[10px] text-ink-muted shrink-0">
                      {c.pieces}개 · 맵 {c.maps}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. 작업 */}
        <section className="flex flex-col gap-1.5">
          <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
            3. 작업
          </h5>
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => selectOpKind('rotate')}
              className={cx(
                'px-2 py-1 rounded-tile border text-xs transition-colors',
                !isClear ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2',
              )}
            >
              ↻ 회전
            </button>
            <button
              type="button"
              onClick={() => selectOpKind('clearTraits')}
              className={cx(
                'px-2 py-1 rounded-tile border text-xs transition-colors',
                isClear ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2',
              )}
            >
              ✨ 특성 삭제
            </button>
          </div>

          {isClear ? (
            <div className="flex flex-col gap-1 border border-line rounded-tile p-2 bg-surface">
              <p className="text-[11px] text-ink-muted">
                선택한 기물의 <strong className="text-ink">🎒 유저 지급 · 🔄 회전 가능 · 🖐 이동 가능</strong>
                {' '}을 모두 끕니다. 기물 자체는 지우지 않고 좌표·타입·회전도 그대로입니다.
              </p>
              <p className="text-[11px] text-warning">
                ⚠️ 유저 지급 기물이 고정 기물이 되면 저장된 회전(정답 회전)이 플레이 화면에 그대로 드러납니다.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="bulk-rot-mode"
                    checked={rotationOp.mode === 'delta'}
                    onChange={() => setRotationOp({ mode: 'delta', delta: 90 })}
                  />
                  상대 회전
                </label>
                <div className="flex gap-1 flex-wrap">
                  {DELTAS.map(d => (
                    <Button
                      key={d}
                      variant={rotationOp.mode === 'delta' && rotationOp.delta === d ? 'accent' : 'secondary'}
                      className="!text-xs"
                      onClick={() => setRotationOp({ mode: 'delta', delta: d })}
                    >
                      {d < 0 ? '↺' : '↻'} {d > 0 ? `+${d}` : d}°
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="bulk-rot-mode"
                    checked={rotationOp.mode === 'set'}
                    onChange={() => setRotationOp({ mode: 'set', rotation: 0 })}
                  />
                  절대 지정
                </label>
                <Select
                  value={rotationOp.mode === 'set' ? rotationOp.rotation : 0}
                  onChange={e => setRotationOp({ mode: 'set', rotation: Number(e.target.value) })}
                  className="!w-auto"
                  disabled={rotationOp.mode !== 'set'}
                >
                  {ROTATIONS.map(r => <option key={r} value={r}>{r}°</option>)}
                </Select>
              </div>
            </>
          )}
        </section>

        {/* 4. 적용 결과 미리보기 */}
        <section className="flex flex-col gap-1.5 border-t border-line pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
              4. 변경 예정
            </h5>
            <span className="text-[11px] text-ink-muted">
              맵 <strong className="text-ink">{plan.length}</strong>개 ·
              {' '}기물 <strong className="text-ink">{totalPieces}</strong>개
              {isClear ? ' 특성 삭제' : ' 회전'}
              {' '}(대상 {scopeMaps.length}개 중)
            </span>
          </div>

          {activeTypes.length === 0 ? (
            <p className="text-[11px] text-ink-muted">대상 기물을 하나 이상 선택하세요.</p>
          ) : plan.length === 0 ? (
            <p className="text-[11px] text-ink-muted">
              {isClear
                ? '바뀌는 기물이 없습니다 (이미 특성이 없거나 대상이 없습니다).'
                : '바뀌는 기물이 없습니다 (이미 지정한 각도이거나 대상이 없습니다).'}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
              {plan.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-[11px]">
                  <span className="flex-1 min-w-0 truncate">{p.title || '제목 없음'}</span>
                  <code className="text-[9px] text-ink-muted shrink-0">{p.id.slice(0, 8)}…</code>
                  <span className="text-ink-muted shrink-0">기물 {p.changed}개</span>
                </div>
              ))}
            </div>
          )}

          {failures.length > 0 && (
            <div className="flex flex-col gap-0.5 border border-danger rounded-tile p-2">
              <strong className="text-[11px] text-danger">저장 실패 {failures.length}건</strong>
              {failures.map(f => (
                <span key={f} className="text-[10px] text-ink-muted break-words">{f}</span>
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
