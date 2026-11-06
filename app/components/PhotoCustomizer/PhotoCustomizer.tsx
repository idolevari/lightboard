import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {useI18n} from '~/lib/useI18n';
import {
  fetchRemoteImageAsBlob,
  getDefaultCrop,
  loadImageFromFile,
  MIN_PHOTO_DIMENSION,
  renderCropToJpegBlob,
  renderCropUnderCap,
  validatePhotoDimensions,
  validatePhotoFile,
} from '~/lib/photo-canvas';
import type {CropPixels} from '~/lib/photo-canvas';
import {pickThreeFromGallery} from '~/lib/surprise-gallery';
import {
  CUSTOMIZER_CONFIG,
  LINE_ATTR,
  maxPrintEdge,
} from '~/lib/customizer-config';
import type {CustomizerKind} from '~/lib/customizer-config';
import {
  PRINTBOARD_PRESETS,
  findPreset,
  presetDefaultCrop,
  presetPreviewUrl,
  presetPrintUrl,
} from '~/lib/printboard-presets';
import {BoardCanvas} from './BoardCanvas';
import {CropDialog} from './CropDialog';
import {
  BOARD_PATH,
  BOARD_VIEWBOX,
  PrintboardPreview,
} from './PrintboardPreview';
import type {BoardPhoto} from './PrintboardPreview';
import {PrintboardStage} from './PrintboardStage';

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
  /** Printboard ready-made design (lives on the CDN, never uploaded). */
  presetId: string | null;
};

type StoredPhotoState = {
  originalUrls: Array<string | null>;
  crops: Array<CropPixels | null>;
};

export type PhotoCustomizerInitialState = {
  croppedUrls: string[];
  originalUrls: Array<string | null>;
  crops: Array<CropPixels | null>;
  /** Printboard: the ready-made design on the line, if any. */
  presetIds?: Array<string | null>;
};

export type PhotoAttribute = {key: string; value: string};

export type PhotoCustomizerProps = {
  /** Which product this customizes (slot count, crop aspect, preview). */
  kind?: CustomizerKind;
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
  /** Reports how many slots are filled (drives the ATC label). */
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
    presetId: null,
  };
}

function revokeSlotUrls(slot: PhotoSlotState | null | undefined) {
  if (!slot) return;
  if (slot.imageObjectUrl) URL.revokeObjectURL(slot.imageObjectUrl);
  if (slot.thumbnailObjectUrl) URL.revokeObjectURL(slot.thumbnailObjectUrl);
}

/** Slot showing a Printboard preset, framed by `crop` (default framing). */
function presetSlot(
  presetId: string,
  crop?: CropPixels | null,
): PhotoSlotState {
  const preset = findPreset(presetId);
  if (!preset) return emptySlot();
  const frame = crop ?? presetDefaultCrop(preset);
  return {
    ...emptySlot(),
    crop: frame,
    uploadedCroppedUrl: presetPrintUrl(preset, frame),
    uploadedOriginalUrl: preset.url,
    imageDimensions: {width: preset.width, height: preset.height},
    fromGallery: true,
    presetId,
  };
}

/** Read the region crop back out of a preset print URL (edit from cart). */
function parseRegionCrop(url: string | null | undefined): CropPixels | null {
  if (!url) return null;
  try {
    const q = new URL(url).searchParams;
    const n = (k: string) => Number(q.get(k));
    const crop = {
      x: n('crop_left'),
      y: n('crop_top'),
      width: n('crop_width'),
      height: n('crop_height'),
    };
    return crop.width > 0 && crop.height > 0 ? crop : null;
  } catch {
    return null;
  }
}

/** Pick whichever URL the preview should display for this slot. */
function previewUrlFor(slot: PhotoSlotState): string | null {
  return slot.thumbnailObjectUrl || slot.uploadedCroppedUrl || null;
}

/**
 * Top-level photo customizer for the photo products' PDP.
 *
 * Lightboard: picking, cropping, previewing and uploading three square
 * photos. Printboard: one 2:5 photo (own upload or a ready-made design)
 * previewed live on the board. Calls `onApprove` with a Shopify
 * line-item-attribute array once every slot is cropped, uploaded to Shopify
 * Files (presets and gallery photos skip the upload), and the user clicks
 * Approve. The parent (ProductForm) merges those attributes into LinesAdd or
 * LinesUpdate as appropriate.
 */
