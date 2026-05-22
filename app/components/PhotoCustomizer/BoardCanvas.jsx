import {useRef} from 'react';

const BOARD_IMAGE_URL =
  'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/lightboard-canvas-empty-v2.png?v=1779485082';

// Percentages of the board image at which the three white photo slots sit.
// Measured against the 1024x1024 source on Shopify Files; positions scale with
// the rendered image, so the overlays stay aligned at any size.
const SLOT_RECTS = [
  {left: 24.609, top: 42.676, width: 16.016, height: 15.039},
  {left: 44.141, top: 42.969, width: 15.723, height: 14.648},
  {left: 63.086, top: 43.066, width: 15.918, height: 14.355},
];

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * Interactive surfboard preview. Renders the empty Lightboard photo and
 * overlays three clickable slots at the exact pixel positions of the white
 * photo placeholders on the board.
 *
 * Each slot behaves like the old PhotoSlot: empty -> opens the file picker;
 * filled -> shows the user's cropped photo with small edit/remove controls.
 *
 * @param {{
 *   slots: Array<{thumbnailUrl: string | null, error: string | null}>,
 *   slotLabel: (n: number) => string,
 *   pickLabel: string,
 *   editLabel: string,
 *   removeLabel: string,
 *   disabled?: boolean,
 *   onFilePicked: (index: number, file: File) => void,
 *   onEditCrop: (index: number) => void,
 *   onRemove: (index: number) => void,
 * }}
 */
export function BoardCanvas({
  slots,
  slotLabel,
  pickLabel,
  editLabel,
  removeLabel,
  disabled = false,
  onFilePicked,
  onEditCrop,
  onRemove,
}) {
  return (
    <div className="board-canvas" role="group" aria-label={slotLabel(0)}>
      <img
        src={`${BOARD_IMAGE_URL}&width=1200`}
        srcSet={[600, 900, 1200, 1600]
          .map((w) => `${BOARD_IMAGE_URL}&width=${w} ${w}w`)
          .join(', ')}
        sizes="(min-width: 45em) 50vw, 100vw"
        alt=""
        className="board-canvas__bg"
        draggable={false}
      />
      {SLOT_RECTS.map((rect, i) => (
        <BoardSlot
          key={i}
          index={i}
          rect={rect}
          slot={slots[i]}
          label={slotLabel(i + 1)}
          pickLabel={pickLabel}
          editLabel={editLabel}
          removeLabel={removeLabel}
          disabled={disabled}
          onFilePicked={(file) => onFilePicked(i, file)}
          onEditCrop={() => onEditCrop(i)}
          onRemove={() => onRemove(i)}
        />
      ))}
    </div>
  );
}

function BoardSlot({
  index,
  rect,
  slot,
  label,
  pickLabel,
  editLabel,
  removeLabel,
  disabled,
  onFilePicked,
  onEditCrop,
  onRemove,
}) {
  const inputRef = useRef(null);
  const filled = !!slot?.thumbnailUrl;

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) onFilePicked(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFilePicked(file);
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  const style = {
    left: `${rect.left}%`,
    top: `${rect.top}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
  };

  return (
    <div
      className={`board-canvas__slot ${filled ? 'is-filled' : 'is-empty'}`}
      style={style}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {filled ? (
        <>
          <img
            src={slot.thumbnailUrl}
            alt={label}
            className="board-canvas__photo"
            draggable={false}
          />
          <div className="board-canvas__overlay">
            <button
              type="button"
              className="board-canvas__icon-btn"
              onClick={onEditCrop}
              disabled={disabled}
              aria-label={editLabel}
              title={editLabel}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className="board-canvas__icon-btn board-canvas__icon-btn--danger"
              onClick={onRemove}
              disabled={disabled}
              aria-label={removeLabel}
              title={removeLabel}
            >
              <CloseIcon />
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="board-canvas__pick"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          aria-label={`${label} — ${pickLabel}`}
        >
          <span className="board-canvas__num">{index + 1}</span>
          <span className="board-canvas__plus" aria-hidden="true">
            +
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="board-canvas__file-input"
        onChange={handleFileChange}
        disabled={disabled}
        tabIndex={-1}
      />
      {slot?.error ? (
        <p className="board-canvas__error" role="alert">
          {slot.error}
        </p>
      ) : null}
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11.2 2.3l2.5 2.5L5.4 13.1l-3 .5.5-3L11.2 2.3z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 3l10 10M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
