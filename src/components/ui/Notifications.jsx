// ============================================================
// NOTIFICATIONS — Toast stack
// ============================================================

import { useGame } from '../../state/GameContext.jsx';

export default function Notifications() {
  const { state, dispatch } = useGame();
  return (
    <div className="notif-area">
      {state.notifications.map((n) => (
        <div
          key={n.id}
          className={`notif ${n.type || 'info'}`}
          onClick={() => dispatch({ type: 'DISMISS_NOTIFICATION', id: n.id })}
        >
          {n.message}
        </div>
      ))}
    </div>
  );
}
