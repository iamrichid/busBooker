import Script from "next/script";
import BrandStrip from "../_components/brand-strip";
import FinanceDesk from "../_components/finance-desk";
import PageTopbar from "../_components/page-topbar";

export const metadata = {
  title: "Church Bus Finance Desk",
};

export default function FinancePage() {
  return (
    <>
      <Script id="finance-body-class" strategy="beforeInteractive">
        {`document.body.className = "admin-shell font-sans antialiased text-slate-900 bg-white";`}
      </Script>

      <main className="page page-admin">
        <BrandStrip />
        <PageTopbar
          eyebrow="Finance Desk"
          title="Church Bus Finance Desk"
          action={
            <a className="admin-link" href="/">
              Member booking
            </a>
          }
        />

        <FinanceDesk />
      </main>
    </>
  );
}
