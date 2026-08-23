/**
 * Le vocabulaire de la facture, partage par l'ecran de saisie et par la
 * vue imprimable. Un fichier de page Next ne peut rien exporter d'autre
 * que son composant : ces definitions vivent donc a part.
 */

export type Facture = {
  id: string; number: number; customer_id: string | null; order_id: string | null;
  bill_to: string; bill_phone: string | null; bill_email: string | null; bill_address: string | null;
  issue_date: string; due_date: string | null; currency: string; status: string;
  paid_amount: number; note: string; created_at: string;
};

export type LigneFacture = {
  id?: string; product_id: string | null; description: string;
  rate: number; qty: number; discount: number; position: number;
};

export const STATUTS_FACTURE = [
  { v: "brouillon", l: "Brouillon", t: "mute" },
  { v: "envoyee", l: "Envoyee", t: "info" },
  { v: "partielle", l: "Partiellement payee", t: "warn" },
  { v: "payee", l: "Payee", t: "ok" },
  { v: "annulee", l: "Annulee", t: "err" },
];

export const statutFacture = (v: string) => STATUTS_FACTURE.find((s) => s.v === v);

/** Montant d'une ligne, remise deduite. */
export const totalLigne = (l: { rate: number; qty: number; discount: number }) =>
  Math.round(Number(l.rate) * Number(l.qty) * (1 - Number(l.discount || 0) / 100) * 100) / 100;

/** Remise en valeur, telle qu'elle s'affiche dans la colonne DISCOUNT. */
export const remiseLigne = (l: { rate: number; qty: number; discount: number }) =>
  Math.round(Number(l.rate) * Number(l.qty) * Number(l.discount || 0) / 100 * 100) / 100;

export const totalFacture = (lignes: { rate: number; qty: number; discount: number }[]) =>
  Math.round(lignes.reduce((s, l) => s + totalLigne(l), 0) * 100) / 100;

/** Numero lisible : le prefixe des reglages, puis quatre chiffres. */
export const numeroFacture = (n: number, prefixe = "INV") =>
  prefixe + String(n).padStart(4, "0");
