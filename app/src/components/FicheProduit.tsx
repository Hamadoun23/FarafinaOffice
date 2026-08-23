"use client";

/**
 * Fiche produit — la seule et unique.
 *
 * Elle sert au catalogue comme a l'editeur en direct : cliquer un produit
 * dans la page du site ouvre exactement le meme formulaire. Rien ne se
 * modifie a deux endroits differents.
 */

import { useState } from "react";
import { Champ, Ico, Modal, toast } from "@/components/ui";
import { enregistrer, euros, prixRemise, promoActive, slugifier, televerser } from "@/lib/db";
import { SITE_URL as SITE } from "@/lib/supabase";

export type Produit = {
  id: string; ref: string; slug: string; category_id: string; subcategory_id: string | null;
  fr_name: string; fr_desc: string; en_name: string; en_desc: string;
  price: number | null; price_from: boolean; unit: string; set_qty: number | null;
  sizes: string | null; tag: string | null; image_path: string | null;
  discount_percent: number; discount_until: string | null;
  is_published: boolean; position: number;
};
export type Categorie = { id: string; slug: string; fr_name: string; position: number };
export type SousCategorie = { id: string; category_id: string; slug: string; fr_name: string };

export const UNITES = [
  { v: "piece", l: "A la piece" },
  { v: "pair", l: "A la paire" },
  { v: "lot", l: "Par lot / assortiment" },
  { v: "metre", l: "Au metre" },
];
export const ETIQUETTES = ["", "signature", "best", "gros", "piece-speciale", "nouveau"];
export const REMISES = [0, 5, 10, 15, 20, 25, 30, 40, 50];

export const produitVide = (): Partial<Produit> => ({
  ref: "", slug: "", fr_name: "", fr_desc: "", en_name: "", en_desc: "",
  price: null, price_from: false, unit: "piece", set_qty: null, sizes: "",
  tag: "", image_path: "", discount_percent: 0, discount_until: null,
  is_published: true, position: 0,
});

/**
 * URL d'affichage d'une photo.
 * Deux cas : une image televersee (adresse absolue) ou une photo livree
 * avec le site, rangee sous assets/ (« produits/bijoux/boucles/x.webp »).
 */
export function photoProduit(chemin: string | null | undefined): string {
  const v = String(chemin || "");
  if (!v) return "";
  if (v.includes("://")) return v;
  const propre = v.replace(/^\/?(assets\/)?/, "");
  return `${SITE}/assets/${/\.(webp|jpe?g|png)$/i.test(propre) ? propre : propre + ".webp"}`;
}

/** Dossier de rangement d'une photo, calque sur les dossiers du site. */
export function dossierPhoto(cats: Categorie[], subs: SousCategorie[], f: Partial<Produit>) {
  const cat = cats.find((c) => c.id === f.category_id)?.slug || "divers";
  const sub = subs.find((s) => s.id === f.subcategory_id)?.slug;
  return sub ? `produits/${cat}/${sub}` : `produits/${cat}`;
}

