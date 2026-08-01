import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import {
  getCatalogs, getCatalog, getCatalogOverrides, getBuiltinCatalog,
  isBuiltinCatalogId, isValidCatalogId, applyCatalogConfig, loadCatalogConfig,
  type CatalogDef,
} from '../../lib/catalogConfig';
import { selectCatalogMaps, describeCatalog, needsLogin } from '../../lib/catalogRules';
import { saveCatalogEntry, deleteCatalogEntry, saveCatalogPatch } from '../../lib/firebaseService';
import { getAllMapStates } from '../../hooks/useMapReactions';
import { Button, IconButton, Label, TextInput, Pill, cx } from '../../components/ui';
import { CatalogRuleEditor } from './CatalogRuleEditor';
import { CatalogCurationPanel } from './CatalogCurationPanel';
import { CatalogPreviewPanel } from './CatalogPreviewPanel';
import { useAdminMaps } from './useAdminMaps';

/* 카탈로그 편집 — 라이브러리 카탈로그(구 카테고리) 정의를 어드민에서 관리한다.
   저장 = Firestore config/catalog 머지 → 로컬 오버레이 즉시 재적용 → 라이브러리 반영.
   빌트인 5종은 전체 편집·숨김 가능하지만 삭제는 불가 (기본값으로 되돌리기 제공).
   레이아웃: 좌(목록) / 중(편집) / 우(미리보기 전용 열, xl 이상). 좁은 화면에서는
   미리보기가 편집 폼 아래로 내려온다 — 같은 CatalogPreviewPanel 을 두 자리에 건다. */

function errDetail(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    return `${code ?? err.name}: ${err.message.slice(0, 200)}`;
  }
  return '권한(firestore.rules) 또는 네트워크를 확인하세요.';
}

function cloneDef(def: CatalogDef): CatalogDef {
  return JSON.parse(JSON.stringify(def)) as CatalogDef;
}

