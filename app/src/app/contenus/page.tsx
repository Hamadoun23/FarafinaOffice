"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { Champ, Confirm, Ico, Modal, Chargement, Vide, toast } from "@/components/ui";
import { enregistrer, majChamp, supprimer, useTable } from "@/lib/db";

type Texte = { key: string; fr: string; en: string; section: string | null; help: string | null };

export default function Contenus() {
  const { items, chargement, charger } = useTable<Texte>("contents", "key,fr,en,section,help", { col: "key", asc: true });

  const [q, setQ] = useState("");
  const [section, setSection] = useState("");
  const [edite, setEdite] = useState<Partial<Texte> | null>(null);
  const [aSupprimer, setASupprimer] = useState<Texte | null>(null);
  const [enregistre, setEnregistre] = useState<string | null>(null);

  const sections = [...new Set(items.map((t) => t.section ?? "divers"))].sort();
  const t = q.trim().toLowerCase();
  const vus = items.filter((x) => {
    if (section && (x.section ?? "divers") !== section) return false;
    return !t || (x.key + x.fr + x.en).toLowerCase().includes(t);
  });
  const groupes = [...new Set(vus.map((x) => x.section ?? "divers"))];

  async function sauver(cle: string, colonne: "fr" | "en", valeur: string) {
    if (await majChamp("contents", cle, colonne, valeur, "key")) {
      setEnregistre(cle + colonne);
      setTimeout(() => setEnregistre(null), 1600);
    }
  }

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Textes</h1>
          <p>{items.length} textes du site, en francais et en anglais — la modification part en ligne aussitot.</p>
        </div>
        <div className="head__act">
          <div className="search">
            <Ico n="search" s={16} />
            <input placeholder="Rechercher un texte…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn btn--main" onClick={() => setEdite({ section: section || "divers" })}>
            <Ico n="plus" s={16} /> Ajouter
          </button>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${!section ? "on" : ""}`} onClick={() => setSection("")}>
          Tout ({items.length})
        </button>
        {sections.map((s) => (
          <button key={s} className={`chip ${section === s ? "on" : ""}`}
                  onClick={() => setSection(section === s ? "" : s)}>
            {s}
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="card"><Chargement /></div>
      ) : vus.length === 0 ? (
        <div className="card">
          <Vide titre="Aucun texte" texte="Ajoutez une cle ou elargissez la recherche."
                action={<button className="btn btn--main" onClick={() => setEdite({ section: "divers" })}>Ajouter un texte</button>} />
        </div>
      ) : (
        groupes.map((s) => (
          <div key={s} className="card card--pad" style={{ marginBottom: 14 }}>
            <div className="section-t">{s}</div>
            {vus.filter((x) => (x.section ?? "divers") === s).map((x) => (
              <div key={x.key} style={{ borderTop: "1px solid var(--line-2)", padding: "14px 0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <div>
                    <span className="mono">{x.key}</span>
                    {x.help && <div className="sub">{x.help}</div>}
                  </div>
                  <div className="acts">
                    <button className="btn btn--ghost btn--icon" title="Modifier la fiche"
                            onClick={() => setEdite(x)}><Ico n="pen" s={16} /></button>
                    <button className="btn btn--ghost btn--icon" title="Supprimer"
                            onClick={() => setASupprimer(x)}><Ico n="trash" s={16} /></button>
                  </div>
                </div>
                <div className="row">
                  {(["fr", "en"] as const).map((lg) => (
                    <div key={lg}>
                      <label style={{
                        fontSize: ".62rem", fontWeight: 800, letterSpacing: ".12em",
                        textTransform: "uppercase", color: "var(--ink-3)",
                        display: "flex", justifyContent: "space-between", marginBottom: 4,
                      }}>
                        {lg === "fr" ? "Francais" : "Anglais"}
                        {enregistre === x.key + lg && (
                          <span style={{ color: "var(--ok)" }}>enregistre</span>
                        )}
                      </label>
                      <textarea defaultValue={x[lg]} style={{ minHeight: 62, fontSize: ".85rem" }}
                                onBlur={(e) => { if (e.target.value !== x[lg]) sauver(x.key, lg, e.target.value); }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {edite && (
        <Forme valeur={edite} sections={sections}
               onClose={() => setEdite(null)}
               onSaved={() => { setEdite(null); charger(); }} />
      )}

      {aSupprimer && (
        <Confirm
          titre={`Supprimer « ${aSupprimer.key} » ?`}
          texte="Le site retombera sur le texte embarque dans son code pour cette cle."
          onCancel={() => setASupprimer(null)}
          onOk={async () => {
            if (await supprimer("contents", aSupprimer.key, "key")) charger();
            setASupprimer(null);
          }}
        />
      )}
    </Shell>
  );
}

function Forme({ valeur, sections, onClose, onSaved }: {
  valeur: Partial<Texte>; sections: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Texte>>({ ...valeur });
  const [envoi, setEnvoi] = useState(false);
  const nouveau = !valeur.key;
  const set = (k: keyof Texte, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      titre={nouveau ? "Nouveau texte" : "Modifier le texte"}
      sous={nouveau ? "La cle doit correspondre a celle utilisee par le site." : valeur.key}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" disabled={envoi} onClick={async () => {
            if (!f.key?.trim()) return toast("La cle est obligatoire.", "err");
            setEnvoi(true);
            const ok = await enregistrer("contents", {
              key: f.key.trim(),
              fr: f.fr ?? "",
              en: f.en ?? "",
              section: f.section || "divers",
              help: f.help || null,
            }, valeur.key ?? null, "key");
            setEnvoi(false);
            if (ok) onSaved();
          }}>{envoi ? "…" : "Enregistrer"}</button>
        </>
      }
    >
      <div className="row">
        <Champ label="Cle" aide="Ex. hero.title1 — telle qu'elle figure dans le site.">
          <input className="mono" autoFocus disabled={!nouveau} value={f.key ?? ""}
                 onChange={(e) => set("key", e.target.value)} />
        </Champ>
        <Champ label="Section" aide="Regroupement dans cet ecran.">
          <input list="sections" value={f.section ?? ""} onChange={(e) => set("section", e.target.value)} />
          <datalist id="sections">
            {sections.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Champ>
      </div>
      <Champ label="Francais">
        <textarea value={f.fr ?? ""} onChange={(e) => set("fr", e.target.value)} />
      </Champ>
      <Champ label="Anglais">
        <textarea value={f.en ?? ""} onChange={(e) => set("en", e.target.value)} />
      </Champ>
      <Champ label="Note interne" aide="Rappel a l'attention de l'equipe.">
        <input value={f.help ?? ""} onChange={(e) => set("help", e.target.value)} />
      </Champ>
    </Modal>
  );
}
