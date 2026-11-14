"use client";

import { ImagePlus, RotateCcw, Save, Upload } from "lucide-react";
import { useEffect, useState } from "react";

type Fit = "fit" | "square-pad" | "square-crop";
type Format = "image/jpeg" | "image/png" | "image/webp";

type ImageSettings = {
  size: number; // longest side in px; 0 = keep original size
  fit: Fit;
  format: Format;
  quality: number; // 60-100
};

/** Default product image: 1000px square on white, JPEG at 92% (visually lossless, works in PDFs). */
export const DEFAULT_IMAGE_SETTINGS: ImageSettings = { size: 1000, fit: "square-pad", format: "image/jpeg", quality: 92 };

const storageKey = "product-image-defaults";
const sizePresets = [0, 600, 800, 1000, 1200, 1600, 2000];
const maxUploadBytes = 10 * 1024 * 1024;

function loadDefaults(): ImageSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") return { ...DEFAULT_IMAGE_SETTINGS, ...saved };
  } catch { /* Storage unavailable: fall back to built-in defaults. */ }
  return DEFAULT_IMAGE_SETTINGS;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("This image format is not supported by the browser. Use JPEG, PNG, or WebP."));
      image.src = String(reader.result); // data: URL keeps us within the page CSP
    };
    reader.readAsDataURL(file);
  });
}

type Processed = { blob: Blob; width: number; height: number; preview: string };

async function processImage(image: HTMLImageElement, settings: ImageSettings): Promise<Processed> {
  const srcW = image.naturalWidth;
  const srcH = image.naturalHeight;
  const longest = Math.max(srcW, srcH);
  // Never upscale: a small photo stays its own size.
  const target = settings.size > 0 ? Math.min(settings.size, longest) : longest;

  let canvasW: number, canvasH: number;
  let sx = 0, sy = 0, sw = srcW, sh = srcH, dx = 0, dy = 0, dw: number, dh: number;

  if (settings.fit === "fit") {
    const scale = target / longest;
    canvasW = dw = Math.round(srcW * scale);
    canvasH = dh = Math.round(srcH * scale);
  } else if (settings.fit === "square-pad") {
    canvasW = canvasH = target;
    const scale = target / longest;
    dw = Math.round(srcW * scale);
    dh = Math.round(srcH * scale);
    dx = Math.round((target - dw) / 2);
    dy = Math.round((target - dh) / 2);
  } else {
    const side = Math.min(srcW, srcH);
    const squareTarget = settings.size > 0 ? Math.min(settings.size, side) : side;
    canvasW = canvasH = dw = dh = squareTarget;
    sx = Math.round((srcW - side) / 2);
    sy = Math.round((srcH - side) / 2);
    sw = sh = side;
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser.");
  if (settings.format !== "image/png") {
    ctx.fillStyle = "#ffffff"; // JPEG has no transparency; pad with white
    ctx.fillRect(0, 0, canvasW, canvasH);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);

  const quality = settings.quality / 100;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, settings.format, quality));
  if (!blob) throw new Error("The image could not be converted.");
  return { blob, width: canvasW, height: canvasH, preview: canvas.toDataURL(settings.format, quality) };
}

