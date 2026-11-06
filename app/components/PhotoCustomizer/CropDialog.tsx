import {useState, useCallback, useEffect, useId, useRef} from 'react';
import type {CSSProperties, ReactNode} from 'react';
import Cropper from 'react-easy-crop';
import type {Area, Point} from 'react-easy-crop';
import type {CropPixels} from '~/lib/photo-canvas';

type CropDialogProps = {
  imageUrl: string;
  initialCrop?: CropPixels | null;
  slotLabel: string;
  saveLabel: string;
  cancelLabel: string;
  zoomLabel: string;
  hint?: string;
  /** Crop aspect, width / height (default square). */
  aspect?: number;
  /** Drawn over the crop area (e.g. the board outline). */
  overlay?: ReactNode;
  /** Live preview beside the stage, re-rendered on every pan / zoom. */
  renderPreview?: (cropPixels: CropPixels | null) => ReactNode;
  onSave: (cropPixels: CropPixels) => void;
  onCancel: () => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Crop modal (square by default; the Printboard uses the board's aspect).
 *
 * - `objectFit="cover"`: the photo always fills the crop (no letterbox
 *   bars), so what you see is what prints.
 * - Real modal behaviour: initial focus, Tab trap, Escape closes, focus
 *   returns to the control that opened it.
 * - Panning has a keyboard alternative (react-easy-crop moves the crop with
 *   arrow keys when the stage is focused) plus the zoom slider, so dragging
 *   is never the only way (WCAG 2.5.7).
 */
export function CropDialog({
  imageUrl,
  initialCrop,
  slotLabel,
  saveLabel,
  cancelLabel,
  zoomLabel,
  hint,
  aspect = 1,
  overlay,
  renderPreview,
  onSave,
  onCancel,
}: CropDialogProps) {
  const [crop, setCrop] = useState<Point>({x: 0, y: 0});
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropPixels | null>(
    initialCrop ?? null,
  );
  const titleId = useId();
  const zoomId = useId();
  const hintId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Start on the primary action so Enter saves the default crop.
    const first =
      panel?.querySelector<HTMLElement>('.crop-dialog__btn--primary') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);
  // Only the live preview needs every intermediate frame.
  const [liveArea, setLiveArea] = useState<CropPixels | null>(
    initialCrop ?? null,
  );
  const handleCropAreaChange = useCallback((_area: Area, areaPixels: Area) => {
    setLiveArea(areaPixels);
  }, []);
  const wide = aspect !== 1;

  function handleSave() {
    if (croppedAreaPixels) onSave(croppedAreaPixels);
  }

  return (
    <div
      className="crop-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={hint ? hintId : undefined}
    >
      <button
        type="button"
        aria-label={cancelLabel}
        className="crop-dialog__backdrop"
        onClick={onCancel}
        tabIndex={-1}
      />
      <div
        className={`crop-dialog__panel${wide ? ' is-tall' : ''}`}
        ref={panelRef}
      >
        <h2 className="crop-dialog__title" id={titleId}>
          {slotLabel}
        </h2>
        <div className="crop-dialog__body">
          <div
            className="crop-dialog__stage"
            style={{'--crop-aspect': String(aspect)} as CSSProperties}
          >
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape="rect"
              showGrid={true}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              onCropAreaChange={
                renderPreview ? handleCropAreaChange : undefined
              }
              objectFit="cover"
              initialCroppedAreaPixels={initialCrop ?? undefined}
              restrictPosition={true}
            />
            {overlay ? (
              <div className="crop-dialog__overlay" aria-hidden="true">
                {overlay}
              </div>
            ) : null}
          </div>
          {renderPreview ? (
            <div className="crop-dialog__preview">
              {renderPreview(liveArea)}
            </div>
          ) : null}
        </div>
        {hint ? (
          <p className="crop-dialog__hint" id={hintId}>
            {hint}
          </p>
        ) : null}
        <div className="crop-dialog__zoom">
          <label htmlFor={zoomId}>{zoomLabel}</label>
          <input
            id={zoomId}
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </div>
        <div className="crop-dialog__actions">
          <button
            type="button"
            className="crop-dialog__btn crop-dialog__btn--ghost"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="crop-dialog__btn crop-dialog__btn--primary"
            onClick={handleSave}
            disabled={!croppedAreaPixels}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
