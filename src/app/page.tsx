import BookingFlow from "@/components/BookingFlow";

export default function Home() {
  const shopId = process.env.NEXT_PUBLIC_SHOP_ID;

  if (!shopId) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center text-[var(--muted)]">
          <h1 className="font-display mb-2 text-lg text-white">
            Booking is not configured yet
          </h1>
          <p>
            Set <code>NEXT_PUBLIC_SHOP_ID</code> and your Supabase env vars in{" "}
            <code>.env.local</code> to enable booking.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <section className="w-full bg-gradient-to-b from-[#1a1a1a] to-[#2d2d2d] px-4 py-16 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide text-white sm:text-5xl">
          Book Your Appointment
        </h1>
        <p className="mt-3 text-sm uppercase tracking-[2px] text-[var(--muted)] sm:text-base">
          Pick a barber, a service, and a time that works for you
        </p>
        <div className="brand-divider" />
      </section>

      <section className="flex flex-1 justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <BookingFlow shopId={shopId} />
        </div>
      </section>
    </main>
  );
}
