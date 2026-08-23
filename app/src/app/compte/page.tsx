"use client";

/**
 * Mon compte — changement de mot de passe.
 *
 * Les comptes sont créés par l'administrateur avec un mot de passe
 * provisoire et l'indicateur `must_change_password`. Tant qu'il est là,
 * la coquille renvoie ici : impossible d'utiliser le back-office sans
 * avoir choisi son propre mot de passe.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";

export default function Compte() {
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [obligatoire, setObligatoire] = useState(false);
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [etat, setEtat] = useState<{ type: "ok" | "err"; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata ?? {};
      const contact = u.phone ? "+223 " + u.phone.replace(/^223/, "") : u.email ?? "";
      const nom = (meta.name as string) || (meta.full_name as string) || "";
      setIdentifiant(nom ? `${nom} · ${contact}` : contact);
      setObligatoire(u.user_metadata?.must_change_password === true);
    });
  }, []);

  async function changer(e: React.FormEvent) {
    e.preventDefault();
    setEtat(null);

    if (mdp.length < 8) {
      setEtat({ type: "err", texte: "Choisissez au moins 8 caractères." });
      return;
    }
    if (mdp === "12345") {
      setEtat({ type: "err", texte: "Ce mot de passe est celui fourni par défaut : choisissez-en un autre." });
      return;
    }
    if (mdp !== confirmation) {
      setEtat({ type: "err", texte: "Les deux saisies ne correspondent pas." });
      return;
    }

    setEnvoi(true);
    const { error } = await supabase.auth.updateUser({
      password: mdp,
      data: { must_change_password: false },
    });
    setEnvoi(false);

    if (error) {
      setEtat({ type: "err", texte: "Échec : " + error.message });
      return;
    }
    setEtat({ type: "ok", texte: "Mot de passe modifié." });
    setMdp("");
    setConfirmation("");
    setObligatoire(false);
    setTimeout(() => router.replace("/"), 1200);
  }

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Mon compte</h1>
          <p>Connecté en tant que {identifiant}</p>
        </div>
      </div>

      {obligatoire && (
        <div className="msg msg--err" style={{ maxWidth: 520 }}>
          Vous utilisez encore le mot de passe provisoire. Choisissez-en un
          personnel avant de continuer.
        </div>
      )}

      <form className="card-box" style={{ maxWidth: 520 }} onSubmit={changer}>
        <h2 style={{ fontSize: "1rem", marginBottom: 16 }}>Changer mon mot de passe</h2>

        {etat && <div className={`msg msg--${etat.type === "ok" ? "ok" : "err"}`}>{etat.texte}</div>}

        <div className="field">
          <label htmlFor="mdp">Nouveau mot de passe</label>
          <input
            id="mdp"
            type="password"
            autoComplete="new-password"
            required
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="conf">Confirmer</label>
          <input
            id="conf"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>

        <button className="btn btn--main" disabled={envoi}>
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </Shell>
  );
}
