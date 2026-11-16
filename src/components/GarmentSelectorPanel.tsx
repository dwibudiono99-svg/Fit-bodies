import React, { useRef } from "react";
import { Upload, RotateCcw } from "lucide-react";
import { GARMENT_CATALOG, OCCASION_LABELS } from "../data/catalog";
import { GarmentItem, OccasionType } from "../types/studio";

interface GarmentSelectorPanelProps {
  occasion: OccasionType;
  selectedGarmentId: string;
  customGarmentImageUrl: string | null;
  customNotes: string;
  onChangeOccasion: (occasion: OccasionType) => void;
  onSelectGarment: (garment: GarmentItem) => void;
  onUploadCustomGarment: (dataUrl: string) => void;
  onClearCustomGarment: () => void;
  onChangeCustomNotes: (notes: string) => void;
}

export function GarmentSelectorPanel({
  occasion,
  selectedGarmentId,
  customGarmentImageUrl,
  customNotes,
  onChangeOccasion,
  onSelectGarment,
  onUploadCustomGarment,
  onClearCustomGarment,
  onChangeCustomNotes,
}: GarmentSelectorPanelProps) {
  const garmentFileRef = useRef<HTMLInputElement>(null);

  const handleGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onUploadCustomGarment(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const occasionKeys: OccasionType[] = ["bepergian", "resmi-biasa", "kedinasan"];

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-[#E4E6EA] bg-white p-5">
      <div>
        <div className="text-xs font-medium text-[#6B7280]">03. Konteks Acara & Busana</div>
        <h3 className="mt-1 text-base font-semibold text-[#111315]">Pilihan Model Pakaian</h3>
      </div>

      {/* Occasion Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#111315]">Tujuan Penggunaan</label>
        <div className="flex flex-col gap-1.5">
          {occasionKeys.map((key) => {
            const info = OCCASION_LABELS[key];
            const active = occasion === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChangeOccasion(key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                  active
                    ? "border-[#1D4ED8] bg-[#EFF6FF]"
                    : "border-[#E4E6EA] bg-[#F8F9FA] hover:border-[#9CA3AF]"
                }`}
              >
                <div className="text-xs font-semibold text-[#111315]">{info.title}</div>
                <div className="mt-0.5 text-[11px] text-[#6B7280]">{info.subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-[#E4E6EA]" />

      {/* Studio Garment List */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#111315]">Koleksi Studio</span>
          <span className="text-[11px] text-[#6B7280] tabular-nums">
            {GARMENT_CATALOG.length} model
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {GARMENT_CATALOG.map((item) => {
            const isSelected = !customGarmentImageUrl && selectedGarmentId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectGarment(item)}
                className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "border-[#1D4ED8] bg-[#EFF6FF]"
                    : "border-[#E4E6EA] bg-white hover:border-[#9CA3AF]"
                }`}
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="h-14 w-11 shrink-0 rounded bg-[#F2F4F7] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-[#111315]">{item.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-[#6B7280]">
                    {item.gender === "pria" ? "Pria" : "Wanita"} · {OCCASION_LABELS[item.occasion].title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[#4B5563]">{item.colorName}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-[#E4E6EA]" />

      {/* Upload Own Garment */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#111315]">Uji Pakaian Pribadi</label>
        <input
          ref={garmentFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleGarmentUpload}
          className="hidden"
          aria-label="Upload foto pakaian sendiri"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => garmentFileRef.current?.click()}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              customGarmentImageUrl
                ? "border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]"
                : "border-[#9CA3AF] bg-[#F8F9FA] text-[#111315] hover:border-[#111315]"
            }`}
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">
              {customGarmentImageUrl ? "Ganti Foto Busana" : "Upload Foto Pakaian"}
            </span>
          </button>

          {customGarmentImageUrl && (
            <button
              type="button"
              onClick={onClearCustomGarment}
              title="Gunakan katalog studio"
              className="rounded-lg border border-[#E4E6EA] p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111315] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Custom Fitting Notes */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="custom-fit-notes" className="text-xs font-semibold text-[#111315]">
          Catatan Acara / Penyesuaian
        </label>
        <textarea
          id="custom-fit-notes"
          rows={3}
          value={customNotes}
          onChange={(e) => onChangeCustomNotes(e.target.value)}
          placeholder="Contoh: Rapat dinas di gedung ber-AC, perlu potongan bahu lebih rileks untuk lapisan dalam..."
          className="w-full rounded-lg border border-[#E4E6EA] bg-[#F8F9FA] p-2.5 text-xs text-[#111315] placeholder:text-[#9CA3AF] focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
        />
      </div>
    </div>
  );
}
