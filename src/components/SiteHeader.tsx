export default function SiteHeader() {
  return (
    <header className="flex h-[110px] w-full items-center justify-center bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <a href="https://bighitbarbershop.com" className="font-display text-xl uppercase tracking-wide text-white sm:text-2xl">
        Big Hit <span className="text-[var(--accent-light)]">Barbershop</span>
      </a>
    </header>
  );
}
