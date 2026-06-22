// ============================================================
// BOTTOM NAV — Large mobile buttons that open bottom sheets
// ============================================================

import { useGame } from '../../state/GameContext.jsx';

const NAV = [
  { sheet: 'build',    icon: '🏗️', label: 'Construir' },
  { sheet: 'city',     icon: '🏛️', label: 'Ciudad' },
  { sheet: 'port',     icon: '⚓',  label: 'Puerto' },
  { sheet: 'shipyard', icon: '🚢', label: 'Flota' },
  { sheet: 'defense',  icon: '🏰', label: 'Defensa' },
  { sheet: 'layers',   icon: '🗺️', label: 'Capas' },
];

export default function BottomNav() {
  const { state, dispatch } = useGame();
  const active = state.ui.openSheet;

  return (
    <nav className="bottom-nav">
      {NAV.map((n) => (
        <button
          key={n.sheet}
          className={`nav-btn ${active === n.sheet ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'OPEN_SHEET', sheet: active === n.sheet ? null : n.sheet })}
        >
          <span className="nav-icon">{n.icon}</span>
          <span className="nav-label">{n.label}</span>
        </button>
      ))}
    </nav>
  );
}
