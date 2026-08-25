"use client";

import { useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { Champ, Confirm, Ico, Modal, Chargement, Vide, toast } from "@/components/ui";
import FicheProduit, {
  Categorie, Produit, REMISES, SousCategorie, dossierPhoto, photoProduit, produitVide,
} from "@/components/FicheProduit";
import {
  enregistrer, euros, majChamp, prixRemise, promoActive, supprimer, televerser, useTable,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";

export default function Catalogue() {
  const { items, chargement, charger } = useTable<Produit>("products", "*", { col: "position", asc: true });
  const { items: cats } = useTable<Categorie>("categories", "id,slug,fr_name,position", { col: "position", asc: true });
  const { items: subs } = useTable<SousCategorie>("subcategories", "id,category_id,slug,fr_name", { col: "position", asc: true });

  const [q, setQ] = useState("");
  const [filtreCat, setFiltreCat] = useState("");
  const [filtre, setFiltre] = useState<"" | "sansprix" | "masques" | "promo">("");
  const [edite, setEdite] = useState<Partial<Produit> | null>(null);
  const [aSupprimer, setASupprimer] = useState<Produit | null>(null);
  const [coches, setCoches] = useState<string[]>([]);
  const [promoLot, setPromoLot] = useState(false);

  const nomCat = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c.fr_name])), [cats]);
  const nomSub = useMemo(() => Object.fromEntries(subs.map((s) => [s.id, s.fr_name])), [subs]);

  const vus = items.filter((p) => {
    if (filtreCat && p.category_id !== filtreCat) return false;
    if (filtre === "sansprix" && p.price !== null) return false;
    if (filtre === "masques" && p.is_published) return false;
    if (filtre === "promo" && !promoActive(p.discount_percent, p.discount_until)) return false;
    const t = q.trim().toLowerCase();
    return !t || (p.fr_name + p.en_name + p.ref).toLowerCase().includes(t);
  });

  const enPromo = items.filter((p) => promoActive(p.discount_percent, p.discount_until)).length;
  const toutCoche = vus.length > 0 && vus.every((p) => coches.includes(p.id));

  async function dupliquer(p: Produit) {
    const { id, ...reste } = p;
    if (await enregistrer("products", {
      ...reste,
      ref: p.ref + "-COPIE",
      slug: p.slug + "-copie",
      fr_name: p.fr_name + " (copie)",
      is_published: false,
    })) charger();
  }

  /** Applique une action a toutes les references cochees. */
  async function surLaSelection(patch: Record<string, unknown>, message: string) {
    const { error } = await supabase.from("products").update(patch).in("id", coches);
    if (error) return toast("Echec : " + error.message, "err");
    toast(`${coches.length} reference(s) — ${message}`);
    setCoches([]);
    charger();
  }

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Produits</h1>
          <p>
            {items.length} references · {items.filter((p) => p.price === null).length} sans prix ·{" "}
            {items.filter((p) => !p.is_published).length} masquees · {enPromo} en promotion
          </p>
        </div>
        <div className="head__act">
          <div className="search">
            <Ico n="search" s={16} />
            <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn btn--main" onClick={() => setEdite(produitVide())}>
            <Ico n="plus" s={16} /> Ajouter
          </button>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${!filtreCat && !filtre ? "on" : ""}`}
                onClick={() => { setFiltreCat(""); setFiltre(""); }}>
          Tout ({items.length})
        </button>
        {cats.map((c) => (
          <button key={c.id} className={`chip ${filtreCat === c.id ? "on" : ""}`}
                  onClick={() => { setFiltreCat(filtreCat === c.id ? "" : c.id); setFiltre(""); }}>
            {c.fr_name}
          </button>
        ))}
        <span style={{ width: 10 }} />
        <button className={`chip ${filtre === "promo" ? "on" : ""}`}
                onClick={() => setFiltre(filtre === "promo" ? "" : "promo")}>
          En promotion ({enPromo})
        </button>
        <button className={`chip ${filtre === "sansprix" ? "on" : ""}`}
                onClick={() => setFiltre(filtre === "sansprix" ? "" : "sansprix")}>
          Sans prix
        </button>
        <button className={`chip ${filtre === "masques" ? "on" : ""}`}
                onClick={() => setFiltre(filtre === "masques" ? "" : "masques")}>
          Masques
        </button>
      </div>

      {coches.length > 0 && (
        <div className="card card--pad" style={{
          marginBottom: 12, display: "flex", gap: 10, alignItems: "center",
          flexWrap: "wrap", background: "var(--g-warm)", padding: "12px 16px",
        }}>
          <strong style={{ fontSize: ".88rem" }}>{coches.length} reference(s) selectionnee(s)</strong>
          <span style={{ flex: 1 }} />
          <button className="btn btn--sm btn--main" onClick={() => setPromoLot(true)}>
            Appliquer une promotion
          </button>
          <button className="btn btn--sm"
                  onClick={() => surLaSelection({ discount_percent: 0, discount_until: null }, "promotion retiree")}>
            Retirer la promotion
          </button>
          <button className="btn btn--sm" onClick={() => surLaSelection({ is_published: true }, "publiees")}>
            Publier
          </button>
          <button className="btn btn--sm" onClick={() => surLaSelection({ is_published: false }, "masquees")}>
            Masquer
          </button>
          <button className="btn btn--sm btn--ghost" onClick={() => setCoches([])}>Deselectionner</button>
        </div>
      )}

      <div className="card">
        <div className="tw">
          {chargement ? (
            <Chargement />
          ) : vus.length === 0 ? (
            <Vide titre="Aucune reference"
                  texte="Ajoutez un premier produit ou elargissez la recherche."
                  action={<button className="btn btn--main" onClick={() => setEdite(produitVide())}>Ajouter un produit</button>} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input type="checkbox" checked={toutCoche} style={{ width: 16, height: 16, padding: 0 }}
                           onChange={() => setCoches(toutCoche ? [] : vus.map((p) => p.id))} />
                  </th>
                  <th style={{ width: 62 }}>Photo</th>
                  <th>Produit</th>
                  <th>Rangement</th>
                  <th style={{ width: 150 }}>Prix</th>
                  <th style={{ width: 120 }}>Promo</th>
                  <th style={{ width: 90 }}>En ligne</th>
                  <th style={{ width: 116 }}></th>
                </tr>
              </thead>
              <tbody>
                {vus.map((p) => {
                  const remise = promoActive(p.discount_percent, p.discount_until);
                  return (
                    <tr key={p.id}>
                      <td>
                        <input type="checkbox" checked={coches.includes(p.id)} style={{ width: 16, height: 16, padding: 0 }}
                               onChange={() => setCoches((c) =>
                                 c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id])} />
                      </td>
                      <td>
                        <label className="photo-echange"
                               title="Cliquer pour importer une autre photo">
                          {p.image_path ? (
                            <img className="thumb" src={photoProduit(p.image_path)} alt="" />
                          ) : (
                            <span className="thumb" style={{ display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
                              <Ico n="box" s={18} />
                            </span>
                          )}
                          <input type="file" accept="image/*" hidden
                                 onChange={async (e) => {
                                   const file = e.target.files?.[0];
                                   e.target.value = "";
                                   if (!file) return;
                                   toast("Import en cours…");
                                   const url = await televerser(file, dossierPhoto(cats, subs, p), p.slug);
                                   if (url && await majChamp("products", p.id, "image_path", url)) {
                                     toast("Photo importee.");
                                     charger();
                                   }
                                 }} />
                          <span className="photo-echange__voile"><Ico n="image" s={16} /></span>
                        </label>
                      </td>
                      <td>
                        <strong>{p.fr_name}</strong>
                        <div className="sub"><span className="mono">{p.ref}</span>{p.tag ? <> · {p.tag}</> : null}</div>
                      </td>
                      <td className="sub">
                        {nomCat[p.category_id] ?? "—"}
                        {p.subcategory_id && <div>{nomSub[p.subcategory_id]}</div>}
                      </td>
                      <td>
                        <input className="num" defaultValue={p.price ?? ""} placeholder="sur demande"
                               style={{ padding: "6px 9px", fontSize: ".82rem" }}
                               onBlur={async (e) => {
                                 const brut = e.target.value.trim().replace(",", ".");
                                 if (brut === String(p.price ?? "")) return;
                                 const prix = brut === "" ? null : Number(brut);
                                 if (prix !== null && Number.isNaN(prix)) {
                                   toast("Prix illisible : " + e.target.value, "err");
                                   e.target.value = String(p.price ?? "");
                                   return;
                                 }
                                 if (await majChamp("products", p.id, "price", prix)) {
                                   toast(`Prix de ${p.ref} : ${euros(prix)}`);
                                   charger();
                                 }
                               }} />
                        {remise && p.price !== null && (
                          <div className="sub" style={{ color: "var(--err)", fontWeight: 700 }}>
                            {euros(prixRemise(p.price, p.discount_percent, p.discount_until))}
                          </div>
                        )}
                      </td>
                      <td>
                        <select value={p.discount_percent ?? 0} style={{ padding: "6px 9px", fontSize: ".8rem" }}
                                onChange={async (e) => {
                                  if (await majChamp("products", p.id, "discount_percent", Number(e.target.value))) {
                                    toast(Number(e.target.value) ? `Promotion − ${e.target.value} %` : "Promotion retiree.");
                                    charger();
                                  }
                                }}>
                          {REMISES.map((r) => <option key={r} value={r}>{r === 0 ? "—" : `− ${r} %`}</option>)}
                        </select>
                      </td>
                      <td>
                        <label className="switch" title={p.is_published ? "Visible sur le site" : "Masque"}>
                          <input type="checkbox" checked={p.is_published}
                                 onChange={async () => {
                                   if (await majChamp("products", p.id, "is_published", !p.is_published)) charger();
                                 }} />
                          <i />
                        </label>
                      </td>
                      <td>
                        <div className="acts">
                          <button className="btn btn--ghost btn--icon" title="Modifier"
                                  onClick={() => setEdite(p)}><Ico n="pen" s={16} /></button>
                          <button className="btn btn--ghost btn--icon" title="Dupliquer"
                                  onClick={() => dupliquer(p)}><Ico n="copy" s={16} /></button>
                          <button className="btn btn--ghost btn--icon" title="Supprimer"
                                  onClick={() => setASupprimer(p)}><Ico n="trash" s={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {edite && (
        <FicheProduit produit={edite} cats={cats} subs={subs}
                      onClose={() => setEdite(null)}
                      onSaved={() => { setEdite(null); charger(); }} />
      )}

      {promoLot && (
        <PromoLot nombre={coches.length} onClose={() => setPromoLot(false)}
                  onOk={async (pct, jusquau) => {
                    await surLaSelection({ discount_percent: pct, discount_until: jusquau },
                                         pct ? `promotion − ${pct} %` : "promotion retiree");
                    setPromoLot(false);
                  }} />
      )}

      {aSupprimer && (
        <Confirm
          titre="Supprimer cette reference ?"
          texte={`« ${aSupprimer.fr_name} » (${aSupprimer.ref}) disparaitra du site. Les commandes deja passees gardent leur libelle.`}
          onCancel={() => setASupprimer(null)}
          onOk={async () => {
            if (await supprimer("products", aSupprimer.id)) charger();
            setASupprimer(null);
          }}
        />
      )}
    </Shell>
  );
}

/** Promotion appliquee d'un coup a plusieurs references. */
function PromoLot({ nombre, onClose, onOk }: {
  nombre: number;
  onClose: () => void;
  onOk: (pct: number, jusquau: string | null) => Promise<void>;
}) {
  const [pct, setPct] = useState(10);
  const [jusquau, setJusquau] = useState("");
  const [envoi, setEnvoi] = useState(false);

  return (
    <Modal
      titre={`Promotion sur ${nombre} reference(s)`}
      sous="Le prix de gros ne change pas : la remise se pose par-dessus et s'arrete toute seule."
      taille="sm"
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" disabled={envoi}
                  onClick={async () => { setEnvoi(true); await onOk(pct, jusquau || null); setEnvoi(false); }}>
            {envoi ? "…" : "Appliquer"}
          </button>
        </>
      }
    >
      <Champ label="Remise">
        <div className="chips">
          {REMISES.filter((r) => r > 0).map((r) => (
            <button key={r} className={`chip ${pct === r ? "on" : ""}`} onClick={() => setPct(r)}>
              − {r} %
            </button>
          ))}
        </div>
      </Champ>
      <Champ label="Jusqu'au" aide="Vide : la promotion court jusqu'a ce qu'on la retire.">
        <input type="date" value={jusquau} onChange={(e) => setJusquau(e.target.value)} />
      </Champ>
    </Modal>
  );
}
