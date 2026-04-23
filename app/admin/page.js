import Script from "next/script";
import AdminDesk from "../_components/admin-desk";
import BrandStrip from "../_components/brand-strip";
import PageTopbar from "../_components/page-topbar";

export const metadata = {
  title: "Transport Approval Desk",
};

export default function AdminPage() {
  return (
    <>
      <Script id="admin-body-class" strategy="beforeInteractive">
        {`document.body.className = "admin-shell font-sans antialiased text-slate-900 bg-white";`}
      </Script>

      <main className="page page-admin">
        <BrandStrip />
        <PageTopbar
          eyebrow="Approval Desk"
          title="Transport Approval Desk"
          action={
            <a className="admin-link" href="/">
              Member booking
            </a>
          }
        />

        <AdminDesk />
      </main>
    </>
  );
}
