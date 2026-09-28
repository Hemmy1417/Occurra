/**
 * Preparing images for the record. GenVM's model gateway accepts only PNG
 * and JPEG whose bytes begin FF D8 FF E0 (JFIF), and the contract refuses
 * anything else at filing. Camera photos are usually
 * EXIF JPEGs (FF D8 FF E1), so every image is redrawn here, at no more than
 * 1,024 pixels, and re-encoded as a JFIF JPEG under the contract's size
 * limit. The capture date and position are read from the original's EXIF
 * block first, and filed as what they are: the submitter's claims.
 */

export const IMAGE_MAX_BYTES = 400_000;
export const MAX_EDGE = 1024;
const JFIF_APP0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];

/** FF D8 FF E0, then the APP0 length, then "JFIF" and a zero byte: the header the contract checks. */
export function isJfif(b: Uint8Array): boolean {
  const name = [0x4a, 0x46, 0x49, 0x46, 0x00];
  return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b[3] === 0xe0 && name.every((v, i) => b[6 + i] === v);
}

export function isPng(b: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return sig.every((v, i) => b[i] === v);
}

/**
 * A JPEG whose first segment is the JFIF APP0 marker. Browsers' canvas
 * encoders write one already; a JPEG without it gets the standard 18-byte
 * JFIF segment inserted after its start-of-image marker, which every
 * decoder reads and which changes no pixel.
 */
export function ensureJfif(jpeg: Uint8Array): Uint8Array {
  if (isJfif(jpeg)) return jpeg;
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("The encoder did not produce a JPEG.");
  const out = new Uint8Array(jpeg.length + JFIF_APP0.length);
  out.set([0xff, 0xd8], 0);
  out.set(JFIF_APP0, 2);
  out.set(jpeg.subarray(2), 2 + JFIF_APP0.length);
  return out;
}

/** The dimensions an image is redrawn at: the long edge at most MAX_EDGE. */
export function fitWithin(width: number, height: number, edge = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface PreparedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  /** a blob URL for the preview; revoke when done */
  preview: string;
  claimedCapture: string;
  claimedLocation: string;
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("This browser could not encode the image.");
  return ensureJfif(new Uint8Array(await blob.arrayBuffer()));
}

/** Draw a source onto a canvas at the fitted size and encode it under the limit. */
export async function encodeForRecord(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  let edge = MAX_EDGE;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { width, height } = fitWithin(sourceWidth, sourceHeight, edge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw images.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    for (const quality of [0.86, 0.78, 0.7]) {
      const bytes = await encode(canvas, quality);
      if (bytes.length <= IMAGE_MAX_BYTES) return { bytes, width, height };
    }
    edge = Math.round(edge * 0.8);
  }
  throw new Error("The image could not be reduced below 400 KB.");
}

function two(n: number): string {
  return String(n).padStart(2, "0");
}

/** EXIF DateTimeOriginal and GPS position, as the photo itself reports them. */
export async function readClaims(file: File): Promise<{ capture: string; location: string }> {
  try {
    const exifr = (await import("exifr")).default;
    const tags = (await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"], gps: true })) as
      | { DateTimeOriginal?: Date; CreateDate?: Date; latitude?: number; longitude?: number }
      | undefined;
    const when = tags?.DateTimeOriginal ?? tags?.CreateDate;
    const capture = when instanceof Date && !Number.isNaN(when.getTime())
      ? `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())} ${two(when.getHours())}:${two(when.getMinutes())}`
      : "";
    const location = typeof tags?.latitude === "number" && typeof tags?.longitude === "number"
      ? `${tags.latitude.toFixed(5)}, ${tags.longitude.toFixed(5)}`
      : "";
    return { capture, location };
  } catch {
    return { capture: "", location: "" };
  }
}

/** A photograph or a scanned page, from a file the person picked. */
export async function preparePhoto(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const claims = await readClaims(file);
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { bytes, width, height } = await encodeForRecord(bitmap, bitmap.width, bitmap.height);
    const preview = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/jpeg" }));
    return { bytes, width, height, preview, claimedCapture: claims.capture, claimedLocation: claims.location };
  } finally {
    bitmap.close();
  }
}
