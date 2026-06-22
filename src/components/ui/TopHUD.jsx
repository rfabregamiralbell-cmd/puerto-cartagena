// ============================================================
// TOP HUD — Resources + city level (mobile-first)
// ============================================================

import { useState } from 'react';
import { useGame } from '../../state/GameContext.jsx';

export default function TopHUD() {
  const { state } = useGame();
  const [expanded, setExpanded] = useState(false);
  const res = state.resources;

  const primary = ['oro', 'madera'];
  const secondary = ['piedra', 'velas', 'canones', 'polvora', 'tripulacion'];
  const shown = expanded ? [...primary, ...secondary] : primary;

  const xpPct = Math.min((state.port.xp / state.port.xpToNextLevel) * 100, 100);

  return (
    <div className="top-hud">
      <div className="hud-city" title="Nivel de ciudad (Cabildo)">
        <span className="hud-city-level">🏛️ Nv{state.port.level}</span>
        <div className="hud-xp"><div className="hud-xp-fill" style={{ width: `${xpPct}%` }} /></div>
      </div>

      <div className="hud-resources" onClick={() => setExpanded((v) => !v)}>
        {shown.map((key) => {
          const r = res[key];
          const low = r.amount / r.max < 0.2;
          return (
            <div className="hud-res" key={key} title={`${r.label}: ${Math.floor(r.amount)}/${r.max}`}>
              <span>{r.icon}</span>
              <span className={low ? 'low' : ''}>{Math.floor(r.amount)}</span>
            </div>
          );
        })}
        <span className="hud-toggle">{expanded ? '▲' : '▼'}</span>
      </div>
    </div>
  );
}
