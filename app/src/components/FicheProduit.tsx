"use client";

/**
 * Fiche produit — la seule et unique.
 *
 * Elle sert au catalogue comme a l'editeur en direct : cliquer un produit
 * dans la page du site ouvre exactement le meme formulaire. Rien ne se
 * modifie a deux endroits differents.
 */

import { useEffect, useState } from "react";
import { Champ, Ico, Modal, toast } from "@/components/ui";
import { euros, prixRemise, promoActive, slugifier, televerser } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import ChoixPhoto from "@/components/ChoixPhoto";
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
  const [planche, setPlanche] = useState<string[]>([]);
  const [choix, setChoix] = useState<"principale" | "planche" | null>(null);
  const [onglet, setOnglet] = useState<"fiche" | "photos" | "details">("fiche");
  const [tousProduits, setTousProduits] = useState<{ id: string; ref: string; fr_name: string; image_path: string | null }[]>([]);
  const nouveau = !produit.id;

  /* La planche de motifs : les photos secondaires d'un assortiment.
     Elles vivent dans product_images, une table a part, parce qu'une
     reference peut en porter vingt. */
  useEffect(() => {
    if (!produit.id) return;
    supabase.from("product_images").select("path").eq("product_id", produit.id).order("position")
      .then(({ data }) => setPlanche((data ?? []).map((r: { path: string }) => r.path)));
  }, [produit.id]);

  useEffect(() => {
    supabase.from("products").select("id,ref,fr_name,image_path").order("ref")
      .then(({ data }) => setTousProduits((data ?? []) as typeof tousProduits));
  }, []);
  const set = (k: keyof Produit, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  const sousDeLaCat = subs.filter((s) => s.category_id === f.category_id);

  /* La reference est attribuee par la base : elle porte les initiales de la
     gamme et de la sous-gamme, puis un compteur propre a ce couple. On la
     demande a chaque changement de rangement, tant que la fiche est neuve —
     une reference deja portee par un produit ne bouge jamais. */
  useEffect(() => {
    if (!nouveau || !f.category_id) return;
    let vivant = true;
    supabase
      .rpc("prochaine_reference", {
        p_categorie: f.category_id,
        p_sous_categorie: f.subcategory_id || null,
      })
      .then(({ data, error }) => {
        if (!vivant || error || !data) return;
        setF((x) => ({ ...x, ref: data as string }));
      });
    return () => { vivant = false; };
  }, [nouveau, f.category_id, f.subcategory_id]);

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
    /* Les champs obligatoires vivent tous sur le premier onglet : on y
       ramene l'utilisateur, sinon le message designe un champ invisible. */
    if (!f.fr_name?.trim()) { setOnglet("fiche"); return toast("Le nom francais est obligatoire.", "err"); }
    if (!f.ref?.trim()) { setOnglet("fiche"); return toast("Choisissez une gamme : la reference en decoule.", "err"); }
    if (!f.category_id) { setOnglet("fiche"); return toast("Choisissez une categorie.", "err"); }

    setEnvoi(true);
    const valeurs = {
      ref: f.ref.trim(),
      slug: f.slug?.trim() || slugifier(f.fr_name),
      category_id: f.category_id,
      subcategory_id: f.subcategory_id || null,
      fr_name: f.fr_name.trim(), fr_desc: f.fr_desc ?? "",
      en_name: (f.en_name || f.fr_name).trim(), en_desc: f.en_desc ?? "",
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
    };

    /* On passe par supabase directement — et non par le raccourci
       enregistrer() — pour recuperer l'identifiant d'un produit tout
       juste cree : la planche de motifs en a besoin. */
    const res = produit.id
      ? await supabase.from("products").update(valeurs).eq("id", produit.id).select("id").single()
      : await supabase.from("products").insert(valeurs).select("id").single();

    if (res.error || !res.data) {
      setEnvoi(false);
      const m = res.error?.message ?? "";
      return toast(
        m.includes("duplicate key") ? "Cette reference ou cet identifiant existe deja." : "Echec : " + m,
        "err"
      );
    }

    /* la planche est reecrite en entier : c'est une liste courte, et
       cela evite d'avoir a suivre chaque ajout et chaque retrait */
    const id = res.data.id as string;
    await supabase.from("product_images").delete().eq("product_id", id);
    if (planche.length) {
      const { error } = await supabase.from("product_images").insert(
        planche.map((chemin, i) => ({
          product_id: id, path: chemin, alt: f.fr_name ?? "", position: i,
        }))
      );
      if (error) { setEnvoi(false); return toast("Planche refusee : " + error.message, "err"); }
    }

    setEnvoi(false);
    toast(produit.id ? "Modification enregistree." : "Ajout enregistre.");
    onSaved();
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
      {/* Une fiche produit compte une vingtaine de champs. Les presenter
          d'un bloc noie l'essentiel : on separe ce qu'on modifie tous les
          jours, les photos, et le reste. */}
      <div className="chips" style={{ marginBottom: 18 }}>
        <button className={`chip ${onglet === "fiche" ? "on" : ""}`} onClick={() => setOnglet("fiche")}>
          La fiche
        </button>
        <button className={`chip ${onglet === "photos" ? "on" : ""}`} onClick={() => setOnglet("photos")}>
          Photos{planche.length ? ` · ${planche.length + (f.image_path ? 1 : 0)}` : f.image_path ? " · 1" : ""}
        </button>
        <button className={`chip ${onglet === "details" ? "on" : ""}`} onClick={() => setOnglet("details")}>
          Details et promotion
        </button>
      </div>

      <div hidden={onglet !== "fiche"}>
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
        <Champ
          label="Reference"
          aide={nouveau
            ? "Attribuee toute seule d'apres la gamme et la sous-gamme."
            : "Fixee a la creation : elle ne change plus."}
        >
          <input className="mono" value={f.ref ?? ""} readOnly disabled
                 placeholder={f.category_id ? "…" : "choisissez d'abord la gamme"} />
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

      </div>

      <div hidden={onglet !== "details"}>
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

      </div>

      <div hidden={onglet !== "photos"}>
      <div style={{
        border: "1px solid var(--line-2)", borderRadius: "var(--r-m)",
        background: "var(--surface-2)", padding: "14px 16px", marginBottom: 16,
      }}>
        <div className="section-t" style={{ marginBottom: 4 }}>Photo principale</div>
        <p className="sub" style={{ marginBottom: 12 }}>
          Celle qui represente la reference partout : vignette du catalogue, fiche, panier.
          Importee dans <span className="mono">assets/{dossier}</span>, comme les photos livrees avec le site.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {f.image_path ? (
            <img className="thumb" style={{ width: 110, height: 110 }} src={photoProduit(f.image_path)} alt="" />
          ) : (
            <span className="thumb" style={{ width: 110, height: 110, display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
              <Ico n="image" s={26} />
            </span>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn--sm" onClick={() => setChoix("principale")}>
              Choisir dans le site
            </button>
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
      </div>

      {/* ---------- planche de motifs : les lots ---------- */}
      <div style={{
        border: "1px solid var(--line-2)", borderRadius: "var(--r-m)",
        background: "var(--surface-2)", padding: "14px 16px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div className="section-t" style={{ marginBottom: 4 }}>Planche de motifs · {planche.length}</div>
          <span className="sub">Pour les references vendues par lot</span>
        </div>
        <p className="sub" style={{ marginBottom: 12 }}>
          Ces photos s&apos;affichent en carrousel sous la fiche, sur le site : l&apos;acheteur
          voit la collection dans laquelle l&apos;atelier puise, sans choisir un modele.
        </p>

        {planche.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {planche.map((chemin, i) => (
              <span key={chemin + i} style={{ position: "relative" }}>
                <img className="thumb" style={{ width: 54, height: 66 }} src={photoProduit(chemin)} alt="" />
                <button className="btn btn--icon"
                        title="Retirer de la planche"
                        style={{
                          position: "absolute", top: -6, right: -6, width: 22, height: 22,
                          background: "var(--surface)", border: "1px solid var(--line)",
                        }}
                        onClick={() => setPlanche((p) => p.filter((_, j) => j !== i))}>
                  <Ico n="x" s={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value="" style={{ maxWidth: 300, fontSize: ".82rem" }}
                  onChange={(e) => {
                    const p = tousProduits.find((x) => x.id === e.target.value);
                    if (p?.image_path && !planche.includes(p.image_path)) {
                      setPlanche((l) => [...l, p.image_path!]);
                    }
                    e.target.value = "";
                  }}>
            <option value="">+ Reprendre la photo d&apos;une reference…</option>
            {tousProduits.filter((p) => p.image_path && p.id !== produit.id).map((p) => (
              <option key={p.id} value={p.id}>{p.ref} · {p.fr_name}</option>
            ))}
          </select>

          <button className="btn btn--sm" onClick={() => setChoix("planche")}>
            Choisir dans le site
          </button>

          <label className="btn btn--sm">
            Importer une photo
            <input type="file" accept="image/*" hidden
                   onChange={async (e) => {
                     const file = e.target.files?.[0];
                     e.target.value = "";
                     if (!file) return;
                     if (!f.category_id) return toast("Choisissez d'abord la categorie.", "err");
                     setDepot(true);
                     const url = await televerser(file, dossier, (f.slug || "motif") + "-motif");
                     setDepot(false);
                     if (url) { setPlanche((l) => [...l, url]); toast("Motif ajoute a la planche."); }
                   }} />
          </label>

          {planche.length > 0 && (
            <button className="btn btn--sm btn--danger" onClick={() => setPlanche([])}>
              Vider la planche
            </button>
          )}
        </div>

        {planche.length > 0 && f.unit !== "lot" && (
          <p className="sub" style={{ marginTop: 10, color: "var(--warn)" }}>
            Cette reference porte une planche mais n&apos;est pas vendue « par lot » —
            l&apos;acheteur croira choisir un modele.{" "}
            <button className="btn btn--sm" style={{ marginLeft: 4 }}
                    onClick={() => { set("unit", "lot"); setOnglet("fiche"); }}>
              La vendre par lot
            </button>
          </p>
        )}
      </div>


      </div>

      {choix && (
        <ChoixPhoto
          dossier={dossier}
          multiple={choix === "planche"}
          titre={choix === "planche" ? "Ajouter des motifs a la planche" : "Choisir la photo principale"}
          onClose={() => setChoix(null)}
          onChoisir={(chemins) => {
            if (choix === "principale") {
              set("image_path", chemins[0]);
              toast("Photo choisie.");
            } else {
              setPlanche((l) => [...l, ...chemins.filter((c) => !l.includes(c))]);
              toast(`${chemins.length} motif(s) ajoute(s).`);
            }
          }}
        />
      )}
    </Modal>
  );
}
