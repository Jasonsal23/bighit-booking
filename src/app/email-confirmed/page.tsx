export default function EmailConfirmedPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-2xl">
          ✓
        </div>
        <h1 className="font-display mb-2 text-lg uppercase tracking-wide text-white">
          Email Confirmed
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Your email is confirmed. Head back to the Big Hit Barbershop app and log in.
        </p>
      </div>
    </main>
  );
}
