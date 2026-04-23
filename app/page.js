import Script from "next/script";
import HomeCarousel from "./_components/home-carousel";

export const metadata = {
  title: "Church Bus Booker",
};

export default function HomePage() {
  return (
    <>
      <Script id="home-body-class" strategy="beforeInteractive">
        {`document.body.className = "member-shell home-shell font-sans antialiased text-slate-900 bg-white";`}
      </Script>

      <main className="home-page">
        <HomeCarousel />
      </main>
    </>
  );
}
