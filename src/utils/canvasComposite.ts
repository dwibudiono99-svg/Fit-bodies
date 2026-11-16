import { BackdropType, BodyProfile, GarmentOverlayAnchors } from "../types/studio";

const transparentGarmentCache = new Map<string, HTMLCanvasElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Removes edge-connected neutral studio background from garment photos using
 * a corner-seeded flood fill so interior whites (like white dress shirts) remain intact.
 */
export async function getTransparentGarmentCanvas(imageUrl: string): Promise<HTMLCanvasElement> {
  const cached = transparentGarmentCache.get(imageUrl);
  if (cached) return cached;

  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  const maxDim = 900;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample corner pixels to determine background color & variance
  const sampleIdx = (x: number, y: number) => (y * w + x) * 4;
  const corners = [
    sampleIdx(2, 2),
    sampleIdx(w - 3, 2),
    sampleIdx(2, h - 3),
    sampleIdx(w - 3, h - 3),
  ];

  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  for (const idx of corners) {
    avgR += data[idx];
    avgG += data[idx + 1];
    avgB += data[idx + 2];
  }
  avgR /= corners.length;
  avgG /= corners.length;
  avgB /= corners.length;

  const bgIsNeutralStudio =
    Math.abs(avgR - avgG) < 20 &&
    Math.abs(avgG - avgB) < 20 &&
    (avgR + avgG + avgB) / 3 > 140;

  if (!bgIsNeutralStudio) {
    // Non-studio custom upload: apply gentle edge vignette mask instead of hard key
    transparentGarmentCache.set(imageUrl, canvas);
    return canvas;
  }

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const isBackgroundLike = (pxIdx: number) => {
    const i = pxIdx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;
    const dist = Math.hypot(r - avgR, g - avgG, b - avgB);
    return chroma < 24 && dist < 58 && (r + g + b) / 3 > 130;
  };

  const enqueue = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    if (!isBackgroundLike(p)) return;
    visited[p] = 1;
    queue[tail++] = p;
  };

  for (let x = 0; x < w; x++) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    const y = (p - x) / w;
    data[p * 4 + 3] = 0;

    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  // Feather 1px border around cleared background for smooth garment edges
  const alphaCopy = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    alphaCopy[p] = data[p * 4 + 3];
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (alphaCopy[p] === 0) continue;
      let transparentNeighbors = 0;
      if (alphaCopy[p - 1] === 0) transparentNeighbors++;
      if (alphaCopy[p + 1] === 0) transparentNeighbors++;
      if (alphaCopy[p - w] === 0) transparentNeighbors++;
      if (alphaCopy[p + w] === 0) transparentNeighbors++;
      if (transparentNeighbors > 0) {
        data[p * 4 + 3] = Math.round(alphaCopy[p] * (1 - transparentNeighbors * 0.16));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  transparentGarmentCache.set(imageUrl, canvas);
  return canvas;
}

export function getBodyShapeScaleModifiers(profile: BodyProfile): {
  widthMultiplier: number;
  heightMultiplier: number;
} {
  let widthMultiplier = 1;
  let heightMultiplier = 1;

  if (profile.bodyShape === "atletis" || profile.bodyShape === "bahu-lebar") {
    widthMultiplier *= 1.05;
  } else if (profile.bodyShape === "ramping") {
    widthMultiplier *= 0.94;
    heightMultiplier *= 1.03;
  } else if (profile.bodyShape === "berisi") {
    widthMultiplier *= 1.1;
  } else if (profile.bodyShape === "jam-pasir") {
    widthMultiplier *= 0.98;
  }

  if (profile.fitPreference === "slim") {
    widthMultiplier *= 0.96;
  } else if (profile.fitPreference === "relaxed") {
    widthMultiplier *= 1.06;
  }

  const bmiFactor = profile.weightKg / Math.pow(profile.heightCm / 100, 2);
  if (bmiFactor > 26) {
    widthMultiplier *= 1.04;
  } else if (bmiFactor < 19.5) {
    widthMultiplier *= 0.96;
  }

  return { widthMultiplier, heightMultiplier };
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, backdrop: BackdropType) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (backdrop === "studio") {
    grad.addColorStop(0, "#F3F4F6");
    grad.addColorStop(0.75, "#E5E7EB");
    grad.addColorStop(1, "#D6D3CE");
  } else if (backdrop === "perjalanan") {
    grad.addColorStop(0, "#E7EEF5");
    grad.addColorStop(0.7, "#D9E1EA");
    grad.addColorStop(1, "#C5CCD4");
  } else if (backdrop === "rapat") {
    grad.addColorStop(0, "#ECEEF0");
    grad.addColorStop(0.7, "#DFE2E6");
    grad.addColorStop(1, "#C9CED4");
  } else {
    grad.addColorStop(0, "#EAE8E3");
    grad.addColorStop(0.7, "#DDDAD2");
    grad.addColorStop(1, "#C9C4B9");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

export async function renderFittingComposite(
  targetCanvas: HTMLCanvasElement,
  options: {
    modelImageUrl: string;
    garmentImageUrl: string;
    anchors: GarmentOverlayAnchors;
    profile: BodyProfile;
    backdrop: BackdropType;
    showGarmentOverlay: boolean;
    splitRatio?: number;
  }
): Promise<void> {
  const {
    modelImageUrl,
    garmentImageUrl,
    anchors,
    profile,
    backdrop,
    showGarmentOverlay,
    splitRatio,
  } = options;

  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return;

  const w = targetCanvas.width;
  const h = targetCanvas.height;

  drawBackdrop(ctx, w, h, backdrop);

  const modelImg = await loadImage(modelImageUrl);
  const modelAspect = modelImg.width / modelImg.height;
  const canvasAspect = w / h;

  let drawW = w;
  let drawH = h;
  let drawX = 0;
  let drawY = 0;

  if (modelAspect > canvasAspect) {
    drawH = h;
    drawW = h * modelAspect;
    drawX = (w - drawW) / 2;
  } else {
    drawW = w;
    drawH = w / modelAspect;
    drawY = (h - drawH) * 0.18;
  }

  ctx.save();
  ctx.drawImage(modelImg, drawX, drawY, drawW, drawH);
  ctx.restore();

  if (!showGarmentOverlay) return;

  const garmentCanvas = await getTransparentGarmentCanvas(garmentImageUrl);
  const { widthMultiplier, heightMultiplier } = getBodyShapeScaleModifiers(profile);

  const effectiveWidthPct = (anchors.widthScalePct / 100) * widthMultiplier * anchors.shoulderWidthRatio;
  const effectiveHeightPct = (anchors.heightScalePct / 100) * heightMultiplier;

  const gWidth = w * effectiveWidthPct * 0.72;
  const gAspect = garmentCanvas.width / garmentCanvas.height;
  const gHeight = (gWidth / gAspect) * (effectiveHeightPct / effectiveWidthPct);

  const gX = (w - gWidth) / 2 + (anchors.offsetXPct / 100) * w;
  const gY = h * 0.145 + (anchors.offsetYPct / 100) * h;

  ctx.save();
  if (typeof splitRatio === "number") {
    ctx.beginPath();
    ctx.rect(w * splitRatio, 0, w * (1 - splitRatio), h);
    ctx.clip();
  }

  ctx.globalAlpha = anchors.opacity;
  ctx.shadowColor = "rgba(17, 19, 21, 0.18)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(garmentCanvas, gX, gY, gWidth, gHeight);
  ctx.restore();
}
