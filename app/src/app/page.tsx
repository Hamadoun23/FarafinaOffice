"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Ico, Vide } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { euros, jour } from "@/lib/db";

type Chiffres = {
  produits: number; masques: number; sansPrix: number;
  clients: number; commandes: number; aTraiter: number; prospects: number; relances: number;
};

type Ligne = {
  id: string; number: number; status: string; total_estimate: number;
  created_at: string; customers: { name: string } | null;
};

const STATUT: Record<string, { l: string; t: string }> = {
  nouveau: { l: "Nouveau", t: "warn" },
  devis_envoye: { l: "Devis envoye", t: "info" },
  confirme: { l: "Confirme", t: "info" },
  paye: { l: "Paye", t: "ok" },
  expedie: { l: "Expedie", t: "ok" },
  annule: { l: "Annule", t: "mute" },
};

export default function TableauDeBord() {
  const [c, setC] = useState<Chiffres | null>(null);
  const [recentes, setRecentes] = useState<Ligne[]>([]);

  useEffect(() => {
    async function charger() {
      const n = async (table: string, filtre?: (q: any) => any) => {
        let q = supabase.from(table).select("*", { count: "exact", head: true });
        if (filtre) q = filtre(q);
        const { count } = await q;
        return count ?? 0;
      };
      const [produits, masques, sansPrix, clients, commandes, aTraiter, prospects, relances] =
        await Promise.all([
          n("products"),
          n("products", (q) => q.eq("is_published", false)),
          n("products", (q) => q.is("price", null)),
          n("customers"),
          n("orders"),
          n("orders", (q) => q.eq("status", "nouveau")),
          n("leads"),
          n("follow_ups", (q) => q.is("done_at", null)),
        ]);
      setC({ produits, masques, sansPrix, clients, commandes, aTraiter, prospects, relances });

      const { data } = await supabase
        .from("orders")
        .select("id,number,status,total_estimate,created_at,customers(name)")
        .order("created_at", { ascending: false })
        .limit(6);
      setRecentes((data as unknown as Ligne[]) ?? []);
    }
    charger();

    const canal = supabase
      .channel("tableau-de-bord")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, charger)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, charger)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, charger)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  const tuiles = [
    { l: "References", v: c?.produits, h: "/catalogue" },
    { l: "A traiter", v: c?.aTraiter, h: "/commandes" },
    { l: "Clients", v: c?.clients, h: "/clients" },
    { l: "Prospects", v: c?.prospects, h: "/clients" },
    { l: "Relances dues", v: c?.relances, h: "/relances" },
  ];

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vue d&apos;ensemble de l&apos;activite, actualisee en direct.</p>
        </div>
        <div className="head__act">
          <Link className="btn" href="/catalogue"><Ico n="plus" s={16} /> Nouveau produit</Link>
          <Link className="btn btn--main" href="/editeur"><Ico n="edit" s={16} /> Modifier le site</Link>
        </div>
      </div>

      <div className="grid grid--4">
        {tuiles.map((s) => (
          <Link key={s.l} href={s.h} className="stat">
            <b>{s.v ?? "—"}</b>
            <span>{s.l}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid--2" style={{ marginTop: 16, alignItems: "start" }}>
        <div className="card">
          <div style={{ padding: "16px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="section-t" style={{ margin: 0 }}>Dernieres commandes</div>
            <Link className="btn btn--sm btn--ghost" href="/commandes">Tout voir</Link>
          </div>
          <div className="tw">
            {recentes.length === 0 ? (
              <Vide titre="Aucune commande" texte="Les demandes de devis envoyees par le site apparaitront ici." />
            ) : (
              <table>
                <tbody>
                  {recentes.map((o) => (
                    <tr key={o.id}>
                      <td className="mono">#{o.number}</td>
                      <td><strong>{o.customers?.name ?? "—"}</strong><div className="sub">{jour(o.created_at)}</div></td>
                      <td className="num">{euros(o.total_estimate)}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`tag tag--${STATUT[o.status]?.t ?? "mute"}`}>
                          {STATUT[o.status]?.l ?? o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div className="hero">
            <div>
              <h2>Tout se modifie ici</h2>
              <p>
                <strong>Modifier le site</strong> ouvre le site reel : un clic sur un texte, un prix
                ou une image suffit. <strong>Produits</strong> sert a creer, dupliquer ou retirer une
                reference. Rien ne passe par le code.
              </p>
            </div>
            <Link className="btn btn--main" href="/editeur">Ouvrir</Link>
          </div>

          <div className="card card--pad">
            <div className="section-t">A surveiller</div>
            <ul style={{ listStyle: "none", display: "grid", gap: 10, fontSize: ".87rem" }}>
              <li style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Prix encore a definir</span>
                <Link href="/catalogue" className="tag tag--warn">{c?.sansPrix ?? "—"}</Link>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Produits masques du site</span>
                <Link href="/catalogue" className="tag tag--mute">{c?.masques ?? "—"}</Link>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Commandes en attente</span>
                <Link href="/commandes" className="tag tag--info">{c?.aTraiter ?? "—"}</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Shell>
  );
}
