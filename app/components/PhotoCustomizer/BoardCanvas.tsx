import {useRef} from 'react';
import type {ChangeEvent, DragEvent} from 'react';

type SlotRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

// The three white photo-slot positions per Color variant, as percentages of
// the variant's board image. Measured against the 920×920 sources uploaded to
// Shopify Files and bound to each variant's `image` field in Admin. Slots stay
// aligned at any rendered size because they're stored as percentages.
//
// IMPORTANT: these rects are coupled to the specific image composition for
// each variant. If a merchant swaps a variant's image in Shopify Admin to a
// different scene, the slots will misalign — re-run scripts/lightboard-board-prep.py
// against the new images and update the rects below.
const SLOT_RECTS_BY_COLOR: Record<string, SlotRect[]> = {
  Cream: [
    {left: 29.348, top: 45.326, width: 15.652, height: 14.457},
    {left: 47.391, top: 45.435, width: 15.543, height: 14.13},
    {left: 66.522, top: 44.457, width: 15.109, height: 14.239},
  ],
  'Light Blue': [
    {left: 34.565, top: 38.696, width: 13.37, height: 12.5},
    {left: 50.652, top: 38.696, width: 13.152, height: 12.283},
    {left: 66.413, top: 38.696, width: 13.043, height: 12.174},
  ],
  Pink: [
    {left: 39.783, top: 39.783, width: 10.0, height: 9.457},
    {left: 51.957, top: 39.783, width: 9.891, height: 9.239},
    {left: 64.022, top: 39.674, width: 9.891, height: 9.348},
  ],
};

const DEFAULT_COLOR = 'Cream';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

type BoardSlotData = {
  thumbnailUrl: string | null;
  error: string | null;
};

type BoardCanvasProps = {
  slots: BoardSlotData[];
  slotLabel: (n: number) => string;
  pickLabel: string;
  editLabel: string;
  removeLabel: string;
  disabled?: boolean;
  /** Board image URL from the selected variant. Falls back to nothing rendered. */
  imageUrl?: string | null;
  /** Lightboard "Color" option value (e.g. "Cream" / "Light Blue" / "Pink") — selects the slot-rect set. */
  color?: string | null;
  /** Surprise-me overlay: omit to hide the pill entirely. */
  surprise?: {
    label: string;
    swapLabel: string;
    onPick: () => void;
    disabled?: boolean;
  };
  onFilePicked: (index: number, file: File) => void;
  onEditCrop: (index: number) => void;
  onRemove: (index: number) => void;
};

/**
 * Interactive surfboard preview. Renders the empty Lightboard photo and
 * overlays three clickable slots at the exact pixel positions of the white
 * photo placeholders on the board.
 *
 * Each slot behaves like the old PhotoSlot: empty -> opens the file picker;
 * filled -> shows the user's cropped photo with small edit/remove controls.
 */
export function BoardCanvas({
  slots,
  slotLabel,
  pickLabel,
  editLabel,
  removeLabel,
  disabled = false,
  imageUrl,
  color,
  surprise,
  onFilePicked,
  onEditCrop,
  onRemove,
}: BoardCanvasProps) {
  const rects =
    SLOT_RECTS_BY_COLOR[color ?? ''] ?? SLOT_RECTS_BY_COLOR[DEFAULT_COLOR];
  // Shopify CDN URLs include a `?v=...` cache-buster, so append width via `&`.
  const srcSep = imageUrl?.includes('?') ? '&' : '?';
  const filledCount = slots.filter((s) => !!s?.thumbnailUrl).length;
  const surpriseState =
    filledCount === 0 ? 'empty' : filledCount === slots.length ? 'filled' : 'partial';
  const surpriseLabel =
    surprise && surpriseState === 'filled' ? surprise.swapLabel : surprise?.label ?? '';
  return (
    <div className="board-canvas" role="group" aria-label={slotLabel(0)}>
      {imageUrl ? (
        <img
          src={`${imageUrl}${srcSep}width=1200`}
          srcSet={[600, 900, 1200, 1600]
            .map((w) => `${imageUrl}${srcSep}width=${w} ${w}w`)
            .join(', ')}
          sizes="(min-width: 45em) 50vw, 100vw"
          alt=""
          className="board-canvas__bg"
          draggable={false}
        />
      ) : null}
      {surprise ? (
        <button
          type="button"
          className="board-canvas__surprise"
          data-state={surpriseState}
          onClick={surprise.onPick}
          disabled={surprise.disabled}
          aria-label={surpriseLabel}
          title={surpriseLabel}
        >
          <span className="board-canvas__surprise-icon" aria-hidden="true">✨</span>
          <span className="board-canvas__surprise-label">{surpriseLabel}</span>
        </button>
      ) : null}
      {rects.map((rect, i) => (
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

type BoardSlotProps = {
  index: number;
  rect: SlotRect;
  slot: BoardSlotData;
  label: string;
  pickLabel: string;
  editLabel: string;
  removeLabel: string;
  disabled: boolean;
  onFilePicked: (file: File) => void;
  onEditCrop: () => void;
  onRemove: () => void;
};

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
}: BoardSlotProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filled = !!slot?.thumbnailUrl;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFilePicked(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFilePicked(file);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
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
      {filled && slot.thumbnailUrl ? (
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
