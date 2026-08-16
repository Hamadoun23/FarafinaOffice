"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";

type Client = { id: string; name: string; company: string | null; email: string | null;
  country: string | null; source: string; created_at: string };

export default function Clients() {
  const [items, setItems] = useState<Client[]>([]);

  async function charger() {
    const { data } = await supabase.from("customers")
      .select("id,name,company,email,country,source,created_at")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => {
    charger();
    const canal = supabase.channel("clients")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, charger)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Clients</h1>
          <p>{items.length} fiches · alimentées en direct par le site</p>
        </div>
      </div>

      <div className="card-box" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead><tr><th>Nom</th><th>Société</th><th>E-mail</th><th>Pays</th><th>Origine</th></tr></thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ color: "var(--tx-3)", padding: 26 }}>
                Aucun client pour l&apos;instant. Les fiches arriveront du formulaire de contact,
                du catalogue PDF et des demandes de devis.
              </td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.company || "—"}</td>
                <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</td>
                <td>{c.country || "—"}</td>
                <td><span className="tag tag--nouveau">{c.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