const extensions: Record<Format, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function ProductImageUploader({ itemId, itemCode, hasImage }: { itemId: string; itemCode: string; hasImage: boolean }) {
  const [settings, setSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [result, setResult] = useState<Processed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    processImage(image, settings)
      .then((processed) => { if (!cancelled) { setResult(processed); setError(null); } })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [image, settings]);

  function update<K extends keyof ImageSettings>(key: K, value: ImageSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSavedNote(null);
  }

  async function onPick(picked: File | undefined) {
    setResult(null);
    setError(null);
    setImage(null);
    setFile(picked || null);
    if (!picked) return;
    // Saved defaults live in the browser, so read them on first use rather than during render.
    if (!defaultsLoaded) {
      setSettings(loadDefaults());
      setDefaultsLoaded(true);
    }
    try {
      setImage(await loadImage(picked));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function upload() {
    if (!result || !file) return;
    if (result.blob.size > maxUploadBytes) {
      setError(`The optimised image is ${formatBytes(result.blob.size)}. Choose a smaller size or lower quality (max 10 MB).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const baseName = (itemCode || file.name.replace(/\.[^.]+$/, "") || "product").replace(/[^\w.-]+/g, "-");
      const body = new FormData();
      body.set("itemId", itemId);
      body.set("file", new File([result.blob], `${baseName}.${extensions[settings.format]}`, { type: settings.format }));
      const response = await fetch("/api/items/images", { method: "POST", body, redirect: "follow" });
      // The route answers with a redirect carrying ?notice= or ?error=.
      window.location.assign(response.redirected ? response.url : "/items");
    } catch {
      setError("Upload failed. Check your connection and try again.");
      setBusy(false);
    }
  }

  function saveDefaults() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
      setSavedNote("Saved as your default image settings.");
    } catch {
      setSavedNote("Could not save defaults in this browser.");
    }
  }

  function resetDefaults() {
    setSettings(DEFAULT_IMAGE_SETTINGS);
    try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setSavedNote("Reset to standard defaults (1000px square, JPEG 92%).");
  }

  return (
    <div className="image-uploader">
      <label className="upload-drop">
        <ImagePlus size={26} />
        <strong>{file ? file.name : hasImage ? "Replace product image" : "Choose product image"}</strong>
        <span>JPEG, PNG, or WebP · resized and optimised before upload</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          onChange={(event) => onPick(event.target.files?.[0])}
        />
      </label>

      {file ? (<>
      <div className="image-settings">
        <div className="field">
          <label>Size (longest side)</label>
          <select value={settings.size} onChange={(event) => update("size", Number(event.target.value))}>
            {sizePresets.map((size) => (
              <option key={size} value={size}>{size === 0 ? "Original size" : `${size} px${size === DEFAULT_IMAGE_SETTINGS.size ? " (standard)" : ""}`}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Shape</label>
          <select value={settings.fit} onChange={(event) => update("fit", event.target.value as Fit)}>
            <option value="square-pad">Square, white background</option>
            <option value="square-crop">Square, crop to fill</option>
            <option value="fit">Keep original proportions</option>
          </select>
        </div>
        <div className="field">
          <label>Format</label>
          <select value={settings.format} onChange={(event) => update("format", event.target.value as Format)}>
            <option value="image/jpeg">JPEG (best for PDFs)</option>
            <option value="image/png">PNG (lossless, transparent)</option>
            <option value="image/webp">WebP (smallest, not in PDFs)</option>
          </select>
        </div>
        <div className="field">
          <label>Quality {settings.format === "image/png" ? "(lossless)" : `${settings.quality}%`}</label>
          <input
            type="range"
            min={60}
            max={100}
            step={1}
            value={settings.quality}
            disabled={settings.format === "image/png"}
            onChange={(event) => update("quality", Number(event.target.value))}
          />
        </div>
      </div>

      <div className="image-settings-actions">
        <button className="button subtle tiny" type="button" onClick={saveDefaults}><Save size={14} /> Save as default</button>
        <button className="button subtle tiny" type="button" onClick={resetDefaults}><RotateCcw size={14} /> Reset</button>
      </div>
      {savedNote ? <small className="muted">{savedNote}</small> : null}
      </>) : null}

      {result && file ? (
        <div className="image-result">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Optimised preview" src={result.preview} />
          <div>
            <span>Original: {image?.naturalWidth}×{image?.naturalHeight} · {formatBytes(file.size)}</span>
            <strong>Optimised: {result.width}×{result.height} · {formatBytes(result.blob.size)}</strong>
          </div>
        </div>
      ) : null}

      {error ? <p className="notice error" role="alert">{error}</p> : null}

      <button className="button" type="button" disabled={!result || busy} onClick={upload}>
        <Upload size={15} /> {busy ? "Uploading…" : "Upload image"}
      </button>
    </div>
  );
}
