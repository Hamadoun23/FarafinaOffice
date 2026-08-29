"use client";

/**
 * Acces aux donnees — une seule couche pour tous les ecrans.
 *
 * Chaque ecran se contente de declarer sa table et ses colonnes :
 * le chargement, le rafraichissement en direct, l'enregistrement,
 * la suppression et les messages sont faits ici.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { toast } from "@/components/ui";

/** Charge une table et la garde a jour (temps reel Supabase). */
export function useTable<T>(
  table: string,
  colonnes = "*",
  tri: { col: string; asc?: boolean } = { col: "created_at", asc: false }
) {
  const [items, setItems] = useState<T[]>([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select(colonnes)
      .order(tri.col, { ascending: tri.asc ?? true });
    if (error) toast("Lecture impossible : " + error.message, "err");
    setItems((data as T[]) ?? []);
    setChargement(false);
  }, [table, colonnes, tri.col, tri.asc]);

  useEffect(() => {
    charger();
    const canal = supabase
      .channel("live-" + table)
      .on("postgres_changes", { event: "*", schema: "public", table }, charger)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [charger, table]);

  return { items, chargement, charger, setItems };
}

/**
 * Cree ou met a jour une ligne.
 * `cle` vaut "id" partout sauf pour les textes du site, dont la cle est `key`.
 */
export async function enregistrer(
  table: string,
  valeurs: Record<string, unknown>,
  id?: string | null,
  cle = "id"
): Promise<boolean> {
  const { error } = id
    ? await supabase.from(table).update(valeurs).eq(cle, id)
    : await supabase.from(table).insert(valeurs);
  if (error) {
    toast(lisible(error.message), "err");
    return false;
  }
  toast(id ? "Modification enregistree." : "Ajout enregistre.");
  return true;
}

/** Supprime une ligne. */
export async function supprimer(
  table: string,
  id: string,
  cle = "id"
): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq(cle, id);
  if (error) {
    toast(lisible(error.message), "err");
    return false;
  }
  toast("Supprime.");
  return true;
}

/** Modification d'un seul champ, sans fenetre — pour les tableaux. */
export async function majChamp(
  table: string,
  id: string,
  champ: string,
  valeur: unknown,
  cle = "id"
): Promise<boolean> {
  const { error } = await supabase.from(table).update({ [champ]: valeur }).eq(cle, id);
  if (error) { toast(lisible(error.message), "err"); return false; }
  return true;
}

/**
 * Prepare une image avant envoi.
 *
 * Une photo prise au telephone pese 4 a 8 Mo et arrive parfois en HEIC,
 * que seul Safari sait lire. On la redessine donc dans un canvas et on
 * la renvoie en JPEG : format unique, poids divise par vingt, et plus
 * de « Load failed » sur une connexion lente. Si le navigateur n'y
 * arrive pas, on renvoie le fichier tel quel plutot que de bloquer.
 */
async function preparerImage(fichier: File, maxCote = 1600, qualite = 0.82): Promise<Blob> {
  if (/^image\/(svg|gif)/i.test(fichier.type)) return fichier;
  try {
    const source = await lireImage(fichier);
    const large = "width" in source ? source.width : 0;
    const haut = "height" in source ? source.height : 0;
    if (!large || !haut) return fichier;

    const ech = Math.min(1, maxCote / Math.max(large, haut));
    const c = document.createElement("canvas");
    c.width = Math.round(large * ech);
    c.height = Math.round(haut * ech);
    const ctx = c.getContext("2d");
    if (!ctx) return fichier;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(source as CanvasImageSource, 0, 0, c.width, c.height);
    if ("close" in source) (source as ImageBitmap).close();

    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", qualite));
    /* on ne garde la version preparee que si elle est vraiment plus legere */
    return blob && blob.size > 0 && blob.size < fichier.size ? blob : fichier;
  } catch {
    return fichier;
  }
}

/** createImageBitmap quand il existe, sinon un <img> — Safari ancien. */
function lireImage(fichier: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(fichier);
  }
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("image illisible")); };
    img.src = url;
  });
}