export function PhotoCustomizer({
  kind = 'lightboard',
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
  const pt = dict.printboard;
  const config = CUSTOMIZER_CONFIG[kind];
  const isPrint = kind === 'printboard';
  const slotCount = config.slotCount;

  const [slots, setSlots] = useState<PhotoSlotState[]>(() =>
    seedSlots(initialState, slotCount),
  );
  // Printboard: the shopper's own photo, set aside while a ready-made
  // design is on the board, so switching back doesn't lose it.
  const [ownStash, setOwnStash] = useState<PhotoSlotState | null>(null);
  const ownStashRef = useRef(ownStash);
  ownStashRef.current = ownStash;
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
      for (const slot of slotsAtMount) revokeSlotUrls(slot);
      revokeSlotUrls(ownStashRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filledCount = slots.filter((s) => previewUrlFor(s)).length;
  const allFilled = filledCount === slotCount;
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
      emptyIdx.length > 0 ? emptyIdx : [0, 1, 2].slice(0, slotCount);
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
        if (slot.thumbnailObjectUrl)
          URL.revokeObjectURL(slot.thumbnailObjectUrl);
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
      const lowRes =
        maxPrintEdge(loaded, config.aspect) < config.recommendedPrintEdge;
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

      // A new own photo replaces any one set aside for a preset.
      if (ownStashRef.current) {
        revokeSlotUrls(ownStashRef.current);
        setOwnStash(null);
      }
      setSlots((current) => {
        const next = current.slice();
        revokeSlotUrls(next[index]);
        next[index] = {
          ...emptySlot(),
          file,
          imageObjectUrl: loaded.objectUrl,
          imageEl: loaded.image,
          imageDimensions: {width: loaded.width, height: loaded.height},
          crop: getDefaultCrop(loaded, config.aspect),
          dirty: true,
          lowRes,
        };
        return next;
      });
      setCropDialogIndex(index);
    },
    [t, markUnapproved, config],
  );

  const handleEditCrop = useCallback(
    async (index: number) => {
      markUnapproved();
      const slot = slots[index];
      // Presets crop straight from the CDN original: nothing to fetch.
      if (slot.imageEl || slot.presetId) {
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
            crop: prev.crop ?? getDefaultCrop(loaded, config.aspect),
            error: null,
          };
          return next;
        });
        setCropDialogIndex(index);
      } catch {
        patchSlot(index, {error: t.errors.loadFailed});
      }
    },
    [slots, t, markUnapproved, config],
  );

  const handleCropSaved = useCallback(
    async (cropPixels: CropPixels) => {
      const index = cropDialogIndex;
      if (index == null) return;
      setCropDialogIndex(null);
      focusSlotTile(index);

      const slot = slots[index];
      if (slot.presetId) {
        // Re-framed preset: the CDN renders the new crop, nothing uploads.
        const presetId = slot.presetId;
        setSlots((current) => {
          const next = current.slice();
          next[index] = presetSlot(presetId, cropPixels);
          return next;
        });
        markUnapproved();
        return;
      }
      if (!slot.imageEl) return;

      let thumbnailBlob;
      try {
        thumbnailBlob = await renderCropToJpegBlob(
          slot.imageEl,
          cropPixels,
          config.thumbnail,
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
    [cropDialogIndex, slots, t, markUnapproved, config],
  );

  const handleCropCancelled = useCallback(() => {
    focusSlotTile(cropDialogIndex);
    setCropDialogIndex(null);
  }, [cropDialogIndex]);

  /** Printboard: put a ready-made design on the board. */
  const handleSelectPreset = useCallback(
    (presetId: string) => {
      const current = slots[0];
      if (current?.presetId === presetId) return;
      markUnapproved();
      setUploadError(null);
      if (current && previewUrlFor(current) && !current.presetId) {
        // Keep the shopper's own photo (and its object URLs) to come back to.
        setOwnStash(current);
      } else if (current && !current.presetId) {
        revokeSlotUrls(current);
      }
      setSlots([presetSlot(presetId)]);
    },
    [slots, markUnapproved],
  );

  /** Printboard: switch back to the shopper's own photo set aside earlier. */
  const handleSelectOwn = useCallback(() => {
    const stash = ownStashRef.current;
    if (!stash) return;
    markUnapproved();
    setOwnStash(null);
    setSlots([stash]);
  }, [markUnapproved]);

  const handleRemove = useCallback((index: number) => {
    markUnapproved();
    setSlots((current) => {
      const next = current.slice();
      revokeSlotUrls(next[index]);
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
          return renderCropUnderCap(
            slot.imageEl,
            slot.crop,
            config.output,
            config.outputQuality,
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
        cropped: slots.map(() => null),
        originals: slots.map(() => null),
      };
      const hasUploads = slots.some((s) => s.dirty);
      if (hasUploads) {
        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          body: form,
        });
        if (!response.ok) {
          const errBody = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
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

      const attributes: PhotoAttribute[] = finalCroppedUrls.map((url, i) => ({
        key: LINE_ATTR.photo(i + 1),
        value: url as string,
      }));
      if (isPrint) {
        // The studio prints "Photo 1"; it also gets the source to re-crop
        // from (own photo) or the design's name and id (ready-made).
        const presetId = updatedSlots[0]?.presetId;
        if (presetId) {
          attributes.push(
            {key: LINE_ATTR.design, value: presetNameFor(presetId)},
            {key: LINE_ATTR.designId, value: presetId},
          );
        } else if (finalOriginalUrls[0]) {
          attributes.push({
            key: LINE_ATTR.original,
            value: finalOriginalUrls[0],
          });
        }
      }
      onApprove(attributes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'upload-failed';
      setUploadError(message);
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  const cropDialogSlot =
    cropDialogIndex == null ? null : slots[cropDialogIndex];
  const cropDialogPreset = findPreset(cropDialogSlot?.presetId);
  const cropDialogImageUrl =
    cropDialogSlot?.imageObjectUrl ?? cropDialogPreset?.url ?? null;

  function presetNameFor(id: string): string {
    return (pt.presets as Record<string, string>)[id] ?? id;
  }

  const approveLabel = uploading
    ? t.uploading
    : isEditing
      ? t.saveChanges
      : isPrint
        ? pt.approve
        : t.approve;

  const isApproved = approved && !anyDirty;
  const approveDisabled = uploading || !allFilled || isApproved;
  const slotLabelFor = (n: number) =>
    isPrint ? pt.ownPhoto : t.slotLabel.replace('{n}', String(n));
  const slotMessages = slots
    .map((slot, i) => ({i, slot}))
    .filter(({slot}) => slot.error || (slot.lowRes && previewUrlFor(slot)));

  return (
    <section className="photo-customizer" aria-labelledby={headingId}>
      <header className="photo-customizer__header">
        <h2 className="photo-customizer__title" id={headingId}>
          {isPrint ? pt.heading : t.heading}
        </h2>
        <p className="photo-customizer__subtitle">
          {isPrint ? pt.subheading : t.subheading}
        </p>
      </header>

      {isPrint ? (
        <PrintboardStage
          photo={boardPhotoFor(slots[0])}
          presets={PRINTBOARD_PRESETS}
          selectedPresetId={slots[0]?.presetId ?? null}
          ownSelected={Boolean(previewUrlFor(slots[0]) && !slots[0].presetId)}
          ownThumbUrl={
            ownStash
              ? previewUrlFor(ownStash)
              : !slots[0]?.presetId
                ? previewUrlFor(slots[0])
                : null
          }
          hasError={Boolean(slots[0]?.error)}
          disabled={uploading}
          labels={{
            previewLabel: pt.previewLabel,
            previewEmpty: pt.previewEmpty,
            sourcesLabel: pt.sourcesLabel,
            presetsTitle: pt.presetsTitle,
            ownPhoto: pt.ownPhoto,
            upload: pt.upload,
            replace: pt.replace,
            adjust: pt.adjust,
            remove: pt.remove,
            presetName: presetNameFor,
          }}
          onFilePicked={(file) => void handleFilePicked(0, file)}
          onSelectOwn={handleSelectOwn}
          onSelectPreset={handleSelectPreset}
          onAdjust={() => void handleEditCrop(0)}
          onRemove={() => handleRemove(0)}
        />
      ) : (
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
      )}

      {slotMessages.length > 0 ? (
        <ul className="photo-customizer__messages">
          {slotMessages.map(({i, slot}) => (
            <li
              key={i}
              className={slot.error ? 'is-error' : 'is-warning'}
              role={slot.error ? 'alert' : 'status'}
            >
              <strong>{slotLabelFor(i + 1)}:</strong>{' '}
              {slot.error ?? (isPrint ? pt.lowRes : t.lowRes)}
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
              {isEditing ? t.savedNote : isPrint ? pt.ready : t.ready}
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

      {cropDialogSlot && cropDialogImageUrl ? (
        <CropDialog
          imageUrl={cropDialogImageUrl}
          initialCrop={cropDialogSlot.crop}
          slotLabel={
            isPrint ? pt.cropTitle : slotLabelFor((cropDialogIndex ?? 0) + 1)
          }
          saveLabel={t.cropSave}
          cancelLabel={t.cropCancel}
          zoomLabel={t.zoom}
          hint={isPrint ? pt.cropHint : t.cropHint}
          aspect={config.aspect}
          overlay={isPrint ? <BoardCropOverlay /> : undefined}
          renderPreview={
            isPrint
              ? (area) => (
                  <>
                    <PrintboardPreview
                      wall={false}
                      label={pt.livePreview}
                      photo={{
                        src: cropDialogImageUrl,
                        width: cropDialogSlot.imageDimensions?.width,
                        height: cropDialogSlot.imageDimensions?.height,
                        crop: area,
                      }}
                    />
                    <p
                      className="crop-dialog__preview-label"
                      aria-hidden="true"
                    >
                      {pt.livePreview}
                    </p>
                  </>
                )
              : undefined
          }
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
    const tile =
      document.querySelectorAll('.board-slots__tile')[index] ??
      document.querySelector('.pb-stage');
    tile?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }, 60);
}

/**
 * What the Printboard preview draws for a slot: the full source plus the
 * crop rect when we have both (live and exact), else the cropped image.
 */
function boardPhotoFor(slot: PhotoSlotState | undefined): BoardPhoto | null {
  if (!slot) return null;
  const preset = findPreset(slot.presetId);
  if (preset) {
    return {
      src: presetPreviewUrl(preset, 1200),
      width: preset.width,
      height: preset.height,
      crop: slot.crop ?? presetDefaultCrop(preset),
    };
  }
  // Only once cropped: a freshly picked photo opens the crop dialog first.
  if (
    slot.thumbnailObjectUrl &&
    slot.imageObjectUrl &&
    slot.crop &&
    slot.imageDimensions
  ) {
    return {
      src: slot.imageObjectUrl,
      width: slot.imageDimensions.width,
      height: slot.imageDimensions.height,
      crop: slot.crop,
    };
  }
  if (slot.thumbnailObjectUrl) return {src: slot.thumbnailObjectUrl};
  if (slot.uploadedCroppedUrl) return {src: slot.uploadedCroppedUrl};
  return null;
}

/** Board outline over the 2:5 crop stage; outside the board is dimmed. */
function BoardCropOverlay() {
  const {width: W, height: H} = BOARD_VIEWBOX;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path
        d={`M0 0H${W}V${H}H0Z ${BOARD_PATH}`}
        fillRule="evenodd"
        fill="rgba(11, 58, 74, 0.62)"
      />
      <path
        d={BOARD_PATH}
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function seedSlots(
  initialState: PhotoCustomizerInitialState | null | undefined,
  slotCount: number,
): PhotoSlotState[] {
  if (initialState && initialState.croppedUrls?.length === slotCount) {
    return initialState.croppedUrls.map((croppedUrl, i) => {
      const presetId = initialState.presetIds?.[i] ?? null;
      if (presetId && findPreset(presetId)) {
        return presetSlot(presetId, parseRegionCrop(croppedUrl));
      }
      return {
        ...emptySlot(),
        crop: initialState.crops?.[i] ?? null,
        uploadedCroppedUrl: croppedUrl,
        uploadedOriginalUrl: initialState.originalUrls?.[i] ?? null,
        dirty: false,
      };
    });
  }
  return Array.from({length: slotCount}, () => emptySlot());
}
