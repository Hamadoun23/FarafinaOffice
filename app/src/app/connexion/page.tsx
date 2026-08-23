"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* Les noms d'usage sont traduits en adresses internes : « Lefa » devient
   lefa@farafinatigne.com. Aucune requête préalable, aucune liste de noms
   exposée — la correspondance est une simple règle d'écriture. */
const DOMAINE = "farafinatigne.com";

export default function Connexion() {
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    /* Trois facons de se presenter, parce qu'on ne retient pas tous la
       meme chose : le nom d'usage (« Lefa »), le numero de telephone
       (avec ou sans indicatif), ou l'adresse e-mail. Le nom d'usage est
       traduit en adresse interne, sans aller interroger la base. */
    const saisi = identifiant.trim();
    const chiffres = saisi.replace(/[^\d]/g, "");

    let creds: { email: string; password: string } | { phone: string; password: string };
    if (saisi.includes("@")) {
      creds = { email: saisi, password: motDePasse };
    } else if (chiffres.length >= 8) {
      const phone = chiffres.startsWith("223") ? chiffres : "223" + chiffres;
      creds = { phone, password: motDePasse };
    } else {
      creds = { email: saisi.toLowerCase() + "@" + DOMAINE, password: motDePasse };
    }

    const { error } = await supabase.auth.signInWithPassword(creds);
    setEnvoi(false);
    if (error) {
      // message générique : on n'indique pas lequel des deux est faux
      setErreur("Identifiant ou mot de passe incorrect.");
      return;
    }
    router.replace("/");
  }

  return (
    <div className="login">
      <form className="login__box" onSubmit={soumettre}>
        <h1>FarafinaOffice</h1>
        <p>Espace réservé à l&apos;équipe de Farafinatignɛ.</p>

        {erreur && <div className="msg msg--err">{erreur}</div>}

        <div className="field">
          <label htmlFor="email">Nom d&apos;utilisateur, numéro ou e-mail</label>
          <input
            id="email"
            type="text"
            inputMode="tel"
            autoComplete="username"
            placeholder="Lefa, ou 76 87 06 95"
            required
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="mdp">Mot de passe</label>
          <input
            id="mdp"
            type="password"
            autoComplete="current-password"
            required
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </div>

        <button className="btn btn--main" style={{ width: "100%" }} disabled={envoi}>
          {envoi ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
