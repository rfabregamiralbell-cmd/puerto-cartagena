// ============================================================
// LAYERS PANEL — Toggle map overlays
// ============================================================

import { useGame } from '../../state/GameContext.jsx';
import BottomSheet from '../ui/BottomSheet.jsx';

const LAYERS = [
  { key: 'districts', icon: '🟦', label: 'Distritos', desc: 'Polígonos de los distritos construidos' },
  { key: 'buildings', icon: '📍', label: 'Edificios', desc: 'Marcadores del edificio principal' },
  { key: 'terrainDefense', icon: '🏰', label: 'Defensa del terreno', desc: 'Radio de cobertura de fortalezas' },
  { key: 'tradeRoutes', icon: '⛵', label: 'Rutas comerciales', desc: 'Líneas de comercio naval' },
  { key: 'influence', icon: '✨', label: 'Influencia', desc: 'Halo de alcance de cada distrito (según empleo y nivel)' },
  { key: 'logistics', icon: '🛣️', label: 'Logística', desc: 'Caminos y conexiones entre distritos y el puerto' },
  { key: 'combat', icon: '⚔️', label: 'Combate', desc: '(Próximamente)' },
];

export default function LayersPanel() {
  const { state, dispatch } = useGame();
  return (
    <BottomSheet title="🗺️ Capas del mapa" onClose={() => dispatch({ type: 'CLOSE_SHEET' })}>
      {LAYERS.map((l) => (
        <label key={l.key} className="layer-row">
          <div>
            <div className="layer-name">{l.icon} {l.label}</div>
            <div className="muted small">{l.desc}</div>
          </div>
          <input
            type="checkbox"
            checked={!!state.map.layers[l.key]}
            onChange={() => dispatch({ type: 'TOGGLE_LAYER', layer: l.key })}
          />
        </label>
      ))}
    </BottomSheet>
  );
}
