"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const LIENS = [
  { href: "/", label: "Tableau de bord" },
  { href: "/editeur", label: "Modifier le site" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/contenus", label: "Textes" },
  { href: "/clients", label: "Clients" },
  { href: "/commandes", label: "Commandes" },
  { href: "/devis", label: "Devis" },
];

/** Coquille commune : barre latérale + garde d'authentification. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/connexion");
      else setEmail(data.session.user.email ?? null);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/connexion");
      else setEmail(session.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!checked) return <div style={{ padding: 40 }}>Chargement…</div>;

  return (
    <div className="shell">
      <aside className="side">
        <div className="side__brand">
          <svg viewBox="0 0 120 70" width="42" height="25" fill="none" aria-hidden>
            <ellipse cx="60" cy="35" rx="57" ry="32.5" stroke="#F8F7EE" strokeWidth="2.6" />
            <g stroke="#CC8D3D" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 26 L25 17 L35 26 L45 17 L55 26 L65 17 L75 26 L85 17 L95 26 L104 19" />
              <path d="M15 44 L25 53 L35 44 L45 53 L55 44 L65 53 L75 44 L85 53 L95 44 L104 51" />
            </g>
          </svg>
          <div>
            <b>FARAFINAOFFICE</b>
            <span>Gestion</span>
          </div>
        </div>

        <nav>
          {LIENS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="side__foot">
          {email}
          <br />
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/connexion");
            }}
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
