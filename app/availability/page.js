import Script from "next/script";
import AvailabilityForm from "../_components/availability-form";
import BrandStrip from "../_components/brand-strip";

export const metadata = {
  title: "Bus Availability",
};

export default function AvailabilityPage() {
  return (
    <>
      <Script id="availability-body-class" strategy="beforeInteractive">
        {`document.body.className = "member-shell request-page font-sans antialiased text-slate-900 bg-white";`}
      </Script>

      <main className="page page-member">
        <BrandStrip />

        <section className="request-topbar availability-topbar">
          <div>
            <p className="eyebrow">Bus Availability</p>
            <h1 className="font-display">Select Date Range</h1>
          </div>
        </section>

        <section className="availability-warning" role="note" aria-label="Booking notice">
          <strong>Book at least one week ahead.</strong>
          <span>Requests for dates within the next 7 days may be delayed or unavailable after review.</span>
        </section>

        <AvailabilityForm />
      </main>
    </>
  );
}
