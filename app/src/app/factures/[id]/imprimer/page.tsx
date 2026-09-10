"use client";

/**
 * Facture imprimable (ecran d'administration) — impression papier, et
 * envoi au client par email/WhatsApp.
 *
 * L'envoi partage un lien vers /facture/[id] : une page publique, sans
 * connexion, qui n'existe que pour cette facture (voir ce dossier).
 * Jamais un lien vers cet ecran-ci, que le client ne peut pas ouvrir.
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { montant } from "@/lib/db";
import { Facture, numeroFacture, soldeFacture, totalFacture } from "@/lib/facture";
import FactureRendu, { ClientFacture, dateFr, LigneFacture } from "@/components/FactureRendu";

type Ligne = LigneFacture;
type Client = ClientFacture;

export default function Imprimer() {
  const { id } = useParams<{ id: string }>();
  const [f, setF] = useState<Facture | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [reg, setReg] = useState<Record<string, string>>({});
  const [client, setClient] = useState<Client>(null);
  const [etat, setEtat] = useState<"chargement" | "prete" | "absente">("chargement");
  const [menuEnvoi, setMenuEnvoi] = useState(false);
  const envoiRef = useRef<HTMLDivElement>(null);

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
        setClient(data as Client);
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

  if (etat === "chargement") return <div className="fac__vide">Chargement…</div>;
  if (etat === "absente" || !f) return <div className="fac__vide">Cette facture n&apos;existe pas.</div>;

  const total = totalFacture(lignes);
  const solde = soldeFacture(total, f.paid_amount, f.status);
  const dev = f.currency;
  const numero = numeroFacture(f.number, reg["facture.prefixe"] || "INV");
  const nomSociete = reg["societe.nom"] || "FARAFINATIGNE";
  const urlPublique = typeof window !== "undefined" ? `${window.location.origin}/facture/${f.id}` : "";
  const messageEnvoi =
    `Bonjour ${f.bill_to},\n\n` +
    `Voici votre facture ${numero} du ${dateFr(f.issue_date)}, d'un montant de ${dev} ${montant(total, dev)}` +
    `${solde > 0 ? ` (solde du : ${dev} ${montant(solde, dev)})` : ""}.\n` +
    `Vous pouvez la consulter et la telecharger ici :\n${urlPublique}\n\n` +
    `N'hesitez pas a nous contacter pour toute question.\n\n` +
    `Merci de votre confiance,\n${nomSociete}`;

  const envoyerParEmail = () => {
    if (!f.bill_email) return;
    setMenuEnvoi(false);
    const sujet = `Facture ${numero} — ${nomSociete}`;
    window.location.href = `mailto:${f.bill_email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(messageEnvoi)}`;
  };

  const envoyerParWhatsapp = () => {
    const tel = (f.bill_phone || "").replace(/[^\d]/g, "");
    if (!tel) return;
    setMenuEnvoi(false);
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(messageEnvoi)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="fac__barre">
        <a className="btn" href="/factures">← Retour aux factures</a>
        <div className="fac__actions">
          <div className="fac__envoi" ref={envoiRef}>
            <button className="btn" onClick={() => setMenuEnvoi((v) => !v)}>
              Envoyer ▾
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

      <FactureRendu f={f} lignes={lignes} reg={reg} client={client} />
    </>
  );
}
