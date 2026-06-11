import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { isAdminUid } from '../lib/admin';
import { getSvgArt } from '../lib/svgArt';
import { getPieceLabel } from '../lib/pieceActions';
import {
  getBehaviorDef, calculateReflection,
  type PieceBehaviorDef, type FaceSpec, type FaceEffect, type FaceEffectKind,
} from '../lib/laserEngine';
import {
  PALETTE_ORDER, getPieceFolder, getPieceDefaults, getAllConfigEntries, applyPieceConfig,
  getFolders, getCustomTypes, DEFAULT_FOLDERS, isPieceHidden, isValidCustomTypeId,
  type PieceConfigEntry, type PieceFolder,
} from '../lib/pieceConfig';
import { savePieceConfigEntry, deletePieceConfigEntry, savePieceConfigPatch } from '../lib/firebaseService';
import { Notification } from '../components/layout/Notification';
import { Button, IconButton, Label, TextInput, TextArea, Select, Pill, ConfirmHost, cx } from '../components/ui';

/* ════════════════════════════════════════════════════════
   어드민 — 면별(per-face) 기물 behavior 에디터 (docs/ADMIN_PANEL.md)
   저장 = Firestore config/pieces 머지 → 즉시 로컬 오버레이 재적용.
   쓰기 권한 강제는 firestore.rules (이 페이지 게이트는 UI 숨김일 뿐).
   ════════════════════════════════════════════════════════ */

// UI 효과 4종 (엔진 kind 와의 매핑은 아래 toUiKind / setUiKind).
//   통과=pass · 정지=흡수(satisfy)/차단(없음) · 반사=reflect(되돌림 흡수) · 분기=split
type UiKind = 'pass' | 'stop' | 'reflect' | 'split';
const UI_KINDS: UiKind[] = ['pass', 'stop', 'reflect', 'split'];
const UI_KIND_LABEL: Record<UiKind, string> = { pass: '통과', stop: '정지', reflect: '반사', split: '분기' };

function toUiKind(k: FaceEffectKind): UiKind {
  if (k === 'absorb' || k === 'block') return 'stop';
  if (k === 'reverse') return 'reflect'; // 되돌림 = 반대 방향 반사
  return k as UiKind;
}

// 8방향 진행방향 → 화살표 글리프 (0=오른쪽, 90=아래 / dy+1 규약)
const DIR_ARROW: Record<number, string> = {
  0: '→', 45: '↘', 90: '↓', 135: '↙', 180: '←', 225: '↖', 270: '↑', 315: '↗',
};
// 출력 방향 화살표 3×3 배치 (중앙 비움). 칸 = "빔이 나가는 진행방향".
const ARROW_GRID: (number | null)[][] = [
  [225, 270, 315],
  [180, null, 0],
  [135, 90, 45],
];
// 입사 rel 빔이 out 방향으로 나가게 하는 면각: out = 2*sa - rel → sa = (rel+out)/2
function outToSurface(rel: number, out: number): number {
  return (((rel + out) / 2) % 360 + 360) % 360;
}

const RELS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const DEFAULT_FOLDER_IDS = new Set(DEFAULT_FOLDERS.map(f => f.id));
const BUILTIN_SET = new Set<string>(PALETTE_ORDER);

// 새 커스텀 기물의 시작 SVG (어드민이 SVG 편집창에서 교체)
const NEW_PIECE_SVG =
  `<svg viewBox="0 0 100 100"><rect x="22" y="22" width="56" height="56" fill="none" stroke="currentColor" stroke-width="8"/></svg>`;

// 면 그리드 배치: 각 칸 = "그 방향에서 들어오는 빔"(rel = 진행방향-회전).
// rel 0 = 오른쪽으로 진행 = 왼쪽 면으로 입사 → 중앙 기준 왼쪽 칸.
const FACE_GRID: (number | null)[][] = [
  [45, 90, 135],
  [0, null, 180],
  [315, 270, 225],
];

type DualSpec = { open: FaceEffect; closed: FaceEffect };
const isDual = (s: FaceSpec): s is DualSpec => 'open' in s && 'closed' in s;

interface Draft {
  def: PieceBehaviorDef;
  svg: string;
  label: string;
  folderId: string;
  defaults: { canRotate: boolean; canMove: boolean; isInventory: boolean };
}

function makeDraft(type: string): Draft {
  const def = getBehaviorDef(type)!;
  return {
    def: JSON.parse(JSON.stringify(def)) as PieceBehaviorDef,
    svg: getSvgArt(type),
    label: getPieceLabel(type),
    folderId: getPieceFolder(type),
    defaults: getPieceDefaults(type),
  };
}

