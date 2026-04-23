import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: {
    default: "Church Bus Booker",
    template: "%s | Church Bus Booker",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Script id="tailwind-config" strategy="beforeInteractive">
          {`
            tailwind.config = {
              theme: {
                extend: {
                  fontFamily: {
                    sans: ["Source Sans 3", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
                    display: ["Cormorant Garamond", "Georgia", "serif"],
                  },
                  colors: {
                    navy: "#123b74",
                    presbyRed: "#c7333a",
                    presbyGold: "#c8a64f",
                  },
                },
              },
            };
          `}
        </Script>
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
