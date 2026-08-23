"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { Champ, Confirm, Ico, Modal, Chargement, Vide, toast } from "@/components/ui";
import { enregistrer, euros, jour, majChamp, supprimer, useTable } from "@/lib/db";

type Devis = {
  id: string; number: number; order_id: string | null; customer_id: string | null;
  amount: number; shipping_cost: number; currency: string; status: string;
  valid_until: string | null; sent_at: string | null; created_at: string;
  customers: { name: string; company: string | null } | null;
};
type Client = { id: string; name: string; company: string | null };
type Commande = { id: string; number: number; total_estimate: number; customer_id: string | null };

const STATUTS = [
  { v: "brouillon", l: "Brouillon", t: "mute" },
  { v: "envoye", l: "Envoye", t: "info" },
  { v: "accepte", l: "Accepte", t: "ok" },
  { v: "refuse", l: "Refuse", t: "err" },
  { v: "expire", l: "Expire", t: "warn" },
];
const st = (v: string) => STATUTS.find((s) => s.v === v);
const dans30j = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

export default function DevisPage() {
  const { items, chargement, charger } = useTable<Devis>(
    "quotes",
    "id,number,order_id,customer_id,amount,shipping_cost,currency,status,valid_until,sent_at,created_at,customers(name,company)"
  );
  const { items: clients } = useTable<Client>("customers", "id,name,company", { col: "name", asc: true });
  const { items: commandes } = useTable<Commande>("orders", "id,number,total_estimate,customer_id");

  const [filtre, setFiltre] = useState("");
  const [edite, setEdite] = useState<Partial<Devis> | null>(null);
  const [aSupprimer, setASupprimer] = useState<Devis | null>(null);

  const vus = filtre ? items.filter((d) => d.status === filtre) : items;
  const encours = items
    .filter((d) => ["envoye", "accepte"].includes(d.status))
    .reduce((s, d) => s + Number(d.amount) + Number(d.shipping_cost), 0);

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Devis</h1>
          <p>{items.length} factures proforma · {euros(encours)} envoyes ou acceptes</p>
        </div>
        <div className="head__act">
          <button className="btn btn--main"
                  onClick={() => setEdite({ status: "brouillon", amount: 0, shipping_cost: 0, valid_until: dans30j() })}>
            <Ico n="plus" s={16} /> Nouveau devis
          </button>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${!filtre ? "on" : ""}`} onClick={() => setFiltre("")}>
          Tous ({items.length})
        </button>
        {STATUTS.map((s) => (
          <button key={s.v} className={`chip ${filtre === s.v ? "on" : ""}`}
                  onClick={() => setFiltre(filtre === s.v ? "" : s.v)}>
            {s.l} ({items.filter((d) => d.status === s.v).length})
          </button>
        ))}
      </div>

      <div className="card">
        <div className="tw">
          {chargement ? <Chargement /> : vus.length === 0 ? (
            <Vide titre="Aucun devis" texte="Etablissez-en un depuis une commande (icone facture) ou creez-le ici."
                  action={<button className="btn btn--main"
                                  onClick={() => setEdite({ status: "brouillon", amount: 0, shipping_cost: 0, valid_until: dans30j() })}>
                            Creer un devis
                          </button>} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>N°</th><th>Client</th><th>Montant</th><th>Port</th>
                  <th>Total</th><th>Validite</th><th style={{ width: 150 }}>Statut</th><th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {vus.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">#{d.number}</td>
                    <td>
                      <strong>{d.customers?.name ?? "—"}</strong>
                      <div className="sub">{d.customers?.company || jour(d.created_at)}</div>
                    </td>
                    <td className="num">{euros(d.amount)}</td>
                    <td className="num">{euros(d.shipping_cost)}</td>
                    <td className="num"><strong>{euros(Number(d.amount) + Number(d.shipping_cost))}</strong></td>
                    <td className="sub">{jour(d.valid_until)}</td>
                    <td>
                      <select value={d.status} style={{ padding: "6px 9px", fontSize: ".8rem" }}
                              onChange={async (e) => {
                                const v = e.target.value;
                                const ok = await majChamp("quotes", d.id, "status", v);
                                if (ok && v === "envoye") await majChamp("quotes", d.id, "sent_at", new Date().toISOString());
                                if (ok) { toast("Statut mis a jour."); charger(); }
                              }}>
                        {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="acts">
                        <button className="btn btn--ghost btn--icon" title="Modifier"
                                onClick={() => setEdite(d)}><Ico n="pen" s={16} /></button>
                        <button className="btn btn--ghost btn--icon" title="Supprimer"
                                onClick={() => setASupprimer(d)}><Ico n="trash" s={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
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
          titre={`Supprimer le devis #${aSupprimer.number} ?`}
          texte="La commande d'origine, elle, reste inchangee."
          onCancel={() => setASupprimer(null)}
          onOk={async () => {
            if (await supprimer("quotes", aSupprimer.id)) charger();
            setASupprimer(null);
          }}
        />
      )}
    </Shell>
  );
}