function defHasSatisfy(def: PieceBehaviorDef): boolean {
  const specs = [...Object.values(def.faces), def.fallback].filter(Boolean) as FaceSpec[];
  return specs.some(s => isDual(s) ? !!s.open.satisfy || !!s.closed.satisfy : !!s.satisfy);
}

// 조건부 트리거: groups(number[][]) ↔ 면→그룹번호(1-base) 매핑.
// 같은 그룹 = OR, 다른 그룹 = AND. (예: cross_gate [[0,180],[90,270]])
function groupsToFaceMap(groups: number[][]): Record<number, number> {
  const m: Record<number, number> = {};
  groups.forEach((g, gi) => g.forEach(f => { m[f] = gi + 1; }));
  return m;
}

function faceMapToGroups(map: Record<number, number>): number[][] {
  const byGroup = new Map<number, number[]>();
  for (const [faceStr, g] of Object.entries(map)) {
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(Number(faceStr));
  }
  return [...byGroup.keys()].sort((a, b) => a - b)
    .map(g => byGroup.get(g)!.sort((a, b) => a - b));
}

/* ── 단일 효과 편집 폼 ──────────────────────────────────── */

function ReflectArrows({
  rel, surfaceAngle, onPick,
}: { rel: number; surfaceAngle: number; onPick: (sa: number) => void }) {
  const current = calculateReflection(rel, surfaceAngle); // 현재 출력(나가는) 방향
  return (
    <div className="grid grid-cols-3 gap-0.5 w-fit" title="빔이 나갈 방향 선택">
      {ARROW_GRID.flat().map((d, i) =>
        d === null ? (
          <div key={i} className="w-6 h-6 flex items-center justify-center text-[10px] text-ink-muted">·</div>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => onPick(outToSurface(rel, d))}
            className={cx(
              'w-6 h-6 flex items-center justify-center rounded text-sm border',
              current === d ? 'bg-primary text-primary-ink border-primary' : 'border-line hover:bg-surface-2',
            )}
            title={`→ ${d}° 로 반사`}
          >
            {DIR_ARROW[d]}
          </button>
        ),
      )}
    </div>
  );
}

function EffectEditor({
  value, onChange, allowInherit, inheritLabel = '(fallback)', rel,
}: {
  value: FaceEffect | undefined;
  onChange: (fx: FaceEffect | undefined) => void;
  allowInherit?: boolean;
  inheritLabel?: string;
  rel?: number; // 이 면의 입사 방향 (있으면 반사 각도를 8방향 화살표로 선택)
}) {
  const ui: UiKind | '' = value ? toUiKind(value.kind) : '';
  const isRefl = !!value && (value.kind === 'reflect' || value.kind === 'split' || value.kind === 'reverse');
  // 되돌림은 표시상 반사로 정규화 (반대 방향 출력 = 반대 화살표)
  const surfaceAngle = value?.kind === 'reverse'
    ? (rel != null ? outToSurface(rel, (rel + 180) % 360) : 0)
    : (value?.surfaceAngle ?? 0);

  function setUi(u: UiKind) {
    const satisfy = value?.satisfy;
    if (u === 'pass') onChange({ kind: 'pass', ...(satisfy && { satisfy: true }) });
    else if (u === 'stop') onChange({ kind: satisfy ? 'absorb' : 'block', ...(satisfy && { satisfy: true }) });
    else onChange({ kind: u, surfaceAngle, ...(satisfy && { satisfy: true }) }); // reflect / split
  }
  function setSatisfy(checked: boolean) {
    if (!value) return;
    // 정지(흡수/차단)는 충족 여부로 흡수↔차단이 갈린다.
    const kind: FaceEffectKind = (value.kind === 'absorb' || value.kind === 'block')
      ? (checked ? 'absorb' : 'block')
      : value.kind;
    onChange({ ...value, kind, satisfy: checked || undefined });
  }
  function setSurface(sa: number) {
    if (!value) return;
    const kind: FaceEffectKind = value.kind === 'reverse' ? 'reflect' : value.kind; // 되돌림 → 반사 확정
    onChange({ ...value, kind, surfaceAngle: sa });
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={ui}
        onChange={e => {
          const v = e.target.value as UiKind | '';
          if (v === '') { onChange(undefined); return; }
          setUi(v);
        }}
        className="!text-xs !py-1 !px-1.5"
      >
        {allowInherit && <option value="">{inheritLabel}</option>}
        {UI_KINDS.map(u => <option key={u} value={u}>{UI_KIND_LABEL[u]}</option>)}
      </Select>
      {isRefl && (
        rel != null
          ? <ReflectArrows rel={rel} surfaceAngle={surfaceAngle} onPick={setSurface} />
          : <TextInput
              type="number"
              step={22.5}
              value={surfaceAngle}
              onChange={e => setSurface(Number(e.target.value))}
              className="!text-xs !py-1 !px-1.5"
              title="면각 (기물 기준, rotation 이 더해짐)"
            />
      )}
      {value && (
        <label className="flex items-center gap-1 text-[11px] text-ink-muted">
          <input type="checkbox" checked={!!value.satisfy} onChange={e => setSatisfy(e.target.checked)} />
          🎯 충족
        </label>
      )}
    </div>
  );
}

