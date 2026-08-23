"use client";

/**
 * Editeur en direct.
 *
 * Le vrai site est affiche dans un cadre, en mode edition.
 *   · un texte  -> il s'ouvre ici, l'apercu suit la frappe ;
 *   · un produit -> la FICHE CATALOGUE s'ouvre, la meme qu'a l'onglet
 *     Produits : nom, prix, promotion, photo. On ne modifie plus du
 *     HTML a la main ;
 *   · une image editoriale -> elle s'importe et remplace la photo du
 *     site, sans toucher au code.
 *
 * Le site n'a aucune cle d'ecriture : c'est cette page qui ecrit, avec
 * la session de l'administrateur.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { Ico, toast } from "@/components/ui";
import FicheProduit, { Categorie, Produit, SousCategorie } from "@/components/FicheProduit";
import { televerser, useTable } from "@/lib/db";
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
  { file: "a-propos.html", label: "A propos" },
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
  const [fiche, setFiche] = useState<Partial<Produit> | null>(null);
  const [depot, setDepot] = useState(false);

  const { items: cats } = useTable<Categorie>("categories", "id,slug,fr_name,position", { col: "position", asc: true });
  const { items: subs } = useTable<SousCategorie>("subcategories", "id,category_id,slug,fr_name", { col: "position", asc: true });

  const src = `${SITE_URL}/${page}?edit=1&lang=${langue}`;

  const versLeSite = useCallback((msg: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage(
      { source: "farafina-office", ...msg },
      new URL(SITE_URL).origin
    );
  }, []);

  /** Un clic sur une carte produit ouvre sa fiche, chargee depuis la base. */
  const ouvrirProduit = useCallback(async (slug: string) => {
    const { data, error } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
    if (error) return toast("Lecture impossible : " + error.message, "err");
    if (!data) return toast("Cette carte ne correspond a aucune reference en base.", "err");
    setFiche(data as Produit);
  }, []);

  /* ---------- reception des clics venus du site ---------- */
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== new URL(SITE_URL).origin) return;
      const m = e.data;
      if (!m || m.source !== "farafina-site") return;

      if (m.type === "select") {
        if (m.kind === "product") { ouvrirProduit(m.key); return; }
        setSel({ kind: m.kind, key: m.key, field: m.field, value: m.value, lang: m.lang });
        setValeur(m.value);
        setEtat(null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [ouvrirProduit]);

  /* ---------- apercu instantane pendant la frappe ---------- */
  function saisir(v: string) {
    setValeur(v);
    if (!sel) return;
    versLeSite({ type: "preview", kind: sel.kind, key: sel.key, field: sel.field, value: v });
  }

  /* ---------- enregistrement d'un texte ---------- */
  async function sauver() {
    if (!sel || sel.kind !== "content") return;
    setEnregistre(true);
    setEtat(null);
    const { error } = await supabase
      .from("contents")
      .update({ [langue]: valeur })
      .eq("key", sel.key);
    setEnregistre(false);
    if (error) setEtat({ type: "err", texte: "Echec de l'enregistrement : " + error.message });
    else setEtat({ type: "ok", texte: "Enregistre. La modification est en ligne." });
  }

  /**
   * Remplacement d'une image editoriale.
   * Le site n'a pas de table pour ses photos de decor : on enregistre
   * l'adresse de la nouvelle image dans « contents », sous la cle
   * media.<nom-du-fichier>, que le site applique au chargement.
   */
  async function importerMedia(file: File) {
    if (!sel) return;
    setDepot(true);
    const nom = sel.key.replace(/\.(webp|jpe?g|png)$/i, "");
    const url = await televerser(file, "medias", nom);
    if (!url) { setDepot(false); return; }
    const { error } = await supabase.from("contents").upsert({
      key: "media." + sel.key,
      fr: url, en: url,
      section: "medias",
      help: "Image du site remplacee depuis l'editeur",
    });
    setDepot(false);
    if (error) { setEtat({ type: "err", texte: "Echec : " + error.message }); return; }
    versLeSite({ type: "preview", kind: "media", key: sel.key, field: null, value: url });
    setSel({ ...sel, value: url });
    setEtat({ type: "ok", texte: "Image remplacee. Elle est en ligne sur le site." });
  }

  function annuler() {
    if (!sel) return;
    setValeur(sel.value);
    versLeSite({ type: "preview", kind: sel.kind, key: sel.key, field: sel.field, value: sel.value });
    setEtat(null);
  }

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Modifier le site</h1>
          <p>Cliquez un texte, un produit ou une image dans la page : tout se modifie ici.</p>
        </div>
        <div className="head__act">
          <a className="btn" href={SITE_URL} target="_blank" rel="noopener">Voir le site public</a>
        </div>
      </div>

      <div className="editor">
        <div className="editor__frame">
          <div className="editor__bar">
            <select value={page} onChange={(e) => setPage(e.target.value)}>
              {PAGES.map((p) => <option key={p.file} value={p.file}>{p.label}</option>)}
            </select>
            <button className={langue === "fr" ? "on" : ""} onClick={() => setLangue("fr")}>Francais</button>
            <button className={langue === "en" ? "on" : ""} onClick={() => setLangue("en")}>English</button>
            <button onClick={() => versLeSite({ type: "reload" })} style={{ marginLeft: "auto" }}>
              Recharger
            </button>
          </div>
          <iframe ref={frame} src={src} title="Apercu du site" />
        </div>

        <aside className="editor__panel">
          {!sel ? (
            <div className="editor__hint">
              <span className="editor__what">Comment faire</span>
              <ol>
                <li>Choisissez la page et la langue en haut du cadre.</li>
                <li>Survolez la page : les elements modifiables s&apos;encadrent.</li>
                <li>
                  <strong>Un texte</strong> s&apos;ouvre ici et l&apos;apercu suit la frappe.
                </li>
                <li>
                  <strong>Un produit</strong> ouvre sa fiche complete : nom, description,
                  prix, promotion et photo.
                </li>
                <li>
                  <strong>Une image</strong> se remplace en important un fichier.
                </li>
              </ol>
            </div>
          ) : (
            <>
              <span className="editor__what">
                {sel.kind === "content" ? "Texte du site" : "Image du site"}
              </span>
              <div className="editor__key">
                {sel.key}
                {sel.kind === "content" && ` · ${langue === "fr" ? "francais" : "anglais"}`}
              </div>

              {etat && <div className={`msg msg--${etat.type === "ok" ? "ok" : "err"}`}>{etat.texte}</div>}

              {sel.kind === "media" ? (
                <>
                  <img
                    src={sel.value.includes("://") ? sel.value : `${SITE_URL}/${sel.value.replace(/^\//, "")}`}
                    alt="" style={{ borderRadius: 10, marginBottom: 14 }}
                  />
                  <label className="btn btn--main" style={{ width: "100%" }}>
                    {depot ? "Import en cours…" : "Importer une autre image"}
                    <input type="file" accept="image/*" hidden disabled={depot}
                           onChange={(e) => {
                             const file = e.target.files?.[0];
                             e.target.value = "";
                             if (file) importerMedia(file);
                           }} />
                  </label>
                  <p className="editor__hint" style={{ marginTop: 12 }}>
                    L&apos;image est rangee dans le dossier <strong>medias</strong> et remplace
                    celle du site partout ou elle apparait.
                  </p>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="v">Contenu</label>
                    <textarea id="v" value={valeur} onChange={(e) => saisir(e.target.value)}
                              style={{ minHeight: 150 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn--main" onClick={sauver} disabled={enregistre}>
                      {enregistre ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button className="btn" onClick={annuler} disabled={enregistre}>Annuler</button>
                  </div>
                </>
              )}

              <button className="btn btn--ghost btn--sm" style={{ marginTop: 16 }}
                      onClick={() => { setSel(null); setEtat(null); }}>
                <Ico n="back" s={15} /> Revenir a l&apos;aide
              </button>
            </>
          )}
        </aside>
      </div>

      {fiche && (
        <FicheProduit
          produit={fiche} cats={cats} subs={subs}
          onClose={() => setFiche(null)}
          onSaved={() => { setFiche(null); versLeSite({ type: "reload" }); }}
        />
      )}
    </Shell>
  );
}
