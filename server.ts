import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum tersedia pada konfigurasi server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function readLocalAssetAsBase64(relativeAssetPath: string): { data: string; mimeType: string } | null {
  if (!relativeAssetPath || !relativeAssetPath.startsWith("/src/assets/")) {
    return null;
  }
  const cleanPath = relativeAssetPath.replace(/^\/+/, "");
  const fullPath = path.resolve(__dirname, cleanPath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  const ext = path.extname(fullPath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const buffer = fs.readFileSync(fullPath);
  return {
    data: buffer.toString("base64"),
    mimeType,
  };
}

function parseDataUrl(dataUrl: string): { data: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function resolveImageInput(imageUrlOrData: string | undefined): { data: string; mimeType: string } | null {
  if (!imageUrlOrData) return null;
  if (imageUrlOrData.startsWith("data:image/")) {
    return parseDataUrl(imageUrlOrData);
  }
  if (imageUrlOrData.startsWith("/src/assets/")) {
    return readLocalAssetAsBase64(imageUrlOrData);
  }
  return null;
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("fetch failed")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContentWithResilience(
  ai: GoogleGenAI,
  contents: unknown,
  config: Record<string, unknown>
) {
  const candidateModels = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastError: unknown;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          model,
          contents: contents as never,
          config: config as never,
        });
      } catch (err) {
        lastError = err;
        if (!isTransientGeminiError(err)) {
          throw err;
        }
        await sleep(750 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMsg = err instanceof Error ? err.message : String(err);
  let parsedCode: number | undefined;
  let parsedStatus = "";

  try {
    const jsonStart = rawMsg.indexOf("{");
    if (jsonStart !== -1) {
      const parsed = JSON.parse(rawMsg.slice(jsonStart));
      parsedCode = parsed?.error?.code;
      parsedStatus = parsed?.error?.status ?? "";
    }
  } catch {
    // Ignore non-JSON error messages
  }

  if (
    parsedCode === 403 ||
    parsedCode === 400 ||
    rawMsg.includes("API_KEY_INVALID") ||
    rawMsg.includes("PERMISSION_DENIED")
  ) {
    return {
      status: 403,
      message:
        "Kunci API Gemini belum valid atau tidak memiliki izin. Silakan periksa panel Settings > Secrets.",
    };
  }
  if (parsedCode === 429 || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("429")) {
    return {
      status: 429,
      message:
        "Kuota permintaan AI sedang penuh. Silakan tunggu beberapa saat sebelum mencoba kembali.",
    };
  }
  if (
    parsedCode === 503 ||
    parsedStatus === "UNAVAILABLE" ||
    rawMsg.includes("503") ||
    rawMsg.includes("UNAVAILABLE") ||
    rawMsg.includes("high demand")
  ) {
    return {
      status: 503,
      message:
        "Server AI sedang mengalami lonjakan trafik sementara. Silakan klik coba lagi dalam beberapa detik.",
    };
  }
  return {
    status: 500,
    message: "Terjadi kendala sementara saat memproses kalibrasi AI. Silakan coba lagi.",
  };
}

const LANDMARKS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    neckY: { type: Type.NUMBER, description: "Posisi vertikal pangkal leher dari atas gambar (12-26)." },
    leftShoulderX: { type: Type.NUMBER, description: "Posisi horizontal bahu kiri model pada gambar (22-44)." },
    leftShoulderY: { type: Type.NUMBER, description: "Posisi vertikal bahu kiri model pada gambar (15-30)." },
    rightShoulderX: { type: Type.NUMBER, description: "Posisi horizontal bahu kanan model pada gambar (56-78)." },
    rightShoulderY: { type: Type.NUMBER, description: "Posisi vertikal bahu kanan model pada gambar (15-30)." },
    chestWidthPct: { type: Type.NUMBER, description: "Lebar dada tubuh dalam % lebar gambar (22-48)." },
    waistY: { type: Type.NUMBER, description: "Posisi vertikal pinggang dalam % tinggi gambar (34-52)." },
    waistWidthPct: { type: Type.NUMBER, description: "Lebar pinggang tubuh dalam % lebar gambar (18-46)." },
    hipY: { type: Type.NUMBER, description: "Posisi vertikal pinggul dalam % tinggi gambar (46-64)." },
    hipWidthPct: { type: Type.NUMBER, description: "Lebar pinggul tubuh dalam % lebar gambar (22-50)." },
    hemY: { type: Type.NUMBER, description: "Posisi vertikal ujung bawah celana/rok dalam % tinggi gambar (76-96)." },
    brightness: { type: Type.NUMBER, description: "Penyesuaian kecerahan pencahayaan foto (0.85-1.15)." },
    contrast: { type: Type.NUMBER, description: "Penyesuaian kontras foto (0.9-1.15)." },
  },
  required: [
    "neckY",
    "leftShoulderX",
    "leftShoulderY",
    "rightShoulderX",
    "rightShoulderY",
    "chestWidthPct",
    "waistY",
    "waistWidthPct",
    "hipY",
    "hipWidthPct",
    "hemY",
    "brightness",
    "contrast",
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));

  app.post("/api/analyze-body", async (req, res) => {
    try {
      const { modelImage, profile, occasion, garmentTitle, garmentCategory } = req.body ?? {};
      const ai = getAiClient();

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
      const resolvedModelImg = resolveImageInput(modelImage);
      if (resolvedModelImg) {
        parts.push({ inlineData: resolvedModelImg });
      }

      const prompt = `Anda adalah master tailor (penjahit ahli) dan sistem pengukur anatomi tubuh berbasis visi komputer.
Perhatikan foto model yang dilampirkan (jika ada) serta data kondisi tubuh berikut:
- Siluet Dasar: ${profile?.gender === "wanita" ? "Wanita" : "Pria"}
- Bentuk Tubuh: ${profile?.bodyShape ?? "proporsional"}
- Kondisi Tubuh Khusus: ${profile?.bodyCondition ?? "standar"}
- Tinggi Badan: ${profile?.heightCm ?? 170} cm
- Berat Badan: ${profile?.weightKg ?? 65} kg
- Ukuran: ${profile?.size ?? "M"}
- Preferensi Potongan: ${profile?.fitPreference ?? "regular"}
- Acara Tujuan: ${occasion ?? "resmi-biasa"}
- Busana: ${garmentTitle ?? "Setelan Studio"} (${garmentCategory ?? occasion})

Tugas kritis Anda:
1. Deteksi koordinat anatomi tubuh model pada gambar dalam persen (0-100) agar mesin mesh-warping dapat membentuk pakaian MENEMPEL PAS mengikuti kontur tubuh dan kemiringan bahu model:
   - neckY: titik pangkal leher agar wajah & leher tetap terbuka alami (biasanya 15-21)
   - leftShoulderX & leftShoulderY, rightShoulderX & rightShoulderY: titik ujung bahu kiri dan kanan (perhatikan jika bahu miring atau posisi subjek tidak tepat di tengah)
   - chestWidthPct, waistY, waistWidthPct, hipY, hipWidthPct, hemY: ukur proporsi dada, pinggang, dan pinggul sesuai foto dan kondisi tubuh (misal: jika berisi/perut-berisi maka waistWidthPct lebih lebar; jika atletis/jam-pasir maka waistWidthPct lebih ramping dari chestWidthPct dan hipWidthPct; jika torso-pendek maka waistY lebih tinggi).
   - brightness & contrast: sesuaikan dengan pencahayaan foto asli model.
2. Berikan analisis penjahitan profesional dan panduan acara dalam Bahasa Indonesia.`;

      parts.push({ text: prompt });

      const response = await generateContentWithResilience(
        ai,
        { parts },
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              silhouetteSummary: { type: Type.STRING },
              landmarks: LANDMARKS_SCHEMA,
              tailoringSpecs: {
                type: Type.OBJECT,
                properties: {
                  shoulderCut: { type: Type.STRING },
                  jacketLength: { type: Type.STRING },
                  sleeveBreak: { type: Type.STRING },
                  trouserCut: { type: Type.STRING },
                  collarStyle: { type: Type.STRING },
                  fabricWeight: { type: Type.STRING },
                },
                required: ["shoulderCut", "jacketLength", "sleeveBreak", "trouserCut", "collarStyle", "fabricWeight"],
              },
              occasionGuidance: {
                type: Type.OBJECT,
                properties: {
                  readinessNote: { type: Type.STRING },
                  etiquetteNote: { type: Type.STRING },
                  packingOrCareTip: { type: Type.STRING },
                },
                required: ["readinessNote", "etiquetteNote", "packingOrCareTip"],
              },
              recommendedColorways: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              "silhouetteSummary",
              "landmarks",
              "tailoringSpecs",
              "occasionGuidance",
              "recommendedColorways",
            ],
          },
        }
      );

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/generate-fitting", async (req, res) => {
    try {
      const { modelImage, garmentImage, garmentTitle, garmentDescription, profile, occasion, customNotes } =
        req.body ?? {};
      const ai = getAiClient();

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
      const resolvedModel = resolveImageInput(modelImage);
      const resolvedGarment = resolveImageInput(garmentImage);

      if (resolvedModel) parts.push({ inlineData: resolvedModel });
      if (resolvedGarment) parts.push({ inlineData: resolvedGarment });

      const prompt = `Anda adalah AI Tailoring & Mesh Calibration RupaFit Studio.
Gambar 1 adalah foto orang/model yang akan mengenakan busana; Gambar 2 adalah foto busana (jika tersedia).
Profil & kondisi tubuh pengguna:
- Siluet: ${profile?.gender ?? "pria"}
- Bentuk Tubuh: ${profile?.bodyShape ?? "proporsional"}
- Kondisi Tubuh Khusus: ${profile?.bodyCondition ?? "standar"}
- Tinggi: ${profile?.heightCm ?? 172} cm, Berat: ${profile?.weightKg ?? 68} kg, Ukuran: ${profile?.size ?? "M"}
- Preferensi Potongan: ${profile?.fitPreference ?? "regular"}
- Acara Tujuan: ${occasion ?? "resmi-biasa"}
- Pakaian: ${garmentTitle ?? "Busana Pilihan"} — ${garmentDescription ?? ""}
- Catatan Pengguna: ${customNotes || "Tidak ada"}

Tugas Anda:
1. Hitung titik anatomi 'landmarks' yang presisi terhadap tubuh pada Gambar 1 agar pakaian dapat di-warp mengikuti lekuk bahu, dada, pinggang, pinggul, serta kemiringan postur tubuh pengguna sehingga terlihat pas menempel di badan.
2. Hitung parameter 'calibration' tambahan dan berikan evaluasi kesesuaian pakaian terhadap kondisi tubuh beserta daftar padu padan lengkap dalam Bahasa Indonesia.`;

      parts.push({ text: prompt });

      const response = await generateContentWithResilience(
        ai,
        { parts },
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              landmarks: LANDMARKS_SCHEMA,
              calibration: {
                type: Type.OBJECT,
                properties: {
                  offsetXPct: { type: Type.NUMBER },
                  offsetYPct: { type: Type.NUMBER },
                  widthScalePct: { type: Type.NUMBER },
                  heightScalePct: { type: Type.NUMBER },
                  fitTightness: { type: Type.STRING },
                  drapeShadow: { type: Type.NUMBER },
                },
                required: ["offsetXPct", "offsetYPct", "widthScalePct", "heightScalePct", "fitTightness", "drapeShadow"],
              },
              fitAssessment: {
                type: Type.OBJECT,
                properties: {
                  fitVerdict: { type: Type.STRING },
                  proportionNote: { type: Type.STRING },
                  alterationAdvice: { type: Type.STRING },
                },
                required: ["fitVerdict", "proportionNote", "alterationAdvice"],
              },
              pairingChecklist: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ["category", "recommendation", "reason"],
                },
              },
            },
            required: ["landmarks", "calibration", "fitAssessment", "pairingChecklist"],
          },
        }
      );

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/stylist-mix", async (req, res) => {
    try {
      const { occasion, profile, garmentTitle, destinationOrAgenda } = req.body ?? {};
      const ai = getAiClient();

      const prompt = `Buat panduan referensi busana dan daftar bawaan ringkas dalam Bahasa Indonesia untuk agenda berikut:
- Konteks Acara: ${occasion}
- Agenda / Tujuan Spesifik: ${destinationOrAgenda || "Perjalanan dinas / pertemuan penting"}
- Profil Pemakai: ${profile?.gender ?? "pria"}, tinggi ${profile?.heightCm ?? 170} cm, bentuk tubuh ${profile?.bodyShape ?? "proporsional"}, kondisi ${profile?.bodyCondition ?? "standar"}
- Busana Utama: ${garmentTitle ?? "Setelan Tailored"}

Berikan rekomendasi sepatu, aksesori jam/tas, perawatan bahan agar tidak kusut, dan alternatif cadangan.`;

      const response = await generateContentWithResilience(ai, prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            footwear: { type: Type.STRING },
            accessories: { type: Type.STRING },
            garmentCare: { type: Type.STRING },
            backupItem: { type: Type.STRING },
          },
          required: ["headline", "footwear", "accessories", "garmentCare", "backupItem"],
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RupaFit Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
