// ============================================================
// BUILD PANEL — Choose a district type, then place it on the map
// ============================================================

import { useGame } from '../../state/GameContext.jsx';
import BottomSheet from '../ui/BottomSheet.jsx';
import districtsConfig from '../../config/districts_config.json';

const TERRAIN_LABEL = {
  land: 'Tierra', coast: 'Costa', coast_near: 'Cerca de costa',
  land_open: 'Tierra abierta', defensive: 'Posición defensiva', water: 'Agua',
};

export default function BuildPanel() {
  const { state, dispatch } = useGame();
  const cab = state.districts.filter((d) => d.type === 'cabildo');
  const cabLevel = cab.length ? Math.max(...cab.map((d) => d.level)) : 0;

  const canAfford = (cost) =>
    Object.entries(cost || {}).every(([r, v]) => (state.resources[r]?.amount ?? 0) >= v);

  return (
    <BottomSheet title="🏗️ Construir distrito" onClose={() => dispatch({ type: 'CLOSE_SHEET' })}>
      <p className="muted small">Elige un distrito y luego toca el mapa para colocarlo.</p>
      <div className="card-grid">
        {districtsConfig.districtTypes.map((t) => {
          const built = t.unique && state.districts.some((d) => d.type === t.id);
          const cabReq = t.requiredCabildoLevel ? cabLevel < t.requiredCabildoLevel : false;
          const locked = built || cabReq || !t.unlocked && cabReq;
          const disabled = built || cabReq;
          let reason = '';
          if (built) reason = 'Ya construido';
          else if (cabReq) reason = `Cabildo Nv${t.requiredCabildoLevel}`;

          return (
            <button
              key={t.id}
              className={`build-card ${disabled ? 'locked' : ''}`}
              disabled={disabled}
              onClick={() => dispatch({ type: 'START_PLACEMENT', typeId: t.id })}
            >
              {disabled && <span className="lock">🔒</span>}
              <div className="bc-emoji">{t.emoji}</div>
              <div className="bc-name">{t.name}</div>
              <div className="bc-terrain">{disabled ? reason : TERRAIN_LABEL[t.terrain]}</div>
              <div className="bc-cost">
                {Object.entries(t.cost || {}).map(([r, v]) => (
                  <span key={r} className={canAfford({ [r]: v }) ? '' : 'cant'}>
                    {state.resources[r]?.icon || r}{v}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
