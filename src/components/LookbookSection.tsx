import { useState } from "react";
import { Download, Sparkles, Trash2 } from "lucide-react";
import { OCCASION_LABELS } from "../data/catalog";
import {
  BodyProfile,
  OccasionType,
  SavedLookbookEntry,
  StylistMixResponse,
} from "../types/studio";

interface LookbookSectionProps {
  lookbook: SavedLookbookEntry[];
  occasion: OccasionType;
  profile: BodyProfile;
  garmentTitle: string;
  onDeleteEntry: (id: string) => void;
}

export function LookbookSection({
  lookbook,
  occasion,
  profile,
  garmentTitle,
  onDeleteEntry,
}: LookbookSectionProps) {
  const [agendaInput, setAgendaInput] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [planResult, setPlanResult] = useState<StylistMixResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const handleGenerateBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPlanning(true);
    setPlanError(null);
    try {
      const res = await fetch("/api/stylist-mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion,
          profile,
          garmentTitle,
          destinationOrAgenda: agendaInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyusun panduan perjalanan.");
      }
      setPlanResult(data);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Terjadi kesalahan jaringan.");
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1360px] px-6 pb-20">
      {/* Section: Panduan Acara & Perjalanan */}
      <section id="panduan-acara" className="border-t border-[#E4E6EA] py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="text-xs font-medium text-[#6B7280]">Perencana Referensi Agenda</div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#111315] text-balance">
              Panduan Bepergian & Pertemuan Resmi
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
              Masukkan tujuan perjalanan atau agenda pertemuan Anda untuk memperoleh rekomendasi
              sepatu, kelengkapan tas, serta perawatan bahan agar busana tetap rapi saat tiba di lokasi.
            </p>

            <form onSubmit={handleGenerateBrief} className="mt-6 flex flex-col gap-3">
              <label htmlFor="agenda-input" className="text-xs font-semibold text-[#111315]">
                Agenda atau Kota Tujuan
              </label>
              <input
                id="agenda-input"
                type="text"
                value={agendaInput}
                onChange={(e) => setAgendaInput(e.target.value)}
                placeholder="Misal: Kunjungan kerja 2 hari ke Jakarta & rapat kedinasan"
                className="w-full rounded-lg border border-[#E4E6EA] bg-white px-3.5 py-2.5 text-sm text-[#111315] placeholder:text-[#9CA3AF] focus:border-[#1D4ED8] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isPlanning}
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#111315] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isPlanning ? "Menyusun Panduan..." : "Susun Panduan Busana AI"}</span>
              </button>
            </form>

            {planError && (
              <p className="mt-3 text-xs text-red-600">{planError}</p>
            )}
          </div>

          <div className="lg:col-span-7">
            {planResult ? (
              <div className="rounded-xl border border-[#E4E6EA] bg-white p-6">
                <div className="text-xs font-medium text-[#6B7280]">
                  Ringkasan Referensi · {OCCASION_LABELS[occasion].title}
                </div>
                <h3 className="mt-1 text-lg font-semibold text-[#111315]">{planResult.headline}</h3>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-[#F8F9FA] p-4">
                    <div className="text-xs font-semibold text-[#111315]">Alas Kaki</div>
                    <p className="mt-1 text-xs leading-relaxed text-[#4B5563]">{planResult.footwear}</p>
                  </div>
                  <div className="rounded-lg bg-[#F8F9FA] p-4">
                    <div className="text-xs font-semibold text-[#111315]">Tas & Aksesori</div>
                    <p className="mt-1 text-xs leading-relaxed text-[#4B5563]">
                      {planResult.accessories}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#F8F9FA] p-4">
                    <div className="text-xs font-semibold text-[#111315]">Perawatan Saat Perjalanan</div>
                    <p className="mt-1 text-xs leading-relaxed text-[#4B5563]">
                      {planResult.garmentCare}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#F8F9FA] p-4">
                    <div className="text-xs font-semibold text-[#111315]">Busana Cadangan</div>
                    <p className="mt-1 text-xs leading-relaxed text-[#4B5563]">
                      {planResult.backupItem}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(["bepergian", "resmi-biasa", "kedinasan"] as OccasionType[]).map((key, idx) => (
                  <div key={key} className="rounded-xl border border-[#E4E6EA] bg-white p-5">
                    <div className="font-mono text-xs text-[#6B7280] tabular-nums">0{idx + 1}.</div>
                    <h3 className="mt-2 text-sm font-semibold text-[#111315]">
                      {OCCASION_LABELS[key].title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#4B5563]">
                      {OCCASION_LABELS[key].detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section: Lookbook Tersimpan */}
      <section id="lookbook-tersimpan" className="border-t border-[#E4E6EA] pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-[#6B7280]">Arsip Referensi Pribadi</div>
            <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-[#111315]">
              Lookbook Tersimpan
            </h2>
          </div>
          <div className="text-xs font-medium text-[#6B7280] tabular-nums">
            {lookbook.length} tampilan tersimpan
          </div>
        </div>

        {lookbook.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#D1D5DB] bg-white p-10 text-center">
            <p className="text-sm font-semibold text-[#111315]">Belum ada tampilan di Lookbook Anda</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              Klik tombol “Simpan Lookbook” pada kanvas studio setelah mengatur fitting agar dapat
              dibandingkan sebelum bepergian atau menghadiri acara penting.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {lookbook.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[#E4E6EA] bg-white"
              >
                <div className="aspect-[3/4] w-full bg-[#F2F4F7]">
                  <img
                    src={entry.previewDataUrl}
                    alt={entry.garmentTitle}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <div className="text-[11px] font-medium text-[#6B7280]">
                      {OCCASION_LABELS[entry.occasion].title} · {entry.createdAt}
                    </div>
                    <h3 className="mt-1 truncate text-sm font-semibold text-[#111315]">
                      {entry.garmentTitle}
                    </h3>
                    <p className="mt-1 text-xs text-[#4B5563]">{entry.profileSummary}</p>
                    <p className="mt-1 text-xs font-medium text-[#1D4ED8]">{entry.fitVerdict}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#E4E6EA] pt-3">
                    <a
                      href={entry.previewDataUrl}
                      download={`lookbook-${entry.id}.jpg`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#111315] hover:text-[#1D4ED8]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Unduh</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      aria-label={`Hapus ${entry.garmentTitle}`}
                      className="inline-flex items-center gap-1 text-xs text-[#6B7280] hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
