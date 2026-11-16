import React, { useRef } from "react";
import { Upload, Sparkles, UserCheck, RotateCcw } from "lucide-react";
import {
  BODY_CONDITION_OPTIONS,
  BODY_SHAPE_OPTIONS,
  STUDIO_MODEL_PRESETS,
} from "../data/catalog";
import {
  BodyAnalysisResponse,
  BodyConditionFlag,
  BodyProfile,
  BodyShapeType,
  FitPreferenceType,
  GenderType,
} from "../types/studio";

interface BodyProfilePanelProps {
  modelSource: "preset" | "upload";
  selectedPresetId: string;
  uploadedModelUrl: string | null;
  profile: BodyProfile;
  isAnalyzing: boolean;
  analysisResult: BodyAnalysisResponse | null;
  analysisError: string | null;
  onSelectPreset: (presetId: string) => void;
  onUploadModelPhoto: (dataUrl: string, fileName: string) => void;
  onClearUploadedPhoto: () => void;
  onChangeProfile: (updated: BodyProfile) => void;
  onAnalyzeBody: () => void;
}

export function BodyProfilePanel({
  modelSource,
  selectedPresetId,
  uploadedModelUrl,
  profile,
  isAnalyzing,
  analysisResult,
  analysisError,
  onSelectPreset,
  onUploadModelPhoto,
  onClearUploadedPhoto,
  onChangeProfile,
  onAnalyzeBody,
}: BodyProfilePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onUploadModelPhoto(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const updateField = <K extends keyof BodyProfile>(key: K, value: BodyProfile[K]) => {
    onChangeProfile({ ...profile, [key]: value });
  };

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-[#E4E6EA] bg-white p-5">
      <div>
        <div className="text-xs font-medium text-[#6B7280]">01. Sumber Model & Kondisi Tubuh</div>
        <h3 className="mt-1 text-base font-semibold text-[#111315]">Model & Kalibrasi Tubuh</h3>
      </div>

      {/* Upload / Preset Selector */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {STUDIO_MODEL_PRESETS.map((preset) => {
            const isSelected = modelSource === "preset" && selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset.id)}
                className={`flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "border-[#1D4ED8] bg-[#EFF6FF]"
                    : "border-[#E4E6EA] bg-[#F8F9FA] hover:border-[#9CA3AF]"
                }`}
              >
                <img
                  src={preset.imageUrl}
                  alt={preset.name}
                  referrerPolicy="no-referrer"
                  className="h-11 w-9 shrink-0 rounded object-cover object-top bg-[#E5E7EB]"
                />
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-[#111315]">
                    {preset.gender === "pria" ? "Aditya" : "Laras"}
                  </div>
                  <div className="truncate text-[11px] text-[#6B7280] tabular-nums">
                    {preset.heightCm} cm · {preset.weightKg} kg
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload foto model pribadi"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              modelSource === "upload" && uploadedModelUrl
                ? "border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]"
                : "border-[#9CA3AF] bg-[#F8F9FA] text-[#111315] hover:border-[#111315]"
            }`}
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">
              {modelSource === "upload" && uploadedModelUrl ? "Ganti Foto Upload" : "Upload Foto Sendiri"}
            </span>
          </button>

          {modelSource === "upload" && uploadedModelUrl && (
            <button
              type="button"
              onClick={onClearUploadedPhoto}
              title="Kembali ke model studio"
              className="rounded-lg border border-[#E4E6EA] p-2.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111315] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <hr className="border-[#E4E6EA]" />

      {/* Gender / Silhouette */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#111315]">Siluet Dasar</label>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F2F4F7] p-1">
          {(["pria", "wanita"] as GenderType[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => updateField("gender", g)}
              className={`rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                profile.gender === g
                  ? "bg-white text-[#111315] shadow-xs"
                  : "text-[#6B7280] hover:text-[#111315]"
              }`}
            >
              {g === "pria" ? "Pria" : "Wanita"}
            </button>
          ))}
        </div>
      </div>

      {/* Body Shape Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#111315]">Bentuk Tubuh</label>
        <div className="grid grid-cols-2 gap-2">
          {BODY_SHAPE_OPTIONS.map((item) => {
            const active = profile.bodyShape === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateField("bodyShape", item.id as BodyShapeType)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                  active
                    ? "border-[#1D4ED8] bg-[#EFF6FF]"
                    : "border-[#E4E6EA] bg-white hover:border-[#9CA3AF]"
                }`}
              >
                <div className="truncate text-xs font-semibold text-[#111315]">{item.label}</div>
                <div className="mt-0.5 truncate text-[11px] text-[#6B7280]">{item.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Specific Body Condition */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="body-condition-select" className="text-xs font-semibold text-[#111315]">
          Kondisi Postur & Tubuh Khusus
        </label>
        <select
          id="body-condition-select"
          value={profile.bodyCondition}
          onChange={(e) => updateField("bodyCondition", e.target.value as BodyConditionFlag)}
          className="w-full rounded-lg border border-[#E4E6EA] bg-white px-3 py-2 text-xs font-medium text-[#111315] focus:border-[#1D4ED8] focus:outline-none"
        >
          {BODY_CONDITION_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Numeric Measurements */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-[#4B5563]">
            <label htmlFor="height-input">Tinggi (cm)</label>
            <span className="font-mono font-semibold text-[#111315] tabular-nums">{profile.heightCm}</span>
          </div>
          <input
            id="height-input"
            type="range"
            min={145}
            max={200}
            value={profile.heightCm}
            onChange={(e) => updateField("heightCm", Number(e.target.value))}
            className="mt-2 w-full accent-[#1D4ED8] cursor-pointer"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-medium text-[#4B5563]">
            <label htmlFor="weight-input">Berat (kg)</label>
            <span className="font-mono font-semibold text-[#111315] tabular-nums">{profile.weightKg}</span>
          </div>
          <input
            id="weight-input"
            type="range"
            min={40}
            max={125}
            value={profile.weightKg}
            onChange={(e) => updateField("weightKg", Number(e.target.value))}
            className="mt-2 w-full accent-[#1D4ED8] cursor-pointer"
          />
        </div>
      </div>

      {/* Size & Fit Preference */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-[#111315]">Ukuran</label>
          <select
            value={profile.size}
            onChange={(e) => updateField("size", e.target.value as BodyProfile["size"])}
            className="mt-1.5 w-full rounded-lg border border-[#E4E6EA] bg-white px-3 py-2 text-xs font-medium text-[#111315] focus:border-[#1D4ED8] focus:outline-none"
          >
            <option value="S">S — Kecil</option>
            <option value="M">M — Sedang</option>
            <option value="L">L — Besar</option>
            <option value="XL">XL — Ekstra</option>
            <option value="XXL">XXL — Plus</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#111315]">Potongan</label>
          <select
            value={profile.fitPreference}
            onChange={(e) => updateField("fitPreference", e.target.value as FitPreferenceType)}
            className="mt-1.5 w-full rounded-lg border border-[#E4E6EA] bg-white px-3 py-2 text-xs font-medium text-[#111315] focus:border-[#1D4ED8] focus:outline-none"
          >
            <option value="slim">Slim Fit</option>
            <option value="regular">Regular Tailored</option>
            <option value="relaxed">Relaxed Drape</option>
          </select>
        </div>
      </div>

      {/* AI Body Proportion Analysis */}
      <button
        type="button"
        onClick={onAnalyzeBody}
        disabled={isAnalyzing}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#111315] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">
          {isAnalyzing ? "Memetakan Titik Tubuh..." : "Deteksi Titik Tubuh AI"}
        </span>
      </button>

      {analysisError && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          <span>{analysisError}</span>
          <button
            type="button"
            onClick={onAnalyzeBody}
            className="w-fit font-semibold text-red-800 underline hover:text-red-950 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {analysisResult && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-[#E4E6EA] bg-[#F8F9FA] p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111315]">
            <UserCheck className="h-3.5 w-3.5 text-[#1D4ED8]" />
            <span>Hasil Kalibrasi Penjahit AI</span>
          </div>
          <p className="text-xs leading-relaxed text-[#374151]">{analysisResult.silhouetteSummary}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[#E4E6EA] pt-2 text-[11px]">
            <div>
              <span className="text-[#6B7280]">Bahu: </span>
              <span className="font-medium text-[#111315]">{analysisResult.tailoringSpecs.shoulderCut}</span>
            </div>
            <div>
              <span className="text-[#6B7280]">Jas/Atasan: </span>
              <span className="font-medium text-[#111315]">{analysisResult.tailoringSpecs.jacketLength}</span>
            </div>
            <div>
              <span className="text-[#6B7280]">Celana/Bawahan: </span>
              <span className="font-medium text-[#111315]">{analysisResult.tailoringSpecs.trouserCut}</span>
            </div>
            <div>
              <span className="text-[#6B7280]">Bahan: </span>
              <span className="font-medium text-[#111315]">{analysisResult.tailoringSpecs.fabricWeight}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
