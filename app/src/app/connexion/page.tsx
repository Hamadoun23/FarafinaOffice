"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
    /* On accepte un numéro de téléphone ou une adresse e-mail.
       Un numéro malien saisi sans indicatif reçoit le +223. */
    const saisi = identifiant.trim();
    const chiffres = saisi.replace(/[^\d]/g, "");
    const estNumero = !saisi.includes("@") && chiffres.length >= 8;
    const phone = chiffres.startsWith("223") ? chiffres : "223" + chiffres;

    const { error } = await supabase.auth.signInWithPassword(
      estNumero ? { phone, password: motDePasse } : { email: saisi, password: motDePasse }
    );
    setEnvoi(false);
    if (error) {
      // message générique : on n'indique pas si c'est l'adresse ou le mot de passe
      setErreur("Numéro ou mot de passe incorrect.");
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
          <label htmlFor="email">Numéro de téléphone</label>
          <input
            id="email"
            type="text"
            inputMode="tel"
            autoComplete="username"
            placeholder="83 75 70 33"
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