export function CatalogTab() {
  const { showNotification, requestConfirm, bumpCatalogConfigRev, currentUserUid } =
    useGameStore(useShallow(s => ({
      showNotification: s.showNotification,
      requestConfirm: s.requestConfirm,
      bumpCatalogConfigRev: s.bumpCatalogConfigRev,
      currentUserUid: s.currentUserUid,
    })));
  useGameStore(s => s.catalogConfigRev);
  useGameStore(s => s.pieceConfigRev);

  const admin = useAdminMaps(); // 큐레이션 선택 + 미리보기용 맵 목록
  const [selectedId, setSelectedId] = useState<string>('featured');
  const [draft, setDraft] = useState<CatalogDef | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState<{ id: string; label: string; emoji: string } | null>(null);
  const [previewAsMe, setPreviewAsMe] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // 어드민 직접 진입 대비 — 부팅 로더와 별개로 1회 더 읽는다 (idempotent)
  useEffect(() => {
    loadCatalogConfig().then(result => { if (result) bumpCatalogConfigRev(); });
  }, [bumpCatalogConfigRev]);

  const catalogs = getCatalogs({ includeHidden: true });
  const overrides = getCatalogOverrides();
  const builtins = catalogs.filter(c => isBuiltinCatalogId(c.id));
  const customs = catalogs.filter(c => !isBuiltinCatalogId(c.id));
  const current = draft ?? getCatalog(selectedId) ?? catalogs[0];

  // 편집 중인 정의로 실제 평가 — 저장 전에 결과를 확인한다
  const preview = useMemo(() => {
    if (!current) return [];
    return selectCatalogMaps(current, admin.maps, {
      uid: previewAsMe ? currentUserUid : null,
      mapStates: getAllMapStates(),
    });
  }, [current, admin.maps, previewAsMe, currentUserUid]);

  async function selectCatalog(id: string) {
    if (dirty && !(await requestConfirm({ message: '저장하지 않은 변경이 있습니다. 버리고 이동할까요?', danger: true }))) return;
    setSelectedId(id);
    setDraft(null);
    setDirty(false);
  }

  function patchDraft(patch: Partial<CatalogDef>) {
    setDraft(d => ({ ...cloneDef(d ?? current!), ...patch }));
    setDirty(true);
  }

  // 저장 성공 후 로컬 오버레이 즉시 재적용 (라이브러리도 같은 소스를 본다)
  function applyLocal(nextOverrides: Record<string, Partial<CatalogDef>>) {
    applyCatalogConfig({ version: 2, catalogs: nextOverrides });
    bumpCatalogConfigRev();
  }

  async function handleSave() {
    if (!current) return;
    setSaving(true);
    try {
      const entry: Partial<CatalogDef> = {
        label: current.label,
        emoji: current.emoji,
        order: current.order,
        hidden: current.hidden ?? false,
        conditions: current.conditions ?? [],
        sort: current.sort,
        limit: current.limit,
        pinnedMapIds: current.pinnedMapIds ?? [],
        excludedMapIds: current.excludedMapIds ?? [],
      };
      await saveCatalogEntry(current.id, entry as Record<string, unknown>);
      applyLocal({ ...overrides, [current.id]: entry });
      setDraft(null);
      setDirty(false);
      showNotification(`[${current.label}] 저장 완료 — 라이브러리에 반영됩니다.`);
    } catch (err) {
      showNotification(`저장 실패 — ${errDetail(err)}`, '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!current) return;
    const message = isBuiltinCatalogId(current.id)
      ? `[${current.label}] 을 코드 기본값으로 되돌릴까요? 어드민에서 바꾼 내용이 사라집니다.`
      : `[${current.label}] 의 저장되지 않은 변경을 버릴까요?`;
    if (!(await requestConfirm({ message, danger: true }))) return;

    if (!isBuiltinCatalogId(current.id)) { setDraft(null); setDirty(false); return; }

    setSaving(true);
    try {
      await deleteCatalogEntry(current.id);
      const rest = { ...overrides };
      delete rest[current.id];
      applyLocal(rest);
      setDraft(null);
      setDirty(false);
      showNotification('기본값으로 복원되었습니다.');
    } catch (err) {
      showNotification(`복원 실패 — ${errDetail(err)}`, '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!current || isBuiltinCatalogId(current.id)) return;
    if (!(await requestConfirm({
      message: `[${current.label}] 카탈로그를 삭제할까요? 라이브러리에서 사라집니다 (맵은 지워지지 않습니다).`,
      danger: true,
    }))) return;
    setSaving(true);
    try {
      await deleteCatalogEntry(current.id);
      const rest = { ...overrides };
      delete rest[current.id];
      applyLocal(rest);
      setDraft(null);
      setDirty(false);
      setSelectedId('featured');
      showNotification(`[${current.label}] 삭제 완료.`);
    } catch (err) {
      showNotification(`삭제 실패 — ${errDetail(err)}`, '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  async function toggleHidden() {
    if (!current) return;
    patchDraft({ hidden: !current.hidden });
  }

  async function moveCatalog(id: string, delta: -1 | 1) {
    const list = getCatalogs({ includeHidden: true });
    const i = list.findIndex(c => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];

    const patch: Record<string, Record<string, unknown>> = {};
    const nextOverrides = { ...overrides };
    list.forEach((c, idx) => {
      if (c.order === idx) return;
      patch[c.id] = { order: idx };
      nextOverrides[c.id] = { ...(nextOverrides[c.id] ?? {}), order: idx };
      // 커스텀은 라벨이 없으면 sanitize 가 엔트리를 버린다
      if (!isBuiltinCatalogId(c.id)) {
        patch[c.id].label = c.label;
        nextOverrides[c.id] = { ...nextOverrides[c.id], label: c.label };
      }
    });
    if (Object.keys(patch).length === 0) return;

    try {
      await saveCatalogPatch(patch);
      applyLocal(nextOverrides);
    } catch (err) {
      showNotification(`순서 저장 실패 — ${errDetail(err)}`, '#e74c3c');
    }
  }

  async function createCatalog() {
    if (!creating) return;
    const id = creating.id.trim();
    if (!isValidCatalogId(id)) {
      showNotification('잘못된 id — 소문자/숫자/_ 만, 48자 이하.', '#e74c3c');
      return;
    }
    if (catalogs.some(c => c.id === id)) {
      showNotification('이미 존재하는 카탈로그 id 입니다.', '#e74c3c');
      return;
    }
    const label = creating.label.trim() || id;
    setSaving(true);
    try {
      const entry: Partial<CatalogDef> = {
        label,
        emoji: creating.emoji.trim() || '📁',
        order: catalogs.length,
        hidden: false,
        conditions: [],
        sort: { by: 'createdAt', dir: 'desc' },
        pinnedMapIds: [],
        excludedMapIds: [],
      };
      await saveCatalogEntry(id, entry as Record<string, unknown>);
      applyLocal({ ...overrides, [id]: entry });
      setCreating(null);
      setSelectedId(id);
      setDraft(null);
      setDirty(false);
      showNotification(`[${label}] 생성 완료 — 조건을 채워주세요.`);
    } catch (err) {
      showNotification(`생성 실패 — ${errDetail(err)}`, '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  function renderRow(c: CatalogDef) {
    const isModified = !!overrides[c.id];
    return (
      <div key={c.id} className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => selectCatalog(c.id)}
          className={cx(
            'flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-tile text-left text-xs border transition-colors',
            c.id === current?.id ? 'bg-accent-soft border-accent' : 'border-transparent hover:bg-surface-2',
          )}
        >
          <span className="w-5 shrink-0 text-center" aria-hidden>{c.emoji ?? '📁'}</span>
          <span className={cx('min-w-0 flex-1 truncate font-medium', c.hidden && 'line-through opacity-50')}>
            {c.label}
          </span>
          {isModified && <span className="text-accent text-[10px] font-bold" title="오버라이드 적용됨">●</span>}
          {c.hidden && <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">숨김</Pill>}
        </button>
        <IconButton aria-label="위로" className="!text-[10px] !px-1 !py-1" onClick={() => moveCatalog(c.id, -1)}>↑</IconButton>
        <IconButton aria-label="아래로" className="!text-[10px] !px-1 !py-1" onClick={() => moveCatalog(c.id, 1)}>↓</IconButton>
      </div>
    );
  }

  function renderSection(id: string, title: string, list: CatalogDef[]) {
    const isCollapsed = collapsed.has(id);
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setCollapsed(s => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
          })}
          className="flex items-center gap-1 px-1 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted"
        >
          <span className="w-3">{isCollapsed ? '▸' : '▾'}</span>
          {title} <span className="font-normal">({list.length})</span>
        </button>
        {!isCollapsed && (list.length > 0
          ? list.map(renderRow)
          : <p className="px-2 py-1 text-[10px] text-ink-muted">없음</p>)}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* 좌: 빌트인 / 커스텀 분리 목록 */}
      <aside className="w-64 shrink-0 bg-surface border-r border-line p-2 overflow-y-auto flex flex-col gap-2">
        {renderSection('builtin', '빌트인', builtins)}
        {renderSection('custom', '커스텀', customs)}

        {creating ? (
          <div className="border border-line rounded-tile p-2 flex flex-col gap-1.5">
            <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">새 카탈로그</h5>
            <TextInput
              autoFocus
              placeholder="id (소문자/숫자/_)"
              value={creating.id}
              onChange={e => setCreating({ ...creating, id: e.target.value })}
              className="!text-xs !py-1 !px-1.5 font-mono"
            />
            <TextInput
              placeholder="이름"
              value={creating.label}
              onChange={e => setCreating({ ...creating, label: e.target.value })}
              className="!text-xs !py-1 !px-1.5"
            />
            <TextInput
              placeholder="이모지"
              value={creating.emoji}
              onChange={e => setCreating({ ...creating, emoji: e.target.value })}
              className="!text-xs !py-1 !px-1.5"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="success" className="!text-xs" onClick={createCatalog} disabled={saving}>생성</Button>
              <Button variant="secondary" className="!text-xs" onClick={() => setCreating(null)}>취소</Button>
            </div>
          </div>
        ) : (
          <Button
            variant="accent"
            className="!text-xs"
            onClick={() => setCreating({ id: '', label: '', emoji: '📁' })}
          >
            ➕ 새 카탈로그
          </Button>
        )}
      </aside>

      {/* 중: 편집 */}
      <section className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col gap-4">
        {!current ? (
          <p className="text-xs text-ink-muted">카탈로그가 없습니다.</p>
        ) : (
          <>
            {/* 액션 바 */}
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold tracking-tight mr-auto">
                {current.emoji} {current.label}
                <code className="ml-2 text-[11px] font-normal text-ink-muted">{current.id}</code>
              </h2>
              {dirty && <Pill tone="danger">저장 안 됨</Pill>}
              {isBuiltinCatalogId(current.id)
                ? <Pill tone="neutral">빌트인</Pill>
                : <Pill tone="info">커스텀</Pill>}
              <Button variant="secondary" onClick={toggleHidden}>
                {current.hidden ? '👁 노출' : '🙈 숨기기'}
              </Button>
              {isBuiltinCatalogId(current.id) ? (
                <Button variant="secondary" onClick={handleReset} disabled={saving || !overrides[current.id]}>
                  ↩ 기본값으로
                </Button>
              ) : (
                <Button variant="danger" onClick={handleDelete} disabled={saving}>🗑 삭제</Button>
              )}
              <Button variant="success" onClick={handleSave} disabled={saving || !dirty}>
                {saving ? '저장 중…' : '💾 저장'}
              </Button>
            </div>

            <p className="text-[11px] text-ink-muted">
              현재 규칙: <strong className="text-ink">{describeCatalog(current)}</strong>
              {needsLogin(current) && ' · 🔒 비로그인 사용자에게는 빈 목록으로 보입니다'}
            </p>

            {/* 메타 */}
            <section className="grid grid-cols-2 gap-3 border border-line rounded-tile p-3">
              <Label>
                이름
                <TextInput
                  value={current.label}
                  maxLength={40}
                  onChange={e => patchDraft({ label: e.target.value })}
                  className="mt-1"
                />
              </Label>
              <Label>
                이모지
                <TextInput
                  value={current.emoji ?? ''}
                  maxLength={8}
                  onChange={e => patchDraft({ emoji: e.target.value })}
                  className="mt-1"
                />
              </Label>
              <Label>
                순서
                <TextInput
                  type="number"
                  value={current.order}
                  onChange={e => patchDraft({ order: Number(e.target.value) })}
                  className="mt-1"
                />
              </Label>
              <label className="flex items-end gap-1.5 text-xs pb-2">
                <input
                  type="checkbox"
                  checked={!current.hidden}
                  onChange={e => patchDraft({ hidden: !e.target.checked })}
                />
                라이브러리에 노출
              </label>
            </section>

            {/* 규칙 */}
            <CatalogRuleEditor
              conditions={current.conditions ?? []}
              sort={current.sort}
              limit={current.limit}
              onChange={patchDraft}
            />

            {/* 수동 큐레이션 */}
            <CatalogCurationPanel
              pinnedMapIds={current.pinnedMapIds ?? []}
              excludedMapIds={current.excludedMapIds ?? []}
              maps={admin.maps}
              loading={admin.loading}
              onChange={patchDraft}
            />

            {/* 미리보기 — 좁은 화면 전용 (넓은 화면은 오른쪽 전용 열) */}
            <CatalogPreviewPanel
              className="xl:hidden border border-line rounded-tile p-3"
              maps={preview}
              totalCount={admin.maps.length}
              pinnedMapIds={current.pinnedMapIds ?? []}
              loading={admin.loading}
              error={admin.error}
              previewAsMe={previewAsMe}
              onPreviewAsMe={setPreviewAsMe}
            />

            {isBuiltinCatalogId(current.id) && (
              <p className="text-[10px] text-ink-muted pb-8">
                빌트인 카탈로그는 삭제할 수 없습니다. 코드 기본값:{' '}
                {describeCatalog(getBuiltinCatalog(current.id)!)}
              </p>
            )}
          </>
        )}
      </section>

      {/* 우: 미리보기 전용 열 */}
      {current && (
        <aside className="hidden xl:flex w-[clamp(300px,26vw,440px)] shrink-0 bg-surface border-l border-line p-3 flex-col min-h-0">
          <CatalogPreviewPanel
            maps={preview}
            totalCount={admin.maps.length}
            pinnedMapIds={current.pinnedMapIds ?? []}
            loading={admin.loading}
            error={admin.error}
            previewAsMe={previewAsMe}
            onPreviewAsMe={setPreviewAsMe}
          />
        </aside>
      )}
    </div>
  );
}
