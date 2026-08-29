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

export type TypeRemise = "percent" | "amount";

export type LigneFacture = {
  id?: string; product_id: string | null; description: string;
  rate: number; qty: number; discount: number; discount_type: TypeRemise; position: number;
};

export const STATUTS_FACTURE = [
  { v: "brouillon", l: "Brouillon", t: "mute" },
  { v: "envoyee", l: "Envoyee", t: "info" },
  { v: "partielle", l: "Partiellement payee", t: "warn" },
  { v: "payee", l: "Payee", t: "ok" },
  { v: "annulee", l: "Annulee", t: "err" },
];

export const statutFacture = (v: string) => STATUTS_FACTURE.find((s) => s.v === v);

type LigneChiffree = { rate: number; qty: number; discount: number; discount_type?: TypeRemise };

/**
 * Remise en valeur, telle qu'elle s'affiche dans la colonne DISCOUNT.
 * En pourcentage (le cas historique) elle se calcule sur le brut ; en
 * montant, la saisie de l'admin est la valeur elle-meme — plafonnee au
 * brut de la ligne, une remise ne peut pas rendre un montant negatif.
 */
export function remiseLigne(l: LigneChiffree): number {
  const brut = Number(l.rate) * Number(l.qty);
  if (l.discount_type === "amount") {
    return Math.round(Math.min(Math.max(0, Number(l.discount || 0)), brut) * 100) / 100;
  }
  return Math.round(brut * Number(l.discount || 0) / 100 * 100) / 100;
}

/** Montant d'une ligne, remise deduite. */
export const totalLigne = (l: LigneChiffree) =>
  Math.round((Number(l.rate) * Number(l.qty) - remiseLigne(l)) * 100) / 100;

export const totalFacture = (lignes: LigneChiffree[]) =>
  Math.round(lignes.reduce((s, l) => s + totalLigne(l), 0) * 100) / 100;

/**
 * Solde du : le total moins ce qui est deja regle, jamais negatif.
 * Une facture au statut « payee » est a solde nul par definition, meme
 * si le montant regle saisi n'a pas ete corrige au centime pres.
 */
export function soldeFacture(total: number, paidAmount: number, statut: string): number {
  if (statut === "payee") return 0;
  return Math.max(0, Math.round((total - Number(paidAmount || 0)) * 100) / 100);
}

/** Numero lisible : le prefixe des reglages, puis quatre chiffres. */
export const numeroFacture = (n: number, prefixe = "INV") =>
  prefixe + String(n).padStart(4, "0");

/**
 * Conversion en FCFA, pour le chiffre d'affaires cumule des Rapports.
 *
 * Le franc CFA ouest-africain est arrime a l'euro par traite : 1 EUR =
 * 655,957 XOF, un taux fixe depuis 1999, pas une estimation. Le dollar
 * flotte : son taux vient des Reglages (`taux.usd_xof`), a mettre a jour
 * par l'equipe. Sans ce taux renseigne, on n'invente rien — la conversion
 * de cette devise est simplement ignoree par l'appelant.
 */
export const EUR_VERS_XOF = 655.957;

export function versXOF(montant: number, devise: string, tauxUsdXof: number): number | null {
  if (devise === "XOF") return montant;
  if (devise === "EUR") return Math.round(montant * EUR_VERS_XOF);
  if (devise === "USD") return tauxUsdXof > 0 ? Math.round(montant * tauxUsdXof) : null;
  return null;
}
