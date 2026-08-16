"use client";

/**
 * Éditeur en direct.
 *
 * Le vrai site est affiché dans un cadre, en mode édition. Quand
 * l'administrateur clique un texte, un prix ou une image, le site nous
 * envoie l'identifiant de l'élément ; on ouvre le champ ici, et c'est
 * CETTE page qui écrit dans Supabase avec la session de l'admin.
 * Le site n'a aucune clé d'écriture : il ne fait qu'afficher l'aperçu
 * qu'on lui renvoie.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { supabase, SITE_URL } from "@/lib/supabase";

type Selection = {
  kind: "content" | "product" | "media";
  key: string;
  field: string | null;
  value: string;
  lang: string;
};

const PAGES = [
  { file: "index.html", label: "Accueil" },
  { file: "boutique.html", label: "Boutique" },
  { file: "a-propos.html", label: "À propos" },
  { file: "contact.html", label: "Contact" },
];

export default function Editeur() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [page, setPage] = useState("index.html");
  const [langue, setLangue] = useState<"fr" | "en">("fr");
  const [sel, setSel] = useState<Selection | null>(null);
  const [valeur, setValeur] = useState("");
  const [etat, setEtat] = useState<{ type: "ok" | "err"; texte: string } | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  const src = `${SITE_URL}/${page}?edit=1&lang=${langue}`;

  const versLeSite = useCallback((msg: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage(
      { source: "farafina-office", ...msg },
      new URL(SITE_URL).origin
    );
  }, []);

  /* ---------- réception des clics venus du site ---------- */
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== new URL(SITE_URL).origin) return;
      const m = e.data;
      if (!m || m.source !== "farafina-site") return;

      if (m.type === "select") {
        setSel({ kind: m.kind, key: m.key, field: m.field, value: m.value, lang: m.lang });
        setValeur(m.value);
        setEtat(null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* ---------- aperçu instantané pendant la frappe ---------- */
  function saisir(v: string) {
    setValeur(v);
    if (!sel) return;
    versLeSite({ type: "preview", kind: sel.kind, key: sel.key, field: sel.field, value: v });
  }

  /* ---------- enregistrement ---------- */
  async function enregistrer() {
    if (!sel) return;
    setEnregistre(true);
    setEtat(null);

    let error = null;

    if (sel.kind === "content") {
      const colonne = langue === "fr" ? "fr" : "en";
      const res = await supabase
        .from("contents")
        .update({ [colonne]: valeur })
        .eq("key", sel.key);
      error = res.error;
    } else if (sel.kind === "product") {
      const colonnes: Record<string, string> = {
        name: langue === "fr" ? "fr_name" : "en_name",
        desc: langue === "fr" ? "fr_desc" : "en_desc",
      };
      if (sel.field === "price") {
        // on accepte « 12 », « 12,50 », « 12.50 € » ; vide = prix sur demande
        const brut = valeur.replace(/[^\d,.]/g, "").replace(",", ".");
        const prix = brut === "" ? null : Number(brut);
        if (prix !== null && Number.isNaN(prix)) {
          setEtat({ type: "err", texte: "Prix illisible. Exemples : 12 ou 12,50" });
          setEnregistre(false);
          return;
        }
        const res = await supabase.from("products").update({ price: prix }).eq("slug", sel.key);
        error = res.error;
      } else if (sel.field && colonnes[sel.field]) {
        const res = await supabase
          .from("products")
          .update({ [colonnes[sel.field]]: valeur })
          .eq("slug", sel.key);
        error = res.error;
      } else {
        setEtat({ type: "err", texte: "Ce champ se modifie depuis la fiche produit." });
        setEnregistre(false);
        return;
      }
    } else {
      setEtat({
        type: "err",
        texte: "Les images se remplacent depuis l'onglet Catalogue (téléversement).",
      });
      setEnregistre(false);
      return;
    }

    setEnregistre(false);
    if (error) setEtat({ type: "err", texte: "Échec de l'enregistrement : " + error.message });
    else setEtat({ type: "ok", texte: "Enregistré. La modification est en ligne sur le site." });
  }

  function annuler() {
    if (!sel) return;
    setValeur(sel.value);
    versLeSite({ type: "preview", kind: sel.kind, key: sel.key, field: sel.field, value: sel.value });
    setEtat(null);
  }

  const titre =
    sel?.kind === "content"
      ? "Texte du site"
      : sel?.kind === "product"
      ? { name: "Nom du produit", desc: "Description", price: "Prix de gros", image: "Photo" }[
          sel.field ?? ""
        ] ?? "Produit"
      : sel?.kind === "media"
      ? "Image éditoriale"
      : "";

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Modifier le site</h1>
          <p>
            Cliquez directement sur un texte, un prix ou une image dans la page, puis
            enregistrez.
          </p>
        </div>
        <a className="btn btn--line" href={SITE_URL} target="_blank" rel="noopener">
          Voir le site public
        </a>
      </div>

      <div className="editor">
        <div className="editor__frame">
          <div className="editor__bar">
            <select value={page} onChange={(e) => setPage(e.target.value)}>
              {PAGES.map((p) => (
                <option key={p.file} value={p.file}>
                  {p.label}
                </option>
              ))}
            </select>

            <button className={langue === "fr" ? "on" : ""} onClick={() => setLangue("fr")}>
              Français
            </button>
            <button className={langue === "en" ? "on" : ""} onClick={() => setLangue("en")}>
              English
            </button>

            <button onClick={() => versLeSite({ type: "reload" })} style={{ marginLeft: "auto" }}>
              Recharger
            </button>
          </div>
          <iframe ref={frame} src={src} title="Aperçu du site" />
        </div>

        <aside className="editor__panel">
          {!sel ? (
            <div className="editor__hint">
              <span className="editor__what">Comment faire</span>
              <ol>
                <li>Choisissez la page et la langue en haut du cadre.</li>
                <li>Survolez la page : les éléments modifiables s&apos;encadrent.</li>
                <li>Cliquez celui à changer, il s&apos;ouvre ici.</li>
                <li>Modifiez : l&apos;aperçu suit en direct.</li>
                <li>
                  <strong>Enregistrer</strong> met en ligne. <strong>Annuler</strong> revient
                  en arrière.
                </li>
              </ol>
              <p style={{ marginTop: 16 }}>
                Les photos se remplacent depuis l&apos;onglet <strong>Catalogue</strong> : elles
                doivent être téléversées, pas seulement remplacées à l&apos;écran.
              </p>
            </div>
          ) : (
            <>
              <span className="editor__what">{titre}</span>
              <div className="editor__key">
                {sel.kind === "product" ? `référence ${sel.key}` : sel.key}
                {sel.kind !== "media" && ` · ${langue === "fr" ? "français" : "anglais"}`}
              </div>

              {etat && (
                <div className={`msg msg--${etat.type === "ok" ? "ok" : "err"}`}>{etat.texte}</div>
              )}

              {sel.kind === "media" || sel.field === "image" ? (
                <>
                  <img
                    src={
                      sel.value.startsWith("http") ? sel.value : `${SITE_URL}/${sel.value.replace(/^\//, "")}`
                    }
                    alt=""
                    style={{ borderRadius: 8, marginBottom: 12 }}
                  />
                  <p className="editor__hint">
                    Pour remplacer cette image, passez par l&apos;onglet Catalogue.
                  </p>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="v">Contenu</label>
                    <textarea
                      id="v"
                      value={valeur}
                      onChange={(e) => saisir(e.target.value)}
                      style={{ minHeight: sel.field === "price" ? 46 : 150 }}
                    />
                  </div>

                  {sel.field === "price" && (
                    <p className="editor__hint" style={{ marginTop: -6, marginBottom: 14 }}>
                      Laissez vide pour afficher « prix sur demande ».
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn" onClick={enregistrer} disabled={enregistre}>
                      {enregistre ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button className="btn btn--line" onClick={annuler} disabled={enregistre}>
                      Annuler
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </Shell>
  );
}
