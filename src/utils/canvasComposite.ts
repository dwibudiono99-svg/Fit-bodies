import {
  BackdropType,
  BodyLandmarks,
  BodyProfile,
  GarmentOverlayAnchors,
} from "../types/studio";

interface ProcessedGarment {
  canvas: HTMLCanvasElement;
  bounds: {
    topRatio: number;
    bottomRatio: number;
    leftRatio: number;
    rightRatio: number;
    collarRow: number;
  };
}

const processedGarmentCache = new Map<string, ProcessedGarment>();

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
 * Removes edge-connected neutral studio background and detects tight garment
 * bounding box so warping aligns strictly with the actual collar, shoulders, and hem.
 */
export async function getProcessedGarment(imageUrl: string): Promise<ProcessedGarment> {
  const cached = processedGarmentCache.get(imageUrl);
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
  if (!ctx) {
    return {
      canvas,
      bounds: { topRatio: 0.05, bottomRatio: 0.95, leftRatio: 0.15, rightRatio: 0.85, collarRow: 0.08 },
    };
  }

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

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
    Math.abs(avgR - avgG) < 22 &&
    Math.abs(avgG - avgB) < 22 &&
    (avgR + avgG + avgB) / 3 > 138;

  if (bgIsNeutralStudio) {
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
      return chroma < 25 && dist < 60 && (r + g + b) / 3 > 128;
    };

    const enqueue = (x: number, y: number) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      const p = y * w + x;
      if (visited[p] || !isBackgroundLike(p)) return;
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

    // Smooth 1px edge feathering
    const alphaCopy = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) alphaCopy[p] = data[p * 4 + 3];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (alphaCopy[p] === 0) continue;
        let cleared = 0;
        if (alphaCopy[p - 1] === 0) cleared++;
        if (alphaCopy[p + 1] === 0) cleared++;
        if (alphaCopy[p - w] === 0) cleared++;
        if (alphaCopy[p + w] === 0) cleared++;
        if (cleared > 0) {
          data[p * 4 + 3] = Math.round(alphaCopy[p] * (1 - cleared * 0.16));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // Compute tight non-transparent bounding box of the garment
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    minX = 0;
    maxX = w - 1;
    minY = 0;
    maxY = h - 1;
  }

  const result: ProcessedGarment = {
    canvas,
    bounds: {
      topRatio: minY / h,
      bottomRatio: maxY / h,
      leftRatio: minX / w,
      rightRatio: maxX / w,
      collarRow: minY / h,
    },
  };
  processedGarmentCache.set(imageUrl, result);
  return result;
}

