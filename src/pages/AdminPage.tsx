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
  PALETTE_ORDER, getPieceTab, getPieceDefaults, getAllConfigEntries, applyPieceConfig,
  type PieceConfigEntry, type PieceTab,
} from '../lib/pieceConfig';
import { savePieceConfigEntry, deletePieceConfigEntry } from '../lib/firebaseService';
import { Notification } from '../components/layout/Notification';
import { Button, Label, TextInput, TextArea, Select, Pill, ConfirmHost, cx } from '../components/ui';
import type { PieceType } from '../types/game';

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

const TABS: { id: PieceTab; label: string }[] = [
  { id: 'basic', label: '초급' }, { id: 'intermediate', label: '중급' }, { id: 'advanced', label: '상급' },
];

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
  tab: PieceTab;
  defaults: { canRotate: boolean; canMove: boolean; isInventory: boolean };
}

function makeDraft(type: PieceType): Draft {
  const def = getBehaviorDef(type)!;
  return {
    def: JSON.parse(JSON.stringify(def)) as PieceBehaviorDef,
    svg: getSvgArt(type),
    label: getPieceLabel(type),
    tab: getPieceTab(type),
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

  const [selectedType, setSelectedType] = useState<PieceType>(PALETTE_ORDER[0]);
  const [draft, setDraft] = useState<Draft>(() => makeDraft(PALETTE_ORDER[0]));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

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

  async function selectPiece(type: PieceType) {
    if (dirty && !(await requestConfirm({ message: '저장하지 않은 변경이 있습니다. 버리고 이동할까요?', danger: true }))) return;
    setSelectedType(type);
    setDraft(makeDraft(type));
    setDirty(false);
  }

  // 저장: Firestore 머지 + 로컬 오버레이 즉시 재적용
  async function handleSave() {
    setSaving(true);
    try {
      const entry: PieceConfigEntry = {
        behavior: draft.def,
        svg: draft.svg,
        labelKo: draft.label,
        tab: draft.tab,
        defaults: draft.defaults,
      };
      await savePieceConfigEntry(selectedType, entry as unknown as Record<string, unknown>);
      applyPieceConfig({ version: 1, pieces: { ...getAllConfigEntries(), [selectedType]: entry } });
      bumpPieceConfigRev();
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
      applyPieceConfig({ version: 1, pieces: rest });
      bumpPieceConfigRev();
      setDraft(makeDraft(selectedType));
      setDirty(false);
      showNotification('기본값으로 복원되었습니다.');
    } catch {
      showNotification('복원 실패 — 권한 또는 네트워크를 확인하세요.', '#e74c3c');
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
        <Button variant="secondary" onClick={handleReset} disabled={saving}>↩ 기본값으로</Button>
        <Button variant="success" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? '저장 중…' : '💾 저장 (전 플레이어 반영)'}
        </Button>
        <Link to="/">
          <Button variant="secondary">← 에디터로</Button>
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 좌: 기물 목록 */}
        <aside className="w-56 shrink-0 bg-surface border-r border-line p-2 overflow-y-auto">
          {PALETTE_ORDER.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => selectPiece(type)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-tile text-left text-xs transition-colors ${
                type === selectedType ? 'bg-accent-soft border border-accent' : 'hover:bg-surface-2 border border-transparent'
              }`}
            >
              <span className="w-7 h-7 shrink-0" dangerouslySetInnerHTML={{ __html: getSvgArt(type) }} />
              <span className="min-w-0 flex-1 truncate font-medium">{getPieceLabel(type)}</span>
              {getPieceConfigBadge(type)}
            </button>
          ))}
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
              팔레트 탭
              <Select value={draft.tab} onChange={e => patchDraft({ tab: e.target.value as PieceTab })} className="mt-1">
                {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
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
function getPieceConfigBadge(type: PieceType) {
  return getAllConfigEntries()[type]
    ? <span className="text-[10px] text-accent font-bold shrink-0" title="config 오버라이드 적용됨">●</span>
    : null;
}
