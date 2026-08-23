"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { Champ, Confirm, Ico, Modal, Chargement, Vide, toast } from "@/components/ui";
import { enregistrer, slugifier, supprimer, useTable } from "@/lib/db";

type Categorie = {
  id: string; slug: string; fr_name: string; en_name: string;
  description_fr: string; description_en: string; position: number;
};
type SousCategorie = {
  id: string; category_id: string; slug: string;
  fr_name: string; en_name: string; position: number;
};

export default function Categories() {
  const cat = useTable<Categorie>("categories", "*", { col: "position", asc: true });
  const sous = useTable<SousCategorie>("subcategories", "*", { col: "position", asc: true });

  const [editeCat, setEditeCat] = useState<Partial<Categorie> | null>(null);
  const [editeSous, setEditeSous] = useState<Partial<SousCategorie> | null>(null);
  const [aSupprimer, setASupprimer] = useState<
    { table: string; id: string; nom: string; note: string } | null
  >(null);

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Categories</h1>
          <p>{cat.items.length} familles · {sous.items.length} sous-familles — elles organisent le catalogue du site.</p>
        </div>
        <div className="head__act">
          <button className="btn btn--main" onClick={() => setEditeCat({ position: cat.items.length })}>
            <Ico n="plus" s={16} /> Nouvelle categorie
          </button>
        </div>
      </div>

      {cat.chargement ? (
        <div className="card"><Chargement lignes={3} /></div>
      ) : cat.items.length === 0 ? (
        <div className="card">
          <Vide titre="Aucune categorie" texte="Creez au moins une famille avant d'ajouter des produits."
                action={<button className="btn btn--main" onClick={() => setEditeCat({ position: 0 })}>Creer</button>} />
        </div>
      ) : (
        <div className="grid grid--2" style={{ alignItems: "start" }}>
          {cat.items.map((c) => {
            const enfants = sous.items.filter((s) => s.category_id === c.id);
            return (
              <div key={c.id} className="card card--pad">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <strong style={{ fontSize: "1rem" }}>{c.fr_name}</strong>
                    <div className="sub">{c.en_name} · <span className="mono">{c.slug}</span></div>
                  </div>
                  <div className="acts">
                    <button className="btn btn--ghost btn--icon" title="Modifier"
                            onClick={() => setEditeCat(c)}><Ico n="pen" s={16} /></button>
                    <button className="btn btn--ghost btn--icon" title="Supprimer"
                            onClick={() => setASupprimer({
                              table: "categories", id: c.id, nom: c.fr_name,
                              note: "Impossible tant que des produits y sont ranges.",
                            })}><Ico n="trash" s={16} /></button>
                  </div>
                </div>

                {c.description_fr && (
                  <p style={{ fontSize: ".84rem", color: "var(--ink-2)", marginTop: 8 }}>{c.description_fr}</p>
                )}

                <div style={{ borderTop: "1px solid var(--line-2)", marginTop: 14, paddingTop: 12 }}>
                  <div className="section-t" style={{ marginBottom: 8 }}>Sous-familles</div>
                  {enfants.length === 0 && (
                    <p className="sub" style={{ marginBottom: 8 }}>Aucune pour l&apos;instant.</p>
                  )}
                  <div style={{ display: "grid", gap: 5 }}>
                    {enfants.map((s) => (
                      <div key={s.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 10, padding: "6px 10px", borderRadius: 9, background: "var(--surface-2)",
                      }}>
                        <span style={{ fontSize: ".85rem", fontWeight: 600 }}>
                          {s.fr_name} <span className="sub">· {s.en_name}</span>
                        </span>
                        <div className="acts">
                          <button className="btn btn--ghost btn--icon" title="Modifier"
                                  onClick={() => setEditeSous(s)}><Ico n="pen" s={15} /></button>
                          <button className="btn btn--ghost btn--icon" title="Supprimer"
                                  onClick={() => setASupprimer({
                                    table: "subcategories", id: s.id, nom: s.fr_name,
                                    note: "Les produits concernes perdront simplement cette sous-famille.",
                                  })}><Ico n="trash" s={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn--sm btn--ghost" style={{ marginTop: 8 }}
                          onClick={() => setEditeSous({ category_id: c.id, position: enfants.length })}>
                    <Ico n="plus" s={15} /> Ajouter une sous-famille
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editeCat && (
        <FormeCat
          valeur={editeCat}
          onClose={() => setEditeCat(null)}
          onSaved={() => { setEditeCat(null); cat.charger(); }}
        />
      )}

      {editeSous && (
        <FormeSous
          valeur={editeSous}
          cats={cat.items}
          onClose={() => setEditeSous(null)}
          onSaved={() => { setEditeSous(null); sous.charger(); }}
        />
      )}

      {aSupprimer && (
        <Confirm
          titre={`Supprimer « ${aSupprimer.nom} » ?`}
          texte={aSupprimer.note}
          onCancel={() => setASupprimer(null)}
          onOk={async () => {
            if (await supprimer(aSupprimer.table, aSupprimer.id)) { cat.charger(); sous.charger(); }
            setASupprimer(null);
          }}
        />
      )}
    </Shell>
  );
}

function FormeCat({ valeur, onClose, onSaved }: {
  valeur: Partial<Categorie>; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Categorie>>({ ...valeur });
  const [envoi, setEnvoi] = useState(false);
  const nouveau = !valeur.id;
  const set = (k: keyof Categorie, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      titre={nouveau ? "Nouvelle categorie" : "Modifier la categorie"}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" disabled={envoi} onClick={async () => {
            if (!f.fr_name?.trim()) return toast("Le nom francais est obligatoire.", "err");
            setEnvoi(true);
            const ok = await enregistrer("categories", {
              slug: f.slug?.trim() || slugifier(f.fr_name),
              fr_name: f.fr_name.trim(),
              en_name: (f.en_name || f.fr_name).trim(),
              description_fr: f.description_fr ?? "",
              description_en: f.description_en ?? "",
              position: Number(f.position ?? 0),
            }, valeur.id ?? null);
            setEnvoi(false);
            if (ok) onSaved();
          }}>{envoi ? "…" : "Enregistrer"}</button>
        </>
      }
    >
      <div className="row">
        <Champ label="Nom (francais)">
          <input autoFocus value={f.fr_name ?? ""}
                 onChange={(e) => { set("fr_name", e.target.value); if (nouveau) set("slug", slugifier(e.target.value)); }} />
        </Champ>
        <Champ label="Nom (anglais)">
          <input value={f.en_name ?? ""} onChange={(e) => set("en_name", e.target.value)} />
        </Champ>
      </div>
      <div className="row">
        <Champ label="Identifiant de lien" aide="Apparait dans l'adresse de la page.">
          <input className="mono" value={f.slug ?? ""} onChange={(e) => set("slug", slugifier(e.target.value))} />
        </Champ>
        <Champ label="Ordre d'affichage">
          <input inputMode="numeric" value={f.position ?? 0} onChange={(e) => set("position", e.target.value)} />
        </Champ>
      </div>
      <div className="row">
        <Champ label="Description (francais)">
          <textarea value={f.description_fr ?? ""} onChange={(e) => set("description_fr", e.target.value)} />
        </Champ>
        <Champ label="Description (anglais)">
          <textarea value={f.description_en ?? ""} onChange={(e) => set("description_en", e.target.value)} />
        </Champ>
      </div>
    </Modal>
  );
}

function FormeSous({ valeur, cats, onClose, onSaved }: {
  valeur: Partial<SousCategorie>; cats: Categorie[]; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<SousCategorie>>({ ...valeur });
  const [envoi, setEnvoi] = useState(false);
  const nouveau = !valeur.id;
  const set = (k: keyof SousCategorie, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      titre={nouveau ? "Nouvelle sous-famille" : "Modifier la sous-famille"}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" disabled={envoi} onClick={async () => {
            if (!f.fr_name?.trim()) return toast("Le nom francais est obligatoire.", "err");
            if (!f.category_id) return toast("Choisissez une categorie parente.", "err");
            setEnvoi(true);
            const ok = await enregistrer("subcategories", {
              category_id: f.category_id,
              slug: f.slug?.trim() || slugifier(f.fr_name),
              fr_name: f.fr_name.trim(),
              en_name: (f.en_name || f.fr_name).trim(),
              position: Number(f.position ?? 0),
            }, valeur.id ?? null);
            setEnvoi(false);
            if (ok) onSaved();
          }}>{envoi ? "…" : "Enregistrer"}</button>
        </>
      }
    >
      <Champ label="Categorie parente">
        <select value={f.category_id ?? ""} onChange={(e) => set("category_id", e.target.value)}>
          <option value="">— choisir —</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.fr_name}</option>)}
        </select>
      </Champ>
      <div className="row">
        <Champ label="Nom (francais)">
          <input autoFocus value={f.fr_name ?? ""}
                 onChange={(e) => { set("fr_name", e.target.value); if (nouveau) set("slug", slugifier(e.target.value)); }} />
        </Champ>
        <Champ label="Nom (anglais)">
          <input value={f.en_name ?? ""} onChange={(e) => set("en_name", e.target.value)} />
        </Champ>
      </div>
      <div className="row">
        <Champ label="Identifiant de lien">
          <input className="mono" value={f.slug ?? ""} onChange={(e) => set("slug", slugifier(e.target.value))} />
        </Champ>
        <Champ label="Ordre d'affichage">
          <input inputMode="numeric" value={f.position ?? 0} onChange={(e) => set("position", e.target.value)} />
        </Champ>
      </div>
    </Modal>
  );
}
