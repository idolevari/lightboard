import {useRef} from 'react';

/**
 * One of the three photo slots.
 *
 * Two visual states:
 *   - empty: drag-drop area + click-to-pick file input
 *   - filled: square thumbnail of the cropped result + Edit/Remove controls
 *
 * @param {{
 *   index: number,                // 0..2
 *   slotLabel: string,             // localized "Photo 1"
 *   thumbnailUrl: string | null,   // object URL of cropped thumbnail, or null
 *   error: string | null,          // localized error message
 *   pickLabel: string,             // localized "Choose photo"
 *   editLabel: string,
 *   removeLabel: string,
 *   disabled?: boolean,
 *   onFilePicked: (file: File) => void,
 *   onEditCrop: () => void,
 *   onRemove: () => void,
 * }}
 */
export function PhotoSlot({
  index,
  slotLabel,
  thumbnailUrl,
  error,
  pickLabel,
  editLabel,
  removeLabel,
  disabled,
  onFilePicked,
  onEditCrop,
  onRemove,
}) {
  const inputRef = useRef(null);

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

  const filled = !!thumbnailUrl;

  return (
    <div
      className={`photo-slot ${filled ? 'photo-slot--filled' : 'photo-slot--empty'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="photo-slot__index" aria-hidden="true">
        {index + 1}
      </div>
      {filled ? (
        <>
          <img
            className="photo-slot__thumb"
            src={thumbnailUrl}
            alt={slotLabel}
          />
          <div className="photo-slot__actions">
            <button
              type="button"
              className="photo-slot__action"
              onClick={onEditCrop}
              disabled={disabled}
            >
              {editLabel}
            </button>
            <button
              type="button"
              className="photo-slot__action photo-slot__action--danger"
              onClick={onRemove}
              disabled={disabled}
            >
              {removeLabel}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="photo-slot__pick"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <span className="photo-slot__pick-label">{slotLabel}</span>
          <span className="photo-slot__pick-cta">{pickLabel}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="photo-slot__input"
        onChange={handleFileChange}
        disabled={disabled}
      />
      {error ? <p className="photo-slot__error">{error}</p> : null}
    </div>
  );
}
