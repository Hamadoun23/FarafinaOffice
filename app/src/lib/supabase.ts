/**
 * Accès à Supabase depuis le navigateur.
 *
 * Le back-office n'utilise QUE la clé publique : c'est la session de
 * l'utilisateur connecté qui lui ouvre les droits d'écriture, via les
 * politiques de sécurité par ligne (« for all to authenticated »).
 * La clé service_role n'apparaît nulle part dans ce code : elle serait
 * lisible par n'importe qui dans le navigateur.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anon) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis — " +
      "copier .env.example vers .env.local"
  );
}

export const supabase = createBrowserClient(url, anon);

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:5510";
