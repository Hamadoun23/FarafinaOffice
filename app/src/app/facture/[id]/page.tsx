"use client";

/**
 * Facture publique — page sans connexion, une par facture (l'id, un
 * uuid v4, fait office de jeton), envoyee au client par email/WhatsApp
 * depuis l'ecran d'administration.
 *
 * Elle ne lit pas les tables directement (RLS reserve invoices et
 * consorts a l'equipe connectee) mais passe par la fonction Postgres
 * `facture_publique`, qui ne renvoie qu'UNE facture, par id — jamais de
 * liste, jamais les autres reglages.
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Facture, numeroFacture } from "@/lib/facture";
import FactureRendu, { ClientFacture, LigneFacture } from "@/components/FactureRendu";
import { genererPdfFacture, telechargerBlob } from "@/lib/facturePdf";

export default function FacturePublique() {
  const { id } = useParams<{ id: string }>();
  const [f, setF] = useState<Facture | null>(null);
  const [lignes, setLignes] = useState<LigneFacture[]>([]);
  const [reg, setReg] = useState<Record<string, string>>({});
  const [client, setClient] = useState<ClientFacture>(null);
  const [etat, setEtat] = useState<"chargement" | "prete" | "absente">("chargement");
  const [enCours, setEnCours] = useState(false);
  const facRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("facture_publique", { p_id: id });
      if (error || !data || !data.facture) { setEtat("absente"); return; }
      setF(data.facture as Facture);
      setLignes((data.lignes as LigneFacture[]) ?? []);
      setReg((data.reglages as Record<string, string>) ?? {});
      setClient(data.client_reference ? { reference: data.client_reference as string } : null);
      setEtat("prete");
    })();
  }, [id]);

  useEffect(() => {
    if (f) document.title = `${numeroFacture(f.number, reg["facture.prefixe"] || "INV")} — ${reg["societe.nom"] || "FARAFINATIGNE"}`;
  }, [f, reg]);

  if (etat === "chargement") return <div className="fac__vide">Chargement…</div>;
  if (etat === "absente" || !f) return <div className="fac__vide">Cette facture n&apos;existe pas.</div>;

  const numero = numeroFacture(f.number, reg["facture.prefixe"] || "INV");

  const telecharger = async () => {
    if (!facRef.current || enCours) return;
    setEnCours(true);
    try {
      const { blob, nomFichier } = await genererPdfFacture(facRef.current, numero);
      telechargerBlob(blob, nomFichier);
    } catch {
      window.alert("La generation du PDF a echoue. Reessayez, ou utilisez Imprimer.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <div className="fac__barre">
        <span className="fac__marque">{reg["societe.nom"] || "FARAFINATIGNE"}</span>
        <div className="fac__actions">
          <button className="btn" onClick={() => window.print()}>Imprimer</button>
          <button className="btn btn--main" onClick={telecharger} disabled={enCours}>
            {enCours ? "Generation…" : "Telecharger en PDF"}
          </button>
        </div>
      </div>

      <FactureRendu ref={facRef} f={f} lignes={lignes} reg={reg} client={client} />
    </>
  );
}
