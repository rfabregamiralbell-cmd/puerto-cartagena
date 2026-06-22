// ============================================================
// GAME MAP — Real Leaflet map of Cartagena with game layers on top
// ============================================================

import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useGame } from '../../state/GameContext.jsx';
import mapConfig from '../../config/map_config.json';
import districtsConfig from '../../config/districts_config.json';
import routesConfig from '../../config/trade_routes_config.json';
import { polygonToLatLngs } from '../../utils/geoUtils.js';
import { buildLinkGraph } from '../../engines/trade/logisticsEngine.js';

const getType = (id) => districtsConfig.districtTypes.find((t) => t.id === id);

// Emoji divIcon for district main buildings. `ready` adds a pulse badge
// when the district has goods waiting to be collected.
function emojiIcon(emoji, selected, ready) {
  return L.divIcon({
    className: 'district-emoji-icon',
    html: `<div class="emoji-marker ${selected ? 'selected' : ''}">${emoji}${ready ? '<span class="ready-badge">📦</span>' : ''}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// Captures map clicks for placement + preview on mouse move
function PlacementHandler() {
  const { state, dispatch } = useGame();
  useMapEvents({
    click(e) {
      if (!state.ui.placementMode) return;
      const point = [e.latlng.lat, e.latlng.lng];
      dispatch({ type: 'PREVIEW_PLACEMENT', point });
    },
  });
  return null;
}

export default function GameMap() {
  const { state, dispatch } = useGame();
  const { layers } = state.map;

  return (
    <MapContainer
      center={mapConfig.center}
      zoom={mapConfig.defaultZoom}
      minZoom={mapConfig.minZoom}
      maxZoom={mapConfig.maxZoom}
      zoomControl={false}
      attributionControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer url={mapConfig.tileLayer.url} />

      <PlacementHandler />

      {/* ── Logistics layer: road links between nearby districts ── */}
      {layers.logistics && (() => {
        const graph = buildLinkGraph(state.districts);
        const byId = new Map(state.districts.map((d) => [d.id, d]));
        const drawn = new Set();
        const lines = [];
        state.districts.forEach((d) => {
          (graph.get(d.id) || new Set()).forEach((nid) => {
            const key = [d.id, nid].sort().join('|');
            if (drawn.has(key)) return;
            drawn.add(key);
            const n = byId.get(nid);
            if (!n) return;
            // Highlight links that involve a road (camino) — those carry goods
            const isRoad = d.type === 'camino' || n.type === 'camino' || d.type === 'puerto' || n.type === 'puerto';
            lines.push(
              <Polyline
                key={`lk_${key}`}
                positions={[d.mainBuildingPoint, n.mainBuildingPoint]}
                pathOptions={{
                  color: isRoad ? '#c9a227' : '#888',
                  weight: isRoad ? 3 : 1.5,
                  opacity: isRoad ? 0.8 : 0.4,
                  dashArray: isRoad ? null : '4 6',
                }}
              />
            );
          });
        });
        return lines;
      })()}

      {/* ── District polygons ── */}
      {layers.districts && state.districts.map((d) => {
        const type = getType(d.type);
        const selected = state.ui.selectedDistrictId === d.id;
        return (
          <Polygon
            key={d.id}
            positions={polygonToLatLngs(d.polygon)}
            pathOptions={{
              color: selected ? '#f4c430' : (type?.color || '#888'),
              weight: selected ? 3 : 2,
              fillColor: type?.color || '#888',
              fillOpacity: selected ? 0.45 : 0.3,
            }}
            eventHandlers={{ click: () => dispatch({ type: 'SELECT_DISTRICT', id: d.id }) }}
          />
        );
      })}

      {/* ── Terrain defense layer: Fortaleza coverage ── */}
      {layers.terrainDefense && state.districts.filter((d) => d.type === 'fortaleza').map((d) => (
        <Circle
          key={`cov_${d.id}`}
          center={d.mainBuildingPoint}
          radius={d.coverageRadiusM || 400}
          pathOptions={{ color: '#27ae60', weight: 1, fillColor: '#27ae60', fillOpacity: 0.12, dashArray: '6 6' }}
        />
      ))}

      {/* ── Building markers ── */}
      {layers.buildings && state.districts.map((d) => {
        const type = getType(d.type);
        const selected = state.ui.selectedDistrictId === d.id;
        const ready = d.buffer && Object.values(d.buffer).some((v) => v > 0);
        return (
          <Marker
            key={`m_${d.id}`}
            position={d.mainBuildingPoint}
            icon={emojiIcon(type?.emoji || '🏠', selected, ready)}
            eventHandlers={{ click: () => dispatch({ type: 'SELECT_DISTRICT', id: d.id }) }}
          />
        );
      })}

      {/* ── Trade route layer ── */}
      {layers.tradeRoutes && routesConfig.routes.map((r) => {
        const dest = r.destinationCoords;
        if (!dest) return null;
        // destinationCoords are normalized 0-1 in old config; here we fan out around Cartagena
        const destLatLng = [
          mapConfig.center[0] + (0.5 - dest.y) * 0.6,
          mapConfig.center[1] + (dest.x - 0.5) * 0.6,
        ];
        const locked = state.port.level < r.requiredPortLevel;
        return (
          <Polyline
            key={`r_${r.id}`}
            positions={[mapConfig.portStart, destLatLng]}
            pathOptions={{
              color: locked ? '#666' : (r.color || '#27ae60'),
              weight: 2, opacity: locked ? 0.3 : 0.7, dashArray: '8 6',
            }}
          />
        );
      })}

      {/* ── Placement preview ── */}
      {state.ui.placementPreview && (
        <>
          <Polygon
            positions={polygonToLatLngs(state.ui.placementPreview.polygon)}
            pathOptions={{
              color: state.ui.placementPreview.valid ? '#27ae60' : '#e74c3c',
              weight: 2,
              fillColor: state.ui.placementPreview.valid ? '#27ae60' : '#e74c3c',
              fillOpacity: 0.35,
              dashArray: '5 5',
            }}
          />
          <Marker
            position={state.ui.placementPreview.point}
            icon={emojiIcon(getType(state.ui.placementMode?.typeId)?.emoji || '📍', false)}
          />
        </>
      )}
    </MapContainer>
  );
}
