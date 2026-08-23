"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { Champ, Confirm, Ico, Modal, Chargement, Vide, toast } from "@/components/ui";
import { enregistrer, majChamp, supprimer, useTable } from "@/lib/db";

type Relance = {
  id: string; customer_id: string | null; order_id: string | null;
  channel: string; note: string; due_at: string | null; done_at: string | null;
  created_at: string;
  customers: { name: string; phone: string | null; email: string | null } | null;
};
type Client = { id: string; name: string; company: string | null; phone: string | null; email: string | null };
type Commande = { id: string; number: number };

const CANAUX = [
  { v: "whatsapp", l: "WhatsApp" },
  { v: "email", l: "E-mail" },
  { v: "appel", l: "Appel telephonique" },
];

const quand = (s: string | null) => {
  if (!s) return { texte: "Sans date", t: "mute" as const };
  const d = new Date(s);
  const jours = Math.round((d.getTime() - Date.now()) / 864e5);
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  if (jours < 0) return { texte: `En retard · ${date}`, t: "err" as const };
  if (jours === 0) return { texte: "Aujourd'hui", t: "warn" as const };
  if (jours === 1) return { texte: "Demain", t: "warn" as const };
  return { texte: `Dans ${jours} jours · ${date}`, t: "info" as const };
};

const VIDE = (): Partial<Relance> => ({
  channel: "whatsapp", note: "",
  due_at: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
});

