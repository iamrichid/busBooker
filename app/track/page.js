import Script from "next/script";
import BrandStrip from "../_components/brand-strip";
import PageTopbar from "../_components/page-topbar";
import TrackingClient from "../_components/tracking-client";

export const metadata = {
  title: "Track Bus Request",
};

export default async function TrackPage({ searchParams }) {
  const params = await searchParams;
  const initialCode = String(params?.code || "").trim().toUpperCase();

  return (
    <>
      <Script id="track-body-class" strategy="beforeInteractive">
        {`document.body.className = "member-shell request-page font-sans antialiased text-slate-900 bg-white";`}
      </Script>

      <main className="page page-member">
        <BrandStrip />
        <PageTopbar eyebrow="Request Tracking" title="Track Your Bus Request" />

        <TrackingClient initialCode={initialCode} />
      </main>
    </>
  );
}