/**
 * Televerse une image dans le bucket public.
 * Le fichier est range comme en local : produits/<gamme>/<sous-gamme>/<nom>.
 *
 * Un echec reseau est reessaye une fois : sur une liaison instable, la
 * premiere tentative echoue souvent alors que la seconde passe.
 */
export async function televerser(
  fichier: File,
  dossier: string,
  base: string
): Promise<string | null> {
  if (!fichier.type.startsWith("image/")) {
    toast("Ce fichier n'est pas une image.", "err");
    return null;
  }

  const corps = await preparerImage(fichier);
  const jpeg = corps !== fichier || /jpe?g/i.test(fichier.type);
  const ext = jpeg ? "jpg" : (fichier.name.split(".").pop()?.toLowerCase() || "jpg");
  const propre = (base || "photo").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const chemin = `${dossier.replace(/^\/+|\/+$/g, "")}/${propre}-${Date.now()}.${ext}`;
  const type = corps instanceof File ? fichier.type : "image/jpeg";

  for (let essai = 1; essai <= 2; essai++) {
    const { error } = await supabase.storage
      .from("product-images")
      .upload(chemin, corps, { cacheControl: "31536000", upsert: true, contentType: type });
    if (!error) {
      return supabase.storage.from("product-images").getPublicUrl(chemin).data.publicUrl;
    }
    const reseau = /load failed|failed to fetch|network|timeout/i.test(error.message);
    if (!reseau || essai === 2) {
      toast(
        reseau
          ? "Envoi interrompu. Verifiez la connexion et reessayez."
          : "Televersement refuse : " + error.message,
        "err"
      );
      return null;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}

/** Prix effectivement paye, remise appliquee. */
export function prixRemise(
  prix: number | null | undefined,
  pourcent: number | null | undefined,
  jusquau?: string | null
): number | null {
  if (prix === null || prix === undefined) return null;
  if (!pourcent || pourcent <= 0) return Number(prix);
  if (jusquau && new Date(jusquau + "T23:59:59") < new Date()) return Number(prix);
  return Math.round(Number(prix) * (1 - pourcent / 100) * 100) / 100;
}

/** La promotion court-elle encore ? */
export const promoActive = (pourcent?: number | null, jusquau?: string | null) =>
  !!pourcent && pourcent > 0 && (!jusquau || new Date(jusquau + "T23:59:59") >= new Date());

/* ---------- petites aides d'affichage ---------- */

/** Traduit les erreurs Postgres les plus frequentes. */
function lisible(m: string): string {
  if (m.includes("duplicate key")) return "Cette valeur existe deja (reference ou e-mail en double).";
  if (m.includes("violates foreign key")) return "Element encore utilise ailleurs : detachez-le d'abord.";
  if (m.includes("null value")) return "Un champ obligatoire est vide.";
  if (m.includes("row-level security")) return "Droits insuffisants : reconnectez-vous.";
  return "Echec : " + m;
}

export const euros = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "sur demande"
    : Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/** Montant dans la devise de la facture (la boutique reste en euros). */
export const DEVISES = [
  { code: "USD", symbole: "$" },
  { code: "EUR", symbole: "€" },
  { code: "XOF", symbole: "FCFA" },
];

export function montant(n: number | null | undefined, devise = "USD") {
  /* Une devise vide (etat encore incertain le temps d'un rendu) ferait
     planter Intl.NumberFormat, qui n'accepte aucun code invalide : le
     parametre par defaut ci-dessus ne joue que sur `undefined`, pas sur
     une chaine vide, d'ou ce filet en plus. */
  const d = devise || "USD";
  const v = Number(n ?? 0);
  if (d === "XOF") return Math.round(v).toLocaleString("fr-FR") + " FCFA";
  /* Chaque devise s'ecrit dans sa langue : « $2,157.00 » pour un client
     a l'export, « 2 157,00 EUR » pour un europeen. */
  const langue = d === "USD" ? "en-US" : "fr-FR";
  return v.toLocaleString(langue, {
    style: "currency", currency: d,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export const jour = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** Fabrique un identifiant de lien a partir d'un nom. */
export const slugifier = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
