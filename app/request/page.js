import Script from "next/script";
import BrandStrip from "../_components/brand-strip";
import PageTopbar from "../_components/page-topbar";
import RequestForm from "../_components/request-form";

export const metadata = {
  title: "Request Church Bus",
};

export default async function RequestPage({ searchParams }) {
  const params = await searchParams;
  const initialFromDate = String(params?.fromDate || "").trim();
  const initialToDate = String(params?.toDate || "").trim();

  return (
    <>
      <Script id="request-body-class" strategy="beforeInteractive">
        {`document.body.className = "member-shell request-page font-sans antialiased text-slate-900 bg-white";`}
      </Script>

      <main className="page page-member">
        <BrandStrip />
        <PageTopbar eyebrow="Booking Request" title="Church Bus Request Form" />

        <section className="request-layout">
          <aside className="request-sidebar">
            <h2>Before You Submit</h2>
            <ul>
              <li>Church members and outside parties can submit requests.</li>
              <li>Every required field must be completed before submission.</li>
              <li>Requests are only final after admin approval.</li>
            </ul>
            <p>
              Need to book quickly? Complete all required fields and avoid abbreviations in event and destination
              names.
            </p>
          </aside>
          <RequestForm initialFromDate={initialFromDate} initialToDate={initialToDate} />
        </section>
      </main>
    </>
  );
}
