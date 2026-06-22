// ============================================================
// DISTRICT PANEL — Detail bottom sheet for a selected district
// ============================================================

import { useGame } from '../../state/GameContext.jsx';
import BottomSheet from '../ui/BottomSheet.jsx';
import districtsConfig from '../../config/districts_config.json';

const getType = (id) => districtsConfig.districtTypes.find((t) => t.id === id);

export default function DistrictPanel() {
  const { state, dispatch } = useGame();
  const d = state.districts.find((x) => x.id === state.ui.selectedDistrictId);
  if (!d) return null;
  const type = getType(d.type);

  const canUpgrade = d.level < type.maxLevel;
  const upgradeCost = canUpgrade
    ? Object.fromEntries(Object.entries(type.cost || {}).map(([k, v]) => [k, Math.floor(v * 1.5 * d.level)]))
    : null;
  const canAfford = upgradeCost && Object.entries(upgradeCost).every(([r, v]) => state.resources[r]?.amount >= v);

  const production = type.production
    ? Object.entries(type.production).map(([r, v]) => `${state.resources[r]?.icon || r} +${v * d.level}/${type.productionInterval / 1000}s`).join('  ')
    : '—';

  return (
    <BottomSheet
      title={`${type.emoji} ${d.name}`}
      onClose={() => dispatch({ type: 'CLOSE_SHEET' })}
      footer={
        <>
          <button className="btn danger" onClick={() => dispatch({ type: 'DEMOLISH_DISTRICT', id: d.id })}>Demoler</button>
          {canUpgrade && (
            <button className="btn primary" disabled={!canAfford} onClick={() => dispatch({ type: 'UPGRADE_DISTRICT', id: d.id })}>
              Mejorar a Nv{d.level + 1}
            </button>
          )}
        </>
      }
    >
      <div className="row"><span className="muted">Nivel</span><span>{d.level} / {type.maxLevel}</span></div>
      <div className="row"><span className="muted">Estado</span><span>{d.status}</span></div>
      <div className="row"><span className="muted">Área</span><span>{d.areaM2.toLocaleString()} m²</span></div>
      <div className="row"><span className="muted">Trabajadores</span><span>{d.assignedWorkers}/{d.workersRequired}</span></div>
      <div className="row"><span className="muted">Producción</span><span className="good">{production}</span></div>
      {d.type === 'fortaleza' && d.defensiveValue != null && (
        <>
          <div className="row"><span className="muted">Valor defensivo</span><span className="good">{d.defensiveValue}/100</span></div>
          <div className="row"><span className="muted">Radio de cobertura</span><span>{d.coverageRadiusM} m</span></div>
        </>
      )}
      <p className="muted small" style={{ marginTop: 10 }}>{type.description}</p>
      {canUpgrade && (
        <div className="cost-line">
          Mejora: {Object.entries(upgradeCost).map(([r, v]) => (
            <span key={r} className={state.resources[r]?.amount >= v ? '' : 'cant'}>{state.resources[r]?.icon || r}{v} </span>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
