"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase, SITE_URL as SITE } from "@/lib/supabase";

type Produit = {
  id: string; ref: string; slug: string; fr_name: string; en_name: string;
  price: number | null; unit: string; tag: string | null; image_path: string | null;
  is_published: boolean;
};

export default function Catalogue() {
  const [items, setItems] = useState<Produit[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  async function charger() {
    const { data } = await supabase
      .from("products")
      .select("id,ref,slug,fr_name,en_name,price,unit,tag,image_path,is_published")
      .order("position");
    setItems(data ?? []);
  }
  useEffect(() => { charger(); }, []);

  async function majPrix(p: Produit, brut: string) {
    const v = brut.trim().replace(",", ".");
    const prix = v === "" ? null : Number(v);
    if (prix !== null && Number.isNaN(prix)) { setMsg("Prix illisible : " + brut); return; }
    const { error } = await supabase.from("products").update({ price: prix }).eq("id", p.id);
    setMsg(error ? "Échec : " + error.message : `Prix de ${p.ref} enregistré.`);
    charger();
  }

  /* Remplacement d'une photo : le fichier part dans le bucket Supabase et
     image_path reçoit l'URL publique. Les photos d'origine restent servies
     en local par nginx — on ne téléverse que ce qui change réellement. */
  async function remplacerImage(p: Produit, fichier: File) {
    setMsg("Téléversement de " + fichier.name + "…");
    const ext = fichier.name.split(".").pop()?.toLowerCase() || "jpg";
    const chemin = `${p.slug}-${Date.now()}.${ext}`;
    const up = await supabase.storage
      .from("product-images")
      .upload(chemin, fichier, { cacheControl: "31536000", upsert: true });
    if (up.error) { setMsg("Échec du téléversement : " + up.error.message); return; }

    const { data } = supabase.storage.from("product-images").getPublicUrl(chemin);
    const { error } = await supabase
      .from("products")
      .update({ image_path: data.publicUrl })
      .eq("id", p.id);
    setMsg(error ? "Échec : " + error.message : `Photo de ${p.ref} remplacée.`);
    charger();
  }

  async function basculer(p: Produit) {
    await supabase.from("products").update({ is_published: !p.is_published }).eq("id", p.id);
    charger();
  }

  const vus = items.filter((p) =>
    (p.fr_name + p.en_name + p.ref).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Catalogue</h1>
          <p>{items.length} références · {items.filter((p) => p.price === null).length} sans prix · cliquez une photo pour la remplacer</p>
        </div>
        <input
          placeholder="Rechercher une référence…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, minWidth: 260 }}
        />
      </div>

      {msg && <div className="msg msg--ok">{msg}</div>}

      <div className="card-box" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Photo</th><th>Réf.</th><th>Produit</th><th>Prix (€)</th><th>En ligne</th>
            </tr>
          </thead>
          <tbody>
            {vus.map((p) => (
              <tr key={p.id}>
                <td>
                  <label style={{ cursor: "pointer", display: "block", width: 52 }}
                         title="Cliquer pour remplacer la photo">
                    <img
                      src={
                        p.image_path?.includes("://")
                          ? p.image_path
                          : `${SITE}/assets/images/${p.image_path ?? ""}`
                      }
                      alt=""
                      style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6,
                               background: "var(--sand)" }}
                    />
                    <input type="file" accept="image/*" hidden
                           onChange={(e) => {
                             const f = e.target.files?.[0];
                             if (f) remplacerImage(p, f);
                             e.target.value = "";
                           }} />
                  </label>
                </td>
                <td style={{ fontFamily: "ui-monospace,monospace", fontSize: ".76rem" }}>{p.ref}</td>
                <td>
                  <strong>{p.fr_name}</strong>
                  <div style={{ color: "var(--tx-3)", fontSize: ".78rem" }}>{p.en_name}</div>
                </td>
                <td>
                  <input
                    defaultValue={p.price ?? ""}
                    placeholder="sur demande"
                    onBlur={(e) => { if (e.target.value !== String(p.price ?? "")) majPrix(p, e.target.value); }}
                    style={{ width: 110, padding: "7px 9px", border: "1px solid var(--line)", borderRadius: 7 }}
                  />
                </td>
                <td>
                  <button className="btn btn--line" style={{ padding: "6px 12px", fontSize: ".76rem" }}
                          onClick={() => basculer(p)}>
                    {p.is_published ? "Visible" : "Masqué"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
