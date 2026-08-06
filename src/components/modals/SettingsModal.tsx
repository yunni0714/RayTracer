import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { updateUserSettings } from '../../lib/firebaseService';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../lib/mapCategory';
import { Modal, Button, Tabs, Toggle } from '../ui';
import type { UserSettings } from '../../lib/userSettings';

// 섹션 헤더 — docs/DESIGN.md 의 h5 규칙 (11px/800/uppercase/tracking/muted)
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-ink-muted">
      {children}
    </h5>
  );
}

export function SettingsModal() {
  const {
    theme, setTheme, settings, setSetting, currentUserUid, closeModal,
  } = useGameStore(useShallow(s => ({
    theme: s.theme,
    setTheme: s.setTheme,
    settings: s.settings,
    setSetting: s.setSetting,
    currentUserUid: s.currentUserUid,
    closeModal: s.closeModal,
  })));

  // 스토어(로컬)에 먼저 반영하고 계정 정본을 뒤따라 저장한다.
  // 저장 실패는 조용히 무시 — 로컬 값은 이미 적용됐고 설정은 취향일 뿐이다.
  function changeSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSetting(key, value);
    if (currentUserUid) {
      const next = { ...useGameStore.getState().settings };
      updateUserSettings(currentUserUid, next).catch(() => { /* 오프라인/권한 실패 무시 */ });
    }
  }

  return (
    <Modal
      title="⚙️ 계정 설정"
      onClose={closeModal}
      width="md"
      footer={<Button variant="primary" onClick={closeModal}>닫기</Button>}
    >
      <div className="flex flex-col gap-5">
        {/* ── 표시 ── */}
        <section className="flex flex-col gap-3">
          <SectionHeader>표시</SectionHeader>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">테마</span>
            <Tabs
              variant="segment"
              items={[
                { id: 'light', label: '☀️ 라이트' },
                { id: 'dark', label: '🌙 다크' },
              ]}
              value={theme}
              onChange={(id) => setTheme(id === 'dark' ? 'dark' : 'light')}
            />
          </div>

          <div className="border-t border-line pt-3 flex flex-col gap-3">
            <Toggle
              checked={settings.pastelCards}
              onChange={(v) => changeSetting('pastelCards', v)}
              label="파스텔 맵 카드"
              description="맵 카드를 카테고리 색으로 은은하게 칠합니다. 끄면 호버할 때만 카드 뒤에 색이 번집니다."
            />

            {/* 미리보기 — 카드와 같은 CSS 규칙을 타므로 토글 즉시 반영된다 */}
            <div className="flex gap-2" aria-hidden>
              {CATEGORY_ORDER.map(cat => (
                <div key={cat} className="cat-swatch" data-category={cat}>
                  {CATEGORY_LABELS[cat]}
                </div>
              ))}
            </div>
          </div>
        </section>

        {!currentUserUid && (
          <p className="text-xs text-ink-muted border-t border-line pt-3">
            로그인하지 않아 이 기기에만 저장됩니다. 로그인하면 계정에 저장되어 다른 기기에서도 따라옵니다.
          </p>
        )}
      </div>
    </Modal>
  );
}
