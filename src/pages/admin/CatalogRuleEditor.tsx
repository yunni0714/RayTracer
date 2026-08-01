import { getSvgArt } from '../../lib/svgArt';
import { getPieceLabel } from '../../lib/pieceActions';
import { PALETTE_ORDER, getCustomTypes } from '../../lib/pieceConfig';
import { CATEGORY_LABELS, type MapCategory } from '../../lib/mapCategory';
import { describeCondition } from '../../lib/catalogRules';
import {
  USER_CONDITION_KINDS,
  type CatalogCondition, type CatalogConditionKind, type CatalogSort, type SortKey,
} from '../../lib/catalogConfig';
import { Button, IconButton, Label, Select, TextInput, Pill, cx } from '../../components/ui';
import type { Difficulty } from '../../types/game';

/* 카탈로그 규칙 편집 — 조건 카드 리스트(AND) + 정렬 + 개수 제한.
   조건 스키마는 lib/catalogConfig.ts 의 CatalogCondition 과 1:1. */

const DIFFICULTIES: Difficulty[] = ['Tutor', 'Easy', 'Normal', 'Hard', 'Insane'];
const CATEGORIES: MapCategory[] = ['basic', 'logic', 'advanced', 'advanced_logic'];
const SORT_KEYS: { id: SortKey; label: string }[] = [
  { id: 'createdAt', label: '생성일' },
  { id: 'reactionGod', label: '🌟 반응' },
  { id: 'reactionOk', label: '👍 반응' },
  { id: 'title', label: '제목' },
];

// 조건 추가 드롭다운 — kind 별 기본값
const CONDITION_TEMPLATES: { kind: CatalogConditionKind; label: string; make: () => CatalogCondition }[] = [
  { kind: 'author', label: '작성자', make: () => ({ kind: 'author', author: '' }) },
  { kind: 'reaction', label: '반응 수', make: () => ({ kind: 'reaction', field: 'reactionGod', min: 3 }) },
  { kind: 'difficulty', label: '난이도', make: () => ({ kind: 'difficulty', values: ['Normal'] }) },
  { kind: 'category', label: '맵 카테고리', make: () => ({ kind: 'category', values: ['logic'] }) },
  { kind: 'recent', label: '최근 N일', make: () => ({ kind: 'recent', days: 7 }) },
  { kind: 'gridSize', label: '그리드 크기', make: () => ({ kind: 'gridSize', min: 5 }) },
  { kind: 'pieceCount', label: '기물 수', make: () => ({ kind: 'pieceCount', min: 1 }) },
  { kind: 'containsPiece', label: '특정 기물 포함', make: () => ({ kind: 'containsPiece', types: [], mode: 'any' }) },
  { kind: 'titleContains', label: '제목/설명 포함', make: () => ({ kind: 'titleContains', text: '' }) },
  { kind: 'mine', label: '내 맵 여부 (로그인)', make: () => ({ kind: 'mine', owned: true }) },
  { kind: 'played', label: '플레이 여부 (로그인)', make: () => ({ kind: 'played', played: false }) },
  { kind: 'reacted', label: '내 반응 여부 (로그인)', make: () => ({ kind: 'reacted', field: 'any', reacted: true }) },
  { kind: 'voted', label: '내 투표 여부 (로그인)', make: () => ({ kind: 'voted', voted: true }) },
];

const numOrUndef = (v: string): number | undefined => (v === '' ? undefined : Number(v));

function NumField({ label, value, onChange }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-ink-muted">
      {label}
      <TextInput
        type="number"
        value={value ?? ''}
        onChange={e => onChange(numOrUndef(e.target.value))}
        className="!w-20 !text-xs !py-1 !px-1.5"
      />
    </label>
  );
}

function ToggleChips<T extends string>({ options, values, labelOf, onChange }: {
  options: readonly T[]; values: T[]; labelOf: (v: T) => string; onChange: (v: T[]) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(opt => {
        const on = values.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(on ? values.filter(v => v !== opt) : [...values, opt])}
            className={cx(
              'px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors',
              on ? 'bg-accent-soft border-accent text-ink' : 'border-line text-ink-muted hover:bg-surface-2',
            )}
          >
            {labelOf(opt)}
          </button>
        );
      })}
    </div>
  );
}

