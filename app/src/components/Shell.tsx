"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Ico, Toasts } from "@/components/ui";

const GROUPES: { titre: string; liens: { href: string; label: string; ico: string }[] }[] = [
  {
    titre: "Pilotage",
    liens: [{ href: "/", label: "Tableau de bord", ico: "home" }],
  },
  {
    titre: "Le site",
    liens: [
      { href: "/editeur", label: "Modifier le site", ico: "edit" },
      { href: "/contenus", label: "Textes", ico: "text" },
    ],
  },
  {
    titre: "Catalogue",
    liens: [
      { href: "/catalogue", label: "Produits", ico: "box" },
      { href: "/categories", label: "Categories", ico: "tag" },
    ],
  },
  {
    titre: "Commercial",
    liens: [
      { href: "/clients", label: "Clients", ico: "users" },
      { href: "/commandes", label: "Commandes", ico: "cart" },
      { href: "/devis", label: "Devis", ico: "bill" },
      { href: "/relances", label: "Relances", ico: "bell" },
    ],
  },
];

/** Coquille commune : barre laterale, garde d'authentification, notifications. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [qui, setQui] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [sombre, setSombre] = useState(false);

  /* Le theme est deja pose sur <html> par le script du layout : on se
     contente de refleter son etat, puis de l'inverser et le retenir. */
  useEffect(() => {
    setSombre(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function basculerTheme() {
    const suivant = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", suivant);
    try { localStorage.setItem("fo-theme", suivant); } catch { /* navigation privee */ }
    setSombre(suivant === "dark");
  }

  useEffect(() => { setOuvert(false); }, [path]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        router.replace("/connexion");
      } else {
        setQui(u.phone ? "+223 " + u.phone.replace(/^223/, "") : u.email ?? null);
        /* mot de passe encore provisoire : on impose le changement */
        if (u.user_metadata?.must_change_password === true && path !== "/compte") {
          router.replace("/compte");
        }
      }
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/connexion");
      else setQui(session.user.phone ? "+223 " + session.user.phone.replace(/^223/, "") : session.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [router, path]);

  if (!checked) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", color: "var(--ink-3)" }}>
        Chargement…
      </div>
    );
  }

  return (
    <div className="shell">
      {ouvert && <div className="scrim" onClick={() => setOuvert(false)} />}

      <aside className={`side ${ouvert ? "open" : ""}`}>
        <div className="side__brand">
          <span className="side__mark">
            <svg viewBox="0 0 120 70" width="26" height="16" fill="none" aria-hidden>
              <g stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 26 L28 14 L44 26 L60 14 L76 26 L92 14 L106 24" />
                <path d="M12 46 L28 58 L44 46 L60 58 L76 46 L92 58 L106 48" />
              </g>
            </svg>
          </span>
          <div>
            <b>FARAFINAOFFICE</b>
            <span>Gestion</span>
          </div>
        </div>

        <nav>
          {GROUPES.map((g) => (
            <div key={g.titre}>
              <div className="side__group">{g.titre}</div>
              {g.liens.map((l) => (
                <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>
                  <Ico n={l.ico} s={17} />
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="side__foot">
          <button className="side__theme" onClick={basculerTheme}>
            <Ico n={sombre ? "sun" : "moon"} s={16} />
            {sombre ? "Thème clair" : "Thème sombre"}
          </button>
          <div className="side__me">
            <i>{(qui ?? "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase()}</i>
            <div>
              <Link href="/compte"><small title={qui ?? ""}>{qui}</small></Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.replace("/connexion");
                }}
              >
                Se deconnecter
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <button className="burger" onClick={() => setOuvert(true)}>
          <Ico n="menu" s={16} /> Menu
        </button>
        {children}
      </main>

      <Toasts />
    </div>
  );
}
