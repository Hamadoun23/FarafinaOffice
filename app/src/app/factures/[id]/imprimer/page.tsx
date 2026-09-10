"use client";

/**
 * Facture imprimable — la mise en pages du modele fourni par la maison.
 *
 * Impression : pas de bibliotheque, le navigateur produit le PDF
 * (Imprimer, puis « Enregistrer au format PDF »).
 *
 * Envoi par email/WhatsApp : la, il faut un vrai fichier PDF en main (pas
 * un lien vers cet ecran d'administration, que le client ne peut pas
 * ouvrir) — html2canvas + jsPDF rejouent le rendu de la facture pour
 * produire ce fichier, telecharge avant l'ouverture du message.
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
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
  const [menuEnvoi, setMenuEnvoi] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState<"email" | "whatsapp" | null>(null);
  const [avisPdf, setAvisPdf] = useState(false);
  const envoiRef = useRef<HTMLDivElement>(null);
  const facRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menuEnvoi) return;
    const surClicExterne = (e: MouseEvent) => {
      if (envoiRef.current && !envoiRef.current.contains(e.target as Node)) setMenuEnvoi(false);
    };
    document.addEventListener("mousedown", surClicExterne);
    return () => document.removeEventListener("mousedown", surClicExterne);
  }, [menuEnvoi]);

  useEffect(() => {
    if (!avisPdf) return;
    const t = setTimeout(() => setAvisPdf(false), 6000);
    return () => clearTimeout(t);
  }, [avisPdf]);

  if (etat === "chargement") return <div className="fac__vide">Chargement…</div>;
  if (etat === "absente" || !f) return <div className="fac__vide">Cette facture n&apos;existe pas.</div>;

  const total = totalFacture(lignes);
  const solde = soldeFacture(total, f.paid_amount, f.status);
  const dev = f.currency;
  const numero = numeroFacture(f.number, reg["facture.prefixe"] || "INV");
  const nomSociete = reg["societe.nom"] || "FARAFINATIGNE";
  const messageEnvoi =
    `Bonjour ${f.bill_to},\n\n` +
    `Veuillez trouver ci-joint votre facture ${numero} du ${dateFr(f.issue_date)}, ` +
    `d'un montant de ${dev} ${montant(total, dev)}` +
    `${solde > 0 ? ` (solde du : ${dev} ${montant(solde, dev)})` : ""}.\n\n` +
    `N'hesitez pas a nous contacter pour toute question.\n\n` +
    `Merci de votre confiance,\n${nomSociete}`;

  /**
   * Rejoue le rendu de la facture dans un PDF telechargeable — le client
   * recoit un vrai document, jamais un lien vers cet ecran d'admin qu'il
   * ne peut pas ouvrir.
   */
  const TAILLE_MAX_PDF = 2 * 1024 * 1024;

  const genererPdf = async () => {
    const noeud = facRef.current;
    if (!noeud) return null;
    const canvas = await html2canvas(noeud, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const largeurPage = 210;
    const hauteurPage = 297;
    const largeurImg = largeurPage;
    const hauteurImg = (canvas.height * largeurImg) / canvas.width;

    // JPEG plutot que PNG : une facture (fond blanc, texte net) ne perd
    // rien a l'oeil meme compressee, et le fichier passe de plusieurs Mo
    // a quelques centaines de ko — important pour un envoi par email ou
    // WhatsApp. On redescend la qualite si besoin pour rester sous 2 Mo,
    // meme pour une facture a beaucoup de lignes (plusieurs pages).
    const construire = (qualite: number) => {
      const imgData = canvas.toDataURL("image/jpeg", qualite);
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      let restant = hauteurImg;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, largeurImg, hauteurImg);
      restant -= hauteurPage;
      while (restant > 0) {
        position -= hauteurPage;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, largeurImg, hauteurImg);
        restant -= hauteurPage;
      }
      return pdf;
    };

    let qualite = 0.92;
    let pdf = construire(qualite);
    let blob: Blob = pdf.output("blob");
    while (blob.size > TAILLE_MAX_PDF && qualite > 0.3) {
      qualite -= 0.15;
      pdf = construire(qualite);
      blob = pdf.output("blob");
    }

    const nomFichier = `Facture-${numero}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return nomFichier;
  };

  const envoyerParEmail = async () => {
    if (!f.bill_email || envoiEnCours) return;
    setMenuEnvoi(false);
    setEnvoiEnCours("email");
    try {
      const ok = await genererPdf();
      if (!ok) return;
      setAvisPdf(true);
      const sujet = `Facture ${numero} — ${nomSociete}`;
      window.location.href = `mailto:${f.bill_email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(messageEnvoi)}`;
    } catch {
      window.alert("La generation du PDF a echoue. Reessayez, ou utilisez « Imprimer / enregistrer en PDF ».");
    } finally {
      setEnvoiEnCours(null);
    }
  };

  const envoyerParWhatsapp = async () => {
    const tel = (f.bill_phone || "").replace(/[^\d]/g, "");
    if (!tel || envoiEnCours) return;
    setMenuEnvoi(false);
    setEnvoiEnCours("whatsapp");
    try {
      const ok = await genererPdf();
      if (!ok) return;
      setAvisPdf(true);
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(messageEnvoi)}`, "_blank", "noopener,noreferrer");
    } catch {
      window.alert("La generation du PDF a echoue. Reessayez, ou utilisez « Imprimer / enregistrer en PDF ».");
    } finally {
      setEnvoiEnCours(null);
    }
  };

  return (
    <>
      <div className="fac__barre">
        <a className="btn" href="/factures">← Retour aux factures</a>
        <div className="fac__actions">
          {avisPdf && <span className="fac__envoi-avis">PDF telecharge — a joindre au message.</span>}
          <div className="fac__envoi" ref={envoiRef}>
            <button className="btn" onClick={() => setMenuEnvoi((v) => !v)} disabled={!!envoiEnCours}>
              {envoiEnCours ? "Generation du PDF…" : "Envoyer ▾"}
            </button>
            {menuEnvoi && (
              <div className="fac__envoi-menu">
                <button className="fac__envoi-opt" onClick={envoyerParEmail} disabled={!f.bill_email}>
                  ✉ Par email{!f.bill_email && <i>aucune adresse</i>}
                </button>
                <button className="fac__envoi-opt" onClick={envoyerParWhatsapp} disabled={!f.bill_phone}>
                  💬 Par WhatsApp{!f.bill_phone && <i>aucun numero</i>}
                </button>
              </div>
            )}
          </div>
          <button className="btn btn--main" onClick={() => window.print()}>
            Imprimer / enregistrer en PDF
          </button>
        </div>
      </div>

      <div className="fac" ref={facRef}>
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
