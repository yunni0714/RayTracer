import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { isAdminUid } from '../lib/admin';
import { getSvgArt } from '../lib/svgArt';
import { getPieceLabel } from '../lib/pieceActions';
import {
  getBehaviorDef,
  type PieceBehaviorDef, type FaceSpec, type FaceEffect, type FaceEffectKind,
} from '../lib/laserEngine';
import {
  PALETTE_ORDER, getPieceTab, getPieceDefaults, getAllConfigEntries, applyPieceConfig,
  type PieceConfigEntry, type PieceTab,
} from '../lib/pieceConfig';
import { savePieceConfigEntry, deletePieceConfigEntry } from '../lib/firebaseService';
import { Notification } from '../components/layout/Notification';
import { Button, Label, TextInput, TextArea, Select, Pill, ConfirmHost } from '../components/ui';
import type { PieceType } from '../types/game';

/* ════════════════════════════════════════════════════════
   어드민 — 면별(per-face) 기물 behavior 에디터 (docs/ADMIN_PANEL.md)
   저장 = Firestore config/pieces 머지 → 즉시 로컬 오버레이 재적용.
   쓰기 권한 강제는 firestore.rules (이 페이지 게이트는 UI 숨김일 뿐).
   ════════════════════════════════════════════════════════ */

const KINDS: FaceEffectKind[] = ['pass', 'block', 'absorb', 'reflect', 'split', 'reverse'];
const KIND_LABEL: Record<FaceEffectKind, string> = {
  pass: '통과', block: '차단', absorb: '흡수', reflect: '반사', split: '분기', reverse: '되돌림',
};
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

function groupsToText(groups: number[][]): string {
  return groups.map(g => g.join(',')).join(';');
}

function textToGroups(text: string): number[][] {
  return text.split(';')
    .map(g => g.split(',').map(v => Number(v.trim())).filter(n => Number.isFinite(n)))
    .filter(g => g.length > 0);
}

/* ── 단일 효과 편집 폼 ──────────────────────────────────── */

function EffectEditor({
  value, onChange, allowInherit, inheritLabel = '(fallback)',
}: {
  value: FaceEffect | undefined;
  onChange: (fx: FaceEffect | undefined) => void;
  allowInherit?: boolean;
  inheritLabel?: string;
}) {
  const kind = value?.kind;
  return (
    <div className="flex flex-col gap-1">
      <Select
        value={kind ?? ''}
        onChange={e => {
          const k = e.target.value as FaceEffectKind | '';
          if (k === '') { onChange(undefined); return; }
          onChange({ kind: k, ...(value?.satisfy && { satisfy: true }),
            ...((k === 'reflect' || k === 'split') && { surfaceAngle: value?.surfaceAngle ?? 0 }) });
        }}
        className="!text-xs !py-1 !px-1.5"
      >
        {allowInherit && <option value="">{inheritLabel}</option>}
        {KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
      </Select>
      {value && (value.kind === 'reflect' || value.kind === 'split') && (
        <TextInput
          type="number"
          step={22.5}
          value={value.surfaceAngle ?? 0}
          onChange={e => onChange({ ...value, surfaceAngle: Number(e.target.value) })}
          className="!text-xs !py-1 !px-1.5"
          title="면각 (기물 기준, rotation 이 더해짐)"
        />
      )}
      {value && (
        <label className="flex items-center gap-1 text-[11px] text-ink-muted">
          <input
            type="checkbox"
            checked={!!value.satisfy}
            onChange={e => onChange({ ...value, satisfy: e.target.checked || undefined })}
          />
          🎯 충족
        </label>
      )}
    </div>
  );
}

/* ── FaceSpec(단일 or open/closed) 편집 ─────────────────── */

function FaceSpecEditor({
  spec, onChange, conditional, allowInherit,
}: {
  spec: FaceSpec | undefined;
  onChange: (s: FaceSpec | undefined) => void;
  conditional: boolean; // 조건부 기물이면 open/closed 분기 허용
  allowInherit?: boolean;
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
          <EffectEditor value={(spec as DualSpec).open} onChange={fx => fx && onChange({ ...(spec as DualSpec), open: fx })} />
          <span className="text-[10px] text-ink-muted">닫힘</span>
          <EffectEditor value={(spec as DualSpec).closed} onChange={fx => fx && onChange({ ...(spec as DualSpec), closed: fx })} />
        </div>
      ) : (
        <EffectEditor
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
              {(['canRotate', 'canMove', 'isInventory'] as const).map(k => (
                <label key={k} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={draft.defaults[k]}
                    onChange={e => patchDraft({ defaults: { ...draft.defaults, [k]: e.target.checked } })}
                  />
                  {k === 'canRotate' ? '🔄 회전 가능' : k === 'canMove' ? '✋ 이동 가능' : '🎒 유저 지급'}
                </label>
              ))}
            </div>
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
                <Label>
                  활성 조건 면 그룹 <span className="text-ink-muted font-normal">(그룹=AND, 그룹 내=OR. 예: 0,180;90,270)</span>
                  <TextInput
                    value={groupsToText(def.conditional.groups)}
                    onChange={e => patchDef({ conditional: { ...def.conditional!, groups: textToGroups(e.target.value) } })}
                    className="mt-1 !text-xs font-mono"
                  />
                </Label>
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
