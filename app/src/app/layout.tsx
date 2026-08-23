import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarafinaOffice — gestion Farafinatignɛ",
  description: "Back-office de Farafinatignɛ : contenus du site, catalogue, clients, commandes et devis.",
  robots: { index: false, follow: false },
};

/**
 * Le theme est pose sur <html> AVANT le premier rendu : applique plus
 * tard, l'ecran s'afficherait en clair puis basculerait. Tant que
 * l'utilisateur n'a rien choisi, on suit le reglage de son systeme.
 */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("fo-theme");
if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
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
