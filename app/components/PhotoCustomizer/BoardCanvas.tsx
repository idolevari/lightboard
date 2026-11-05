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

const BG_WIDTHS = [600, 800, 1000, 1200, 1600];

type BoardSlotData = {
  thumbnailUrl: string | null;
  error: string | null;
};

type BoardCanvasProps = {
  slots: BoardSlotData[];
  slotLabel: (n: number) => string;
  slotsLabel: string;
  pickLabel: string;
  editLabel: string;
  removeLabel: string;
  disabled?: boolean;
  /** Board image URL from the selected variant. Falls back to nothing rendered. */
  imageUrl?: string | null;
  /** Descriptive alt for the board photo (product + color). */
  imageAlt?: string;
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
 * Interactive surfboard preview + photo slot strip.
 *
 * - The board shows the selected color with the shopper's photos composited
 *   at the exact slot positions. Tapping a slot on the board is a pointer
 *   shortcut (pick / re-crop).
 * - Under it, a strip of three large tiles is the real, labelled control:
 *   pick, crop and remove each have ≥40px targets and are always visible
 *   (no hover-only overlays — those were invisible on touch).
 */
export function BoardCanvas({
  slots,
  slotLabel,
  slotsLabel,
  pickLabel,
  editLabel,
  removeLabel,
  disabled = false,
  imageUrl,
  imageAlt = '',
  color,
  surprise,
  onFilePicked,
  onEditCrop,
  onRemove,
}: BoardCanvasProps) {
  const rects =
    SLOT_RECTS_BY_COLOR[color ?? ''] ?? SLOT_RECTS_BY_COLOR[DEFAULT_COLOR];
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  // Shopify CDN URLs include a `?v=...` cache-buster, so append width via `&`.
  const srcSep = imageUrl?.includes('?') ? '&' : '?';
  const filledCount = slots.filter((s) => !!s?.thumbnailUrl).length;
  const surpriseState =
    filledCount === 0 ? 'empty' : filledCount === slots.length ? 'filled' : 'partial';
  const surpriseLabel =
    surprise && surpriseState === 'filled' ? surprise.swapLabel : surprise?.label ?? '';

  const openPicker = (i: number) => {
    if (!disabled) inputRefs.current[i]?.click();
  };

  function handleDrop(i: number, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFilePicked(i, file);
  }

  return (
    <div className="board">
      <div className="board-canvas">
        {imageUrl ? (
          <img
            src={`${imageUrl}${srcSep}width=1000`}
            srcSet={BG_WIDTHS.map(
              (w) => `${imageUrl}${srcSep}width=${w} ${w}w`,
            ).join(', ')}
            sizes="(min-width: 45em) 50vw, calc(100vw - 40px)"
            alt={imageAlt}
            className="board-canvas__bg"
            draggable={false}
            // LCP element on the PDP. Lowercase attribute via spread: React
            // 18 warns on the camelCase prop.
            {...({fetchpriority: 'high'} as Record<string, string>)}
            loading="eager"
            decoding="async"
          />
        ) : null}
        {surprise ? (
          <button
            type="button"
            className="board-canvas__surprise"
            data-state={surpriseState}
            onClick={surprise.onPick}
            disabled={surprise.disabled}
          >
            <span className="board-canvas__surprise-icon" aria-hidden="true">✨</span>
            <span className="board-canvas__surprise-label">{surpriseLabel}</span>
          </button>
        ) : null}
        {rects.map((rect, i) => {
          const slot = slots[i];
          const filled = !!slot?.thumbnailUrl;
          return (
            // Pointer shortcut only — the labelled, keyboard-reachable
            // controls for the same actions live in the strip below.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div
              key={i}
              className={`board-canvas__slot ${filled ? 'is-filled' : 'is-empty'}`}
              style={{
                left: `${rect.left}%`,
                top: `${rect.top}%`,
                width: `${rect.width}%`,
                height: `${rect.height}%`,
              }}
              aria-hidden="true"
              onClick={() => (filled ? onEditCrop(i) : openPicker(i))}
              onDrop={(e) => handleDrop(i, e)}
              onDragOver={(e) => e.preventDefault()}
            >
              {filled && slot.thumbnailUrl ? (
                <img
                  src={slot.thumbnailUrl}
                  alt=""
                  className="board-canvas__photo"
                  draggable={false}
                />
              ) : (
                <span className="board-canvas__pick">
                  <span className="board-canvas__num">{i + 1}</span>
                  <span className="board-canvas__plus">+</span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <ul className="board-slots" aria-label={slotsLabel}>
        {rects.map((_, i) => {
          const slot = slots[i];
          const label = slotLabel(i + 1);
          const filled = !!slot?.thumbnailUrl;
          return (
            <li
              key={i}
              className={`board-slots__tile${filled ? ' is-filled' : ''}${slot?.error ? ' has-error' : ''}`}
              onDrop={(e) => handleDrop(i, e)}
              onDragOver={(e) => e.preventDefault()}
            >
              {filled && slot.thumbnailUrl ? (
                <>
                  <button
                    type="button"
                    className="board-slots__thumb"
                    onClick={() => onEditCrop(i)}
                    disabled={disabled}
                    aria-label={`${label}: ${editLabel}`}
                  >
                    <img src={slot.thumbnailUrl} alt="" draggable={false} />
                  </button>
                  <div className="board-slots__actions">
                    <button
                      type="button"
                      className="board-slots__icon"
                      onClick={() => onEditCrop(i)}
                      disabled={disabled}
                      aria-label={`${label}: ${editLabel}`}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="board-slots__icon board-slots__icon--danger"
                      onClick={() => onRemove(i)}
                      disabled={disabled}
                      aria-label={`${label}: ${removeLabel}`}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="board-slots__pick"
                  onClick={() => openPicker(i)}
                  disabled={disabled}
                  aria-label={`${label}: ${pickLabel}`}
                >
                  <span className="board-slots__plus" aria-hidden="true">+</span>
                  <span aria-hidden="true">{label}</span>
                </button>
              )}
              <input
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="file"
                accept={ACCEPTED_TYPES}
                className="board-canvas__file-input"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0];
                  if (file) onFilePicked(i, file);
                  event.target.value = '';
                }}
                disabled={disabled}
                tabIndex={-1}
                aria-hidden="true"
                aria-label={`${label}: ${pickLabel}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3l10 10M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