export function deriveLandmarksFromProfile(profile: BodyProfile): BodyLandmarks {
  const bmi = profile.weightKg / Math.pow(profile.heightCm / 100, 2);
  const bmiDelta = Math.max(-0.15, Math.min(0.22, (bmi - 22) * 0.022));

  let shoulderSpan = profile.gender === "pria" ? 33 : 29;
  let chestW = profile.gender === "pria" ? 31 : 28;
  let waistW = profile.gender === "pria" ? 27 : 23;
  let hipW = profile.gender === "pria" ? 29 : 31;
  let waistY = 42;
  let leftShoulderY = 20.5;
  let rightShoulderY = 20.5;

  if (profile.bodyShape === "atletis") {
    shoulderSpan += 4;
    chestW += 3.5;
    waistW -= 2.5;
  } else if (profile.bodyShape === "bahu-lebar") {
    shoulderSpan += 5.5;
    chestW += 2.5;
  } else if (profile.bodyShape === "ramping") {
    shoulderSpan -= 2.5;
    chestW -= 2.5;
    waistW -= 3;
    hipW -= 2;
  } else if (profile.bodyShape === "berisi") {
    shoulderSpan += 2;
    chestW += 5;
    waistW += 7.5;
    hipW += 5;
  } else if (profile.bodyShape === "jam-pasir") {
    chestW += 2;
    waistW -= 3.5;
    hipW += 4;
  }

  if (profile.bodyCondition === "bahu-miring") {
    leftShoulderY -= 1.2;
    rightShoulderY += 1.4;
  } else if (profile.bodyCondition === "perut-berisi") {
    waistW += 5.5;
    chestW += 2;
  } else if (profile.bodyCondition === "torso-pendek") {
    waistY = 39;
  } else if (profile.bodyCondition === "torso-panjang") {
    waistY = 45.5;
  } else if (profile.bodyCondition === "dada-bidang") {
    chestW += 4.5;
    shoulderSpan += 2.5;
  }

  const fitScale =
    profile.fitPreference === "slim" ? 0.96 : profile.fitPreference === "relaxed" ? 1.07 : 1.0;

  shoulderSpan = Math.min(46, Math.max(22, shoulderSpan * (1 + bmiDelta * 0.4) * fitScale));
  chestW = Math.min(46, Math.max(20, chestW * (1 + bmiDelta * 0.65) * fitScale));
  waistW = Math.min(46, Math.max(17, waistW * (1 + bmiDelta * 0.95) * fitScale));
  hipW = Math.min(48, Math.max(20, hipW * (1 + bmiDelta * 0.75) * fitScale));

  const heightAdj = (profile.heightCm - 170) * 0.09;
  const neckY = Math.max(13, Math.min(24, 17.5 - heightAdj * 0.25));
  const hemY = Math.max(82, Math.min(95, 89 + heightAdj * 0.35));

  return {
    neckY,
    leftShoulderX: 50 - shoulderSpan / 2,
    leftShoulderY,
    rightShoulderX: 50 + shoulderSpan / 2,
    rightShoulderY,
    chestWidthPct: chestW,
    waistY,
    waistWidthPct: waistW,
    hipY: waistY + 11,
    hipWidthPct: hipW,
    hemY,
    brightness: 1.0,
    contrast: 1.02,
  };
}

