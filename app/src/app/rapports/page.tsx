"use client";

/**
 * Rapports et comptabilite.
 *
 * Chiffre d'affaires par periode, repertoire clients classe par ce qu'il
 * rapporte, recherche rapide dans toutes les factures. Le tout se calcule
 * cote client a partir des factures et de leurs lignes : le volume reste
 * modeste (quelques centaines de factures), inutile d'ajouter une vue SQL.
 *
 * Une regle guide tout l'ecran : ne jamais additionner deux devises. Un
 * dollar et un franc CFA ne s'ajoutent pas sans un taux de change, que
 * l'application n'a aucun moyen de connaitre avec certitude. On choisit
 * donc une devise a la fois, et les chiffres qu'elle montre sont honnetes.
 */

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { Ico, Chargement, Vide } from "@/components/ui";
import { DEVISES, jour, montant, useTable } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { Facture, numeroFacture, soldeFacture, statutFacture as st, totalLigne } from "@/lib/facture";

type Client = { id: string; name: string; company: string | null; reference: string };
type Reglage = { key: string; value: string };
type Granularite = "semaine" | "mois" | "annee";

/** Cle de regroupement : le lundi de la semaine, "AAAA-MM" ou "AAAA". */
function clePeriode(d: string, g: Granularite): string {
  const date = new Date(d + "T00:00:00");
  if (g === "annee") return String(date.getFullYear());
  if (g === "mois") return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  const lundi = new Date(date);
  lundi.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return lundi.toISOString().slice(0, 10);
}

function libellePeriode(cle: string, g: Granularite): string {
  if (g === "annee") return cle;
  if (g === "mois") {
    const [y, m] = cle.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  }
  return "Sem. " + jour(cle);
}

