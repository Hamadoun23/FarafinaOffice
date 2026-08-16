import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarafinaOffice — gestion Farafinatignɛ",
  description: "Back-office de Farafinatignɛ : contenus du site, catalogue, clients, commandes et devis.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&family=Anton&text=FARAFINAOCE%C6%90&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
