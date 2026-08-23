"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { Champ, Confirm, Ico, Modal, Chargement, Vide, toast } from "@/components/ui";
import { enregistrer, jour, supprimer, useTable } from "@/lib/db";

type Client = {
  id: string; name: string; company: string | null; email: string | null;
  phone: string | null; country: string | null; lang: string; source: string;
  notes: string; created_at: string;
};
type Prospect = {
  id: string; name: string; email: string; company: string | null;
  country: string | null; lang: string; created_at: string;
};

const SOURCES = [
  { v: "contact", l: "Formulaire de contact" },
  { v: "catalogue", l: "Telechargement du catalogue" },
  { v: "devis", l: "Demande de devis" },
  { v: "salon", l: "Salon / rencontre" },
  { v: "direct", l: "Saisi par l'equipe" },
];

const VIDE = (): Partial<Client> => ({
  name: "", company: "", email: "", phone: "", country: "", lang: "fr",
  source: "direct", notes: "",
});

export default function Clients() {
  const cli = useTable<Client>("customers");
  const pro = useTable<Prospect>("leads");

  const [onglet, setOnglet] = useState<"clients" | "prospects">("clients");
  const [q, setQ] = useState("");
  const [edite, setEdite] = useState<Partial<Client> | null>(null);
  const [aSupprimer, setASupprimer] = useState<{ table: string; id: string; nom: string } | null>(null);

  const t = q.trim().toLowerCase();
  const vusCli = cli.items.filter((c) =>
    !t || [c.name, c.company, c.email, c.country].join(" ").toLowerCase().includes(t));
  const vusPro = pro.items.filter((p) =>
    !t || [p.name, p.company, p.email, p.country].join(" ").toLowerCase().includes(t));

  /** Un prospect du catalogue PDF devient une fiche client. */
  async function convertir(p: Prospect) {
    const ok = await enregistrer("customers", {
      name: p.name, company: p.company, email: p.email,
      country: p.country, lang: p.lang, source: "catalogue",
      notes: "Issu du telechargement du catalogue le " + jour(p.created_at),
    });
    if (ok) { toast("Fiche client creee."); cli.charger(); }
  }

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Clients</h1>
          <p>{cli.items.length} fiches · {pro.items.length} prospects issus du catalogue</p>
        </div>
        <div className="head__act">
          <div className="search">
            <Ico n="search" s={16} />
            <input placeholder="Nom, societe, e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn btn--main" onClick={() => setEdite(VIDE())}>
            <Ico n="plus" s={16} /> Ajouter
          </button>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${onglet === "clients" ? "on" : ""}`} onClick={() => setOnglet("clients")}>
          Clients ({cli.items.length})
        </button>
        <button className={`chip ${onglet === "prospects" ? "on" : ""}`} onClick={() => setOnglet("prospects")}>
          Prospects ({pro.items.length})
        </button>
      </div>

      <div className="card">
        <div className="tw">
          {onglet === "clients" ? (
            cli.chargement ? <Chargement /> :
            vusCli.length === 0 ? (
              <Vide titre="Aucun client" texte="Les fiches arrivent du formulaire de contact, du catalogue PDF et des demandes de devis — ou saisissez-les a la main."
                    action={<button className="btn btn--main" onClick={() => setEdite(VIDE())}>Ajouter un client</button>} />
            ) : (
              <table>
                <thead>
                  <tr><th>Nom</th><th>Societe</th><th>Contact</th><th>Pays</th><th>Origine</th><th style={{ width: 90 }}></th></tr>
                </thead>
                <tbody>
                  {vusCli.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <div className="sub">Depuis le {jour(c.created_at)}</div>
                      </td>
                      <td>{c.company || "—"}</td>
                      <td>
                        {c.email ? <a href={`mailto:${c.email}`} style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{c.email}</a> : "—"}
                        {c.phone && <div className="sub">{c.phone}</div>}
                      </td>
                      <td>{c.country || "—"}</td>
                      <td><span className="tag tag--mute">{c.source}</span></td>
                      <td>
                        <div className="acts">
                          <button className="btn btn--ghost btn--icon" title="Modifier"
                                  onClick={() => setEdite(c)}><Ico n="pen" s={16} /></button>
                          <button className="btn btn--ghost btn--icon" title="Supprimer"
                                  onClick={() => setASupprimer({ table: "customers", id: c.id, nom: c.name })}>
                            <Ico n="trash" s={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            pro.chargement ? <Chargement /> :
            vusPro.length === 0 ? (
              <Vide titre="Aucun prospect" texte="Ils apparaissent des qu'un visiteur telecharge le catalogue PDF depuis le site." />
            ) : (
              <table>
                <thead>
                  <tr><th>Nom</th><th>Societe</th><th>E-mail</th><th>Pays</th><th>Recu le</th><th style={{ width: 150 }}></th></tr>
                </thead>
                <tbody>
                  {vusPro.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.company || "—"}</td>
                      <td><a href={`mailto:${p.email}`} style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{p.email}</a></td>
                      <td>{p.country || "—"}</td>
                      <td className="sub">{jour(p.created_at)}</td>
                      <td>
                        <div className="acts">
                          <button className="btn btn--sm" onClick={() => convertir(p)}>
                            <Ico n="plus" s={14} /> En client
                          </button>
                          <button className="btn btn--ghost btn--icon" title="Supprimer"
                                  onClick={() => setASupprimer({ table: "leads", id: p.id, nom: p.name })}>
                            <Ico n="trash" s={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {edite && (
        <Fiche valeur={edite} onClose={() => setEdite(null)}
               onSaved={() => { setEdite(null); cli.charger(); }} />
      )}

      {aSupprimer && (
        <Confirm
          titre={`Supprimer « ${aSupprimer.nom} » ?`}
          texte="La fiche est retiree definitivement. Les commandes deja enregistrees restent, sans client rattache."
          onCancel={() => setASupprimer(null)}
          onOk={async () => {
            if (await supprimer(aSupprimer.table, aSupprimer.id)) { cli.charger(); pro.charger(); }
            setASupprimer(null);
          }}
        />
      )}
    </Shell>
  );
}

function Fiche({ valeur, onClose, onSaved }: {
  valeur: Partial<Client>; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Client>>({ ...valeur });
  const [envoi, setEnvoi] = useState(false);
  const set = (k: keyof Client, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      titre={valeur.id ? f.name || "Modifier le client" : "Nouveau client"}
      sous={valeur.id ? "Fiche client" : "Saisie manuelle — utile apres un salon ou un appel."}
      onClose={onClose}
      pied={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" disabled={envoi} onClick={async () => {
            if (!f.name?.trim()) return toast("Le nom est obligatoire.", "err");
            setEnvoi(true);
            const ok = await enregistrer("customers", {
              name: f.name.trim(),
              company: f.company || null,
              email: f.email?.trim() || null,
              phone: f.phone || null,
              country: f.country || null,
              lang: f.lang || "fr",
              source: f.source || "direct",
              notes: f.notes ?? "",
            }, valeur.id ?? null);
            setEnvoi(false);
            if (ok) onSaved();
          }}>{envoi ? "…" : "Enregistrer"}</button>
        </>
      }
    >
      <div className="row">
        <Champ label="Nom"><input autoFocus value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Champ>
        <Champ label="Societe"><input value={f.company ?? ""} onChange={(e) => set("company", e.target.value)} /></Champ>
      </div>
      <div className="row">
        <Champ label="E-mail"><input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Champ>
        <Champ label="Telephone"><input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Champ>
      </div>
      <div className="row--3" style={{ display: "grid", gap: 12 }}>
        <Champ label="Pays"><input value={f.country ?? ""} onChange={(e) => set("country", e.target.value)} /></Champ>
        <Champ label="Langue">
          <select value={f.lang ?? "fr"} onChange={(e) => set("lang", e.target.value)}>
            <option value="fr">Francais</option>
            <option value="en">Anglais</option>
          </select>
        </Champ>
        <Champ label="Origine">
          <select value={f.source ?? "direct"} onChange={(e) => set("source", e.target.value)}>
            {SOURCES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </Champ>
      </div>
      <Champ label="Notes" aide="Preferences, historique, conditions negociees…">
        <textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </Champ>
    </Modal>
  );
}
