import {useRef} from 'react';
import type {ChangeEvent, DragEvent} from 'react';
import {BoardThumb, PrintboardPreview} from './PrintboardPreview';
import type {BoardPhoto} from './PrintboardPreview';
import type {PrintPreset} from '~/lib/printboard-presets';
import {presetPreviewUrl} from '~/lib/printboard-presets';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

export type PrintboardLabels = {
  previewLabel: string;
  previewEmpty: string;
  sourcesLabel: string;
  presetsTitle: string;
  ownPhoto: string;
  upload: string;
  replace: string;
  adjust: string;
  remove: string;
  presetName: (id: string) => string;
};

type PrintboardStageProps = {
  photo: BoardPhoto | null;
  presets: ReadonlyArray<PrintPreset>;
  selectedPresetId: string | null;
  /** The shopper's own photo is the current design. */
  ownSelected: boolean;
  /** Thumbnail of the shopper's own photo (current or set aside). */
  ownThumbUrl: string | null;
  hasError?: boolean;
  disabled?: boolean;
  labels: PrintboardLabels;
  onFilePicked: (file: File) => void;
  onSelectOwn: () => void;
  onSelectPreset: (id: string) => void;
  onAdjust: () => void;
  onRemove: () => void;
};

/**
 * Printboard customizer UI: the live board preview on a wall, then the
 * choice of source — "your photo" (upload) or one of our ready-made designs
 * — as one radio group of tall tiles, then framing / remove actions.
 */
export function PrintboardStage({
  photo,
  presets,
  selectedPresetId,
  ownSelected,
  ownThumbUrl,
  hasError = false,
  disabled = false,
  labels,
  onFilePicked,
  onSelectOwn,
  onSelectPreset,
  onAdjust,
  onRemove,
}: PrintboardStageProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filled = Boolean(photo);
  const presetName = selectedPresetId
    ? labels.presetName(selectedPresetId)
    : null;

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFilePicked(file);
  }

  return (
    <div className="pb-stage">
      <PrintboardPreview
        photo={photo}
        label={
          presetName
            ? `${labels.previewLabel}: ${presetName}`
            : ownSelected
              ? `${labels.previewLabel}: ${labels.ownPhoto}`
              : labels.previewLabel
        }
        emptyHint={labels.previewEmpty}
      >
        {filled ? (
          <div className="pb-stage__tools">
            <button
              type="button"
              className="pb-stage__tool"
              onClick={onAdjust}
              disabled={disabled}
            >
              <CropIcon />
              <span>{labels.adjust}</span>
            </button>
            <button
              type="button"
              className="pb-stage__tool pb-stage__tool--quiet"
              onClick={onRemove}
              disabled={disabled}
            >
              <span>{labels.remove}</span>
            </button>
          </div>
        ) : null}
      </PrintboardPreview>

      <fieldset className="pb-sources" disabled={disabled}>
        <legend className="pb-sources__legend">{labels.sourcesLabel}</legend>
        <div
          className={`pb-own${ownSelected ? ' is-on' : ''}${hasError ? ' has-error' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="pb-own__btn"
            aria-pressed={ownSelected}
            onClick={() =>
              ownThumbUrl && !ownSelected ? onSelectOwn() : openPicker()
            }
          >
            <span className="pb-own__thumb" aria-hidden="true">
              {ownThumbUrl ? (
                <BoardThumb src={ownThumbUrl} label="" decorative />
              ) : (
                <UploadIcon />
              )}
            </span>
            <span className="pb-own__text">
              <strong>{labels.ownPhoto}</strong>
              <span>
                {ownThumbUrl
                  ? ownSelected
                    ? labels.replace
                    : labels.ownPhoto
                  : labels.upload}
              </span>
            </span>
          </button>
          {ownThumbUrl && !ownSelected ? (
            <button
              type="button"
              className="pb-own__replace"
              onClick={openPicker}
            >
              {labels.replace}
            </button>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="board-canvas__file-input"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (file) onFilePicked(file);
              event.target.value = '';
            }}
            tabIndex={-1}
            aria-hidden="true"
            aria-label={labels.upload}
          />
        </div>

        <p className="pb-sources__title" id="pb-presets-title">
          {labels.presetsTitle}
        </p>
        <div
          className="pb-presets"
          role="radiogroup"
          aria-labelledby="pb-presets-title"
        >
          {presets.map((preset) => {
            const on = preset.id === selectedPresetId;
            const name = labels.presetName(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`pb-preset${on ? ' is-on' : ''}`}
                onClick={() => onSelectPreset(preset.id)}
              >
                <span className="pb-preset__art" aria-hidden="true">
                  <PresetTileImage preset={preset} />
                </span>
                <span className="pb-preset__name">{name}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

/** Board-shaped preset tile: the default 2:5 framing straight off the CDN. */
function PresetTileImage({preset}: {preset: PrintPreset}) {
  const src = presetPreviewUrl(preset, 200);
  return <BoardThumb src={src} label="" decorative />;
}

function CropIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 1v11h11M1 4h11v11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 16V4m0 0l-5 5m5-5l5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
