import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useI18n} from '~/lib/useI18n';
import {
  CROPPED_OUTPUT_SIZE,
  fetchRemoteImageAsBlob,
  getDefaultSquareCrop,
  loadImageFromFile,
  renderCropToJpegBlob,
  validatePhotoDimensions,
  validatePhotoFile,
} from '~/lib/photo-canvas';
import {pickThreeFromGallery} from '~/lib/surprise-gallery';
import {PhotoSlot} from './PhotoSlot';
import {CropDialog} from './CropDialog';
import {PreviewBoard} from './PreviewBoard';

const SLOT_COUNT = 3;
const PREVIEW_THUMBNAIL_SIZE = 480;
const STATE_STORAGE_PREFIX = 'lightboard:photoState:';

/**
 * Build the localStorage key for a photo line. We index by the first cropped
 * URL because every approve generates fresh, unique CDN URLs — so the key is
 * stable per line and avoids collisions across orders.
 */
function stateStorageKey(firstCroppedUrl) {
  if (!firstCroppedUrl) return null;
  return STATE_STORAGE_PREFIX + firstCroppedUrl;
}

function readStoredPhotoState(firstCroppedUrl) {
  if (typeof window === 'undefined') return null;
  const key = stateStorageKey(firstCroppedUrl);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.originalUrls) || !Array.isArray(parsed.crops)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredPhotoState(firstCroppedUrl, payload) {
  if (typeof window === 'undefined') return;
  const key = stateStorageKey(firstCroppedUrl);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // localStorage may be unavailable (private mode, quota). Edit-from-cart
    // simply won't be able to resume; user can re-upload to recover.
  }
}

function emptySlot() {
  return {
    file: null,
    imageObjectUrl: null,
    imageEl: null,
    imageDimensions: null,
    crop: null,
    thumbnailObjectUrl: null,
    uploadedCroppedUrl: null,
    uploadedOriginalUrl: null,
    dirty: false,
    error: null,
  };
}

/** Pick whichever URL the preview should display for this slot. */
function previewUrlFor(slot) {
  return slot.thumbnailObjectUrl || slot.uploadedCroppedUrl || null;
}

/**
 * Top-level photo customizer for the Lightboard PDP.
 *
 * Manages picking, cropping, previewing, and uploading three square photos.
 * Calls `onApprove` with a Shopify line-item-attribute array once all three
 * slots have been cropped, uploaded to Shopify Files, and the user clicks
 * Approve. The parent (ProductForm) merges those attributes into LinesAdd or
 * LinesUpdate as appropriate.
 *
 * @param {{
 *   cartId?: string | null,
 *   initialState?: {
 *     croppedUrls: string[],
 *     originalUrls: string[],
 *     crops: Array<{x: number, y: number, width: number, height: number}>,
 *   } | null,
 *   isEditing?: boolean,
 *   onApprove: (attrs: Array<{key: string, value: string}>) => void,
 *   onUnapprove?: () => void,
 * }}
 */
