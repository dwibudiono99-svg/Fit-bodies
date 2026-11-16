interface HeaderProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
}

export function Header({ activeSection, onNavigate }: HeaderProps) {
  const navItems = [
    { id: "studio-fitting", label: "Studio Fitting" },
    { id: "katalog-busana", label: "Katalog Busana" },
    { id: "panduan-acara", label: "Panduan Acara" },
    { id: "lookbook-tersimpan", label: "Lookbook" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#E4E6EA] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-8 px-6 py-4">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("top");
          }}
          className="font-display text-2xl font-semibold tracking-tight text-[#111315] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8]"
        >
          RupaFit
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4B5563]">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.id);
                }}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b ${
                  isActive
                    ? "border-[#111315] text-[#111315]"
                    : "border-transparent hover:border-[#9CA3AF] hover:text-[#111315]"
                } focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8]`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => onNavigate("studio-fitting")}
            className="whitespace-nowrap shrink-0 rounded-lg bg-[#111315] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] cursor-pointer"
          >
            Mulai Fitting
          </button>
        </div>
      </div>
    </header>
  );
}
