// ============================================================
// PLACEMENT CONFIRM — Bottom sheet shown while previewing a district
// ============================================================

import { useGame } from '../../state/GameContext.jsx';
import districtsConfig from '../../config/districts_config.json';
import { TerrainDefenseEngine } from '../../engines/defense/terrainDefenseEngine.js';

const getType = (id) => districtsConfig.districtTypes.find((t) => t.id === id);

export default function PlacementConfirm() {
  const { state, dispatch } = useGame();
  const mode = state.ui.placementMode;
  const preview = state.ui.placementPreview;
  if (!mode) return null;

  const type = getType(mode.typeId);

  return (
    <div className="placement-bar">
      <div className="pb-head">
        <span className="pb-title">{type.emoji} Colocar {type.name}</span>
        <button className="pb-cancel" onClick={() => dispatch({ type: 'CANCEL_PLACEMENT' })}>Cancelar</button>
      </div>

      {!preview && (
        <p className="muted small">Toca el mapa donde quieras situar el distrito.</p>
      )}

      {preview && (
        <>
          <div className="pb-row">
            <span className="muted">Terreno</span>
            <span>{preview.terrain}</span>
          </div>
          <div className="pb-row">
            <span className="muted">Área</span>
            <span>{preview.area.toLocaleString()} m²</span>
          </div>

          {preview.defenseEval && (
            <div className="pb-defense">
              {(() => {
                const v = TerrainDefenseEngine.verdict(preview.defenseEval.defensiveValue);
                return (
                  <div className="pb-verdict" style={{ color: v.color }}>
                    {v.label} · {preview.defenseEval.defensiveValue}/100
                  </div>
                );
              })()}
              <div className="pb-defense-bars">
                <Bar label="Elevación" v={preview.defenseEval.elevationScore} />
                <Bar label="Visión" v={preview.defenseEval.lineOfSight} />
                <Bar label="Costa" v={preview.defenseEval.coastalCoverage} />
                <Bar label="Paso" v={preview.defenseEval.chokepointValue} />
              </div>
            </div>
          )}

          {!preview.valid && (
            <ul className="pb-errors">
              {preview.errors.map((e, i) => <li key={i}>⚠️ {e}</li>)}
            </ul>
          )}

          <button
            className={`pb-confirm ${preview.valid ? '' : 'disabled'}`}
            disabled={!preview.valid}
            onClick={() => dispatch({ type: 'CONFIRM_PLACEMENT' })}
          >
            {preview.valid ? `Confirmar construcción` : 'Posición no válida'}
          </button>
        </>
      )}
    </div>
  );
}

function Bar({ label, v }) {
  return (
    <div className="pb-bar">
      <span className="pb-bar-label">{label}</span>
      <div className="pb-bar-track"><div className="pb-bar-fill" style={{ width: `${v * 100}%` }} /></div>
    </div>
  );
}