function PiecePicker({ types, onChange }: { types: string[]; onChange: (t: string[]) => void }) {
  const all = [...PALETTE_ORDER, ...getCustomTypes()];
  return (
    <div className="flex gap-1 flex-wrap max-h-28 overflow-y-auto p-1 border border-line rounded-tile">
      {all.map(type => {
        const on = types.includes(type);
        return (
          <button
            key={type}
            type="button"
            title={getPieceLabel(type)}
            onClick={() => onChange(on ? types.filter(t => t !== type) : [...types, type])}
            className={cx(
              'w-8 h-8 p-1 rounded-tile border transition-colors',
              on ? 'bg-accent-soft border-accent' : 'border-transparent hover:bg-surface-2',
            )}
          >
            <span className="block w-full h-full" dangerouslySetInnerHTML={{ __html: getSvgArt(type) }} />
          </button>
        );
      })}
    </div>
  );
}

function ConditionFields({ cond, onChange }: {
  cond: CatalogCondition; onChange: (c: CatalogCondition) => void;
}) {
  switch (cond.kind) {
    case 'author':
      return (
        <TextInput
          placeholder="작성자명 (예: RayOriginal)"
          value={cond.author}
          onChange={e => onChange({ ...cond, author: e.target.value })}
          className="!text-xs !py-1"
        />
      );

    case 'reaction':
      return (
        <div className="flex gap-2 flex-wrap items-center">
          <Select
            value={cond.field}
            onChange={e => onChange({ ...cond, field: e.target.value as 'reactionOk' | 'reactionGod' })}
            className="!w-auto !text-xs !py-1"
          >
            <option value="reactionGod">🌟 God</option>
            <option value="reactionOk">👍 Ok</option>
          </Select>
          <NumField label="최소" value={cond.min} onChange={v => onChange({ ...cond, min: v })} />
          <NumField label="최대" value={cond.max} onChange={v => onChange({ ...cond, max: v })} />
        </div>
      );

    case 'difficulty':
      return (
        <ToggleChips
          options={DIFFICULTIES}
          values={cond.values}
          labelOf={d => d}
          onChange={values => onChange({ ...cond, values })}
        />
      );

    case 'category':
      return (
        <ToggleChips
          options={CATEGORIES}
          values={cond.values}
          labelOf={c => CATEGORY_LABELS[c]}
          onChange={values => onChange({ ...cond, values })}
        />
      );

    case 'recent':
      return <NumField label="일" value={cond.days} onChange={v => onChange({ ...cond, days: v ?? 1 })} />;

    case 'gridSize':
    case 'pieceCount':
      return (
        <div className="flex gap-2 flex-wrap">
          <NumField label="최소" value={cond.min} onChange={v => onChange({ ...cond, min: v })} />
          <NumField label="최대" value={cond.max} onChange={v => onChange({ ...cond, max: v })} />
        </div>
      );

    case 'containsPiece':
      return (
        <div className="flex flex-col gap-1.5">
          <Select
            value={cond.mode}
            onChange={e => onChange({ ...cond, mode: e.target.value as 'any' | 'all' })}
            className="!w-auto !text-xs !py-1"
          >
            <option value="any">하나라도 포함</option>
            <option value="all">모두 포함</option>
          </Select>
          <PiecePicker types={cond.types} onChange={types => onChange({ ...cond, types })} />
          <span className="text-[10px] text-ink-muted">{cond.types.length}종 선택됨</span>
        </div>
      );

    case 'titleContains':
      return (
        <TextInput
          placeholder="포함할 문구"
          value={cond.text}
          onChange={e => onChange({ ...cond, text: e.target.value })}
          className="!text-xs !py-1"
        />
      );

    case 'mine':
      return (
        <Select
          value={cond.owned ? 'yes' : 'no'}
          onChange={e => onChange({ ...cond, owned: e.target.value === 'yes' })}
          className="!w-auto !text-xs !py-1"
        >
          <option value="yes">내가 만든 맵</option>
          <option value="no">남이 만든 맵</option>
        </Select>
      );

    case 'played':
      return (
        <Select
          value={cond.played ? 'yes' : 'no'}
          onChange={e => onChange({ ...cond, played: e.target.value === 'yes' })}
          className="!w-auto !text-xs !py-1"
        >
          <option value="yes">플레이한 맵</option>
          <option value="no">아직 안 한 맵</option>
        </Select>
      );

    case 'reacted':
      return (
        <div className="flex gap-2 flex-wrap">
          <Select
            value={cond.field}
            onChange={e => onChange({ ...cond, field: e.target.value as 'ok' | 'god' | 'any' })}
            className="!w-auto !text-xs !py-1"
          >
            <option value="any">아무 반응</option>
            <option value="ok">👍 Ok</option>
            <option value="god">🌟 God</option>
          </Select>
          <Select
            value={cond.reacted ? 'yes' : 'no'}
            onChange={e => onChange({ ...cond, reacted: e.target.value === 'yes' })}
            className="!w-auto !text-xs !py-1"
          >
            <option value="yes">누른 맵</option>
            <option value="no">안 누른 맵</option>
          </Select>
        </div>
      );

    case 'voted':
      return (
        <Select
          value={cond.voted ? 'yes' : 'no'}
          onChange={e => onChange({ ...cond, voted: e.target.value === 'yes' })}
          className="!w-auto !text-xs !py-1"
        >
          <option value="yes">내가 투표한 맵</option>
          <option value="no">투표 안 한 맵</option>
        </Select>
      );
  }
}

