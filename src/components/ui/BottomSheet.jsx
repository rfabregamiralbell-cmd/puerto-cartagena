// ============================================================
// BOTTOM SHEET — Reusable mobile bottom-sheet container
// ============================================================

export default function BottomSheet({ title, onClose, children, footer }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="bottom-sheet" role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 className="sheet-title">{title}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  );
}
