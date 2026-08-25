"use client";

/**
 * Reglages — l'en-tete de facture et les mentions, modifiables sans
 * toucher au code. C'est ce qui evite d'appeler quelqu'un chaque fois
 * qu'un numero de telephone change.
 */

import { useState } from "react";
import Shell from "@/components/Shell";
import { Champ, Ico, Chargement, toast } from "@/components/ui";
import { DEVISES, majChamp, televerser, useTable } from "@/lib/db";

type Reglage = { key: string; value: string; label: string | null; groupe: string; position: number };

const GROUPES: Record<string, { titre: string; aide: string }> = {
  societe: {
    titre: "La maison",
    aide: "Ces lignes forment l'en-tete de vos factures, telles qu'elles s'impriment.",
  },
  facture: {
    titre: "Facturation",
    aide: "Numerotation, devise et mentions de bas de page.",
  },
  site: {
    titre: "Etat du site",
    aide: "De quoi prevenir vos clients — conges, inventaire, rupture — sans passer par personne.",
  },
};

/** Les etats possibles, du plus discret au plus ferme. */
const ETATS = [
  { v: "ouvert",  l: "Ouvert — rien ne change" },
  { v: "annonce", l: "Bandeau d'information — la boutique reste ouverte" },
  { v: "ferme",   l: "Ferme — le catalogue reste visible, les commandes sont suspendues" },
];

/** Trois messages prets a l'emploi. L'administrateur en choisit un puis
    le reecrit s'il veut : ce sont des points de depart, pas des modeles. */
const MESSAGES = [
  {
    quoi: "Conges",
    titre: "Boutique fermee pour conges",
    texte: "L'atelier ferme jusqu'a nouvel ordre. Vous pouvez parcourir le catalogue : nous repondrons a vos demandes des la reouverture.",
  },
  {
    quoi: "Inventaire",
    titre: "Inventaire en cours",
    texte: "Nous comptons nos stocks et mettons les prix a jour. Les commandes reprennent dans quelques jours — ecrivez-nous, nous vous rappellerons.",
  },
  {
    quoi: "Nouvelle collection",
    titre: "Nous preparons la prochaine collection",
    texte: "Les pieces de la saison partent a la teinture. Le catalogue reste consultable et nous notons vos demandes pour la reouverture.",
  },
];

export default function Reglages() {
  const { items, chargement, charger } = useTable<Reglage>(
    "settings", "key,value,label,groupe,position", { col: "position", asc: true }
  );
  const [enCours, setEnCours] = useState<string | null>(null);
  const [depot, setDepot] = useState(false);

  async function sauver(cle: string, valeur: string) {
    if (await majChamp("settings", cle, "value", valeur, "key")) {
      setEnCours(cle);
      setTimeout(() => setEnCours(null), 1500);
      charger();
    }
  }

  const groupes = [...new Set(items.map((r) => r.groupe))];
  const logo = items.find((r) => r.key === "societe.logo")?.value || "";

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Reglages</h1>
          <p>Les coordonnees et les mentions qui apparaissent sur vos factures.</p>
        </div>
      </div>

      {chargement ? (
        <div className="card"><Chargement /></div>
      ) : (
        <div className="grid grid--2" style={{ alignItems: "start" }}>
          {groupes.map((g) => (
            <div key={g} className="card card--pad">
              <div className="section-t">{GROUPES[g]?.titre ?? g}</div>
              {GROUPES[g]?.aide && (
                <p className="sub" style={{ marginBottom: 16 }}>{GROUPES[g].aide}</p>
              )}

              {items.filter((r) => r.groupe === g).map((r) => (
                <div key={r.key} className="field">
                  <label style={{ display: "flex", justifyContent: "space-between" }}>
                    {r.label ?? r.key}
                    {enCours === r.key && <span style={{ color: "var(--ok)" }}>enregistre</span>}
                  </label>

                  {r.key === "societe.logo" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      {logo ? (
                        <img src={logo} alt="" style={{
                          width: 96, height: 62, objectFit: "contain",
                          background: "var(--surface-2)", borderRadius: 8, padding: 6,
                          border: "1px solid var(--line-2)",
                        }} />
                      ) : (
                        <span className="thumb" style={{ width: 96, height: 62, display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
                          <Ico n="box" />
                        </span>
                      )}
                      <label className="btn btn--sm">
                        {depot ? "Import…" : "Importer un logo"}
                        <input type="file" accept="image/*" hidden disabled={depot}
                               onChange={async (e) => {
                                 const f = e.target.files?.[0];
                                 e.target.value = "";
                                 if (!f) return;
                                 setDepot(true);
                                 const url = await televerser(f, "societe", "logo");
                                 setDepot(false);
                                 if (url) { await sauver("societe.logo", url); toast("Logo enregistre."); }
                               }} />
                      </label>
                      {logo && (
                        <button className="btn btn--sm btn--danger" onClick={() => sauver("societe.logo", "")}>
                          Retirer
                        </button>
                      )}
                    </div>
                  ) : r.key === "facture.devise" ? (
                    <select defaultValue={r.value} onChange={(e) => sauver(r.key, e.target.value)}>
                      {DEVISES.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}
                    </select>
                  ) : r.key === "site.etat" ? (
                    <select defaultValue={r.value} onChange={(e) => sauver(r.key, e.target.value)}>
                      {ETATS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
                    </select>
                  ) : r.key === "site.message" ? (
                    <>
                      <textarea defaultValue={r.value} rows={3}
                                onBlur={(e) => { if (e.target.value !== r.value) sauver(r.key, e.target.value); }} />
                      <div className="chips" style={{ marginTop: 10 }}>
                        {MESSAGES.map((m) => (
                          <button key={m.quoi} className="chip" type="button"
                                  title={m.texte}
                                  onClick={async () => {
                                    await sauver("site.titre", m.titre);
                                    await sauver("site.message", m.texte);
                                    charger();
                                    toast("Message « " + m.quoi + " » repris. Modifiez-le si besoin.");
                                  }}>
                            {m.quoi}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : r.key === "site.reprise" ? (
                    <input type="date" defaultValue={r.value}
                           onBlur={(e) => { if (e.target.value !== r.value) sauver(r.key, e.target.value); }} />
                  ) : r.key === "facture.mentions" ? (
                    <textarea defaultValue={r.value}
                              onBlur={(e) => { if (e.target.value !== r.value) sauver(r.key, e.target.value); }} />
                  ) : (
                    <input defaultValue={r.value}
                           inputMode={r.key === "facture.echeance" ? "numeric" : undefined}
                           onBlur={(e) => { if (e.target.value !== r.value) sauver(r.key, e.target.value); }} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
