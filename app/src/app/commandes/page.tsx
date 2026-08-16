"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";

type Commande = { id: string; number: number; status: string; channel: string;
  total_estimate: number; created_at: string; customers: { name: string; company: string | null } | null };

const STATUTS = ["nouveau", "devis_envoye", "confirme", "paye", "expedie", "annule"];
const LIBELLE: Record<string, string> = {
  nouveau: "Nouveau", devis_envoye: "Devis envoyé", confirme: "Confirmé",
  paye: "Payé", expedie: "Expédié", annule: "Annulé",
};

export default function Commandes() {
  const [items, setItems] = useState<Commande[]>([]);

  async function charger() {
    const { data } = await supabase.from("orders")
      .select("id,number,status,channel,total_estimate,created_at,customers(name,company)")
      .order("created_at", { ascending: false });
    setItems((data as unknown as Commande[]) ?? []);
  }
  useEffect(() => {
    charger();
    const canal = supabase.channel("commandes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, charger)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  async function changerStatut(c: Commande, statut: string) {
    await supabase.from("orders").update({ status: statut }).eq("id", c.id);
    charger();
  }

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Commandes</h1>
          <p>Demandes de devis reçues, actualisées en temps réel</p>
        </div>
      </div>

      <div className="card-box" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead><tr><th>N°</th><th>Client</th><th>Canal</th><th>Total estimé</th><th>Statut</th></tr></thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ color: "var(--tx-3)", padding: 26 }}>
                Aucune commande enregistrée. Elles apparaîtront dès que le site enverra
                une demande de devis.
              </td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id}>
                <td style={{ fontFamily: "ui-monospace,monospace" }}>#{c.number}</td>
                <td>
                  <strong>{c.customers?.name ?? "—"}</strong>
                  <div style={{ color: "var(--tx-3)", fontSize: ".78rem" }}>{c.customers?.company ?? ""}</div>
                </td>
                <td>{c.channel}</td>
                <td>{Number(c.total_estimate).toFixed(2)} €</td>
                <td>
                  <select value={c.status} onChange={(e) => changerStatut(c, e.target.value)}
                          style={{ padding: "7px 9px", border: "1px solid var(--line)", borderRadius: 7 }}>
                    {STATUTS.map((s) => <option key={s} value={s}>{LIBELLE[s]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
