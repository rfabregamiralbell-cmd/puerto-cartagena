// ============================================================
// SHIPYARD / DEFENSE / PORT panels
// ============================================================

import { useGame } from '../../state/GameContext.jsx';
import BottomSheet from '../ui/BottomSheet.jsx';
import shipsConfig from '../../config/ships_config.json';
import routesConfig from '../../config/trade_routes_config.json';

export function ShipyardPanel() {
  const { state, dispatch } = useGame();
  const hasPuerto = state.districts.some((d) => d.type === 'puerto');
  const canAfford = (cost) => Object.entries(cost).every(([r, v]) => state.resources[r]?.amount >= v);
  const fleet = state.ships.filter((s) => s.status !== 'sunk');

  return (
    <BottomSheet title="🚢 Astillero y Flota" onClose={() => dispatch({ type: 'CLOSE_SHEET' })}>
      {!hasPuerto && <p className="muted small">Construye un Puerto junto a la costa para botar barcos.</p>}
      <div className="section-label">Construir barco</div>
      <div className="card-grid">
        {shipsConfig.ships.map((sc) => {
          const disabled = !hasPuerto || !canAfford(sc.cost);
          return (
            <button key={sc.id} className={`build-card ${disabled ? 'locked' : ''}`} disabled={disabled}
              onClick={() => dispatch({ type: 'BUILD_SHIP', shipConfigId: sc.id })}>
              <div className="bc-emoji">{sc.emoji}</div>
              <div className="bc-name">{sc.name}</div>
              <div className="bc-cost">
                {Object.entries(sc.cost).map(([r, v]) => (
                  <span key={r} className={canAfford({ [r]: v }) ? '' : 'cant'}>{state.resources[r]?.icon || r}{v}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <div className="section-label" style={{ marginTop: 16 }}>Tu flota ({fleet.length})</div>
      {fleet.length === 0 ? <p className="muted small">Sin barcos aún.</p> :
        fleet.map((s) => (
          <div className="row" key={s.id}>
            <span>{s.emoji} {s.name}</span>
            <span className="muted">{s.status}</span>
          </div>
        ))}
    </BottomSheet>
  );
}

export function DefensePanel() {
  const { state, dispatch } = useGame();
  const d = state.defense;
  const cls = d.defenseScore > 50 ? 'good' : d.defenseScore > 25 ? 'warn' : 'bad';
  return (
    <BottomSheet title="🏰 Defensa del puerto" onClose={() => dispatch({ type: 'CLOSE_SHEET' })}>
      <div className="row"><span className="muted">Defensa total</span><span className={cls}>{d.defenseScore}/100</span></div>
      <div className="bar"><div className={`bar-fill ${cls}`} style={{ width: `${d.defenseScore}%` }} /></div>
      <div className="row"><span className="muted">🎯 Artillería</span><span>{d.artilleryPower}</span></div>
      <div className="row"><span className="muted">⛵ Patrulla naval</span><span>{d.navalPatrolStrength}</span></div>
      <div className="row"><span className="muted">📦 Suministros</span><span>{d.supplyReadiness}</span></div>
      <div className="row"><span className="muted">🔭 Cobertura costera</span><span>{d.coastalCoverage} m</span></div>
      <div className="row"><span className="muted">Riesgo de raid</span><span>{d.raidRisk}</span></div>
      <div className="row"><span className="muted">Riesgo de bloqueo</span><span>{d.blockadeRisk}</span></div>
      <p className="muted small" style={{ marginTop: 10 }}>
        Coloca una Fortaleza en terreno elevado o costero (capa "Defensa del terreno") para ampliar la cobertura.
      </p>
    </BottomSheet>
  );
}

export function PortPanel() {
  const { state, dispatch } = useGame();
  const hasPuerto = state.districts.some((d) => d.type === 'puerto');
  return (
    <BottomSheet title={`⚓ Puerto · Ciudad Nv${state.port.level}`} onClose={() => dispatch({ type: 'CLOSE_SHEET' })}
      footer={<button className="btn ghost" onClick={() => dispatch({ type: 'TOGGLE_LAYER', layer: 'tradeRoutes' })}>
        {state.map.layers.tradeRoutes ? 'Ocultar rutas' : 'Ver rutas en el mapa'}
      </button>}>
      {!hasPuerto && <p className="muted small">Necesitas un Puerto para activar rutas comerciales.</p>}
      <div className="section-label">Rutas comerciales</div>
      {routesConfig.routes.map((r) => {
        const locked = state.port.level < r.requiredPortLevel;
        return (
          <div className="row" key={r.id}>
            <div>
              <div>{r.name}</div>
              <div className="muted small">{locked ? `🔒 Ciudad Nv${r.requiredPortLevel}` : `Riesgo ${r.riskLevel} · ${r.distance}km`}</div>
            </div>
            <span className="good">+{r.profitBase}🪙</span>
          </div>
        );
      })}
    </BottomSheet>
  );
}