function catmullOrSmooth(a: number, b: number, t: number): number {
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
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

function drawBodyLandmarkGuides(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lm: BodyLandmarks,
  offsetXPct: number,
  offsetYPct: number
) {
  const ox = (offsetXPct / 100) * w;
  const oy = (offsetYPct / 100) * h;
  const centerX = ((lm.leftShoulderX + lm.rightShoulderX) / 200) * w + ox;

  const lsX = (lm.leftShoulderX / 100) * w + ox;
  const lsY = (lm.leftShoulderY / 100) * h + oy;
  const rsX = (lm.rightShoulderX / 100) * w + ox;
  const rsY = (lm.rightShoulderY / 100) * h + oy;
  const wY = (lm.waistY / 100) * h + oy;
  const hY = (lm.hipY / 100) * h + oy;
  const wHalf = ((lm.waistWidthPct / 100) * w) / 2;
  const hHalf = ((lm.hipWidthPct / 100) * w) / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(29, 78, 216, 0.78)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);

  // Shoulder line
  ctx.beginPath();
  ctx.moveTo(lsX, lsY);
  ctx.lineTo(rsX, rsY);
  ctx.stroke();

  // Waist line
  ctx.beginPath();
  ctx.moveTo(centerX - wHalf, wY);
  ctx.lineTo(centerX + wHalf, wY);
  ctx.stroke();

  // Hip line
  ctx.beginPath();
  ctx.moveTo(centerX - hHalf, hY);
  ctx.lineTo(centerX + hHalf, hY);
  ctx.stroke();

  // Contour outline
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(29, 78, 216, 0.45)";
  ctx.beginPath();
  ctx.moveTo(lsX, lsY);
  ctx.quadraticCurveTo(centerX - wHalf * 1.05, wY, centerX - hHalf, hY);
  ctx.moveTo(rsX, rsY);
  ctx.quadraticCurveTo(centerX + wHalf * 1.05, wY, centerX + hHalf, hY);
  ctx.stroke();

  // Landmark dots
  const points = [
    { x: lsX, y: lsY, label: "Bahu Kiri" },
    { x: rsX, y: rsY, label: "Bahu Kanan" },
    { x: centerX - wHalf, y: wY, label: "Pinggang" },
    { x: centerX + wHalf, y: wY, label: "" },
    { x: centerX - hHalf, y: hY, label: "Pinggul" },
    { x: centerX + hHalf, y: hY, label: "" },
  ];

  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  for (const pt of points) {
    ctx.fillStyle = "#1D4ED8";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (pt.label) {
      ctx.fillStyle = "rgba(17, 19, 21, 0.85)";
      ctx.fillText(pt.label, pt.x + 8, pt.y + 4);
    }
  }
  ctx.restore();
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
    showLandmarkGuides?: boolean;
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
    showLandmarkGuides = false,
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
    drawY = (h - drawH) * 0.16;
  }

  ctx.save();
  ctx.drawImage(modelImg, drawX, drawY, drawW, drawH);
  ctx.restore();

  const lm = anchors.landmarks;

  if (showGarmentOverlay) {
    const processed = await getProcessedGarment(garmentImageUrl);
    const gCanvas = processed.canvas;
    const { topRatio, bottomRatio, leftRatio, rightRatio } = processed.bounds;

    const srcX = leftRatio * gCanvas.width;
    const srcW = (rightRatio - leftRatio) * gCanvas.width;
    const srcTopY = topRatio * gCanvas.height;
    const srcTotalH = (bottomRatio - topRatio) * gCanvas.height;

    const scaleW = anchors.widthScalePct / 90;
    const scaleH = anchors.heightScalePct / 96;
    const ox = (anchors.offsetXPct / 100) * w;
    const oy = (anchors.offsetYPct / 100) * h;

    const centerX = ((lm.leftShoulderX + lm.rightShoulderX) / 200) * w + ox;
    const shoulderSpan = ((lm.rightShoulderX - lm.leftShoulderX) / 100) * w * scaleW;
    const shoulderTiltRad = Math.atan2(
      ((lm.rightShoulderY - lm.leftShoulderY) / 100) * h,
      Math.max(10, ((lm.rightShoulderX - lm.leftShoulderX) / 100) * w)
    );

    const topY = (lm.neckY / 100) * h + oy;
    const bottomY = Math.min(h * 0.98, topY + ((lm.hemY - lm.neckY) / 100) * h * scaleH);
    const totalOutH = Math.max(80, bottomY - topY);

    // Garment width needs extra margin beyond shoulder bone for outer sleeves/drape
    const outerMarginFactor = profile.fitPreference === "relaxed" ? 1.48 : profile.fitPreference === "slim" ? 1.34 : 1.41;
    const shoulderOutW = shoulderSpan * outerMarginFactor;
    const chestOutW = (lm.chestWidthPct / 100) * w * scaleW * outerMarginFactor;
    const waistOutW = (lm.waistWidthPct / 100) * w * scaleW * (outerMarginFactor * 0.98);
    const hipOutW = (lm.hipWidthPct / 100) * w * scaleW * (outerMarginFactor * 0.98);
    const hemOutW = hipOutW * (profile.gender === "wanita" ? 0.96 : 0.92);

    const waistT = Math.max(0.2, Math.min(0.48, (lm.waistY - lm.neckY) / Math.max(20, lm.hemY - lm.neckY)));
    const hipT = Math.max(waistT + 0.08, Math.min(0.66, (lm.hipY - lm.neckY) / Math.max(20, lm.hemY - lm.neckY)));

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext("2d");

    if (octx) {
      octx.save();
      octx.filter = `brightness(${lm.brightness}) contrast(${lm.contrast})`;

      // Slice garment vertically into 36 contour strips to hug shoulders, chest, waist, hips, and hem
      const slices = 36;
      for (let i = 0; i < slices; i++) {
        const t0 = i / slices;
        const t1 = (i + 1) / slices;
        const tMid = (t0 + t1) / 2;

        let targetW = shoulderOutW;
        if (tMid < 0.14) {
          targetW = catmullOrSmooth(shoulderOutW * 0.94, shoulderOutW, tMid / 0.14);
        } else if (tMid < waistT) {
          const localT = (tMid - 0.14) / Math.max(0.05, waistT - 0.14);
          targetW =
            localT < 0.45
              ? catmullOrSmooth(shoulderOutW, chestOutW, localT / 0.45)
              : catmullOrSmooth(chestOutW, waistOutW, (localT - 0.45) / 0.55);
        } else if (tMid < hipT) {
          const localT = (tMid - waistT) / Math.max(0.05, hipT - waistT);
          targetW = catmullOrSmooth(waistOutW, hipOutW, localT);
        } else {
          const localT = (tMid - hipT) / Math.max(0.05, 1 - hipT);
          targetW = catmullOrSmooth(hipOutW, hemOutW, localT);
        }

        const sy = srcTopY + t0 * srcTotalH;
        const sh = (t1 - t0) * srcTotalH + 0.6;
        const dy = topY + t0 * totalOutH;
        const dh = (t1 - t0) * totalOutH + 1.0;

        // Apply subtle posture/shoulder slope that gradually levels out toward the hem
        const tiltAtSlice = shoulderTiltRad * Math.max(0, 1 - tMid * 1.45);
        const dxCenter = centerX + Math.sin(tiltAtSlice) * (dy - topY) * 0.15;

        octx.save();
        octx.translate(dxCenter, dy);
        octx.rotate(tiltAtSlice);
        octx.drawImage(gCanvas, srcX, sy, srcW, sh, -targetW / 2, 0, targetW, dh);
        octx.restore();
      }

      // Softly feather top collar edge so user's neck and chin remain crisp
      octx.globalCompositeOperation = "destination-in";
      const collarMask = octx.createLinearGradient(0, topY, 0, topY + totalOutH * 0.09);
      collarMask.addColorStop(0, "rgba(0,0,0,0.25)");
      collarMask.addColorStop(0.55, "rgba(0,0,0,0.92)");
      collarMask.addColorStop(1, "rgba(0,0,0,1)");
      octx.fillStyle = collarMask;
      octx.fillRect(0, topY, w, totalOutH * 0.09);
      octx.fillStyle = "#000";
      octx.fillRect(0, topY + totalOutH * 0.088, w, totalOutH);

      // Cylindrical 3D torso wrap shading (subtle highlight down sternum, gentle edge wrap shadow)
      octx.globalCompositeOperation = "source-atop";
      const cylShade = octx.createLinearGradient(
        centerX - shoulderOutW * 0.45,
        0,
        centerX + shoulderOutW * 0.45,
        0
      );
      cylShade.addColorStop(0, "rgba(10, 12, 16, 0.14)");
      cylShade.addColorStop(0.28, "rgba(255, 255, 255, 0.03)");
      cylShade.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
      cylShade.addColorStop(0.72, "rgba(255, 255, 255, 0.02)");
      cylShade.addColorStop(1, "rgba(10, 12, 16, 0.16)");
      octx.fillStyle = cylShade;
      octx.fillRect(0, topY, w, totalOutH);

      octx.restore();

      // Composite warped garment onto model canvas
      ctx.save();
      if (typeof splitRatio === "number") {
        ctx.beginPath();
        ctx.rect(w * splitRatio, 0, w * (1 - splitRatio), h);
        ctx.clip();
      }
      ctx.globalAlpha = anchors.opacity;
      ctx.shadowColor = "rgba(17, 19, 21, 0.2)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(offscreen, 0, 0);
      ctx.restore();
    }
  }

  if (showLandmarkGuides) {
    drawBodyLandmarkGuides(ctx, w, h, lm, anchors.offsetXPct, anchors.offsetYPct);
  }
}