/* ── FaceSpec(단일 or open/closed) 편집 ─────────────────── */

function FaceSpecEditor({
  spec, onChange, conditional, allowInherit, rel,
}: {
  spec: FaceSpec | undefined;
  onChange: (s: FaceSpec | undefined) => void;
  conditional: boolean; // 조건부 기물이면 open/closed 분기 허용
  allowInherit?: boolean;
  rel?: number; // 이 면의 입사 방향 (반사 화살표용)
}) {
  const dual = spec !== undefined && isDual(spec);
  return (
    <div className="flex flex-col gap-1">
      {conditional && (
        <label className="flex items-center gap-1 text-[11px] text-ink-muted">
          <input
            type="checkbox"
            checked={dual}
            onChange={e => {
              if (e.target.checked) {
                const base: FaceEffect = (spec && !isDual(spec)) ? spec : { kind: 'pass' };
                onChange({ open: base, closed: { kind: 'block' } });
              } else {
                onChange(dual ? (spec as DualSpec).open : spec);
              }
            }}
          />
          열림/닫힘 분기
        </label>
      )}
      {dual ? (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-ink-muted">열림</span>
          <EffectEditor rel={rel} value={(spec as DualSpec).open} onChange={fx => fx && onChange({ ...(spec as DualSpec), open: fx })} />
          <span className="text-[10px] text-ink-muted">닫힘</span>
          <EffectEditor rel={rel} value={(spec as DualSpec).closed} onChange={fx => fx && onChange({ ...(spec as DualSpec), closed: fx })} />
        </div>
      ) : (
        <EffectEditor
          rel={rel}
          value={spec as FaceEffect | undefined}
          onChange={fx => onChange(fx)}
          allowInherit={allowInherit}
        />
      )}
    </div>
  );
}

/* ── 메인 페이지 ────────────────────────────────────────── */

