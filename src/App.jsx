// ============================================================
// APP — Root layout: map fills screen, HUD top, nav bottom, sheets
// ============================================================

import { useGame } from './state/GameContext.jsx';
import GameMap from './components/map/GameMap.jsx';
import TopHUD from './components/ui/TopHUD.jsx';
import BottomNav from './components/ui/BottomNav.jsx';
import Notifications from './components/ui/Notifications.jsx';
import BuildPanel from './components/panels/BuildPanel.jsx';
import DistrictPanel from './components/panels/DistrictPanel.jsx';
import LayersPanel from './components/panels/LayersPanel.jsx';
import PlacementConfirm from './components/panels/PlacementConfirm.jsx';
import CityPanel from './components/panels/CityPanel.jsx';
import { ShipyardPanel, DefensePanel, PortPanel } from './components/panels/CorePanels.jsx';

export default function App() {
  const { state } = useGame();
  const sheet = state.ui.openSheet;
  const placing = !!state.ui.placementMode;

  return (
    <div className="app-root">
      <div className="map-wrap">
        <GameMap />
      </div>

      <TopHUD />
      <Notifications />

      {/* Placement confirmation floats above the nav while placing */}
      {placing && <PlacementConfirm />}

      {/* Bottom nav hidden while placing to avoid clutter */}
      {!placing && <BottomNav />}

      {/* Sheets */}
      {sheet === 'build' && <BuildPanel />}
      {sheet === 'district' && <DistrictPanel />}
      {sheet === 'city' && <CityPanel />}
      {sheet === 'layers' && <LayersPanel />}
      {sheet === 'shipyard' && <ShipyardPanel />}
      {sheet === 'defense' && <DefensePanel />}
      {sheet === 'port' && <PortPanel />}
    </div>
  );
}
