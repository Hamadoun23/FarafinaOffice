/**
 * Inventaire des photos du site, relaye par le back-office.
 *
 * Le site et le back-office vivent sur deux sous-domaines : un fetch
 * direct depuis le navigateur serait refuse faute d'en-tete CORS. La
 * requete part donc du serveur, ou cette regle ne s'applique pas — et
 * cela evite d'ouvrir le site aux requetes croisees pour un seul
 * fichier.
 */
import { NextResponse } from "next/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:5510";

export const revalidate = 60;   // l'inventaire bouge rarement

export async function GET() {
  try {
    const r = await fetch(`${SITE}/assets/manifest.json`, { next: { revalidate: 60 } });
    if (!r.ok) {
      return NextResponse.json(
        { erreur: `Le site a repondu ${r.status}. Lancez « node tools/build-manifest.mjs » dans le dossier du site.` },
        { status: 502 }
      );
    }
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json(
      { erreur: `Site injoignable (${SITE}).` },
      { status: 502 }
    );
  }
}
