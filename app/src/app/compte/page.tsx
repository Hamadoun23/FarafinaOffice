"use client";

/**
 * Mon compte — profil et mot de passe.
 *
 * Les comptes sont crees par l'administrateur avec un mot de passe
 * provisoire et l'indicateur `must_change_password`. Tant qu'il est la,
 * la coquille renvoie ici : impossible d'utiliser le back-office sans
 * avoir choisi son propre mot de passe.
 *
 * Le reste du profil se modifie aussi d'ici : le nom affiche et le
 * numero de telephone, qui prennent effet immediatement.
 *
 * L'ADRESSE, elle, n'est pas modifiable ici. GoTrue met tout changement
 * d'adresse demande depuis une session en attente de confirmation, meme
 * avec MAILER_AUTOCONFIRM : sans envoi d'e-mails branche, le message ne
 * partirait jamais et l'utilisateur croirait son identifiant change
 * alors qu'il ne l'est pas. Le numero, lui, s'applique d'office
 * (SMS_AUTOCONFIRM) — verifie.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { Champ, toast } from "@/components/ui";
import { supabase } from "@/lib/supabase";

/** Domaine des adresses internes, celles qui servent de nom d'utilisateur. */
const DOMAINE = "farafinatigne.com";

const nettoyerNom = (s: string) => s.trim().replace(/[^A-Za-z0-9._-]/g, "");