export function PhotoCustomizer({
  cartId,
  initialState,
  isEditing = false,
  onApprove,
  onUnapprove,
}) {
  const {dict} = useI18n();
  const t = dict.photoCustomizer;

  const [slots, setSlots] = useState(() => seedSlots(initialState));
  const [cropDialogIndex, setCropDialogIndex] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [approved, setApproved] = useState(() => !!initialState && !isEditing);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // On mount, if we have a saved photo state in localStorage matching the
  // initial cropped URLs (edit-from-cart flow), enrich each slot with its
  // original URL + crop rect so the user can re-crop.
  useEffect(() => {
    if (!initialState?.croppedUrls?.length) return;
    const stored = readStoredPhotoState(initialState.croppedUrls[0]);
    if (!stored) return;
    setSlots((current) =>
      current.map((slot, i) => ({
        ...slot,
        crop: slot.crop ?? stored.crops?.[i] ?? null,
        uploadedOriginalUrl:
          slot.uploadedOriginalUrl ?? stored.originalUrls?.[i] ?? null,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke object URLs on unmount.
  useEffect(() => {
    const slotsAtMount = slots;
    return () => {
      for (const slot of slotsAtMount) {
        if (slot.imageObjectUrl) URL.revokeObjectURL(slot.imageObjectUrl);
        if (slot.thumbnailObjectUrl) URL.revokeObjectURL(slot.thumbnailObjectUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allFilled = slots.every((s) => previewUrlFor(s));
  const anyDirty = slots.some((s) => s.dirty);

  function patchSlot(index, patch) {
    setSlots((current) => {
      const next = current.slice();
      next[index] = {...next[index], ...patch};
      return next;
    });
  }

  function markUnapproved() {
    if (approved) {
      setApproved(false);
      if (onUnapprove) onUnapprove();
    }
  }

  /**
   * "Surprise me" — populate all three slots with random, brand-curated
   * photos from the gallery on Shopify Files. The slots are marked
   * non-dirty so the existing approve flow skips the upload step and
   * onApprove sends the gallery URLs straight through.
   */
  const handleSurprise = useCallback(() => {
    markUnapproved();
    setUploadError(null);
    const currentlyShown = slots
      .map((s) => s.uploadedCroppedUrl)
      .filter(Boolean);
    const picks = pickThreeFromGallery(currentlyShown);
    setSlots((current) =>
      current.map((slot, i) => {
        if (slot.imageObjectUrl) URL.revokeObjectURL(slot.imageObjectUrl);
        if (slot.thumbnailObjectUrl) URL.revokeObjectURL(slot.thumbnailObjectUrl);
        return {
          ...emptySlot(),
          uploadedCroppedUrl: picks[i],
          uploadedOriginalUrl: picks[i],
          dirty: false,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const handleFilePicked = useCallback(async (index, file) => {
    markUnapproved();
    const fileCheck = validatePhotoFile(file);
    if (!fileCheck.ok) {
      patchSlot(index, {error: t.errors[fileCheck.reason]});
      return;
    }
    let loaded;
    try {
      loaded = await loadImageFromFile(file);
    } catch (err) {
      console.error('[PhotoCustomizer] loadImageFromFile failed', {
        name: file.name,
        type: file.type,
        size: file.size,
        err,
      });
      patchSlot(index, {error: t.errors.loadFailed});
      return;
    }
    if (!mountedRef.current) {
      URL.revokeObjectURL(loaded.objectUrl);
      return;
    }
    const dimsCheck = validatePhotoDimensions(loaded);
    if (!dimsCheck.ok) {
      URL.revokeObjectURL(loaded.objectUrl);
      patchSlot(index, {error: t.errors[dimsCheck.reason]});
      return;
    }

    setSlots((current) => {
      const next = current.slice();
      const prev = next[index];
      if (prev.imageObjectUrl) URL.revokeObjectURL(prev.imageObjectUrl);
      if (prev.thumbnailObjectUrl) URL.revokeObjectURL(prev.thumbnailObjectUrl);
      next[index] = {
        ...emptySlot(),
        file,
        imageObjectUrl: loaded.objectUrl,
        imageEl: loaded.image,
        imageDimensions: {width: loaded.width, height: loaded.height},
        crop: getDefaultSquareCrop(loaded),
        dirty: true,
      };
      return next;
    });
    setCropDialogIndex(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const handleEditCrop = useCallback(async (index) => {
    markUnapproved();
    const slot = slots[index];
    if (slot.imageEl) {
      setCropDialogIndex(index);
      return;
    }
    if (!slot.uploadedOriginalUrl) {
      patchSlot(index, {error: t.errors.cannotEdit});
      return;
    }
    patchSlot(index, {error: null});
    try {
      const blob = await fetchRemoteImageAsBlob(slot.uploadedOriginalUrl);
      const file = new File([blob], `original-${index + 1}`, {
        type: blob.type || 'image/jpeg',
      });
      const loaded = await loadImageFromFile(file);
      if (!mountedRef.current) {
        URL.revokeObjectURL(loaded.objectUrl);
        return;
      }
      setSlots((current) => {
        const next = current.slice();
        const prev = next[index];
        if (prev.imageObjectUrl) URL.revokeObjectURL(prev.imageObjectUrl);
        next[index] = {
          ...prev,
          file,
          imageObjectUrl: loaded.objectUrl,
          imageEl: loaded.image,
          imageDimensions: {width: loaded.width, height: loaded.height},
          crop: prev.crop ?? getDefaultSquareCrop(loaded),
          error: null,
        };
        return next;
      });
      setCropDialogIndex(index);
    } catch {
      patchSlot(index, {error: t.errors.loadFailed});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, t]);

  const handleCropSaved = useCallback(async (cropPixels) => {
    const index = cropDialogIndex;
    if (index == null) return;
    setCropDialogIndex(null);

    const slot = slots[index];
    if (!slot.imageEl) return;

    let thumbnailBlob;
    try {
      thumbnailBlob = await renderCropToJpegBlob(
        slot.imageEl,
        cropPixels,
        PREVIEW_THUMBNAIL_SIZE,
        0.85,
      );
    } catch {
      patchSlot(index, {error: t.errors.renderFailed});
      return;
    }
    if (!mountedRef.current) return;

    const thumbnailObjectUrl = URL.createObjectURL(thumbnailBlob);

    setSlots((current) => {
      const next = current.slice();
      const prev = next[index];
      if (prev.thumbnailObjectUrl) URL.revokeObjectURL(prev.thumbnailObjectUrl);
      next[index] = {
        ...prev,
        crop: cropPixels,
        thumbnailObjectUrl,
        dirty: true,
        error: null,
      };
      return next;
    });
    markUnapproved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropDialogIndex, slots, t]);

  const handleCropCancelled = useCallback(() => {
    setCropDialogIndex(null);
  }, []);

  const handleRemove = useCallback((index) => {
    markUnapproved();
    setSlots((current) => {
      const next = current.slice();
      const prev = next[index];
      if (prev.imageObjectUrl) URL.revokeObjectURL(prev.imageObjectUrl);
      if (prev.thumbnailObjectUrl) URL.revokeObjectURL(prev.thumbnailObjectUrl);
      next[index] = emptySlot();
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApprove() {
    if (uploading) return;
    setUploadError(null);
    setUploading(true);
    try {
      // 1. Build cropped blobs for slots that are dirty (or never uploaded).
      const croppedBlobs = await Promise.all(
        slots.map(async (slot) => {
          if (!slot.dirty && slot.uploadedCroppedUrl) return null;
          if (!slot.imageEl || !slot.crop) {
            throw new Error('slot-not-ready');
          }
          return renderCropToJpegBlob(
            slot.imageEl,
            slot.crop,
            CROPPED_OUTPUT_SIZE,
            0.9,
          );
        }),
      );

      // 2. Build form data — only dirty slots send originals + new crops.
      const form = new FormData();
      if (cartId) form.append('cartId', cartId);
      slots.forEach((slot, i) => {
        const cropped = croppedBlobs[i];
        if (cropped) {
          form.append(
            `cropped_${i}`,
            new File([cropped], `cropped-${i + 1}.jpg`, {type: 'image/jpeg'}),
          );
        }
        if (slot.dirty && slot.file) {
          form.append(
            `original_${i}`,
            new File([slot.file], slot.file.name || `original-${i + 1}`, {
              type: slot.file.type || 'image/jpeg',
            }),
          );
        }
      });

      // 3. Upload, if there is anything to upload.
      let uploadResult = {
        cropped: [null, null, null],
        originals: [null, null, null],
      };
      const hasUploads = slots.some((s) => s.dirty);
      if (hasUploads) {
        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          body: form,
        });
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `upload-${response.status}`);
        }
        uploadResult = await response.json();
      }

      if (!mountedRef.current) return;

      // 4. Merge uploaded URLs back into slots and build the attributes array.
      const finalCroppedUrls = [];
      const finalOriginalUrls = [];
      const finalCrops = [];
      const updatedSlots = slots.map((slot, i) => {
        const cropped = uploadResult.cropped[i] || slot.uploadedCroppedUrl;
        const original = uploadResult.originals[i] || slot.uploadedOriginalUrl;
        finalCroppedUrls.push(cropped);
        finalOriginalUrls.push(original);
        finalCrops.push(slot.crop);
        return {
          ...slot,
          uploadedCroppedUrl: cropped,
          uploadedOriginalUrl: original,
          dirty: false,
        };
      });

      if (finalCroppedUrls.some((u) => !u)) {
        throw new Error('missing-cropped-url');
      }

      setSlots(updatedSlots);
      setApproved(true);

      // Persist originals + crop rects locally so the buyer can re-crop from
      // the cart on the same device. The merchant-visible cart line carries
      // ONLY the three cropped URLs — the order admin stays clean.
      writeStoredPhotoState(finalCroppedUrls[0], {
        originalUrls: finalOriginalUrls,
        crops: finalCrops,
      });

      const attributes = [
        {key: 'Photo 1', value: finalCroppedUrls[0]},
        {key: 'Photo 2', value: finalCroppedUrls[1]},
        {key: 'Photo 3', value: finalCroppedUrls[2]},
      ];
      onApprove(attributes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'upload-failed';
      setUploadError(message);
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  const previewPhotos = useMemo(
    () => slots.map((slot) => ({thumbnailUrl: previewUrlFor(slot)})),
    [slots],
  );

  const cropDialogSlot = cropDialogIndex == null ? null : slots[cropDialogIndex];

  const approveLabel = uploading
    ? t.uploading
    : isEditing
      ? t.saveChanges
      : t.approve;

  const approveDisabled =
    uploading || !allFilled || (approved && !anyDirty);

  return (
    <section className="photo-customizer" aria-label={t.heading}>
      <header className="photo-customizer__header">
        <h3 className="photo-customizer__title">{t.heading}</h3>
        <p className="photo-customizer__subtitle">{t.subheading}</p>
      </header>

      <div className="photo-customizer__slots">
        {slots.map((slot, i) => (
          <PhotoSlot
            key={i}
            index={i}
            slotLabel={t.slotLabel.replace('{n}', String(i + 1))}
            thumbnailUrl={previewUrlFor(slot)}
            error={slot.error}
            pickLabel={t.pick}
            editLabel={t.editCrop}
            removeLabel={t.remove}
            disabled={uploading}
            onFilePicked={(file) => handleFilePicked(i, file)}
            onEditCrop={() => handleEditCrop(i)}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>

      <div className="photo-customizer__surprise" role="group" aria-label={t.surprise?.button ?? 'Pick photos from our gallery'}>
        <p className="photo-customizer__surprise-helper">
          {t.surprise?.helper ?? "Don't have photos handy?"}
        </p>
        <button
          type="button"
          className="photo-customizer__surprise-btn"
          onClick={handleSurprise}
          disabled={uploading}
        >
          {allFilled && !anyDirty
            ? (t.surprise?.swap ?? 'Surprise me again')
            : (t.surprise?.button ?? 'Surprise me from the gallery')}
        </button>
      </div>

      <div className="photo-customizer__preview">
        <h4 className="photo-customizer__preview-title">{t.previewTitle}</h4>
        <PreviewBoard
          photos={previewPhotos}
          placeholderLabel={t.placeholder}
        />
      </div>

      {uploadError ? (
        <p className="photo-customizer__upload-error" role="alert">
          {t.errors.uploadFailed}
        </p>
      ) : null}

      <div className="photo-customizer__actions">
        <button
          type="button"
          className="photo-customizer__approve"
          onClick={handleApprove}
          disabled={approveDisabled}
        >
          {approveLabel}
        </button>
        {approved && !anyDirty ? (
          <p className="photo-customizer__approved-note">
            {isEditing ? t.savedNote : t.approvedNote}
          </p>
        ) : null}
      </div>

      {cropDialogSlot && cropDialogSlot.imageObjectUrl ? (
        <CropDialog
          imageUrl={cropDialogSlot.imageObjectUrl}
          initialCrop={cropDialogSlot.crop}
          slotLabel={t.slotLabel.replace(
            '{n}',
            String((cropDialogIndex ?? 0) + 1),
          )}
          saveLabel={t.cropSave}
          cancelLabel={t.cropCancel}
          zoomLabel={t.zoom}
          onSave={handleCropSaved}
          onCancel={handleCropCancelled}
        />
      ) : null}
    </section>
  );
}

function seedSlots(initialState) {
  if (initialState && initialState.croppedUrls?.length === SLOT_COUNT) {
    return initialState.croppedUrls.map((croppedUrl, i) => ({
      ...emptySlot(),
      crop: initialState.crops?.[i] ?? null,
      uploadedCroppedUrl: croppedUrl,
      uploadedOriginalUrl: initialState.originalUrls?.[i] ?? null,
      dirty: false,
    }));
  }
  return Array.from({length: SLOT_COUNT}, () => emptySlot());
}
