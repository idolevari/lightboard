import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {useI18n} from '~/lib/useI18n';
import {
  CROPPED_OUTPUT_SIZE,
  fetchRemoteImageAsBlob,
  getDefaultSquareCrop,
  loadImageFromFile,
  MIN_PHOTO_DIMENSION,
  renderCropToJpegBlob,
  validatePhotoDimensions,
  validatePhotoFile,
} from '~/lib/photo-canvas';
import type {CropPixels} from '~/lib/photo-canvas';
import {pickThreeFromGallery} from '~/lib/surprise-gallery';
import {BoardCanvas} from './BoardCanvas';
import {CropDialog} from './CropDialog';

const SLOT_COUNT = 3;
const PREVIEW_THUMBNAIL_SIZE = 480;
const STATE_STORAGE_PREFIX = 'lightboard:photoState:';

type PhotoSlotState = {
  file: File | null;
  imageObjectUrl: string | null;
  imageEl: HTMLImageElement | null;
  imageDimensions: {width: number; height: number} | null;
  crop: CropPixels | null;
  thumbnailObjectUrl: string | null;
  uploadedCroppedUrl: string | null;
  uploadedOriginalUrl: string | null;
  dirty: boolean;
  error: string | null;
  /** Accepted but below the recommended print size. */
  lowRes: boolean;
  /** Filled by the "pick for me" gallery, not by the shopper. */
  fromGallery: boolean;
};

type StoredPhotoState = {
  originalUrls: Array<string | null>;
  crops: Array<CropPixels | null>;
};

export type PhotoCustomizerInitialState = {
  croppedUrls: string[];
  originalUrls: Array<string | null>;
  crops: Array<CropPixels | null>;
};

export type PhotoAttribute = {key: string; value: string};

export type PhotoCustomizerProps = {
  cartId?: string | null;
  initialState?: PhotoCustomizerInitialState | null;
  isEditing?: boolean;
  /** Board image URL from the selected variant. */
  imageUrl?: string | null;
  /** Descriptive alt text for the board image. */
  imageAlt?: string;
  /** Lightboard "Color" option value (selects the slot-rect set). */
  color?: string | null;
  onApprove: (attrs: PhotoAttribute[]) => void;
  onUnapprove?: () => void;
  /** Reports how many of the 3 slots are filled (drives the ATC label). */
  onProgressChange?: (filled: number) => void;
};

type UploadResult = {
  cropped: Array<string | null>;
  originals: Array<string | null>;
};

/**
 * Build the localStorage key for a photo line. We index by the first cropped
 * URL because every approve generates fresh, unique CDN URLs — so the key is
 * stable per line and avoids collisions across orders.
 */
function stateStorageKey(firstCroppedUrl: string | null | undefined) {
  if (!firstCroppedUrl) return null;
  return STATE_STORAGE_PREFIX + firstCroppedUrl;
}

