import { useEffect, useRef, useState } from "react";
import { Bookmark, Download, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { OCCASION_LABELS } from "../data/catalog";
import {
  BackdropType,
  BodyProfile,
  FittingCalibrationResponse,
  GarmentItem,
  GarmentOverlayAnchors,
  OccasionType,
} from "../types/studio";
import { renderFittingComposite } from "../utils/canvasComposite";

interface StudioCanvasProps {
  modelImageUrl: string;
  garment: GarmentItem;
  customGarmentImageUrl: string | null;
  anchors: GarmentOverlayAnchors;
  profile: BodyProfile;
  occasion: OccasionType;
  backdrop: BackdropType;
  isGeneratingFit: boolean;
  fittingResult: FittingCalibrationResponse | null;
  fittingError: string | null;
  onChangeBackdrop: (backdrop: BackdropType) => void;
  onChangeAnchors: (anchors: GarmentOverlayAnchors) => void;
  onResetAnchors: () => void;
  onGenerateAiFitting: () => void;
  onSaveLookbook: (previewDataUrl: string) => void;
}

type ViewMode = "fitting" | "asli" | "bandingkan";

export function StudioCanvas({
  modelImageUrl,
  garment,
  customGarmentImageUrl,
  anchors,
  profile,
  occasion,
  backdrop,
  isGeneratingFit,
  fittingResult,
  fittingError,
  onChangeBackdrop,
  onChangeAnchors,
  onResetAnchors,
  onGenerateAiFitting,
  onSaveLookbook,
}: StudioCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("fitting");
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [showSliders, setShowSliders] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);

  const activeGarmentUrl = customGarmentImageUrl || garment.imageUrl;

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setRenderFailed(false);
    renderFittingComposite(canvas, {
      modelImageUrl,
      garmentImageUrl: activeGarmentUrl,
      anchors,
      profile,
      backdrop,
      showGarmentOverlay: viewMode !== "asli",
      splitRatio: viewMode === "bandingkan" ? splitRatio : undefined,
    }).catch(() => {
      if (!cancelled) setRenderFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [modelImageUrl, activeGarmentUrl, anchors, profile, backdrop, viewMode, splitRatio]);

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `rupafit-${garment.id}-${occasion}.png`;
    link.click();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    onSaveLookbook(dataUrl);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const backdropOptions: Array<{ id: BackdropType; label: string }> = [
    { id: "studio", label: "Studio Netral" },
    { id: "perjalanan", label: "Lobi Perjalanan" },
    { id: "rapat", label: "Ruang Rapat" },
    { id: "kedinasan", label: "Aula Kedinasan" },
  ];

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-[#E4E6EA] bg-white p-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-[#6B7280]">
            02. Kanvas Studio · {OCCASION_LABELS[occasion].title}
          </div>
          <h3 className="mt-0.5 text-base font-semibold text-[#111315]">
            {customGarmentImageUrl ? "Busana Upload Kustom" : garment.title}
          </h3>
        </div>

        {/* View Mode Segmented Control */}
        <div className="flex items-center gap-1 rounded-lg bg-[#F2F4F7] p-1">
          {(
            [
              { id: "fitting", label: "Hasil Fitting" },
              { id: "bandingkan", label: "Bandingkan Belah" },
              { id: "asli", label: "Foto Asli" },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === mode.id
                  ? "bg-white text-[#111315] shadow-xs"
                  : "text-[#6B7280] hover:text-[#111315]"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Fitting Stage */}
      <div className="relative overflow-hidden rounded-lg border border-[#E4E6EA] bg-[#F2F4F7]">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-[480px]">
          <canvas
            ref={canvasRef}
            width={720}
            height={960}
            className="h-full w-full object-contain"
          />

          {renderFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F2F4F7] p-6 text-center">
              <p className="text-sm font-semibold text-[#111315]">Pratinjau Studio Belum Tersedia</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                Pilih model atau unggah foto baru untuk merender fitting.
              </p>
            </div>
          )}

          {viewMode === "bandingkan" && (
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-[#1D4ED8]"
              style={{ left: `${splitRatio * 100}%` }}
            >
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 rounded-full bg-[#1D4ED8] px-1.5 py-1 text-[10px] font-semibold text-white shadow">
                ↔
              </div>
            </div>
          )}

          {isGeneratingFit && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 backdrop-blur-xs">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E4E6EA] border-t-[#1D4ED8]" />
              <p className="mt-3 text-xs font-semibold text-[#111315]">
                Menyesuaikan proporsi busana dengan bentuk tubuh...
              </p>
            </div>
          )}
        </div>

        {/* Bottom Scrim Bar for Quick Body Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E6EA] bg-white px-4 py-2.5 text-xs text-[#4B5563]">
          <span className="tabular-nums">
            {profile.gender === "pria" ? "Pria" : "Wanita"} · {profile.heightCm} cm · {profile.weightKg} kg · Ukuran{" "}
            {profile.size}
          </span>
          <span className="font-medium text-[#111315]">
            {fittingResult ? fittingResult.fitAssessment.fitVerdict : garment.cut}
          </span>
        </div>
      </div>

      {/* Split Comparison Slider when in Bandingkan mode */}
      {viewMode === "bandingkan" && (
        <div className="flex items-center gap-3 rounded-lg border border-[#E4E6EA] bg-[#F8F9FA] px-4 py-2.5">
          <span className="text-xs font-medium text-[#4B5563] whitespace-nowrap">Foto Asli</span>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.01}
            value={splitRatio}
            onChange={(e) => setSplitRatio(Number(e.target.value))}
            aria-label="Penggeser perbandingan sebelum dan sesudah fitting"
            className="w-full accent-[#1D4ED8] cursor-pointer"
          />
          <span className="text-xs font-medium text-[#111315] whitespace-nowrap">Hasil Fitting</span>
        </div>
      )}

      {/* Backdrop Selector + Fine-Tuning Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {backdropOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeBackdrop(item.id)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                backdrop === item.id
                  ? "border-[#111315] bg-[#111315] text-white"
                  : "border-[#E4E6EA] bg-white text-[#4B5563] hover:border-[#9CA3AF]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowSliders((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-md border border-[#E4E6EA] bg-white px-3 py-1.5 text-xs font-medium text-[#111315] hover:bg-[#F8F9FA] cursor-pointer whitespace-nowrap"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{showSliders ? "Tutup Presisi Manual" : "Atur Presisi Manual"}</span>
        </button>
      </div>

      {/* Fine-Tuning Manual Sliders */}
      {showSliders && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#E4E6EA] bg-[#F8F9FA] p-4 sm:grid-cols-2">
          <div>
            <div className="flex justify-between text-xs text-[#4B5563]">
              <span>Lebar Bahu & Badan</span>
              <span className="font-mono tabular-nums">{anchors.widthScalePct}%</span>
            </div>
            <input
              type="range"
              min={65}
              max={130}
              value={anchors.widthScalePct}
              onChange={(e) => onChangeAnchors({ ...anchors, widthScalePct: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[#1D4ED8] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-[#4B5563]">
              <span>Panjang Busana</span>
              <span className="font-mono tabular-nums">{anchors.heightScalePct}%</span>
            </div>
            <input
              type="range"
              min={70}
              max={130}
              value={anchors.heightScalePct}
              onChange={(e) => onChangeAnchors({ ...anchors, heightScalePct: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[#1D4ED8] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-[#4B5563]">
              <span>Posisi Vertikal (Bahu)</span>
              <span className="font-mono tabular-nums">{anchors.offsetYPct}%</span>
            </div>
            <input
              type="range"
              min={-15}
              max={20}
              value={anchors.offsetYPct}
              onChange={(e) => onChangeAnchors({ ...anchors, offsetYPct: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[#1D4ED8] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-[#4B5563]">
              <span>Geser Horizontal</span>
              <span className="font-mono tabular-nums">{anchors.offsetXPct}%</span>
            </div>
            <input
              type="range"
              min={-15}
              max={15}
              value={anchors.offsetXPct}
              onChange={(e) => onChangeAnchors({ ...anchors, offsetXPct: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[#1D4ED8] cursor-pointer"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={onResetAnchors}
              className="flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111315] cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Posisi Default</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onGenerateAiFitting}
          disabled={isGeneratingFit}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>{isGeneratingFit ? "Menyesuaikan Fitting..." : "Kalibrasi & Fitting AI"}</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center justify-center gap-2 rounded-lg border border-[#E4E6EA] bg-white px-4 py-3 text-xs font-semibold text-[#111315] transition-colors hover:bg-[#F8F9FA] cursor-pointer whitespace-nowrap"
        >
          <Bookmark className="h-3.5 w-3.5 shrink-0" />
          <span>{savedFeedback ? "Tersimpan" : "Simpan Lookbook"}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPng}
          className="flex items-center justify-center gap-2 rounded-lg border border-[#E4E6EA] bg-white px-4 py-3 text-xs font-semibold text-[#111315] transition-colors hover:bg-[#F8F9FA] cursor-pointer whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>Unduh PNG</span>
        </button>
      </div>

      {fittingError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          {fittingError}
        </div>
      )}

      {fittingResult && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#E4E6EA] bg-[#F8F9FA] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#111315]">
              Evaluasi Fitting: {fittingResult.fitAssessment.fitVerdict}
            </span>
            <span className="text-xs text-[#6B7280] capitalize">
              Potongan {fittingResult.calibration.fitTightness}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[#374151]">
            {fittingResult.fitAssessment.proportionNote}
          </p>
          <p className="text-xs leading-relaxed text-[#4B5563]">
            <strong className="font-semibold text-[#111315]">Saran Penyesuaian: </strong>
            {fittingResult.fitAssessment.alterationAdvice}
          </p>

          {fittingResult.pairingChecklist?.length > 0 && (
            <div className="border-t border-[#E4E6EA] pt-3">
              <div className="text-xs font-semibold text-[#111315]">Padu Padan & Kelengkapan Acara</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {fittingResult.pairingChecklist.map((item, idx) => (
                  <div key={idx} className="rounded border border-[#E4E6EA] bg-white p-2.5">
                    <div className="text-[11px] font-medium text-[#6B7280]">{item.category}</div>
                    <div className="mt-0.5 text-xs font-semibold text-[#111315]">{item.recommendation}</div>
                    <div className="mt-0.5 text-[11px] text-[#4B5563]">{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
