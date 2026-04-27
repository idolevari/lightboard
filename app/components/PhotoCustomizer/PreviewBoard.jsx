/**
 * Visual triptych preview of the user's three crops on a stylized board.
 * Pure CSS layout — the "board" is a wood-toned rectangle with three square
 * photo slots evenly spaced.
 *
 * @param {{
 *   photos: Array<{thumbnailUrl: string | null}>,
 *   placeholderLabel: string,    // localized "Your photo here"
 * }}
 */
export function PreviewBoard({photos, placeholderLabel}) {
  return (
    <div className="board-preview" aria-label="Lightboard preview">
      <div className="board-preview__board">
        {photos.map((photo, index) => (
          <div key={index} className="board-preview__slot">
            {photo?.thumbnailUrl ? (
              <img
                src={photo.thumbnailUrl}
                alt=""
                className="board-preview__photo"
              />
            ) : (
              <div className="board-preview__empty">
                <span className="board-preview__empty-num">{index + 1}</span>
                <span className="board-preview__empty-label">
                  {placeholderLabel}
                </span>
              </div>
            )}
          </div>
        ))}
        <div className="board-preview__lights" aria-hidden="true">
          {Array.from({length: 12}).map((_, i) => (
            <span key={i} className="board-preview__light" />
          ))}
        </div>
      </div>
    </div>
  );
}
