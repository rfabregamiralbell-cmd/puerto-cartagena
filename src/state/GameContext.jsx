// ============================================================
// GAME CONTEXT (React)
// Provides state + dispatch, runs the economy tick, save/load.
// ============================================================

import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { gameReducer } from './gameReducer.js';
import { createInitialState } from './initialState.js';

const SAVE_KEY = 'cartagena_react_save_v1';

const GameContext = createContext(null);

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () => loadSaved() || createInitialState()
  );

  // Economy tick — 1s
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-save every 15s
  useEffect(() => {
    const id = setInterval(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(stateRef.current)); } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const save = useCallback(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(stateRef.current));
      dispatch({ type: 'OPEN_SHEET', sheet: stateRef.current.ui.openSheet }); // no-op to trigger
      return true;
    } catch { return false; }
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(SAVE_KEY);
    dispatch({ type: 'LOAD_STATE', state: createInitialState() });
  }, []);

  return (
    <GameContext.Provider value={{ state, dispatch, save, reset }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
