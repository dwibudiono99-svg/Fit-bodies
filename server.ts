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

function formatGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("API_KEY_INVALID") || msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
    return {
      status: 403,
      message: "Kunci API Gemini belum valid atau tidak memiliki izin. Silakan periksa panel Settings > Secrets.",
    };
  }
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
    return {
      status: 429,
      message: "Kuota permintaan AI sedang penuh. Silakan tunggu beberapa saat sebelum mencoba kembali.",
    };
  }
  return {
    status: 500,
    message: msg || "Terjadi kendala saat memproses kalibrasi AI di server.",
  };
}

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
        parts.push({
          inlineData: resolvedModelImg,
        });
      }

      const prompt = `Anda adalah penjahit ahli (master tailor) dan penata busana profesional Indonesia.
Analisislah profil tubuh dan foto model (jika disertakan) berikut untuk kalibrasi studio fitting pakaian:
- Jenis Siluet: ${profile?.gender === "wanita" ? "Wanita" : "Pria"}
- Bentuk Tubuh: ${profile?.bodyShape ?? "proporsional"}
- Tinggi Badan: ${profile?.heightCm ?? 170} cm
- Berat Badan: ${profile?.weightKg ?? 65} kg
- Ukuran Standar: ${profile?.size ?? "M"}
- Preferensi Potongan: ${profile?.fitPreference ?? "regular"}
- Konteks Acara: ${occasion ?? "resmi-biasa"} (Pilihan: bepergian, resmi-biasa, kedinasan)
- Busana yang Sedang Dicoba: ${garmentTitle ?? "Setelan Studio"} (${garmentCategory ?? occasion})

Tugas Anda:
1. Jika foto model disertakan, perkirakan koordinat jangkar proporsi tubuh pada kanvas foto dalam persen (0–100):
   - centerX: posisi horizontal tengah tubuh (biasanya sekitar 50)
   - shoulderY: posisi vertikal garis bahu dari atas gambar dalam % (biasanya 18–28)
   - shoulderWidthPct: lebar bahu relatif terhadap lebar gambar dalam % (biasanya 28–48)
   - torsoHeightPct: tinggi area pakaian dari bahu ke ujung bawah celana/rok dalam % (biasanya 50–70)
   - waistTaperRatio: rasio kelangsingan pinggang (0.82 untuk atletis/jam pasir, 0.94 untuk regular, 1.04 untuk berisi)
2. Berikan spesifikasi jahitan (tailoringSpecs) dan panduan acara (occasionGuidance) dalam Bahasa Indonesia yang ringkas, elegan, dan langsung dapat dipraktikkan.`;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              silhouetteSummary: {
                type: Type.STRING,
                description: "Ringkasan analisis proporsi tubuh dan siluet dalam 2 kalimat Bahasa Indonesia.",
              },
              anchors: {
                type: Type.OBJECT,
                properties: {
                  centerX: { type: Type.NUMBER },
                  shoulderY: { type: Type.NUMBER },
                  shoulderWidthPct: { type: Type.NUMBER },
                  torsoHeightPct: { type: Type.NUMBER },
                  waistTaperRatio: { type: Type.NUMBER },
                },
                required: ["centerX", "shoulderY", "shoulderWidthPct", "torsoHeightPct", "waistTaperRatio"],
              },
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
              "anchors",
              "tailoringSpecs",
              "occasionGuidance",
              "recommendedColorways",
            ],
          },
        },
      });

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

      if (resolvedModel) {
        parts.push({ inlineData: resolvedModel });
      }
      if (resolvedGarment) {
        parts.push({ inlineData: resolvedGarment });
      }

      const prompt = `Anda adalah sistem kalibrasi fitting busana studio RupaFit.
Gambar pertama adalah foto model/pengguna; gambar kedua adalah referensi pakaian (jika tersedia).
Data bentuk tubuh pengguna:
- Siluet: ${profile?.gender ?? "pria"}
- Bentuk Tubuh: ${profile?.bodyShape ?? "proporsional"}
- Tinggi: ${profile?.heightCm ?? 172} cm, Berat: ${profile?.weightKg ?? 68} kg, Ukuran: ${profile?.size ?? "M"}
- Preferensi Potongan: ${profile?.fitPreference ?? "regular"}
- Acara Tujuan: ${occasion ?? "resmi-biasa"}
- Pakaian: ${garmentTitle ?? "Busana Pilihan"} — ${garmentDescription ?? ""}
- Catatan Tambahan Pengguna: ${customNotes || "Tidak ada"}

Hitung parameter penyesuaian fitting agar pakaian tampak pas mengikuti postur foto model dan berikan catatan evaluasi jahitan serta daftar padu-padan lengkap untuk acara tersebut.`;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              calibration: {
                type: Type.OBJECT,
                properties: {
                  offsetXPct: { type: Type.NUMBER, description: "Geser horizontal dari -15 sampai 15" },
                  offsetYPct: { type: Type.NUMBER, description: "Geser vertikal dari -15 sampai 15" },
                  widthScalePct: { type: Type.NUMBER, description: "Skala lebar pakaian 65 sampai 135" },
                  heightScalePct: { type: Type.NUMBER, description: "Skala tinggi pakaian 70 sampai 130" },
                  fitTightness: { type: Type.STRING, description: "Salah satu: slim, regular, relaxed" },
                  drapeShadow: { type: Type.NUMBER, description: "Intensitas bayangan drape 0.1 sampai 0.5" },
                },
                required: ["offsetXPct", "offsetYPct", "widthScalePct", "heightScalePct", "fitTightness", "drapeShadow"],
              },
              fitAssessment: {
                type: Type.OBJECT,
                properties: {
                  fitVerdict: { type: Type.STRING, description: "Label kesesuaian singkat, misal: Pas di Bahu & Rapi" },
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
            required: ["calibration", "fitAssessment", "pairingChecklist"],
          },
        },
      });

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
- Profil Pemakai: ${profile?.gender ?? "pria"}, tinggi ${profile?.heightCm ?? 170} cm, bentuk tubuh ${profile?.bodyShape ?? "proporsional"}
- Busana Utama: ${garmentTitle ?? "Setelan Tailored"}

Berikan rekomendasi sepatu, aksesori jam/tas, perawatan bahan agar tidak kusut, dan alternatif cadangan.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
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
