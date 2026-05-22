import { useState, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
  const {
    currentLoadedMapObj, currentUserUid, showNotification,
    setCurrentMapReactions,
  } = useGameStore(useShallow(s => ({
    currentLoadedMapObj: s.currentLoadedMapObj,
    currentUserUid: s.currentUserUid,
    showNotification: s.showNotification,
    setCurrentMapReactions: s.setCurrentMapReactions,
  })));

  const [localState, setLocalState] = useState<MapState>({ ok: false, god: false, diff: null });

  useEffect(() => {
    if (currentLoadedMapObj) {
      setLocalState(getMapState(currentLoadedMapObj.id));
    } else {
      setLocalState({ ok: false, god: false, diff: null });
    }
  }, [currentLoadedMapObj?.id]);

  const toggleReaction = useCallback(async (type: 'reactionOk' | 'reactionGod') => {
    if (!currentUserUid) { showNotification('로그인이 필요합니다.', '#e74c3c'); return; }
    if (!currentLoadedMapObj) return;

    const mapId = currentLoadedMapObj.id;
    const states = loadMapStates();
    const state = states[mapId] ?? { ok: false, god: false, diff: null };
    const field = type === 'reactionOk' ? 'ok' : 'god';
    const isOn = state[field];

    const newState = { ...state, [field]: !isOn };
    states[mapId] = newState;
    saveMapStates(states);
    setLocalState(newState);

    // 스토어 카운트 낙관적 업데이트 (stale closure 방지를 위해 getState() 사용)
    const current = useGameStore.getState().currentMapReactions;
    const delta = isOn ? -1 : 1;
    setCurrentMapReactions({
      ok: current.ok + (type === 'reactionOk' ? delta : 0),
      god: current.god + (type === 'reactionGod' ? delta : 0),
    });

    await updateMapReactionsInDB(mapId, type, isOn ? -1 : 1);
  }, [currentLoadedMapObj, currentUserUid, showNotification, setCurrentMapReactions]);

  const voteDifficulty = useCallback(async (level: Difficulty) => {
    if (!currentUserUid) { showNotification('로그인이 필요합니다.', '#e74c3c'); return; }
    if (!currentLoadedMapObj) return;

    const mapId = currentLoadedMapObj.id;
    const states = loadMapStates();
    const state = states[mapId] ?? { ok: false, god: false, diff: null };
    const oldVote = state.diff;
    const newDiff = oldVote === level ? null : level;

    const newState = { ...state, diff: newDiff };
    states[mapId] = newState;
    saveMapStates(states);
    setLocalState(newState);

    await updateMapDifficultyVoteInDB(mapId, oldVote, newDiff);
    showNotification(newDiff ? '체감 난이도 투표가 완료되었습니다!' : '투표가 취소되었습니다.');
  }, [currentLoadedMapObj, currentUserUid, showNotification]);

  return { toggleReaction, voteDifficulty, localState };
}
