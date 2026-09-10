"use client";

/**
 * Rendu de la facture — la mise en pages du modele fourni par la maison.
 * Partage entre l'ecran d'administration (/factures/[id]/imprimer) et la
 * page publique (/facture/[id]) : le meme document, deux facons d'y
 * arriver (l'equipe connectee, ou le lien envoye au client).
 */

import { forwardRef } from "react";
import { montant } from "@/lib/db";
import { Facture, numeroFacture, remiseLigne, soldeFacture, totalFacture, totalLigne, TypeRemise } from "@/lib/facture";

export type LigneFacture = {
  id: string; description: string; rate: number; qty: number;
  discount: number; discount_type: TypeRemise; position: number;
};
export type ClientFacture = { reference: string } | null;

export const dateFr = (s: string | null | undefined) =>
  s ? new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }) : "—";

type Props = {
  f: Facture;
  lignes: LigneFacture[];
  reg: Record<string, string>;
  client: ClientFacture;
};

const FactureRendu = forwardRef<HTMLDivElement, Props>(function FactureRendu({ f, lignes, reg, client }, ref) {
  const total = totalFacture(lignes);
  const solde = soldeFacture(total, f.paid_amount, f.status);
  const dev = f.currency;
  const numero = numeroFacture(f.number, reg["facture.prefixe"] || "INV");

  return (
    <div className="fac" ref={ref}>
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
  );
});

export default FactureRendu;
