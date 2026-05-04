import {useState, useCallback} from 'react';
import Cropper from 'react-easy-crop';

/**
 * Square-aspect crop modal. Renders a backdrop + centered card with
 * react-easy-crop inside and Save/Cancel actions.
 *
 * @param {{
 *   imageUrl: string,
 *   initialCrop?: {x: number, y: number, width: number, height: number} | null,
 *   slotLabel: string,
 *   saveLabel: string,
 *   cancelLabel: string,
 *   zoomLabel: string,
 *   onSave: (cropPixels: {x: number, y: number, width: number, height: number}) => void,
 *   onCancel: () => void,
 * }}
 */
export function CropDialog({
  imageUrl,
  initialCrop,
  slotLabel,
  saveLabel,
  cancelLabel,
  zoomLabel,
  onSave,
  onCancel,
}) {
  const [crop, setCrop] = useState({x: 0, y: 0});
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(initialCrop ?? null);

  const handleCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function handleSave() {
    if (croppedAreaPixels) onSave(croppedAreaPixels);
  }

  return (
    <div className="crop-dialog" role="dialog" aria-modal="true" aria-label={slotLabel}>
      <button
        type="button"
        aria-label={cancelLabel}
        className="crop-dialog__backdrop"
        onClick={onCancel}
      />
      <div className="crop-dialog__panel">
        <h3 className="crop-dialog__title">{slotLabel}</h3>
        <div className="crop-dialog__stage">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={true}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            objectFit="auto-cover"
            restrictPosition={true}
          />
        </div>
        <div className="crop-dialog__zoom">
          <label htmlFor="crop-zoom">{zoomLabel}</label>
          <input
            id="crop-zoom"
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
