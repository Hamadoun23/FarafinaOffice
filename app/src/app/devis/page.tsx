"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";

type Devis = {
  id: string; number: number; amount: number; shipping_cost: number;
  status: string; valid_until: string | null; created_at: string;
  customers: { name: string; company: string | null } | null;
};

const STATUTS: Record<string, string> = {
  brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté",
  refuse: "Refusé", expire: "Expiré",
};

export default function DevisPage() {
  const [items, setItems] = useState<Devis[]>([]);

  async function charger() {
    const { data } = await supabase.from("quotes")
      .select("id,number,amount,shipping_cost,status,valid_until,created_at,customers(name,company)")
      .order("created_at", { ascending: false });
    setItems((data as unknown as Devis[]) ?? []);
  }
  useEffect(() => {
    charger();
    const canal = supabase.channel("devis")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, charger)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  async function changer(d: Devis, statut: string) {
    const maj: Record<string, unknown> = { status: statut };
    if (statut === "envoye") maj.sent_at = new Date().toISOString();
    await supabase.from("quotes").update(maj).eq("id", d.id);
    charger();
  }

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Devis</h1>
          <p>Factures proforma établies à partir des commandes</p>
        </div>
      </div>

      <div className="card-box" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr><th>N°</th><th>Client</th><th>Montant</th><th>Port</th><th>Total</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ color: "var(--tx-3)", padding: 26 }}>
                Aucun devis. Créez-en un depuis une commande.
              </td></tr>
            )}
            {items.map((d) => (
              <tr key={d.id}>
                <td style={{ fontFamily: "ui-monospace,monospace" }}>#{d.number}</td>
                <td>
                  <strong>{d.customers?.name ?? "—"}</strong>
                  <div style={{ color: "var(--tx-3)", fontSize: ".78rem" }}>{d.customers?.company ?? ""}</div>
                </td>
                <td>{Number(d.amount).toFixed(2)} €</td>
                <td>{Number(d.shipping_cost).toFixed(2)} €</td>
                <td><strong>{(Number(d.amount) + Number(d.shipping_cost)).toFixed(2)} €</strong></td>
                <td>
                  <select value={d.status} onChange={(e) => changer(d, e.target.value)}
                          style={{ padding: "7px 9px", border: "1px solid var(--line)", borderRadius: 7 }}>
                    {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