export default function Relances() {
  const { items, chargement, charger } = useTable<Relance>(
    "follow_ups",
    "id,customer_id,order_id,channel,note,due_at,done_at,created_at,customers(name,phone,email)",
    { col: "due_at", asc: true }
  );
  const { items: clients } = useTable<Client>("customers", "id,name,company,phone,email", { col: "name", asc: true });
  const { items: commandes } = useTable<Commande>("orders", "id,number");

  const [voirFaites, setVoirFaites] = useState(false);
  const [edite, setEdite] = useState<Partial<Relance> | null>(null);
  const [aSupprimer, setASupprimer] = useState<Relance | null>(null);

  const aFaire = items.filter((r) => !r.done_at);
  const faites = items.filter((r) => r.done_at);
  const vus = voirFaites ? faites : aFaire;

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Relances</h1>
          <p>{aFaire.length} a faire · {faites.length} deja traitees</p>
        </div>
        <div className="head__act">
          <button className="btn btn--main" onClick={() => setEdite(VIDE())}>
            <Ico n="plus" s={16} /> Programmer une relance
          </button>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${!voirFaites ? "on" : ""}`} onClick={() => setVoirFaites(false)}>
          A faire ({aFaire.length})
        </button>
        <button className={`chip ${voirFaites ? "on" : ""}`} onClick={() => setVoirFaites(true)}>
          Traitees ({faites.length})
        </button>
      </div>

      <div className="card">
        <div className="tw">
          {chargement ? <Chargement /> : vus.length === 0 ? (
            <Vide
              titre={voirFaites ? "Rien de traite" : "Aucune relance en attente"}
              texte="Programmez un rappel sur un client ou une commande : il apparaitra ici a la date voulue."
              action={!voirFaites ? <button className="btn btn--main" onClick={() => setEdite(VIDE())}>Programmer</button> : undefined}
            />
          ) : (
            <table>
              <thead>
                <tr><th style={{ width: 44 }}></th><th>Client</th><th>Canal</th><th>Note</th><th style={{ width: 170 }}>Echeance</th><th style={{ width: 90 }}></th></tr>
              </thead>
              <tbody>
                {vus.map((r) => {
                  const e = quand(r.due_at);
                  return (
                    <tr key={r.id}>
                      <td>
                        <button className="btn btn--ghost btn--icon"
                                title={r.done_at ? "Rouvrir" : "Marquer comme faite"}
                                onClick={async () => {
                                  const ok = await majChamp("follow_ups", r.id, "done_at",
                                    r.done_at ? null : new Date().toISOString());
                                  if (ok) { toast(r.done_at ? "Relance rouverte." : "Relance faite."); charger(); }
                                }}>
                          <Ico n="check" s={17} />
                        </button>
                      </td>
                      <td>
                        <strong>{r.customers?.name ?? "—"}</strong>
                        <div className="sub">{r.customers?.phone || r.customers?.email || ""}</div>
                      </td>
                      <td><span className="tag tag--mute">{CANAUX.find((c) => c.v === r.channel)?.l ?? r.channel}</span></td>
                      <td style={{ maxWidth: 320 }}>{r.note || <span className="sub">—</span>}</td>
                      <td>
                        {r.done_at
                          ? <span className="tag tag--ok">Faite</span>
                          : <span className={`tag tag--${e.t}`}>{e.texte}</span>}
                      </td>
                      <td>
                        <div className="acts">
                          <button className="btn btn--ghost btn--icon" title="Modifier"
                                  onClick={() => setEdite(r)}><Ico n="pen" s={16} /></button>
                          <button className="btn btn--ghost btn--icon" title="Supprimer"
                                  onClick={() => setASupprimer(r)}><Ico n="trash" s={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {edite && (
        <Forme valeur={edite} clients={clients} commandes={commandes}
               onClose={() => setEdite(null)}
               onSaved={() => { setEdite(null); charger(); }} />
      )}

      {aSupprimer && (
        <Confirm
          titre="Supprimer cette relance ?"
          texte="Le rappel disparait ; le client et la commande ne changent pas."
          onCancel={() => setASupprimer(null)}
          onOk={async () => {
            if (await supprimer("follow_ups", aSupprimer.id)) charger();
            setASupprimer(null);
          }}
        />
      )}
    </Shell>
  );
}

function Forme({ valeur, clients, commandes, onClose, onSaved }: {
  valeur: Partial<Relance>; clients: Client[]; commandes: Commande[];
  onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Relance>>({
    ...valeur,
    due_at: valeur.due_at ? String(valeur.due_at).slice(0, 10) : "",
  });
  const [envoi, setEnvoi] = useState(false);
  const set = (k: keyof Relance, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const client = clients.find((c) => c.id === f.customer_id);

  return (
    <Modal
      titre={valeur.id ? "Modifier la relance" : "Programmer une relance"}
      sous="Un rappel simple, sans envoi automatique."
      onClose={onClose}
      pied={
        <>
          {client?.phone && (
            <a className="btn left" target="_blank" rel="noreferrer"
               href={`https://wa.me/${client.phone.replace(/[^\d]/g, "")}`}>
              Ouvrir WhatsApp
            </a>
          )}
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" disabled={envoi} onClick={async () => {
            if (!f.customer_id) return toast("Choisissez un client.", "err");
            setEnvoi(true);
            const ok = await enregistrer("follow_ups", {
              customer_id: f.customer_id,
              order_id: f.order_id || null,
              channel: f.channel || "whatsapp",
              note: f.note ?? "",
              due_at: f.due_at ? new Date(f.due_at + "T09:00:00").toISOString() : null,
            }, valeur.id ?? null);
            setEnvoi(false);
            if (ok) onSaved();
          }}>{envoi ? "…" : "Enregistrer"}</button>
        </>
      }
    >
      <div className="row">
        <Champ label="Client">
          <select value={f.customer_id ?? ""} onChange={(e) => set("customer_id", e.target.value)}>
            <option value="">— choisir —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>
            ))}
          </select>
        </Champ>
        <Champ label="Commande concernee" aide="Facultatif.">
          <select value={f.order_id ?? ""} onChange={(e) => set("order_id", e.target.value)}>
            <option value="">— aucune —</option>
            {commandes.map((c) => <option key={c.id} value={c.id}>#{c.number}</option>)}
          </select>
        </Champ>
      </div>
      <div className="row">
        <Champ label="Canal">
          <select value={f.channel ?? "whatsapp"} onChange={(e) => set("channel", e.target.value)}>
            {CANAUX.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </Champ>
        <Champ label="A relancer le">
          <input type="date" value={f.due_at ?? ""} onChange={(e) => set("due_at", e.target.value)} />
        </Champ>
      </div>
      <Champ label="Note" aide="Ce qu'il faut dire ou verifier.">
        <textarea value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} />
      </Champ>
    </Modal>
  );
}
