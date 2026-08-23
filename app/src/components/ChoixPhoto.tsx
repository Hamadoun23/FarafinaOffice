"use client";

/**
 * Choisir une photo deja livree avec le site.
 *
 * Sans cela, une image rangee dans assets/ etait invisible depuis le
 * back-office : il fallait la reteleverser depuis son poste pour s'en
 * servir. Le site publie desormais l'inventaire de ses photos
 * (assets/manifest.json) et cet ecran le parcourt.
 *
 * Il porte sa propre fenetre plutot que la Modal commune : il s'ouvre
 * PAR-DESSUS la fiche produit, et la touche Echap ne doit fermer que
 * lui.
 */

import { useEffect, useMemo, useState } from "react";
import { Ico } from "@/components/ui";
import { photoProduit } from "@/components/FicheProduit";

type Manifeste = { genere: string; total: number; produits: string[]; editorial: string[] };

/* Le manifeste ne change pas d'une fiche a l'autre : on le garde. */
let cache: Manifeste | null = null;

export default function ChoixPhoto({
  dossier, titre = "Photos du site", multiple, onChoisir, onClose,
}: {
  /** Dossier a proposer en premier, ex. « produits/textile/sacs ». */
  dossier?: string;
  titre?: string;
  /** true : on peut en cocher plusieurs avant de valider. */
  multiple?: boolean;
  onChoisir: (chemins: string[]) => void;
  onClose: () => void;
}) {
  const [manifeste, setManifeste] = useState<Manifeste | null>(cache);
  const [erreur, setErreur] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [famille, setFamille] = useState<"gamme" | "produits" | "editorial">(dossier ? "gamme" : "produits");
  const [coches, setCoches] = useState<string[]>([]);

  useEffect(() => {
    if (cache) return;
    /* on passe par le serveur du back-office : le site est sur un autre
       sous-domaine, un fetch direct serait refuse par le navigateur */
    fetch("/api/manifest", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.erreur || String(r.status));
        return d as Manifeste;
      })
      .then((m) => { cache = m; setManifeste(m); })
      .catch((e) =>
        setErreur(
          (e?.message || "Inventaire des photos introuvable.") +
          " Relancez « node tools/build-manifest.mjs » dans le dossier du site."
        )
      );
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", esc, true);
    return () => document.removeEventListener("keydown", esc, true);
  }, [onClose]);

  const vues = useMemo(() => {
    if (!manifeste) return [];
    const base =
      famille === "editorial" ? manifeste.editorial
      : famille === "gamme" && dossier ? manifeste.produits.filter((p) => p.startsWith(dossier + "/"))
      : manifeste.produits;
    const t = q.trim().toLowerCase();
    return t ? base.filter((p) => p.toLowerCase().includes(t)) : base;
  }, [manifeste, famille, dossier, q]);

  function valider(chemins: string[]) {
    if (!chemins.length) return;
    onChoisir(chemins);
    onClose();
  }

  return (
    <div className="ov ov--haut" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--wide">
        <div className="modal__h">
          <div>
            <h2>{titre}</h2>
            <p>{manifeste ? `${manifeste.total} photos rangees dans le site` : "Lecture de l'inventaire…"}</p>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Fermer">
            <Ico n="x" />
          </button>
        </div>

        <div className="modal__b">
          {erreur ? (
            <div className="msg msg--err">{erreur}</div>
          ) : !manifeste ? (
            <div className="skel" style={{ height: 200 }} />
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <div className="chips">
                  {dossier && (
                    <button className={`chip ${famille === "gamme" ? "on" : ""}`} onClick={() => setFamille("gamme")}>
                      Cette gamme
                    </button>
                  )}
                  <button className={`chip ${famille === "produits" ? "on" : ""}`} onClick={() => setFamille("produits")}>
                    Toutes les references
                  </button>
                  <button className={`chip ${famille === "editorial" ? "on" : ""}`} onClick={() => setFamille("editorial")}>
                    Photos editoriales
                  </button>
                </div>
                <span style={{ flex: 1 }} />
                <div className="search" style={{ minWidth: 200 }}>
                  <Ico n="search" s={16} />
                  <input placeholder="Rechercher un nom de fichier…" value={q}
                         onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>

              {vues.length === 0 ? (
                <p className="sub" style={{ padding: "24px 0", textAlign: "center" }}>
                  Aucune photo ici. Essayez « Toutes les references ».
                </p>
              ) : (
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
                  gap: 10, maxHeight: "46vh", overflowY: "auto", paddingRight: 4,
                }}>
                  {vues.map((chemin) => {
                    const choisi = coches.includes(chemin);
                    return (
                      <button key={chemin}
                              title={chemin}
                              onClick={() => {
                                if (!multiple) return valider([chemin]);
                                setCoches((c) => choisi ? c.filter((x) => x !== chemin) : [...c, chemin]);
                              }}
                              style={{
                                padding: 0, borderRadius: 10, overflow: "hidden", textAlign: "left",
                                border: `2px solid ${choisi ? "var(--gold)" : "var(--line-2)"}`,
                                background: "var(--surface-2)",
                              }}>
                        <img src={photoProduit(chemin)} alt=""
                             style={{ width: "100%", height: 96, objectFit: "cover", display: "block" }} />
                        <span style={{
                          display: "block", padding: "5px 7px", fontSize: ".64rem",
                          color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {chemin.split("/").pop()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal__f">
          {multiple && <span className="left sub">{coches.length} photo(s) cochee(s)</span>}
          <button className="btn" onClick={onClose}>Annuler</button>
          {multiple && (
            <button className="btn btn--main" disabled={!coches.length} onClick={() => valider(coches)}>
              Ajouter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
