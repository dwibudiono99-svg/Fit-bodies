import { useEffect, useState } from "react";
import { ArrowDownRight } from "lucide-react";
import { BodyProfilePanel } from "./components/BodyProfilePanel";
import { GarmentCatalogSection } from "./components/GarmentCatalogSection";
import { GarmentSelectorPanel } from "./components/GarmentSelectorPanel";
import { Header } from "./components/Header";
import { LookbookSection } from "./components/LookbookSection";
import { StudioCanvas } from "./components/StudioCanvas";
import {
  GARMENT_CATALOG,
  HERO_STUDIO_IMAGE,
  OCCASION_LABELS,
  STUDIO_MODEL_PRESETS,
} from "./data/catalog";
import {
  BackdropType,
  BodyAnalysisResponse,
  BodyProfile,
  FittingCalibrationResponse,
  GarmentItem,
  GarmentOverlayAnchors,
  OccasionType,
  SavedLookbookEntry,
} from "./types/studio";
import { deriveLandmarksFromProfile } from "./utils/canvasComposite";

const LOOKBOOK_STORAGE_KEY = "rupafit_lookbook_v1";

export default function App() {
  const [activeSection, setActiveSection] = useState("studio-fitting");

  // Model & Body Profile State
  const [modelSource, setModelSource] = useState<"preset" | "upload">("preset");
  const [selectedPresetId, setSelectedPresetId] = useState(STUDIO_MODEL_PRESETS[0].id);
  const [uploadedModelUrl, setUploadedModelUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  const [profile, setProfile] = useState<BodyProfile>({
    gender: STUDIO_MODEL_PRESETS[0].gender,
    bodyShape: STUDIO_MODEL_PRESETS[0].bodyShape,
    bodyCondition: "standar",
    heightCm: STUDIO_MODEL_PRESETS[0].heightCm,
    weightKg: STUDIO_MODEL_PRESETS[0].weightKg,
    size: "M",
    fitPreference: "regular",
  });

  // Garment & Occasion State
  const [occasion, setOccasion] = useState<OccasionType>("resmi-biasa");
  const [selectedGarment, setSelectedGarment] = useState<GarmentItem>(GARMENT_CATALOG[1]);
  const [customGarmentImageUrl, setCustomGarmentImageUrl] = useState<string | null>(null);
  const [customNotes, setCustomNotes] = useState("");
  const [backdrop, setBackdrop] = useState<BackdropType>("studio");
  const [anchors, setAnchors] = useState<GarmentOverlayAnchors>(() => ({
    ...GARMENT_CATALOG[1].defaultAnchors,
    landmarks: deriveLandmarksFromProfile({
      gender: STUDIO_MODEL_PRESETS[0].gender,
      bodyShape: STUDIO_MODEL_PRESETS[0].bodyShape,
      bodyCondition: "standar",
      heightCm: STUDIO_MODEL_PRESETS[0].heightCm,
      weightKg: STUDIO_MODEL_PRESETS[0].weightKg,
      size: "M",
      fitPreference: "regular",
    }),
  }));

  // AI Endpoints State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<BodyAnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [isGeneratingFit, setIsGeneratingFit] = useState(false);
  const [fittingResult, setFittingResult] = useState<FittingCalibrationResponse | null>(null);
  const [fittingError, setFittingError] = useState<string | null>(null);

  // Lookbook Persistence
  const [lookbook, setLookbook] = useState<SavedLookbookEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LOOKBOOK_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SavedLookbookEntry[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOOKBOOK_STORAGE_KEY, JSON.stringify(lookbook));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [lookbook]);

  const activePreset =
    STUDIO_MODEL_PRESETS.find((p) => p.id === selectedPresetId) ?? STUDIO_MODEL_PRESETS[0];
  const activeModelUrl =
    modelSource === "upload" && uploadedModelUrl ? uploadedModelUrl : activePreset.imageUrl;

  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleProfileChange = (nextProfile: BodyProfile) => {
    setProfile(nextProfile);
    setAnchors((prev) => ({
      ...prev,
      landmarks: deriveLandmarksFromProfile(nextProfile),
    }));
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = STUDIO_MODEL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setModelSource("preset");
    setSelectedPresetId(preset.id);
    const nextProfile: BodyProfile = {
      ...profile,
      gender: preset.gender,
      bodyShape: preset.bodyShape,
      heightCm: preset.heightCm,
      weightKg: preset.weightKg,
    };
    setProfile(nextProfile);
    setAnchors((prev) => ({
      ...prev,
      landmarks: deriveLandmarksFromProfile(nextProfile),
    }));
    setAnalysisResult(null);
    setFittingResult(null);
  };

  const handleUploadModelPhoto = (dataUrl: string, fileName: string) => {
    setModelSource("upload");
    setUploadedModelUrl(dataUrl);
    setUploadedFileName(fileName);
    setAnalysisResult(null);
    setFittingResult(null);
  };

  const handleClearUploadedPhoto = () => {
    setModelSource("preset");
    setUploadedModelUrl(null);
    setUploadedFileName("");
    setAnalysisResult(null);
    setFittingResult(null);
  };

  const handleSelectGarment = (garment: GarmentItem) => {
    setCustomGarmentImageUrl(null);
    setSelectedGarment(garment);
    setOccasion(garment.occasion);
    setAnchors({
      ...garment.defaultAnchors,
      landmarks: deriveLandmarksFromProfile(profile),
    });
    setFittingResult(null);
  };

  const handleTryFromCatalog = (garment: GarmentItem) => {
    handleSelectGarment(garment);
    handleNavigate("studio-fitting");
  };

  const handleChangeOccasion = (nextOccasion: OccasionType) => {
    setOccasion(nextOccasion);
    if (nextOccasion === "bepergian") setBackdrop("perjalanan");
    else if (nextOccasion === "resmi-biasa") setBackdrop("rapat");
    else setBackdrop("kedinasan");
  };

  const handleAnalyzeBody = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/analyze-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelImage: activeModelUrl,
          profile,
          occasion,
          garmentTitle: customGarmentImageUrl ? "Busana Upload Kustom" : selectedGarment.title,
          garmentCategory: OCCASION_LABELS[occasion].title,
        }),
      });
      const data: BodyAnalysisResponse & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menganalisis proporsi tubuh.");
      }
      setAnalysisResult(data);
      if (data.landmarks) {
        setAnchors((prev) => ({
          ...prev,
          offsetXPct: 0,
          offsetYPct: 0,
          landmarks: data.landmarks,
        }));
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Kendala saat menghubungi server AI.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateAiFitting = async () => {
    setIsGeneratingFit(true);
    setFittingError(null);
    try {
      const res = await fetch("/api/generate-fitting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelImage: activeModelUrl,
          garmentImage: customGarmentImageUrl || selectedGarment.imageUrl,
          garmentTitle: customGarmentImageUrl ? "Busana Upload Kustom" : selectedGarment.title,
          garmentDescription: customGarmentImageUrl
            ? "Pakaian pribadi yang diunggah pengguna"
            : `${selectedGarment.fabric}, ${selectedGarment.cut}`,
          profile,
          occasion,
          customNotes,
        }),
      });
      const data: FittingCalibrationResponse & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengkalibrasi fitting AI.");
      }
      setFittingResult(data);
      if (data.landmarks || data.calibration) {
        setAnchors((prev) => ({
          ...prev,
          offsetXPct: Math.max(-15, Math.min(15, Math.round(data.calibration?.offsetXPct ?? 0))),
          offsetYPct: Math.max(-15, Math.min(18, Math.round(data.calibration?.offsetYPct ?? 0))),
          widthScalePct: Math.max(
            68,
            Math.min(130, Math.round(data.calibration?.widthScalePct ?? prev.widthScalePct))
          ),
          heightScalePct: Math.max(
            72,
            Math.min(128, Math.round(data.calibration?.heightScalePct ?? prev.heightScalePct))
          ),
          landmarks: data.landmarks ?? prev.landmarks,
        }));
      }
    } catch (err) {
      setFittingError(err instanceof Error ? err.message : "Gagal terhubung ke server AI.");
    } finally {
      setIsGeneratingFit(false);
    }
  };

  const handleSaveLookbook = (previewDataUrl: string) => {
    const newEntry: SavedLookbookEntry = {
      id: `${Date.now()}`,
      createdAt: new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      occasion,
      garmentTitle: customGarmentImageUrl ? "Busana Upload Pribadi" : selectedGarment.title,
      modelLabel:
        modelSource === "upload" ? uploadedFileName || "Foto Pribadi" : activePreset.name,
      profileSummary: `${profile.gender === "pria" ? "Pria" : "Wanita"} · ${profile.heightCm} cm · ${profile.weightKg} kg · ${profile.bodyShape}`,
      fitVerdict: fittingResult?.fitAssessment.fitVerdict ?? `Potongan ${profile.fitPreference}`,
      previewDataUrl,
      notes: customNotes,
    };
    setLookbook((prev) => [newEntry, ...prev].slice(0, 12));
  };

  const handleDeleteLookbookEntry = (id: string) => {
    setLookbook((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div id="top" className="min-h-screen bg-[#F8F9FA] text-[#111315]">
      <Header activeSection={activeSection} onNavigate={handleNavigate} />

      <main>
        {/* Hero Editorial Split */}
        <section className="mx-auto max-w-[1360px] px-6 pt-10 pb-12">
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
            <div className="flex flex-col justify-between rounded-xl border border-[#E4E6EA] bg-white p-8 lg:col-span-6 lg:p-10">
              <div>
                <div className="text-xs font-medium text-[#6B7280]">
                  Studio Fitting Digital · Kalibrasi Kontur Tubuh AI
                </div>
                <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.12] tracking-tight text-[#111315] text-balance sm:text-5xl">
                  Uji Kesesuaian Busana yang Pas Mengikuti Kondisi Tubuh Anda
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-[#4B5563]">
                  Sesuaikan model pakaian untuk kebutuhan bepergian, pertemuan resmi biasa, hingga
                  tugas kedinasan. Unggah foto Anda sendiri dan biarkan sistem AI memetakan titik
                  bahu, dada, pinggang, dan pinggul agar busana menempel pas sesuai postur tubuh.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleNavigate("studio-fitting")}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#111315] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] cursor-pointer whitespace-nowrap"
                >
                  <span>Buka Studio Fitting</span>
                  <ArrowDownRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("katalog-busana")}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E4E6EA] bg-white px-6 py-3 text-sm font-semibold text-[#111315] transition-colors hover:bg-[#F8F9FA] cursor-pointer whitespace-nowrap"
                >
                  <span>Jelajahi Katalog</span>
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#E4E6EA] bg-[#E5E7EB] lg:col-span-6">
              <img
                src={HERO_STUDIO_IMAGE}
                alt="Ruang studio tailoring RupaFit dengan koleksi blazer, jaket travel linen, dan batik resmi"
                referrerPolicy="no-referrer"
                className="h-full min-h-[340px] w-full object-cover lg:h-full"
              />
            </div>
          </div>

          {/* Full-width 4-column studio capability strip */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                num: "01.",
                title: "Upload Foto Pribadi",
                desc: "Gunakan foto diri sendiri atau model studio untuk uji fitting langsung.",
              },
              {
                num: "02.",
                title: "Kontur Tubuh Adaptif",
                desc: "AI menyesuaikan lekuk bahu, dada, pinggang, dan pinggul secara dinamis.",
              },
              {
                num: "03.",
                title: "Referensi 3 Konteks Acara",
                desc: "Setelan khusus bepergian, rapat resmi biasa, serta protokol kedinasan.",
              },
              {
                num: "04.",
                title: "Arsip Lookbook & Ekspor",
                desc: "Simpan perbandingan tampilan dan unduh gambar referensi resolusi tinggi.",
              },
            ].map((item) => (
              <div
                key={item.num}
                className="rounded-xl border border-[#E4E6EA] bg-white px-5 py-4"
              >
                <div className="font-mono text-xs font-medium text-[#6B7280] tabular-nums">
                  {item.num}
                </div>
                <h2 className="mt-1.5 font-sans text-sm font-semibold text-[#111315]">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#4B5563]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Main 3-Column Interactive Studio Workspace */}
        <section id="studio-fitting" className="mx-auto max-w-[1360px] px-6 py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-t border-[#E4E6EA] pt-10">
            <div>
              <div className="text-xs font-medium text-[#6B7280]">Meja Kerja Fitting Virtual</div>
              <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-[#111315]">
                Studio Kalibrasi & Uji Busana
              </h2>
            </div>
            <div className="text-xs text-[#4B5563]">
              Konteks aktif:{" "}
              <span className="font-semibold text-[#111315]">
                {OCCASION_LABELS[occasion].title}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {/* Left: Model & Body Profile */}
            <div className="lg:col-span-3">
              <BodyProfilePanel
                modelSource={modelSource}
                selectedPresetId={selectedPresetId}
                uploadedModelUrl={uploadedModelUrl}
                profile={profile}
                isAnalyzing={isAnalyzing}
                analysisResult={analysisResult}
                analysisError={analysisError}
                onSelectPreset={handleSelectPreset}
                onUploadModelPhoto={handleUploadModelPhoto}
                onClearUploadedPhoto={handleClearUploadedPhoto}
                onChangeProfile={handleProfileChange}
                onAnalyzeBody={handleAnalyzeBody}
              />
            </div>

            {/* Center: Interactive Composite Canvas */}
            <div className="lg:col-span-6">
              <StudioCanvas
                modelImageUrl={activeModelUrl}
                garment={selectedGarment}
                customGarmentImageUrl={customGarmentImageUrl}
                anchors={anchors}
                profile={profile}
                occasion={occasion}
                backdrop={backdrop}
                isGeneratingFit={isGeneratingFit}
                fittingResult={fittingResult}
                fittingError={fittingError}
                onChangeBackdrop={setBackdrop}
                onChangeAnchors={setAnchors}
                onResetAnchors={() =>
                  setAnchors({
                    ...selectedGarment.defaultAnchors,
                    landmarks: deriveLandmarksFromProfile(profile),
                  })
                }
                onGenerateAiFitting={handleGenerateAiFitting}
                onSaveLookbook={handleSaveLookbook}
              />
            </div>

            {/* Right: Occasion & Garment Selector */}
            <div className="lg:col-span-3">
              <GarmentSelectorPanel
                occasion={occasion}
                selectedGarmentId={selectedGarment.id}
                customGarmentImageUrl={customGarmentImageUrl}
                customNotes={customNotes}
                onChangeOccasion={handleChangeOccasion}
                onSelectGarment={handleSelectGarment}
                onUploadCustomGarment={(url) => {
                  setCustomGarmentImageUrl(url);
                  setFittingResult(null);
                }}
                onClearCustomGarment={() => setCustomGarmentImageUrl(null)}
                onChangeCustomNotes={setCustomNotes}
              />
            </div>
          </div>
        </section>

        {/* Curated Catalog */}
        <GarmentCatalogSection
          selectedGarmentId={customGarmentImageUrl ? "" : selectedGarment.id}
          onTryInStudio={handleTryFromCatalog}
        />

        {/* Occasion Planner & Saved Lookbook */}
        <LookbookSection
          lookbook={lookbook}
          occasion={occasion}
          profile={profile}
          garmentTitle={customGarmentImageUrl ? "Busana Upload Pribadi" : selectedGarment.title}
          onDeleteEntry={handleDeleteLookbookEntry}
        />
      </main>

      <footer className="border-t border-[#E4E6EA] bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-col items-start justify-between gap-4 px-6 py-8 text-xs text-[#6B7280] sm:flex-row sm:items-center">
          <div className="font-display text-base font-semibold text-[#111315]">RupaFit Studio</div>
          <div className="flex flex-wrap items-center gap-6">
            <a
              href="#studio-fitting"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate("studio-fitting");
              }}
              className="hover:text-[#111315]"
            >
              Studio Fitting
            </a>
            <a
              href="#katalog-busana"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate("katalog-busana");
              }}
              className="hover:text-[#111315]"
            >
              Katalog Busana
            </a>
            <a
              href="#panduan-acara"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate("panduan-acara");
              }}
              className="hover:text-[#111315]"
            >
              Panduan Acara
            </a>
            <span>© 2026 RupaFit Studio</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
