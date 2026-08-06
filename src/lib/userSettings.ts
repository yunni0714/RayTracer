// 계정 설정(시각 옵션 등) 오버레이.
//
// pieceConfig.ts / catalogConfig.ts 와 같은 모델을 따른다:
//   순수 검증 + 손상 입력 silent fallback + **절대 throw 하지 않는다**.
// 설정은 UI 취향일 뿐이라 값이 깨졌다고 앱이 멈추면 안 된다.
//
// 저장 위치는 두 곳:
//   Firestore users/{uid}.settings — 계정 정본 (기기 간 동기화)
//   localStorage 'ray-settings'    — 비로그인 대비 + 부팅 시 깜빡임 방지 캐시

export interface UserSettings {
  /** 맵 카드를 카테고리 파스텔 색으로 칠한다 (호버 글로우 → 카드 표면 틴트) */
  pastelCards: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  pastelCards: false,
};

export const SETTINGS_STORAGE_KEY = 'ray-settings';

/** 알 수 없는 값/키는 버리고 기본값으로 메운다. 어떤 입력에도 throw 하지 않는다. */
export function sanitizeSettings(raw: unknown): UserSettings {
  const out: UserSettings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  const src = raw as Record<string, unknown>;
  if (typeof src.pastelCards === 'boolean') out.pastelCards = src.pastelCards;

  return out;
}

export function loadLocalSettings(): UserSettings {
  try {
    const rawText = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawText) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(rawText));
  } catch {
    // 비공개 모드 / 손상된 JSON — 기본값으로 조용히 폴백
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveLocalSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch { /* localStorage 접근 실패 무시 */ }
}