export default function Compte() {
  const router = useRouter();

  const [obligatoire, setObligatoire] = useState(false);
  const [charge, setCharge] = useState(false);

  /* profil */
  const [nom, setNom] = useState("");
  const [nomInitial, setNomInitial] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [aliasInterne, setAliasInterne] = useState(false);
  const [enregistre, setEnregistre] = useState(false);

  /* mot de passe */
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [etat, setEtat] = useState<{ type: "ok" | "err"; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata ?? {};
      const adresse = u.email ?? "";
      /* une adresse en @farafinatigne.com n'est pas une vraie boite : c'est
         l'alias qui permet de se connecter par son nom d'utilisateur */
      const interne = adresse.endsWith("@" + DOMAINE);
      const dedans = interne ? adresse.split("@")[0] : "";
      const affiche = (meta.name as string) || (meta.full_name as string) || dedans;

      setNom(affiche);
      setNomInitial(affiche);
      setEmail(adresse);
      setAliasInterne(interne);
      setTel(u.phone ? u.phone.replace(/^223/, "") : "");
      setObligatoire(meta.must_change_password === true);
      setCharge(true);
    });
  }, []);

  /* ---------- profil ---------- */
  async function enregistrerProfil(e: React.FormEvent) {
    e.preventDefault();
    const propre = nettoyerNom(nom);
    if (propre.length < 2) return toast("Le nom d'utilisateur fait au moins deux caracteres.", "err");

    setEnregistre(true);
    const patch: Parameters<typeof supabase.auth.updateUser>[0] = {
      data: { name: propre },
    };

    const chiffres = tel.replace(/[^\d]/g, "");
    if (chiffres) {
      const complet = chiffres.startsWith("223") ? chiffres : "223" + chiffres;
      patch.phone = complet;
    }

    const { data, error } = await supabase.auth.updateUser(patch);
    setEnregistre(false);
    if (error) return toast(lisible(error.message), "err");

    setNomInitial(propre);
    if (data.user?.phone) setTel(data.user.phone.replace(/^223/, ""));
    toast("Profil enregistre.");
  }

  /* ---------- mot de passe ---------- */
  async function changerMdp(e: React.FormEvent) {
    e.preventDefault();
    setEtat(null);

    if (mdp.length < 8) return setEtat({ type: "err", texte: "Choisissez au moins 8 caracteres." });
    if (mdp === "12345") return setEtat({ type: "err", texte: "C'est le mot de passe fourni par defaut : choisissez-en un autre." });
    if (mdp !== confirmation) return setEtat({ type: "err", texte: "Les deux saisies ne correspondent pas." });

    setEnvoi(true);
    const { error } = await supabase.auth.updateUser({
      password: mdp,
      data: { must_change_password: false },
    });
    setEnvoi(false);

    if (error) return setEtat({ type: "err", texte: lisible(error.message) });

    setEtat({ type: "ok", texte: "Mot de passe modifie." });
    setMdp("");
    setConfirmation("");
    if (obligatoire) {
      setObligatoire(false);
      setTimeout(() => router.replace("/"), 1200);
    }
  }

  const identifiantNom = aliasInterne ? email.split("@")[0] : "";

  const identifiants = [
    identifiantNom || null,
    tel ? "+223 " + tel : null,
    email || null,
  ].filter(Boolean) as string[];

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Mon compte</h1>
          <p>Votre profil et votre mot de passe.</p>
        </div>
      </div>

      {obligatoire && (
        <div className="msg msg--err" style={{ maxWidth: 620 }}>
          Vous utilisez encore le mot de passe provisoire. Choisissez-en un personnel
          avant de continuer.
        </div>
      )}

      <div className="grid grid--2" style={{ alignItems: "start", maxWidth: 900 }}>

        {/* ---------- profil ---------- */}
        <form className="card card--pad" onSubmit={enregistrerProfil}>
          <div className="section-t">Profil</div>

          <Champ
            label="Nom affiche"
            aide="Ce que l'application affiche de vous, en haut de la barre laterale."
          >
            <input value={nom} onChange={(e) => setNom(e.target.value)}
                   autoComplete="name" disabled={!charge} />
          </Champ>

          <Champ label="Telephone" aide="Sert aussi a vous connecter. Indicatif +223 ajoute tout seul.">
            <input value={tel} onChange={(e) => setTel(e.target.value)}
                   inputMode="tel" autoComplete="tel" disabled={!charge} placeholder="00 00 00 00" />
          </Champ>

          <Champ
            label="Adresse e-mail"
            aide={aliasInterne
              ? "Elle sert d'identifiant : « " + identifiantNom + " » suffit pour se connecter. Pour la changer, passez par l'administrateur."
              : "Votre adresse personnelle. Pour la changer, passez par l'administrateur."}
          >
            <input value={email} disabled readOnly />
          </Champ>

          <button className="btn btn--main" disabled={enregistre || !charge}>
            {enregistre ? "Enregistrement…" : "Enregistrer le profil"}
          </button>

          {identifiants.length > 0 && (
            <p className="sub" style={{ marginTop: 14 }}>
              Vous pouvez vous connecter avec&nbsp;: {identifiants.join(" · ")}
            </p>
          )}
        </form>

        {/* ---------- mot de passe ---------- */}
        <form className="card card--pad" onSubmit={changerMdp}>
          <div className="section-t">Mot de passe</div>

          {etat && <div className={`msg msg--${etat.type === "ok" ? "ok" : "err"}`}>{etat.texte}</div>}

          <Champ label="Nouveau mot de passe" aide="Huit caracteres au minimum.">
            <input type="password" autoComplete="new-password" required
                   value={mdp} onChange={(e) => setMdp(e.target.value)} />
          </Champ>

          <Champ label="Confirmer">
            <input type="password" autoComplete="new-password" required
                   value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </Champ>

          <button className="btn btn--main" disabled={envoi}>
            {envoi ? "Enregistrement…" : "Changer le mot de passe"}
          </button>

          <p className="sub" style={{ marginTop: 14 }}>
            Personne d&apos;autre ne le connait, pas meme l&apos;administrateur.
          </p>
        </form>
      </div>
    </Shell>
  );
}

/** Traduit les refus de GoTrue les plus frequents. */
function lisible(m: string): string {
  if (/already registered|already exists/i.test(m)) return "Ce nom d'utilisateur est deja pris.";
  if (/phone/i.test(m) && /invalid/i.test(m)) return "Numero de telephone illisible.";
  if (/password/i.test(m) && /short|least/i.test(m)) return "Mot de passe trop court.";
  if (/same.*password/i.test(m)) return "C'est deja votre mot de passe actuel.";
  return "Echec : " + m;
}
