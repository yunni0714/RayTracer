import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import {
  updateMapReactionsInDB,
  updateMapDifficultyVoteInDB,
} from '../lib/firebaseService';
import type { Difficulty } from '../types/game';

const LS_KEY = 'ray_map_states';

interface MapState {
  ok: boolean;
  god: boolean;
  diff: Difficulty | null;
}

function loadMapStates(): Record<string, MapState> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveMapStates(states: Record<string, MapState>): void {
  localStorage.setItem(LS_KEY, JSON.stringify(states));
}

export function getMapState(mapId: string): MapState {
  return loadMapStates()[mapId] ?? { ok: false, god: false, diff: null };
}

export function useMapReactions() {
  const currentLoadedMapObj = useGameStore(s => s.currentLoadedMapObj);
  const currentUserUid = useGameStore(s => s.currentUserUid);
  const showNotification = useGameStore(s => s.showNotification);

  const toggleReaction = useCallback(async (type: 'reactionOk' | 'reactionGod') => {
    if (!currentUserUid) { showNotification('로그인이 필요합니다.', '#e74c3c'); return; }
    if (!currentLoadedMapObj) return;

    const mapId = currentLoadedMapObj.id;
    const states = loadMapStates();
    const state = states[mapId] ?? { ok: false, god: false, diff: null };
    const field = type === 'reactionOk' ? 'ok' : 'god';
    const isOn = state[field];

    state[field] = !isOn;
    states[mapId] = state;
    saveMapStates(states);

    await updateMapReactionsInDB(mapId, type, isOn ? -1 : 1);
  }, [currentLoadedMapObj, currentUserUid, showNotification]);

  const voteDifficulty = useCallback(async (level: Difficulty) => {
    if (!currentUserUid) { showNotification('로그인이 필요합니다.', '#e74c3c'); return; }
    if (!currentLoadedMapObj) return;

    const mapId = currentLoadedMapObj.id;
    const states = loadMapStates();
    const state = states[mapId] ?? { ok: false, god: false, diff: null };
    const oldVote = state.diff;

    if (oldVote === level) {
      state.diff = null;
      states[mapId] = state;
      saveMapStates(states);
      await updateMapDifficultyVoteInDB(mapId, oldVote, null);
    } else {
      state.diff = level;
      states[mapId] = state;
      saveMapStates(states);
      await updateMapDifficultyVoteInDB(mapId, oldVote, level);
    }
  }, [currentLoadedMapObj, currentUserUid, showNotification]);

  return { toggleReaction, voteDifficulty };
}