export function AdminPage() {
  const { currentUserUid, showNotification, requestConfirm, bumpPieceConfigRev } =
    useGameStore(useShallow(s => ({
      currentUserUid: s.currentUserUid,
      showNotification: s.showNotification,
      requestConfirm: s.requestConfirm,
      bumpPieceConfigRev: s.bumpPieceConfigRev,
    })));
  useGameStore(s => s.pieceConfigRev);

  const [selectedType, setSelectedType] = useState<string>(PALETTE_ORDER[0]);
  const [draft, setDraft] = useState<Draft>(() => makeDraft(PALETTE_ORDER[0]));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);
  const [dropFolder, setDropFolder] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ id: string; name: string; folderId: string } | null>(null);

  if (!isAdminUid(currentUserUid)) {
    return <Navigate to="/" replace />;
  }

  function patchDraft(patch: Partial<Draft>) {
    setDraft(d => ({ ...d, ...patch }));
    setDirty(true);
  }

  function patchDef(patch: Partial<PieceBehaviorDef>) {
    setDraft(d => ({ ...d, def: { ...d.def, ...patch } }));
    setDirty(true);
  }

  async function selectPiece(type: string) {
    if (dirty && !(await requestConfirm({ message: '저장하지 않은 변경이 있습니다. 버리고 이동할까요?', danger: true }))) return;
    setSelectedType(type);
    setDraft(makeDraft(type));
    setDirty(false);
  }

  // 로컬 오버레이 즉시 재적용 (Firestore 쓰기 성공 후 호출)
  function applyLocal(folders: PieceFolder[], entries: Partial<Record<string, PieceConfigEntry>>) {
    applyPieceConfig({ version: 2, folders, pieces: entries });
    bumpPieceConfigRev();
  }

  // 저장: Firestore 머지 + 로컬 오버레이 즉시 재적용
  async function handleSave() {
    setSaving(true);
    try {
      const entry: PieceConfigEntry = {
        behavior: draft.def,
        svg: draft.svg,
        labelKo: draft.label,
        folderId: draft.folderId,
        defaults: draft.defaults,
      };
      await savePieceConfigEntry(selectedType, entry as unknown as Record<string, unknown>);
      applyLocal(getFolders(), { ...getAllConfigEntries(), [selectedType]: entry });
      setDirty(false);
      showNotification(`[${draft.label}] 저장 완료 — 전 플레이어에 반영됩니다.`);
    } catch {
      showNotification('저장 실패 — 권한(firestore.rules) 또는 네트워크를 확인하세요.', '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  // 기본값 리셋: config 엔트리 삭제 + 로컬 재적용
  async function handleReset() {
    if (!(await requestConfirm({ message: `[${getPieceLabel(selectedType)}] 의 오버라이드를 삭제하고 코드 기본값으로 되돌릴까요?`, danger: true }))) return;
    setSaving(true);
    try {
      await deletePieceConfigEntry(selectedType);
      const rest = getAllConfigEntries();
      delete rest[selectedType];
      applyLocal(getFolders(), rest);
      setDraft(makeDraft(selectedType));
      setDirty(false);
      showNotification('기본값으로 복원되었습니다.');
    } catch {
      showNotification('복원 실패 — 권한 또는 네트워크를 확인하세요.', '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  /* ── 폴더 CRUD + 드래그 할당 (즉시 저장) ───────────────── */

  async function persistFolders(
    next: PieceFolder[],
    reassign?: Record<string, string>, // type → folderId
  ) {
    try {
      const piecePatch: Record<string, { folderId: string }> = {};
      const entries = getAllConfigEntries();
      for (const [type, folderId] of Object.entries(reassign ?? {})) {
        piecePatch[type] = { folderId };
        entries[type] = { ...(entries[type] ?? {}), folderId };
      }
      await savePieceConfigPatch(
        reassign ? { folders: next, pieces: piecePatch } : { folders: next },
      );
      applyLocal(next, entries);
    } catch {
      showNotification('폴더 저장 실패 — 권한 또는 네트워크를 확인하세요.', '#e74c3c');
    }
  }

  async function addFolder() {
    const folders = getFolders();
    const id = `folder_${Date.now().toString(36)}`;
    const order = Math.max(...folders.map(f => f.order)) + 1;
    await persistFolders([...folders, { id, name: '새 폴더', order }]);
    setEditingFolder({ id, name: '새 폴더' });
  }

  async function commitRename() {
    if (!editingFolder) return;
    const name = editingFolder.name.trim();
    setEditingFolder(null);
    if (!name) return;
    const folders = getFolders();
    if (folders.find(f => f.id === editingFolder.id)?.name === name) return;
    await persistFolders(folders.map(f => f.id === editingFolder.id ? { ...f, name } : f));
  }

  async function moveFolder(id: string, delta: -1 | 1) {
    const sorted = getFolders();
    const i = sorted.findIndex(f => f.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    await persistFolders(sorted.map((f, idx) => ({ ...f, order: idx })));
  }

  async function removeFolder(id: string) {
    if (DEFAULT_FOLDER_IDS.has(id)) return; // 기본 3폴더는 삭제 불가
    const folders = getFolders();
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const allTypes = [...PALETTE_ORDER, ...getCustomTypes()];
    const moved = allTypes.filter(t => getPieceFolder(t) === id);
    const next = folders.filter(f => f.id !== id);
    const firstId = next.sort((a, b) => a.order - b.order)[0].id;
    if (!(await requestConfirm({
      message: `[${folder.name}] 폴더를 삭제할까요? 폴더의 기물 ${moved.length}개는 [${next[0].name}] 로 이동합니다.`,
      danger: true,
    }))) return;
    await persistFolders(next, Object.fromEntries(moved.map(t => [t, firstId])));
  }

  async function assignPiece(type: string, folderId: string) {
    if (getPieceFolder(type) === folderId) return;
    try {
      await savePieceConfigPatch({ pieces: { [type]: { folderId } } });
      const entries = getAllConfigEntries();
      entries[type] = { ...(entries[type] ?? {}), folderId };
      applyLocal(getFolders(), entries);
      if (type === selectedType) setDraft(d => ({ ...d, folderId }));
    } catch {
      showNotification('이동 실패 — 권한 또는 네트워크를 확인하세요.', '#e74c3c');
    }
  }

  /* ── 기물 생성 / 삭제(빌트인 숨김 · 커스텀 제거) ───────── */

  async function createPiece() {
    if (!creating) return;
    const id = creating.id.trim();
    if (!isValidCustomTypeId(id)) {
      showNotification('잘못된 id — 소문자/숫자/_ 만, 32자 이하, 빌트인과 중복 불가.', '#e74c3c');
      return;
    }
    if (getCustomTypes().includes(id)) {
      showNotification('이미 존재하는 기물 id 입니다.', '#e74c3c');
      return;
    }
    setSaving(true);
    try {
      const entry: PieceConfigEntry = {
        svg: NEW_PIECE_SVG,
        labelKo: creating.name.trim() || id,
        folderId: creating.folderId,
        behavior: { faces: {}, fallback: { kind: 'pass' }, rotationStep: 90 },
        defaults: { canRotate: false, canMove: false, isInventory: false },
      };
      await savePieceConfigEntry(id, entry as unknown as Record<string, unknown>);
      applyLocal(getFolders(), { ...getAllConfigEntries(), [id]: entry });
      setCreating(null);
      setSelectedType(id);
      setDraft(makeDraft(id));
      setDirty(false);
      showNotification(`[${entry.labelKo}] 생성 완료 — 면 그리드와 SVG 를 채워주세요.`);
    } catch {
      showNotification('생성 실패 — 권한(firestore.rules) 또는 네트워크를 확인하세요.', '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  // 삭제(통합): 빌트인 = hidden 토글(코드 정의는 못 지움), 커스텀 = config 엔트리 완전 제거
  async function handleDelete() {
    const label = getPieceLabel(selectedType);
    const isBuiltin = BUILTIN_SET.has(selectedType);
    const message = isBuiltin
      ? `[${label}] 을 팔레트에서 숨길까요? 맵에 이미 놓인 기물은 그대로 동작하며, 복구 버튼으로 되돌릴 수 있습니다.`
      : `[${label}] 커스텀 기물을 완전히 삭제할까요? 이 기물을 쓰는 맵은 해당 칸이 비활성(통과)으로 보일 수 있습니다.`;
    if (!(await requestConfirm({ message, danger: true }))) return;
    setSaving(true);
    try {
      if (isBuiltin) {
        await savePieceConfigPatch({ pieces: { [selectedType]: { hidden: true } } });
        const entries = getAllConfigEntries();
        entries[selectedType] = { ...(entries[selectedType] ?? {}), hidden: true };
        applyLocal(getFolders(), entries);
        showNotification(`[${label}] 숨김 — 팔레트에서 보이지 않습니다.`);
      } else {
        await deletePieceConfigEntry(selectedType);
        const rest = getAllConfigEntries();
        delete rest[selectedType];
        applyLocal(getFolders(), rest);
        setSelectedType(PALETTE_ORDER[0]);
        setDraft(makeDraft(PALETTE_ORDER[0]));
        setDirty(false);
        showNotification(`[${label}] 삭제 완료.`);
      }
    } catch {
      showNotification('삭제 실패 — 권한 또는 네트워크를 확인하세요.', '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore() {
    setSaving(true);
    try {
      await savePieceConfigPatch({ pieces: { [selectedType]: { hidden: false } } });
      const entries = getAllConfigEntries();
      entries[selectedType] = { ...(entries[selectedType] ?? {}), hidden: false };
      applyLocal(getFolders(), entries);
      showNotification(`[${getPieceLabel(selectedType)}] 복구 — 팔레트에 다시 표시됩니다.`);
    } catch {
      showNotification('복구 실패 — 권한 또는 네트워크를 확인하세요.', '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  const def = draft.def;
  const hasConditional = !!def.conditional;
  // 조건부 트리거: 면→그룹번호 매핑 (면 그리드 체크박스 ↔ conditional.groups)
  const faceGroup = def.conditional ? groupsToFaceMap(def.conditional.groups) : {};
  function setTrigger(rel: number, on: boolean) {
    if (!def.conditional) return;
    const map = { ...faceGroup };
    if (on) map[rel] = map[rel] ?? 1; else delete map[rel];
    patchDef({ conditional: { ...def.conditional, groups: faceMapToGroups(map) } });
  }
  function setTriggerGroup(rel: number, g: number) {
    if (!def.conditional) return;
    patchDef({ conditional: { ...def.conditional, groups: faceMapToGroups({ ...faceGroup, [rel]: Math.max(1, g) }) } });
  }

  return (
    <div className="flex flex-col h-screen bg-canvas text-ink">
      {/* 상단바 */}
      <header className="flex items-center gap-3 px-4 py-2 bg-surface border-b border-line shadow-card">
        <h1 className="text-lg font-extrabold tracking-tight mr-auto">🛠 기물 어드민</h1>
        {dirty && <Pill tone="danger">저장 안 됨</Pill>}
        {!BUILTIN_SET.has(selectedType) && <Pill tone="info">커스텀</Pill>}
        {isPieceHidden(selectedType) && <Pill tone="neutral">숨김</Pill>}
        {isPieceHidden(selectedType)
          ? <Button variant="secondary" onClick={handleRestore} disabled={saving}>👁 복구</Button>
          : <Button variant="danger" onClick={handleDelete} disabled={saving}>
              {BUILTIN_SET.has(selectedType) ? '🙈 숨기기' : '🗑 삭제'}
            </Button>}
        {BUILTIN_SET.has(selectedType) && (
          <Button variant="secondary" onClick={handleReset} disabled={saving}>↩ 기본값으로</Button>
        )}
        <Button variant="success" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? '저장 중…' : '💾 저장 (전 플레이어 반영)'}
        </Button>
        <Link to="/">
          <Button variant="secondary">← 에디터로</Button>
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 좌: 기물 목록 — 폴더별 섹션 (접이식 + 드래그 할당) */}
        <aside className="w-60 shrink-0 bg-surface border-r border-line p-2 overflow-y-auto flex flex-col gap-1">
          {getFolders().map(folder => {
            const pieces = [...PALETTE_ORDER, ...getCustomTypes()].filter(t => getPieceFolder(t) === folder.id);
            const isCollapsed = collapsed.has(folder.id);
            const isDefault = DEFAULT_FOLDER_IDS.has(folder.id);
            return (
              <div
                key={folder.id}
                onDragOver={e => { e.preventDefault(); setDropFolder(folder.id); }}
                onDragLeave={() => setDropFolder(f => f === folder.id ? null : f)}
                onDrop={e => {
                  e.preventDefault();
                  setDropFolder(null);
                  const type = e.dataTransfer.getData('text/plain');
                  if (type) assignPiece(type, folder.id);
                }}
                className={cx(
                  'rounded-tile border transition-colors',
                  dropFolder === folder.id ? 'border-accent bg-accent-soft' : 'border-transparent',
                )}
              >
                <div className="flex items-center gap-0.5 px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => setCollapsed(s => {
                      const next = new Set(s);
                      if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id);
                      return next;
                    })}
                    className="w-5 h-5 shrink-0 text-[10px] text-ink-muted hover:text-ink"
                    title={isCollapsed ? '펼치기' : '접기'}
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </button>
                  {editingFolder?.id === folder.id ? (
                    <TextInput
                      autoFocus
                      value={editingFolder.name}
                      onChange={e => setEditingFolder({ id: folder.id, name: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditingFolder(null);
                      }}
                      className="flex-1 min-w-0 !text-xs !py-0.5 !px-1"
                    />
                  ) : (
                    <button
                      type="button"
                      onDoubleClick={() => setEditingFolder({ id: folder.id, name: folder.name })}
                      className="flex-1 min-w-0 truncate text-left text-[11px] font-extrabold uppercase tracking-wider text-ink-muted"
                      title="더블클릭으로 이름 변경"
                    >
                      {folder.name} <span className="font-normal">({pieces.length})</span>
                    </button>
                  )}
                  <IconButton
                    aria-label="이름 변경"
                    className="!text-[10px] !px-1 !py-1"
                    onClick={() => setEditingFolder({ id: folder.id, name: folder.name })}
                  >✏️</IconButton>
                  <IconButton aria-label="위로" className="!text-[10px] !px-1 !py-1" onClick={() => moveFolder(folder.id, -1)}>↑</IconButton>
                  <IconButton aria-label="아래로" className="!text-[10px] !px-1 !py-1" onClick={() => moveFolder(folder.id, 1)}>↓</IconButton>
                  {!isDefault && (
                    <IconButton aria-label="폴더 삭제" className="!text-[10px] !px-1 !py-1" onClick={() => removeFolder(folder.id)}>🗑</IconButton>
                  )}
                </div>
                {!isCollapsed && pieces.map(type => (
                  <button
                    key={type}
                    type="button"
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', type);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => selectPiece(type)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-tile text-left text-xs transition-colors cursor-grab ${
                      type === selectedType ? 'bg-accent-soft border border-accent' : 'hover:bg-surface-2 border border-transparent'
                    }`}
                  >
                    <span className="w-7 h-7 shrink-0" dangerouslySetInnerHTML={{ __html: getSvgArt(type) }} />
                    <span className={cx('min-w-0 flex-1 truncate font-medium', isPieceHidden(type) && 'line-through opacity-50')}>
                      {getPieceLabel(type)}
                    </span>
                    {!BUILTIN_SET.has(type) && <Pill tone="info" className="!text-[9px] !px-1 !py-0">커스텀</Pill>}
                    {isPieceHidden(type) && <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">숨김</Pill>}
                    {getPieceConfigBadge(type)}
                  </button>
                ))}
                {!isCollapsed && pieces.length === 0 && (
                  <p className="px-2 py-1 text-[10px] text-ink-muted">비어 있음 — 기물을 끌어다 놓으세요</p>
                )}
              </div>
            );
          })}
          <Button variant="secondary" className="!text-xs mt-1" onClick={addFolder}>➕ 폴더 추가</Button>

          {/* 새 기물 생성 */}
          {creating ? (
            <div className="border border-line rounded-tile p-2 flex flex-col gap-1.5 mt-1">
              <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">새 기물</h5>
              <TextInput
                autoFocus
                placeholder="id (소문자/숫자/_)"
                value={creating.id}
                onChange={e => setCreating({ ...creating, id: e.target.value })}
                className="!text-xs !py-1 !px-1.5 font-mono"
              />
              <TextInput
                placeholder="이름 (라벨)"
                value={creating.name}
                onChange={e => setCreating({ ...creating, name: e.target.value })}
                className="!text-xs !py-1 !px-1.5"
              />
              <Select
                value={creating.folderId}
                onChange={e => setCreating({ ...creating, folderId: e.target.value })}
                className="!text-xs !py-1 !px-1.5"
              >
                {getFolders().map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="success" className="!text-xs" onClick={createPiece} disabled={saving}>생성</Button>
                <Button variant="secondary" className="!text-xs" onClick={() => setCreating(null)}>취소</Button>
              </div>
            </div>
          ) : (
            <Button
              variant="accent"
              className="!text-xs"
              onClick={() => setCreating({ id: '', name: '', folderId: getFolders()[0].id })}
            >
              ➕ 새 기물
            </Button>
          )}
        </aside>

        {/* 우: 편집 폼 */}
        <section className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 max-w-3xl">
          {/* 메타 */}
          <div className="grid grid-cols-2 gap-3">
            <Label>
              라벨
              <TextInput value={draft.label} onChange={e => patchDraft({ label: e.target.value })} className="mt-1" />
            </Label>
            <Label>
              폴더
              <Select value={draft.folderId} onChange={e => patchDraft({ folderId: e.target.value })} className="mt-1">
                {getFolders().map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </Label>
          </div>

          {/* SVG */}
          <div className="flex gap-3 items-start">
            <Label className="flex-1">
              SVG
              <TextArea
                value={draft.svg}
                onChange={e => patchDraft({ svg: e.target.value })}
                rows={5}
                className="mt-1 !text-[11px] font-mono"
              />
            </Label>
            <div className="shrink-0 flex flex-col items-center gap-1">
              <span className="text-[11px] text-ink-muted">미리보기</span>
              <div
                className="w-20 h-20 border border-line rounded-tile bg-[var(--cell)] p-1.5"
                dangerouslySetInnerHTML={{ __html: draft.svg }}
              />
            </div>
          </div>

          {/* 배치 기본 특성 */}
          <div className="flex flex-col gap-1.5">
            <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">배치 기본 특성</h5>
            <div className="flex gap-4 text-xs">
              {(['canRotate', 'isInventory'] as const).map(k => (
                <label key={k} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.defaults[k]}
                    onChange={e => patchDraft({ defaults: { ...draft.defaults, [k]: e.target.checked } })}
                  />
                  {k === 'canRotate' ? '🔄 회전 가능' : '🎒 유저 지급'}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-ink-muted">이동 가능(canMove)은 유저 지급에 종속 — 유저 지급 기물만 플레이 중 이동 가능.</p>
          </div>

          {/* 면 그리드 */}
          <div className="flex flex-col gap-1.5 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">면별 효과 (입사 방향)</h5>
              {defHasSatisfy(def) && <Pill tone="success">🎯 표적</Pill>}
            </div>
            <p className="text-[11px] text-ink-muted">
              각 칸 = 그 방향에서 들어오는 빔의 효과. 비워두면 fallback 적용. 면각은 기물 기준(회전이 더해짐).
            </p>
            <div className="grid grid-cols-3 gap-2 max-w-md">
              {FACE_GRID.flat().map((rel, i) =>
                rel === null ? (
                  <div key={i} className="flex items-center justify-center border border-line rounded-tile bg-[var(--cell)] p-2">
                    <div className="w-12 h-12" dangerouslySetInnerHTML={{ __html: draft.svg }} />
                  </div>
                ) : (
                  <div key={i} className="border border-line rounded-tile p-1.5 bg-surface">
                    <p className="text-[10px] font-bold text-ink-muted mb-1">rel {rel}°</p>
                    <FaceSpecEditor
                      rel={rel}
                      spec={def.faces[rel]}
                      conditional={hasConditional}
                      allowInherit
                      onChange={s => {
                        const faces = { ...def.faces };
                        if (s === undefined) delete faces[rel];
                        else faces[rel] = s;
                        patchDef({ faces });
                      }}
                    />
                    {hasConditional && (
                      <label className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-line text-[10px] text-ink-muted">
                        <input
                          type="checkbox"
                          checked={faceGroup[rel] != null}
                          onChange={e => setTrigger(rel, e.target.checked)}
                        />
                        ⚡트리거
                        {faceGroup[rel] != null && (
                          <input
                            type="number"
                            min={1}
                            value={faceGroup[rel]}
                            onChange={e => setTriggerGroup(rel, Number(e.target.value))}
                            className="w-9 ml-auto border border-line rounded bg-surface text-ink text-[10px] px-1 py-0.5"
                            title="그룹 (같은 번호=OR, 다른 번호=AND)"
                          />
                        )}
                      </label>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* fallback + rotationStep */}
          <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
            <div>
              <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-1">Fallback (미지정 방향)</h5>
              <FaceSpecEditor
                spec={def.fallback}
                conditional={hasConditional}
                onChange={s => { if (s) patchDef({ fallback: s }); }}
              />
            </div>
            <Label>
              회전 단위
              <Select
                value={def.rotationStep}
                onChange={e => patchDef({ rotationStep: Number(e.target.value) as 45 | 90 })}
                className="mt-1"
              >
                <option value={90}>90°</option>
                <option value={45}>45°</option>
              </Select>
            </Label>
          </div>

          {/* 조건부 */}
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={hasConditional}
                onChange={e => patchDef({
                  conditional: e.target.checked ? { init: false, groups: [[270]] } : undefined,
                })}
              />
              조건부 기물 (게이트/프로젝터 — 고정점 루프로 활성 재평가)
            </label>
            {def.conditional && (
              <div className="grid grid-cols-2 gap-3 pl-5">
                <p className="text-[11px] text-ink-muted self-center">
                  활성 트리거 면은 <strong className="text-ink">위 면 그리드</strong>에서 ⚡트리거 체크.
                  같은 그룹 번호 = OR, 다른 번호 = AND.
                </p>
                <div className="flex flex-col gap-1.5 text-xs pt-1">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={def.conditional.init}
                      onChange={e => patchDef({ conditional: { ...def.conditional!, init: e.target.checked } })}
                    />
                    초기 상태 = 활성
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!def.conditional.negate}
                      onChange={e => patchDef({ conditional: { ...def.conditional!, negate: e.target.checked || undefined } })}
                    />
                    반전 (나열 면 전부 미피격일 때 활성)
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 사출 */}
          <div className="flex flex-col gap-2 border-t border-line pt-4 pb-8">
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={!!def.emit}
                onChange={e => patchDef({ emit: e.target.checked ? { fromRel: 270, whenActive: true } : undefined })}
              />
              사출 (프로젝터 — 활성 상태에서 빔 발사)
            </label>
            {def.emit && (
              <div className="grid grid-cols-2 gap-3 pl-5">
                <Label>
                  사출 방향 (rel)
                  <Select
                    value={def.emit.fromRel}
                    onChange={e => patchDef({ emit: { ...def.emit!, fromRel: Number(e.target.value) } })}
                    className="mt-1"
                  >
                    {RELS.map(r => <option key={r} value={r}>{r}°</option>)}
                  </Select>
                </Label>
                <label className="flex items-center gap-1.5 text-xs pt-6">
                  <input
                    type="checkbox"
                    checked={def.emit.whenActive}
                    onChange={e => patchDef({ emit: { ...def.emit!, whenActive: e.target.checked } })}
                  />
                  활성일 때 사출 (해제 시 비활성일 때 사출)
                </label>
              </div>
            )}
          </div>
        </section>
      </div>

      <Notification />
      <ConfirmHost />
    </div>
  );
}

// 오버라이드 존재 표시 배지
function getPieceConfigBadge(type: string) {
  return getAllConfigEntries()[type]
    ? <span className="text-[10px] text-accent font-bold shrink-0" title="config 오버라이드 적용됨">●</span>
    : null;
}
