export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] text-white">
      <div className="h-[3px] w-full bg-gradient-to-r from-[var(--accent)] via-[var(--accent-light)] to-[var(--accent)]" />
      <div className="mx-auto max-w-[1200px] px-5 py-8 text-center">
        <p className="font-display text-sm uppercase tracking-wide">Big Hit Barbershop</p>
        <p className="mt-3 text-xs text-[#666]">
          &copy; {new Date().getFullYear()} Big Hit Barbershop. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