export default function FicheProduit({
  produit, cats, subs, onClose, onSaved,
}: {
  produit: Partial<Produit>;
  cats: Categorie[];
  subs: SousCategorie[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Produit>>({ ...produit });
  const [envoi, setEnvoi] = useState(false);
  const [depot, setDepot] = useState(false);
  const nouveau = !produit.id;
  const set = (k: keyof Produit, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  const sousDeLaCat = subs.filter((s) => s.category_id === f.category_id);
  const dossier = dossierPhoto(cats, subs, f);
  const remise = promoActive(f.discount_percent, f.discount_until);
  const prixFinal = prixRemise(
    f.price === null || f.price === undefined || String(f.price) === "" ? null : Number(f.price),
    f.discount_percent, f.discount_until
  );

  async function importer(file: File) {
    if (!f.category_id) { toast("Choisissez d'abord la categorie : elle decide du dossier.", "err"); return; }
    setDepot(true);
    const url = await televerser(file, dossier, f.slug || slugifier(f.fr_name || "photo"));
    setDepot(false);
    if (url) { set("image_path", url); toast("Photo importee dans " + dossier); }
  }

  async function valider() {
    if (!f.fr_name?.trim()) return toast("Le nom francais est obligatoire.", "err");
    if (!f.ref?.trim()) return toast("La reference est obligatoire.", "err");
    if (!f.category_id) return toast("Choisissez une categorie.", "err");

    setEnvoi(true);
    const ok = await enregistrer("products", {
      ref: f.ref!.trim(),
      slug: f.slug?.trim() || slugifier(f.fr_name!),
      category_id: f.category_id,
      subcategory_id: f.subcategory_id || null,
      fr_name: f.fr_name!.trim(), fr_desc: f.fr_desc ?? "",
      en_name: (f.en_name || f.fr_name)!.trim(), en_desc: f.en_desc ?? "",
      price: f.price === null || f.price === undefined || String(f.price) === "" ? null : Number(f.price),
      price_from: !!f.price_from,
      unit: f.unit || "piece",
      set_qty: f.set_qty ? Number(f.set_qty) : null,
      sizes: f.sizes || null,
      tag: f.tag || null,
      image_path: f.image_path || null,
      discount_percent: Number(f.discount_percent ?? 0),
      discount_until: f.discount_until || null,
      is_published: f.is_published ?? true,
      position: Number(f.position ?? 0),
    }, produit.id ?? null);
    setEnvoi(false);
    if (ok) onSaved();
  }

  return (
    <Modal
      titre={nouveau ? "Nouveau produit" : f.fr_name || "Modifier le produit"}
      sous={nouveau ? "Il apparaitra sur le site des qu'il sera publie." : f.ref}
      taille="wide"
      onClose={onClose}
      pied={
        <>
          <label className="switch left">
            <input type="checkbox" checked={!!f.is_published}
                   onChange={(e) => set("is_published", e.target.checked)} />
            <i /> Visible sur le site
          </label>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" onClick={valider} disabled={envoi || depot}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="row">
        <Champ label="Nom (francais)">
          <input value={f.fr_name ?? ""} autoFocus
                 onChange={(e) => {
                   set("fr_name", e.target.value);
                   if (nouveau) set("slug", slugifier(e.target.value));
                 }} />
        </Champ>
        <Champ label="Nom (anglais)" aide="Vide : le nom francais est repris.">
          <input value={f.en_name ?? ""} onChange={(e) => set("en_name", e.target.value)} />
        </Champ>
      </div>

      <div className="row--3" style={{ display: "grid", gap: 12 }}>
        <Champ label="Reference" aide="Ex. FT-BJ-014 — unique.">
          <input className="mono" value={f.ref ?? ""} onChange={(e) => set("ref", e.target.value.toUpperCase())} />
        </Champ>
        <Champ label="Gamme">
          <select value={f.category_id ?? ""}
                  onChange={(e) => { set("category_id", e.target.value); set("subcategory_id", null); }}>
            <option value="">— choisir —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.fr_name}</option>)}
          </select>
        </Champ>
        <Champ label="Sous-gamme" aide="Elle decide du dossier de la photo.">
          <select value={f.subcategory_id ?? ""} onChange={(e) => set("subcategory_id", e.target.value || null)}
                  disabled={!f.category_id}>
            <option value="">— aucune —</option>
            {sousDeLaCat.map((s) => <option key={s.id} value={s.id}>{s.fr_name}</option>)}
          </select>
        </Champ>
      </div>

      <div className="row--3" style={{ display: "grid", gap: 12 }}>
        <Champ label="Prix de gros (EUR)" aide="Vide = « prix sur demande ».">
          <input inputMode="decimal" value={f.price ?? ""} placeholder="sur demande"
                 onChange={(e) => set("price", e.target.value === "" ? null : e.target.value.replace(",", "."))} />
        </Champ>
        <Champ label="Vendu">
          <select value={f.unit ?? "piece"} onChange={(e) => set("unit", e.target.value)}>
            {UNITES.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
          </select>
        </Champ>
        <Champ label="Quantite du lot" aide="Ex. 10 pour un assortiment de dix pieces.">
          <input inputMode="numeric" value={f.set_qty ?? ""} onChange={(e) => set("set_qty", e.target.value)} />
        </Champ>
      </div>

      {/* ---------- promotion ---------- */}
      <div style={{
        border: "1px solid var(--line-2)", borderRadius: "var(--r-m)",
        background: "var(--g-warm)", padding: "14px 16px", marginBottom: 16,
      }}>
        <div className="section-t" style={{ marginBottom: 10 }}>Promotion</div>
        <div className="row--3" style={{ display: "grid", gap: 12, alignItems: "start" }}>
          <Champ label="Remise">
            <select value={f.discount_percent ?? 0}
                    onChange={(e) => set("discount_percent", Number(e.target.value))}>
              {REMISES.map((r) => <option key={r} value={r}>{r === 0 ? "Aucune" : `− ${r} %`}</option>)}
            </select>
          </Champ>
          <Champ label="Jusqu'au" aide="Vide : sans date de fin.">
            <input type="date" value={f.discount_until ?? ""}
                   onChange={(e) => set("discount_until", e.target.value || null)} />
          </Champ>
          <div className="field">
            <label>Prix affiche sur le site</label>
            <div style={{ padding: "10px 0", fontSize: ".95rem" }}>
              {remise && prixFinal !== null ? (
                <>
                  <span style={{ textDecoration: "line-through", color: "var(--ink-3)", marginRight: 8 }}>
                    {euros(Number(f.price))}
                  </span>
                  <strong style={{ color: "var(--err)" }}>{euros(prixFinal)}</strong>
                </>
              ) : (
                <strong>{euros(f.price === null || String(f.price) === "" ? null : Number(f.price))}</strong>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row--3" style={{ display: "grid", gap: 12 }}>
        <Champ label="Etiquette">
          <select value={f.tag ?? ""} onChange={(e) => set("tag", e.target.value)}>
            {ETIQUETTES.map((t) => <option key={t} value={t}>{t || "— aucune —"}</option>)}
          </select>
        </Champ>
        <Champ label="Tailles" aide="Ex. S → 4XL">
          <input value={f.sizes ?? ""} onChange={(e) => set("sizes", e.target.value)} />
        </Champ>
        <Champ label="Ordre d'affichage">
          <input inputMode="numeric" value={f.position ?? 0} onChange={(e) => set("position", e.target.value)} />
        </Champ>
      </div>

      <div className="row">
        <Champ label="Description (francais)">
          <textarea value={f.fr_desc ?? ""} onChange={(e) => set("fr_desc", e.target.value)} />
        </Champ>
        <Champ label="Description (anglais)">
          <textarea value={f.en_desc ?? ""} onChange={(e) => set("en_desc", e.target.value)} />
        </Champ>
      </div>

      <Champ label="Photo" aide={`Importee dans assets/${dossier} — comme les photos livrees avec le site.`}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {f.image_path ? (
            <img className="thumb" style={{ width: 78, height: 78 }} src={photoProduit(f.image_path)} alt="" />
          ) : (
            <span className="thumb" style={{ width: 78, height: 78, display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
              <Ico n="box" />
            </span>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className={`btn btn--sm ${depot ? "btn--ghost" : ""}`}>
              {depot ? "Import en cours…" : "Importer une photo"}
              <input type="file" accept="image/*" hidden disabled={depot}
                     onChange={(e) => {
                       const file = e.target.files?.[0];
                       e.target.value = "";
                       if (file) importer(file);
                     }} />
            </label>
            {f.image_path && (
              <button className="btn btn--sm btn--danger" onClick={() => set("image_path", "")}>Retirer</button>
            )}
          </div>
        </div>
      </Champ>
    </Modal>
  );
}
