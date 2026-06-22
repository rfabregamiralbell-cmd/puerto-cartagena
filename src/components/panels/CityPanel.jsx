// ============================================================
// CITY PANEL — Full city status at a glance (bottom sheet)
// ============================================================

import { useGame } from '../../state/GameContext.jsx';
import BottomSheet from '../ui/BottomSheet.jsx';
import districtsConfig from '../../config/districts_config.json';
import { isConnectedToPort, adjacencySynergy } from '../../engines/trade/logisticsEngine.js';

const getType = (id) => districtsConfig.districtTypes.find((t) => t.id === id);

export default function CityPanel() {
  const { state, dispatch } = useGame();
  const { districts, resources, port, defense } = state;

  // Population / workforce
  const cab = districts.filter((d) => d.type === 'cabildo');
  const cabLevel = cab.length ? Math.max(...cab.map((d) => d.level)) : 0;
  const totalWorkers = 10 + cabLevel * 8;
  const assignedWorkers = districts.reduce((s, d) => s + (d.assignedWorkers || 0), 0);
  const freeWorkers = Math.max(0, totalWorkers - assignedWorkers);

  // Net production per minute (only what is being produced, pre-collection)
  const perMin = {};
  districts.forEach((d) => {
    const type = getType(d.type);
    if (!type?.production || !type.productionInterval) return;
    const staffing = type.workersRequired ? Math.min((d.assignedWorkers || 0) / type.workersRequired, 1) : 1;
    const synergy = adjacencySynergy(d, districts);
    const perTick = 60000 / type.productionInterval;
    Object.entries(type.production).forEach(([r, v]) => {
      perMin[r] = (perMin[r] || 0) + Math.round(v * d.level * staffing * synergy * perTick);
    });
  });

  // District census
  const census = {};
  districts.forEach((d) => { census[d.type] = (census[d.type] || 0) + 1; });

  // Warnings
  const warnings = [];
  districts.forEach((d) => {
    const type = getType(d.type);
    if (type?.workersRequired && (d.assignedWorkers || 0) < type.workersRequired) {
      warnings.push(`${type.emoji} ${d.name}: falta personal (${d.assignedWorkers}/${type.workersRequired}).`);
    }
    if (type?.production && !isConnectedToPort(d, districts)) {
      warnings.push(`${type.emoji} ${d.name}: sin camino al Puerto, no exporta.`);
    }
  });

  // Storage usage (only resources near their cap)
  const nearlyFull = Object.entries(resources)
    .filter(([, r]) => r.max > 0 && r.amount / r.max >= 0.85)
    .map(([k, r]) => `${r.icon} ${r.label} ${Math.floor(r.amount)}/${r.max}`);

  const workerPct = Math.round((assignedWorkers / totalWorkers) * 100);

  return (
    <BottomSheet title="🏛️ Estado de la ciudad" onClose={() => dispatch({ type: 'CLOSE_SHEET' })}>
      <div className="section-label">Resumen</div>
      <div className="row"><span className="muted">Nivel de ciudad</span><span className="good">Nv {port.level}</span></div>
      <div className="row"><span className="muted">Distritos</span><span>{districts.length}</span></div>
      <div className="row"><span className="muted">Defensa</span><span className={defense.defenseScore > 50 ? 'good' : defense.defenseScore > 25 ? 'warn' : 'bad'}>{defense.defenseScore}/100</span></div>

      <div className="section-label" style={{ marginTop: 12 }}>Población</div>
      <div className="row"><span className="muted">Trabajadores</span><span className={freeWorkers === 0 && assignedWorkers > 0 ? 'warn' : ''}>{assignedWorkers} / {totalWorkers} ({workerPct}%)</span></div>
      <div className="bar"><div className={`bar-fill ${workerPct >= 95 ? 'warn' : 'good'}`} style={{ width: `${workerPct}%` }} /></div>
      <div className="row"><span className="muted">Disponibles</span><span className={freeWorkers === 0 ? 'bad' : 'good'}>{freeWorkers}</span></div>

      <div className="section-label" style={{ marginTop: 12 }}>Producción / min</div>
      {Object.keys(perMin).length === 0
        ? <p className="muted small">Sin producción activa. Construye Haciendas, Gremios o Arsenales.</p>
        : Object.entries(perMin).map(([r, v]) => (
            <div className="row" key={r}><span className="muted">{resources[r]?.icon} {resources[r]?.label}</span><span className="good">+{v}/min</span></div>
          ))}

      <div className="section-label" style={{ marginTop: 12 }}>Distritos por tipo</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {Object.entries(census).map(([t, n]) => (
          <span key={t} className="cost-tag" style={{ fontSize: 12 }}>{getType(t)?.emoji} {getType(t)?.name} ×{n}</span>
        ))}
      </div>

      {nearlyFull.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 12 }}>Almacenes casi llenos</div>
          {nearlyFull.map((t, i) => <div className="row" key={i}><span className="warn small">{t}</span></div>)}
        </>
      )}

      <div className="section-label" style={{ marginTop: 12 }}>Avisos {warnings.length > 0 ? `(${warnings.length})` : ''}</div>
      {warnings.length === 0
        ? <p className="good small">Todo en orden. ✓</p>
        : warnings.map((w, i) => <p key={i} className="small" style={{ color: '#ffd080', padding: '3px 0' }}>⚠️ {w}</p>)}
    </BottomSheet>
  );
}
