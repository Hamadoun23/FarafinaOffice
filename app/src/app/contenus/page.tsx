"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";

type Texte = { key: string; fr: string; en: string; section: string | null };

export default function Contenus() {
  const [items, setItems] = useState<Texte[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  async function charger() {
    const { data } = await supabase.from("contents").select("key,fr,en,section").order("key");
    setItems(data ?? []);
  }
  useEffect(() => { charger(); }, []);

  async function enregistrer(k: string, colonne: "fr" | "en", v: string) {
    const { error } = await supabase.from("contents").update({ [colonne]: v }).eq("key", k);
    setMsg(error ? "Échec : " + error.message : `« ${k} » enregistré.`);
  }

  const vus = items.filter((t) =>
    (t.key + t.fr + t.en).toLowerCase().includes(q.toLowerCase()));
  const sections = [...new Set(vus.map((t) => t.section ?? "divers"))];

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Textes</h1>
          <p>{items.length} textes du site, en français et en anglais</p>
        </div>
        <input placeholder="Rechercher un texte…" value={q} onChange={(e) => setQ(e.target.value)}
               style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, minWidth: 260 }} />
      </div>

      {msg && <div className="msg msg--ok">{msg}</div>}

      {sections.map((s) => (
        <div key={s} className="card-box" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: ".72rem", letterSpacing: ".16em", textTransform: "uppercase",
                       color: "var(--gold-deep)", marginBottom: 14 }}>{s}</h2>
          {vus.filter((t) => (t.section ?? "divers") === s).map((t) => (
            <div key={t.key} style={{ borderTop: "1px solid var(--line-2)", padding: "12px 0" }}>
              <div style={{ fontFamily: "ui-monospace,monospace", fontSize: ".7rem",
                            color: "var(--tx-3)", marginBottom: 6 }}>{t.key}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(["fr", "en"] as const).map((lg) => (
                  <div key={lg}>
                    <label style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".12em",
                                    textTransform: "uppercase", color: "var(--tx-3)" }}>
                      {lg === "fr" ? "Français" : "Anglais"}
                    </label>
                    <textarea defaultValue={t[lg]}
                      onBlur={(e) => { if (e.target.value !== t[lg]) enregistrer(t.key, lg, e.target.value); }}
                      style={{ width: "100%", minHeight: 58, padding: "8px 10px", marginTop: 4,
                               border: "1px solid var(--line)", borderRadius: 7, fontSize: ".84rem" }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </Shell>
  );
}
