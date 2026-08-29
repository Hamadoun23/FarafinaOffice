"use client";

/**
 * Facture imprimable — la mise en pages du modele fourni par la maison.
 *
 * Pas de bibliotheque PDF : la page est mise en forme pour l'impression
 * et le navigateur produit le PDF (Imprimer, puis « Enregistrer au format
 * PDF »). L'administrateur garde ainsi la main sur le format papier et
 * sur le nom du fichier.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { montant } from "@/lib/db";
import { Facture, numeroFacture, remiseLigne, soldeFacture, totalFacture, totalLigne, TypeRemise } from "@/lib/facture";

type Ligne = {
  id: string; description: string; rate: number; qty: number;
  discount: number; discount_type: TypeRemise; position: number;
};
type Client = { reference: string };

const dateFr = (s: string | null | undefined) =>
  s ? new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }) : "—";

export default function Imprimer() {
  const { id } = useParams<{ id: string }>();
  const [f, setF] = useState<Facture | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [reg, setReg] = useState<Record<string, string>>({});
  const [client, setClient] = useState<Client | null>(null);
  const [etat, setEtat] = useState<"chargement" | "prete" | "absente">("chargement");

  useEffect(() => {
    (async () => {
      const [fac, its, set] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
        supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position"),
        supabase.from("settings").select("key,value"),
      ]);
      if (!fac.data) { setEtat("absente"); return; }
      const facture = fac.data as Facture;
      setF(facture);
      setLignes((its.data as Ligne[]) ?? []);
      setReg(Object.fromEntries(((set.data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value])));
      if (facture.customer_id) {
        const { data } = await supabase.from("customers").select("reference").eq("id", facture.customer_id).maybeSingle();
        setClient(data as Client | null);
      }
      setEtat("prete");
    })();
  }, [id]);

  useEffect(() => {
    if (f) document.title = `${numeroFacture(f.number, reg["facture.prefixe"] || "INV")} — ${f.bill_to}`;
  }, [f, reg]);

  if (etat === "chargement") return <div className="fac__vide">Chargement…</div>;
  if (etat === "absente" || !f) return <div className="fac__vide">Cette facture n&apos;existe pas.</div>;

  const total = totalFacture(lignes);
  const solde = soldeFacture(total, f.paid_amount, f.status);
  const dev = f.currency;
  const numero = numeroFacture(f.number, reg["facture.prefixe"] || "INV");

  return (
    <>
      <div className="fac__barre">
        <a className="btn" href="/factures">← Retour aux factures</a>
        <button className="btn btn--main" onClick={() => window.print()}>
          Imprimer / enregistrer en PDF
        </button>
      </div>

      <div className="fac">
        {/* ---------- en-tete ---------- */}
        <header className="fac__tete">
          <div className="fac__logo">
            {reg["societe.logo"]
              ? <img src={reg["societe.logo"]} alt="" />
              : <div className="fac__logo-vide">{reg["societe.nom"] || "FARAFINATIGNE"}</div>}
          </div>

          <div className="fac__maison">
            <h1>{reg["societe.nom"] || "FARAFINATIGNE"}</h1>
            {reg["societe.contact"] && <p>{reg["societe.contact"]}</p>}
            {(reg["societe.pays"] || reg["societe.bp"]) && (
              <p>{[reg["societe.pays"], reg["societe.bp"]].filter(Boolean).join(" · ")}</p>
            )}
            {reg["societe.adresse"] && <p>{reg["societe.adresse"]}</p>}
            {(reg["societe.tel1"] || reg["societe.tel2"]) && (
              <p className="fac__ico">☏ {[reg["societe.tel1"], reg["societe.tel2"]].filter(Boolean).join(" · ")}</p>
            )}
            {(reg["societe.site"] || reg["societe.email"]) && (
              <p>
                {reg["societe.site"] && (
                  <a href={`https://${String(reg["societe.site"]).replace(/^https?:\/\//, "")}`}>{reg["societe.site"]}</a>
                )}
                {reg["societe.site"] && reg["societe.email"] && " · "}
                {reg["societe.email"]}
              </p>
            )}
          </div>

          <div className="fac__meta">
            <div><span>INVOICE</span><b>{numero}</b></div>
            <div><span>DATE</span><b>{dateFr(f.issue_date)}</b></div>
            <div><span>DUE DATE</span><b>{dateFr(f.due_date)}</b></div>
            <div><span>BALANCE DUE</span><b>{dev} {montant(solde, dev)}</b></div>
          </div>
        </header>

        {/* ---------- destinataire ---------- */}
        <section className="fac__client">
          <span>BILL TO</span>
          <h2>{f.bill_to}{client?.reference && <i className="fac__ref">{client.reference}</i>}</h2>
          {f.bill_phone && <p className="fac__ico">☏ {f.bill_phone}</p>}
          {f.bill_email && <p>{f.bill_email}</p>}
          {f.bill_address && <p>{f.bill_address}</p>}
        </section>

        {/* ---------- lignes ---------- */}
        <table className="fac__lignes">
          <thead>
            <tr>
              <th>DESCRIPTION</th>
              <th className="d">RATE</th>
              <th className="d">QTY</th>
              <th className="d">DISCOUNT</th>
              <th className="d">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const remise = remiseLigne(l);
              return (
                <tr key={l.id}>
                  <td>{l.description}</td>
                  <td className="d">{montant(l.rate, dev)}</td>
                  <td className="d">{Number(l.qty) % 1 === 0 ? Number(l.qty) : Number(l.qty).toFixed(2)}</td>
                  <td className="d">
                    {remise > 0 ? (
                      <>−{montant(remise, dev)}{l.discount_type !== "amount" && <i>{Number(l.discount)}%</i>}</>
                    ) : ""}
                  </td>
                  <td className="d"><b>{montant(totalLigne(l), dev)}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ---------- totaux ---------- */}
        {(() => {
          /* Payee => solde nul a l'affichage : si le montant regle enregistre
             a derive du total (correction ulterieure, remise ajoutee apres
             coup...), on montre ce qui rend les trois lignes coherentes
             plutot que le chiffre brut de la base. */
          const paye = f.status === "payee" ? total : Number(f.paid_amount);
          return (
            <section className="fac__totaux">
              <div className="fac__ligne-total">
                <span>TOTAL</span><b>{montant(total, dev)}</b>
              </div>
              {paye > 0 && (
                <div className="fac__ligne-total">
                  <span>AMOUNT PAID</span><b>−{montant(paye, dev)}</b>
                </div>
              )}
              <div className="fac__ligne-total fac__ligne-total--du">
                <span>BALANCE DUE</span><b>{dev} {montant(solde, dev)}</b>
              </div>
            </section>
          );
        })()}

        {/* ---------- pied ---------- */}
        <footer className="fac__pied">
          {f.note && <p className="fac__note">{f.note}</p>}
          <p>{reg["facture.merci"] || "Thanks for your business!"}</p>
          {reg["facture.mentions"] && <p className="fac__mentions">{reg["facture.mentions"]}</p>}
        </footer>
      </div>
    </>
  );
}
