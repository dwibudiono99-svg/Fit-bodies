import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { GARMENT_CATALOG, OCCASION_LABELS } from "../data/catalog";
import { GarmentItem, GenderType, OccasionType } from "../types/studio";

interface GarmentCatalogSectionProps {
  selectedGarmentId: string;
  onTryInStudio: (garment: GarmentItem) => void;
}

export function GarmentCatalogSection({
  selectedGarmentId,
  onTryInStudio,
}: GarmentCatalogSectionProps) {
  const [occasionFilter, setOccasionFilter] = useState<"semua" | OccasionType>("semua");
  const [genderFilter, setGenderFilter] = useState<"semua" | GenderType>("semua");

  const filteredItems = GARMENT_CATALOG.filter((item) => {
    const matchOccasion = occasionFilter === "semua" || item.occasion === occasionFilter;
    const matchGender = genderFilter === "semua" || item.gender === genderFilter;
    return matchOccasion && matchGender;
  });

  return (
    <section id="katalog-busana" className="mx-auto max-w-[1360px] px-6 py-16">
      <div className="flex flex-col gap-6 border-t border-[#E4E6EA] pt-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <div className="text-xs font-medium text-[#6B7280]">Katalog Referensi Busana</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#111315] text-balance">
            Kurasi Setelan untuk Setiap Agenda
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
            Pilih model pakaian berdasarkan kebutuhan perjalanan, pertemuan resmi biasa, maupun agenda
            kedinasan untuk langsung diuji pada proporsi tubuh Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Occasion Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-[#F2F4F7] p-1">
            {(
              [
                { id: "semua", label: "Semua" },
                { id: "bepergian", label: "Bepergian" },
                { id: "resmi-biasa", label: "Resmi Biasa" },
                { id: "kedinasan", label: "Kedinasan" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOccasionFilter(tab.id)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  occasionFilter === tab.id
                    ? "bg-white text-[#111315] shadow-xs"
                    : "text-[#6B7280] hover:text-[#111315]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Gender Filter */}
          <div className="flex items-center gap-1 rounded-lg bg-[#F2F4F7] p-1">
            {(
              [
                { id: "semua", label: "Semua" },
                { id: "pria", label: "Pria" },
                { id: "wanita", label: "Wanita" },
              ] as const
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGenderFilter(g.id)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  genderFilter === g.id
                    ? "bg-white text-[#111315] shadow-xs"
                    : "text-[#6B7280] hover:text-[#111315]"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3-Column Product Grid */}
      {filteredItems.length === 0 ? (
        <div className="mt-10 rounded-xl border border-[#E4E6EA] bg-white p-12 text-center">
          <p className="text-sm font-semibold text-[#111315]">
            Tidak ada model pakaian pada kombinasi filter ini.
          </p>
          <button
            type="button"
            onClick={() => {
              setOccasionFilter("semua");
              setGenderFilter("semua");
            }}
            className="mt-3 text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
          >
            Tampilkan seluruh koleksi
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isSelected = selectedGarmentId === item.id;
            return (
              <article
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-[#E4E6EA] bg-white transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#F2F4F7]">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <div className="text-xs font-medium text-[#6B7280]">
                      {OCCASION_LABELS[item.occasion].title} ·{" "}
                      {item.gender === "pria" ? "Pria" : "Wanita"}
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-[#111315]">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#4B5563]">{item.fabric}</p>
                    <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
                      {item.protocolNote}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-[#E4E6EA] pt-4">
                    <span className="text-xs font-medium text-[#4B5563]">{item.colorName}</span>
                    <button
                      type="button"
                      onClick={() => onTryInStudio(item)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? "bg-[#EFF6FF] text-[#1D4ED8]"
                          : "bg-[#111315] text-white hover:bg-[#1D4ED8]"
                      }`}
                    >
                      <span>{isSelected ? "Sedang Dipasang" : "Pasang di Studio"}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