function readStoredPhotoState(
  firstCroppedUrl: string | null | undefined,
): StoredPhotoState | null {
  if (typeof window === 'undefined') return null;
  const key = stateStorageKey(firstCroppedUrl);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPhotoState | null;
    if (
      !parsed ||
      !Array.isArray(parsed.originalUrls) ||
      !Array.isArray(parsed.crops)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredPhotoState(
  firstCroppedUrl: string | null | undefined,
  payload: StoredPhotoState,
) {
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

function emptySlot(): PhotoSlotState {
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
    lowRes: false,
    fromGallery: false,
  };
}

/** Pick whichever URL the preview should display for this slot. */
function previewUrlFor(slot: PhotoSlotState): string | null {
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
 */
export function PhotoCustomizer({
  cartId,
  initialState,
  isEditing = false,
  imageUrl,
  imageAlt,
  color,
  onApprove,
  onUnapprove,
  onProgressChange,
}: PhotoCustomizerProps) {
  const {dict} = useI18n();
  const t = dict.photoCustomizer;

  const [slots, setSlots] = useState<PhotoSlotState[]>(() =>
    seedSlots(initialState),
  );
  const [cropDialogIndex, setCropDialogIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [approved, setApproved] = useState(() => !!initialState && !isEditing);
  const headingId = useId();

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

  const filledCount = slots.filter((s) => previewUrlFor(s)).length;
  const allFilled = filledCount === SLOT_COUNT;
  const anyDirty = slots.some((s) => s.dirty);

  const onProgressRef = useRef(onProgressChange);
  onProgressRef.current = onProgressChange;
  useEffect(() => {
    onProgressRef.current?.(filledCount);
  }, [filledCount]);

  function patchSlot(index: number, patch: Partial<PhotoSlotState>) {
    setSlots((current) => {
      const next = current.slice();
      next[index] = {...next[index], ...patch};
      return next;
    });
  }

  // Handlers below are memoized, so read approval state through refs —
  // otherwise they capture the first render's `approved === false` and
  // removing/replacing a photo after approval never un-approves.
  const approvedRef = useRef(approved);
  approvedRef.current = approved;
  const onUnapproveRef = useRef(onUnapprove);
  onUnapproveRef.current = onUnapprove;
  const markUnapproved = useCallback(() => {
    if (!approvedRef.current) return;
    approvedRef.current = false;
    setApproved(false);
    onUnapproveRef.current?.();
  }, []);

  /**
   * "Surprise me" — populate all three slots with random, brand-curated
   * photos from the gallery on Shopify Files. The slots are marked
   * non-dirty so the existing approve flow skips the upload step and
   * onApprove sends the gallery URLs straight through.
   */
  const handleSurprise = useCallback(() => {
    const emptyIdx = slots
      .map((slot, i) => (previewUrlFor(slot) ? -1 : i))
      .filter((i) => i >= 0);
    const ownPhotos = slots.some(
      (slot) => previewUrlFor(slot) && !slot.fromGallery,
    );
    // Some slots empty → fill only those, never touch the shopper's photos.
    // All full of gallery picks → re-roll all. All full with the shopper's
    // own photos → ask first (this used to overwrite silently).
    const targets =
      emptyIdx.length > 0 ? emptyIdx : [0, 1, 2].slice(0, SLOT_COUNT);
    if (
      emptyIdx.length === 0 &&
      ownPhotos &&
      !window.confirm(t.replaceConfirm)
    ) {
      return;
    }
    markUnapproved();
    setUploadError(null);
    const currentlyShown = slots
      .map((s) => s.uploadedCroppedUrl)
      .filter((url): url is string => Boolean(url));
    const picks = pickThreeFromGallery(currentlyShown);
    setSlots((current) =>
      current.map((slot, i) => {
        const k = targets.indexOf(i);
        if (k === -1) return slot;
        if (slot.imageObjectUrl) URL.revokeObjectURL(slot.imageObjectUrl);
        if (slot.thumbnailObjectUrl) URL.revokeObjectURL(slot.thumbnailObjectUrl);
        return {
          ...emptySlot(),
          uploadedCroppedUrl: picks[k],
          uploadedOriginalUrl: picks[k],
          dirty: false,
          fromGallery: true,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, t]);

  const handleFilePicked = useCallback(
    async (index: number, file: File) => {
      markUnapproved();
      const fileCheck = validatePhotoFile(file);
      if (!fileCheck.ok) {
        patchSlot(index, {error: t.errors[fileCheck.reason as string]});
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
        patchSlot(index, {
          error: t.errors[dimsCheck.reason as string].replaceAll(
            '{min}',
            String(MIN_PHOTO_DIMENSION),
          ),
        });
        return;
      }

      setSlots((current) => {
        const next = current.slice();
        const prev = next[index];
        if (prev.imageObjectUrl) URL.revokeObjectURL(prev.imageObjectUrl);
        if (prev.thumbnailObjectUrl)
          URL.revokeObjectURL(prev.thumbnailObjectUrl);
        next[index] = {
          ...emptySlot(),
          file,
          imageObjectUrl: loaded.objectUrl,
          imageEl: loaded.image,
          imageDimensions: {width: loaded.width, height: loaded.height},
          crop: getDefaultSquareCrop(loaded),
          dirty: true,
          lowRes: Boolean(dimsCheck.lowRes),
        };
        return next;
      });
      setCropDialogIndex(index);
    },
    [t, markUnapproved],
  );

  const handleEditCrop = useCallback(
    async (index: number) => {
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
    },
    [slots, t, markUnapproved],
  );

  const handleCropSaved = useCallback(
    async (cropPixels: CropPixels) => {
      const index = cropDialogIndex;
      if (index == null) return;
      setCropDialogIndex(null);
      focusSlotTile(index);

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
        if (prev.thumbnailObjectUrl)
          URL.revokeObjectURL(prev.thumbnailObjectUrl);
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
    },
    [cropDialogIndex, slots, t, markUnapproved],
  );

  const handleCropCancelled = useCallback(() => {
    focusSlotTile(cropDialogIndex);
    setCropDialogIndex(null);
  }, [cropDialogIndex]);

  const handleRemove = useCallback((index: number) => {
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
      let uploadResult: UploadResult = {
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
          const errBody = (await response
            .json()
            .catch(() => ({}))) as {error?: string};
          throw new Error(errBody.error || `upload-${response.status}`);
        }
        uploadResult = (await response.json()) as UploadResult;
      }

      if (!mountedRef.current) return;

      // 4. Merge uploaded URLs back into slots and build the attributes array.
      const finalCroppedUrls: Array<string | null> = [];
      const finalOriginalUrls: Array<string | null> = [];
      const finalCrops: Array<CropPixels | null> = [];
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

      const attributes: PhotoAttribute[] = [
        {key: 'Photo 1', value: finalCroppedUrls[0] as string},
        {key: 'Photo 2', value: finalCroppedUrls[1] as string},
        {key: 'Photo 3', value: finalCroppedUrls[2] as string},
      ];
      onApprove(attributes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'upload-failed';
      setUploadError(message);
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  const cropDialogSlot = cropDialogIndex == null ? null : slots[cropDialogIndex];

  const approveLabel = uploading
    ? t.uploading
    : isEditing
      ? t.saveChanges
      : t.approve;

  const isApproved = approved && !anyDirty;
  const approveDisabled = uploading || !allFilled || isApproved;
  const slotLabelFor = (n: number) => t.slotLabel.replace('{n}', String(n));
  const slotMessages = slots
    .map((slot, i) => ({i, slot}))
    .filter(({slot}) => slot.error || (slot.lowRes && previewUrlFor(slot)));

  return (
    <section className="photo-customizer" aria-labelledby={headingId}>
      <header className="photo-customizer__header">
        <h2 className="photo-customizer__title" id={headingId}>
          {t.heading}
        </h2>
        <p className="photo-customizer__subtitle">{t.subheading}</p>
      </header>

      <BoardCanvas
        slots={slots.map((slot) => ({
          thumbnailUrl: previewUrlFor(slot),
          error: slot.error,
        }))}
        slotLabel={slotLabelFor}
        slotsLabel={t.slotsLabel}
        pickLabel={t.pick}
        editLabel={t.editCrop}
        removeLabel={t.remove}
        disabled={uploading}
        imageUrl={imageUrl}
        imageAlt={imageAlt}
        color={color}
        surprise={{
          label: t.surprise?.button ?? 'Pick for me',
          swapLabel: t.surprise?.swap ?? 'Another round',
          onPick: handleSurprise,
          disabled: uploading,
        }}
        onFilePicked={handleFilePicked}
        onEditCrop={handleEditCrop}
        onRemove={handleRemove}
      />

      {slotMessages.length > 0 ? (
        <ul className="photo-customizer__messages">
          {slotMessages.map(({i, slot}) => (
            <li
              key={i}
              className={slot.error ? 'is-error' : 'is-warning'}
              role={slot.error ? 'alert' : 'status'}
            >
              <strong>{slotLabelFor(i + 1)}:</strong>{' '}
              {slot.error ?? t.lowRes}
            </li>
          ))}
        </ul>
      ) : null}

      {uploadError ? (
        <p className="photo-customizer__upload-error" role="alert">
          {t.errors.uploadFailed}
        </p>
      ) : null}

      <div className="photo-customizer__actions">
        {/* Progress text lives on the add-to-cart hint; here we only
            confirm success, and only offer "approve" once it can work. */}
        <p className="photo-customizer__progress" aria-live="polite">
          {isApproved ? (
            <span className="photo-customizer__ready">
              <span aria-hidden="true">✓</span>{' '}
              {isEditing ? t.savedNote : t.ready}
            </span>
          ) : null}
        </p>
        {isApproved || !allFilled ? null : (
          <button
            type="button"
            className="photo-customizer__approve"
            onClick={handleApprove}
            disabled={approveDisabled}
          >
            {approveLabel}
          </button>
        )}
      </div>

      {cropDialogSlot && cropDialogSlot.imageObjectUrl ? (
        <CropDialog
          imageUrl={cropDialogSlot.imageObjectUrl}
          initialCrop={cropDialogSlot.crop}
          slotLabel={slotLabelFor((cropDialogIndex ?? 0) + 1)}
          saveLabel={t.cropSave}
          cancelLabel={t.cropCancel}
          zoomLabel={t.zoom}
          hint={t.cropHint}
          onSave={handleCropSaved}
          onCancel={handleCropCancelled}
        />
      ) : null}
    </section>
  );
}

/**
 * After the crop dialog closes, the control that opened it may have been
 * replaced (empty "pick" tile → filled thumbnail), so return focus to the
 * slot's tile explicitly instead of letting it fall to <body>.
 */
function focusSlotTile(index: number | null) {
  if (index == null || typeof window === 'undefined') return;
  window.setTimeout(() => {
    const tile = document.querySelectorAll('.board-slots__tile')[index];
    tile?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }, 60);
}

function seedSlots(
  initialState: PhotoCustomizerInitialState | null | undefined,
): PhotoSlotState[] {
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