function Forme({ valeur, clients, commandes, onClose, onSaved }: {
  valeur: Partial<Devis>; clients: Client[]; commandes: Commande[];
  onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Devis>>({ ...valeur });
  const [envoi, setEnvoi] = useState(false);
  const set = (k: keyof Devis, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const total = Number(f.amount || 0) + Number(f.shipping_cost || 0);

  /** Rattacher une commande reprend son client et son montant. */
  function choisirCommande(id: string) {
    const c = commandes.find((x) => x.id === id);
    setF((x) => ({
      ...x,
      order_id: id || null,
      customer_id: c?.customer_id ?? x.customer_id ?? null,
      amount: c ? Number(c.total_estimate) : x.amount,
    }));
  }

  return (
    <Modal
      titre={valeur.id ? `Devis #${valeur.number}` : "Nouveau devis"}
      sous="Facture proforma en euros"
      onClose={onClose}
      pied={
        <>
          <div className="left" style={{ fontSize: ".9rem" }}>
            Total <strong style={{ fontSize: "1.05rem" }}>{euros(total)}</strong>
          </div>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" disabled={envoi} onClick={async () => {
            setEnvoi(true);
            const valeurs: Record<string, unknown> = {
              order_id: f.order_id || null,
              customer_id: f.customer_id || null,
              amount: Number(f.amount || 0),
              shipping_cost: Number(f.shipping_cost || 0),
              status: f.status || "brouillon",
              valid_until: f.valid_until || null,
            };
            if (f.status === "envoye" && !valeur.sent_at) valeurs.sent_at = new Date().toISOString();
            const ok = await enregistrer("quotes", valeurs, valeur.id ?? null);
            setEnvoi(false);
            if (ok) onSaved();
          }}>{envoi ? "…" : "Enregistrer"}</button>
        </>
      }
    >
      <div className="row">
        <Champ label="Client">
          <select value={f.customer_id ?? ""} onChange={(e) => set("customer_id", e.target.value)}>
            <option value="">— non renseigne —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>
            ))}
          </select>
        </Champ>
        <Champ label="Commande rattachee" aide="Reprend automatiquement le montant.">
          <select value={f.order_id ?? ""} onChange={(e) => choisirCommande(e.target.value)}>
            <option value="">— aucune —</option>
            {commandes.map((c) => (
              <option key={c.id} value={c.id}>#{c.number} · {euros(c.total_estimate)}</option>
            ))}
          </select>
        </Champ>
      </div>

      <div className="row--3" style={{ display: "grid", gap: 12 }}>
        <Champ label="Montant des articles (EUR)">
          <input inputMode="decimal" value={f.amount ?? 0}
                 onChange={(e) => set("amount", e.target.value.replace(",", "."))} />
        </Champ>
        <Champ label="Transport (EUR)">
          <input inputMode="decimal" value={f.shipping_cost ?? 0}
                 onChange={(e) => set("shipping_cost", e.target.value.replace(",", "."))} />
        </Champ>
        <Champ label="Valable jusqu'au">
          <input type="date" value={f.valid_until ?? ""} onChange={(e) => set("valid_until", e.target.value)} />
        </Champ>
      </div>

      <Champ label="Statut">
        <select value={f.status ?? "brouillon"} onChange={(e) => set("status", e.target.value)}>
          {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </Champ>

      {f.status && <span className={`tag tag--${st(f.status)?.t ?? "mute"}`}>{st(f.status)?.l}</span>}
    </Modal>
  );
}