export default function Rapports() {
  const { items: factures, chargement } = useTable<Facture>("invoices", "*");
  const { items: clients } = useTable<Client>("customers", "id,name,company,reference", { col: "name", asc: true });
  const { items: reglages } = useTable<Reglage>("settings", "key,value", { col: "position", asc: true });
  const [totaux, setTotaux] = useState<Record<string, number>>({});
  const [devise, setDevise] = useState("");
  const [granularite, setGranularite] = useState<Granularite>("mois");
  const [recherche, setRecherche] = useState("");

  const reg = useMemo(() => Object.fromEntries(reglages.map((r) => [r.key, r.value])), [reglages]);
  const prefixe = reg["facture.prefixe"] || "INV";
  const clientDe = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  useEffect(() => {
    if (!factures.length) { setTotaux({}); return; }
    supabase.from("invoice_items").select("invoice_id,rate,qty,discount,discount_type").then(({ data }) => {
      const t: Record<string, number> = {};
      (data ?? []).forEach((l: any) => { t[l.invoice_id] = (t[l.invoice_id] ?? 0) + totalLigne(l); });
      setTotaux(t);
    });
  }, [factures]);

  /* La devise choisie par defaut : celle qui a le plus de factures, pour
     ouvrir l'ecran sur des chiffres qui parlent tout de suite. */
  useEffect(() => {
    if (devise || !factures.length) return;
    const compte: Record<string, number> = {};
    factures.forEach((f) => { compte[f.currency] = (compte[f.currency] ?? 0) + 1; });
    const plusFrequente = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];
    setDevise(plusFrequente ? plusFrequente[0] : "USD");
  }, [factures, devise]);

  const devisesUtilisees = useMemo(
    () => DEVISES.filter((d) => factures.some((f) => f.currency === d.code)),
    [factures]
  );

  /* Le chiffre d'affaires compte ce qui a ete engage envers un client :
     ni un brouillon (rien n'est encore parti), ni une facture annulee. */
  const facturees = useMemo(
    () => factures.filter((f) => f.currency === devise && f.status !== "brouillon" && f.status !== "annulee"),
    [factures, devise]
  );
  const brouillons = useMemo(
    () => factures.filter((f) => f.currency === devise && f.status === "brouillon").length,
    [factures, devise]
  );

  const kpi = useMemo(() => {
    let facture = 0, encaisse = 0, duReste = 0;
    facturees.forEach((f) => {
      const total = totaux[f.id] ?? 0;
      const solde = soldeFacture(total, f.paid_amount, f.status);
      facture += total; duReste += solde; encaisse += total - solde;
    });
    return { facture, encaisse, duReste, nb: facturees.length, panier: facturees.length ? facture / facturees.length : 0 };
  }, [facturees, totaux]);

  const periodes = useMemo(() => {
    const parCle: Record<string, { facture: number; encaisse: number; nb: number }> = {};
    facturees.forEach((f) => {
      const cle = clePeriode(f.issue_date, granularite);
      const total = totaux[f.id] ?? 0;
      const solde = soldeFacture(total, f.paid_amount, f.status);
      const e = (parCle[cle] ??= { facture: 0, encaisse: 0, nb: 0 });
      e.facture += total; e.encaisse += total - solde; e.nb += 1;
    });
    const limite = granularite === "annee" ? 999 : granularite === "mois" ? 12 : 10;
    return Object.entries(parCle).sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-limite)
      .map(([cle, v]) => ({ cle, libelle: libellePeriode(cle, granularite), ...v }));
  }, [facturees, totaux, granularite]);
  const maxPeriode = Math.max(1, ...periodes.map((p) => p.facture));

  const topClients = useMemo(() => {
    const parClient: Record<string, { nom: string; ref: string; total: number; nb: number }> = {};
    facturees.forEach((f) => {
      const total = totaux[f.id] ?? 0;
      const c = f.customer_id ? clientDe[f.customer_id] : null;
      const cle = f.customer_id || "libre:" + f.bill_to;
      const e = (parClient[cle] ??= {
        nom: c ? (c.company ? `${c.name} — ${c.company}` : c.name) : (f.bill_to || "Client sans fiche"),
        ref: c?.reference || "—", total: 0, nb: 0,
      });
      e.total += total; e.nb += 1;
    });
    return Object.values(parClient).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [facturees, totaux, clientDe]);

  const rq = recherche.trim().toLowerCase();
  const resultats = rq
    ? factures.filter((f) => [numeroFacture(f.number, prefixe), f.bill_to, f.bill_phone, f.bill_email, st(f.status)?.l]
        .filter(Boolean).join(" ").toLowerCase().includes(rq)).slice(0, 30)
    : [];

  if (chargement) {
    return <Shell><div className="head"><div><h1>Rapports</h1></div></div><div className="card"><Chargement /></div></Shell>;
  }

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Rapports</h1>
          <p>Chiffre d&apos;affaires, clients qui rapportent le plus, recherche dans les factures.</p>
        </div>
      </div>

      {/* ---------- recherche rapide, toutes devises ---------- */}
      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <div className="section-t" style={{ marginTop: 0 }}>Retrouver une facture</div>
        <div className="search" style={{ maxWidth: 420 }}>
          <Ico n="search" s={16} />
          <input placeholder="N°, client, telephone, e-mail, statut…"
                 value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        {rq && (
          resultats.length === 0 ? (
            <p style={{ marginTop: 12, color: "var(--ink-3)", fontSize: ".87rem" }}>Aucune facture ne correspond.</p>
          ) : (
            <div className="tw" style={{ marginTop: 12 }}>
              <table>
                <tbody>
                  {resultats.map((f) => (
                    <tr key={f.id}>
                      <td className="mono">{numeroFacture(f.number, prefixe)}</td>
                      <td><strong>{f.bill_to || "—"}</strong></td>
                      <td className="sub">{jour(f.issue_date)}</td>
                      <td><span className={`tag tag--${st(f.status)?.t ?? "mute"}`}>{st(f.status)?.l}</span></td>
                      <td style={{ textAlign: "right" }}>
                        <a className="btn btn--sm" href={`/factures/${f.id}/imprimer`} target="_blank" rel="noopener">Ouvrir</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {factures.length === 0 ? (
        <div className="card"><Vide titre="Aucune facture" texte="Les rapports se remplissent des la premiere facture etablie." /></div>
      ) : !devise ? (
        <div className="card"><Chargement /></div>
      ) : (
        <>
          {/* ---------- devise ---------- */}
          <div className="chips" style={{ marginBottom: 16 }}>
            {devisesUtilisees.map((d) => (
              <button key={d.code} className={`chip ${devise === d.code ? "on" : ""}`} onClick={() => setDevise(d.code)}>
                {d.code} ({factures.filter((f) => f.currency === d.code).length})
              </button>
            ))}
          </div>

          {/* ---------- chiffres cles ---------- */}
          <div className="grid grid--4">
            <div className="stat"><b>{montant(kpi.facture, devise)}</b><span>Facture (hors brouillons)</span></div>
            <div className="stat"><b>{montant(kpi.encaisse, devise)}</b><span>Encaisse</span></div>
            <div className="stat"><b>{montant(kpi.duReste, devise)}</b><span>Reste du</span></div>
            <div className="stat"><b>{kpi.nb}</b><span>Factures ({devise})</span></div>
            <div className="stat"><b>{montant(kpi.panier, devise)}</b><span>Panier moyen</span></div>
          </div>
          {brouillons > 0 && (
            <p style={{ margin: "8px 2px 0", fontSize: ".8rem", color: "var(--ink-3)" }}>
              {brouillons} facture{brouillons > 1 ? "s" : ""} en brouillon en {devise}, pas encore comptee{brouillons > 1 ? "s" : ""} dans ces chiffres.
            </p>
          )}

          {/* ---------- evolution par periode ---------- */}
          <div className="card card--pad" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div className="section-t" style={{ margin: 0 }}>Comment on a gagne — {devise}</div>
              <div className="chips">
                {(["semaine", "mois", "annee"] as Granularite[]).map((g) => (
                  <button key={g} className={`chip ${granularite === g ? "on" : ""}`} onClick={() => setGranularite(g)}>
                    {g === "semaine" ? "Semaines" : g === "mois" ? "Mois" : "Annees"}
                  </button>
                ))}
              </div>
            </div>

            {periodes.length === 0 ? (
              <p style={{ color: "var(--ink-3)", fontSize: ".87rem", marginTop: 10 }}>Rien a montrer pour cette devise.</p>
            ) : (
              <>
                <div className="bars">
                  {periodes.map((p) => (
                    <div key={p.cle} className="bars__col" title={`${p.libelle} : ${montant(p.facture, devise)} facture, ${montant(p.encaisse, devise)} encaisse`}>
                      <div className="bars__stack" style={{ height: `${Math.max(3, (p.facture / maxPeriode) * 100)}%` }}>
                        <div className="bars__encaisse" style={{ height: `${p.facture ? (p.encaisse / p.facture) * 100 : 0}%` }} />
                      </div>
                      <span>{p.libelle}</span>
                    </div>
                  ))}
                </div>
                <div className="tw" style={{ marginTop: 14 }}>
                  <table>
                    <thead>
                      <tr><th>Periode</th><th style={{ width: 70 }}>Factures</th><th className="num">Facture</th><th className="num">Encaisse</th><th className="num">Reste du</th></tr>
                    </thead>
                    <tbody>
                      {[...periodes].reverse().map((p) => (
                        <tr key={p.cle}>
                          <td>{p.libelle}</td>
                          <td>{p.nb}</td>
                          <td className="num">{montant(p.facture, devise)}</td>
                          <td className="num">{montant(p.encaisse, devise)}</td>
                          <td className="num">{montant(p.facture - p.encaisse, devise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* ---------- clients qui rapportent le plus ---------- */}
          <div className="card card--pad" style={{ marginTop: 16 }}>
            <div className="section-t" style={{ marginTop: 0 }}>Meilleurs clients — {devise}</div>
            {topClients.length === 0 ? (
              <p style={{ color: "var(--ink-3)", fontSize: ".87rem" }}>Rien a montrer pour cette devise.</p>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr><th style={{ width: 88 }}>Reference</th><th>Client</th><th style={{ width: 90 }}>Factures</th><th className="num">Total facture</th></tr>
                  </thead>
                  <tbody>
                    {topClients.map((c, i) => (
                      <tr key={i}>
                        <td className="mono">{c.ref}</td>
                        <td><strong>{c.nom}</strong></td>
                        <td>{c.nb}</td>
                        <td className="num">{montant(c.total, devise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
