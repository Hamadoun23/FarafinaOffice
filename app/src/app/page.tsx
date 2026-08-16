"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";

type Chiffres = { produits: number; sansPrix: number; clients: number; commandes: number; prospects: number };

export default function TableauDeBord() {
  const [c, setC] = useState<Chiffres | null>(null);

  useEffect(() => {
    async function charger() {
      const n = async (table: string, filtre?: (q: any) => any) => {
        let q = supabase.from(table).select("*", { count: "exact", head: true });
        if (filtre) q = filtre(q);
        const { count } = await q;
        return count ?? 0;
      };
      setC({
        produits: await n("products"),
        sansPrix: await n("products", (q) => q.is("price", null)),
        clients: await n("customers"),
        commandes: await n("orders"),
        prospects: await n("leads"),
      });
    }
    charger();

    // temps réel : le tableau se met à jour sans rechargement
    const canal = supabase
      .channel("tableau-de-bord")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, charger)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, charger)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, charger)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vue d&apos;ensemble de l&apos;activité, actualisée en temps réel.</p>
        </div>
        <Link className="btn btn--gold" href="/editeur">Modifier le site</Link>
      </div>

      <div className="grid grid--4">
        {[
          { l: "Références", v: c?.produits, h: "/catalogue" },
          { l: "Prix à définir", v: c?.sansPrix, h: "/catalogue" },
          { l: "Clients", v: c?.clients, h: "/clients" },
          { l: "Commandes", v: c?.commandes, h: "/commandes" },
          { l: "Prospects catalogue", v: c?.prospects, h: "/clients" },
        ].map((s) => (
          <Link key={s.l} href={s.h} className="card-box stat">
            <b>{s.v ?? "—"}</b>
            <span>{s.l}</span>
          </Link>
        ))}
      </div>

      <div className="card-box" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: "1rem", marginBottom: 8 }}>Par où commencer</h2>
        <p style={{ color: "var(--tx-2)", fontSize: ".9rem" }}>
          <strong>Modifier le site</strong> ouvre le site réel : cliquez un texte, un prix ou une
          image pour le changer. <strong>Catalogue</strong> sert à créer une référence ou remplacer
          une photo. <strong>Commandes</strong> suit les demandes de devis reçues.
        </p>
      </div>
    </Shell>
  );
}