interface Props {
  conditions: CatalogCondition[];
  sort: CatalogSort | undefined;
  limit: number | undefined;
  onChange: (patch: { conditions?: CatalogCondition[]; sort?: CatalogSort; limit?: number }) => void;
}

export function CatalogRuleEditor({ conditions, sort, limit, onChange }: Props) {
  const effectiveSort: CatalogSort = sort ?? { by: 'createdAt', dir: 'desc' };

  function setCondition(index: number, cond: CatalogCondition) {
    onChange({ conditions: conditions.map((c, i) => (i === index ? cond : c)) });
  }

  function removeCondition(index: number) {
    onChange({ conditions: conditions.filter((_, i) => i !== index) });
  }

  function addCondition(kind: CatalogConditionKind) {
    const template = CONDITION_TEMPLATES.find(t => t.kind === kind);
    if (template) onChange({ conditions: [...conditions, template.make()] });
  }

  return (
    <section className="flex flex-col gap-2 border border-line rounded-tile p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">규칙</h5>
        <span className="text-[11px] text-ink-muted">조건을 <strong className="text-ink">전부</strong> 만족하는 맵(AND). 조건이 없으면 전체.</span>
      </div>

      {conditions.length === 0 && (
        <p className="text-[11px] text-ink-muted py-1">조건 없음 — 모든 맵이 대상입니다.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {conditions.map((cond, i) => (
          <div key={i} className="flex flex-col gap-1">
            {i > 0 && <span className="text-[10px] font-extrabold text-ink-muted">AND</span>}
            <div className="border border-line rounded-tile p-2 bg-surface flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold">{describeCondition(cond)}</span>
                {USER_CONDITION_KINDS.includes(cond.kind) && (
                  <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">🔒 로그인</Pill>
                )}
                <IconButton
                  aria-label="조건 제거"
                  className="!text-[10px] !px-1 !py-1 ml-auto"
                  onClick={() => removeCondition(i)}
                >✕</IconButton>
              </div>
              <ConditionFields cond={cond} onChange={c => setCondition(i, c)} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value=""
          onChange={e => { if (e.target.value) addCondition(e.target.value as CatalogConditionKind); }}
          className="!w-auto !text-xs !py-1"
          aria-label="조건 추가"
        >
          <option value="">＋ 조건 추가…</option>
          {CONDITION_TEMPLATES.map(t => <option key={t.kind} value={t.kind}>{t.label}</option>)}
        </Select>

        <Label className="flex items-center gap-1 !text-[11px]">
          정렬
          <Select
            value={effectiveSort.by}
            onChange={e => onChange({ sort: { ...effectiveSort, by: e.target.value as SortKey } })}
            className="!w-auto !text-xs !py-1"
          >
            {SORT_KEYS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </Label>
        <Button
          variant="secondary"
          className="!text-xs"
          onClick={() => onChange({ sort: { ...effectiveSort, dir: effectiveSort.dir === 'desc' ? 'asc' : 'desc' } })}
        >
          {effectiveSort.dir === 'desc' ? '내림차순 ↓' : '오름차순 ↑'}
        </Button>

        <NumField label="상위 N개" value={limit} onChange={v => onChange({ limit: v })} />
      </div>
    </section>
  );
}
