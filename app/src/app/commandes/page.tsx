"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Champ, Confirm, Ico, Modal, Chargement, Vide, toast } from "@/components/ui";
import { euros, jour, majChamp, supprimer, useTable } from "@/lib/db";
import { supabase } from "@/lib/supabase";

type Commande = {
  id: string; number: number; customer_id: string | null; status: string; channel: string;
  lang: string; total_estimate: number; message: string; created_at: string;
  customers: { name: string; company: string | null } | null;
};
type Article = {
  id?: string; order_id?: string; product_id: string | null;
  ref: string; name: string; qty: number; unit_price: number | null;
};
type Client = { id: string; name: string; company: string | null };
type Produit = { id: string; ref: string; fr_name: string; price: number | null };

const STATUTS = [
  { v: "nouveau", l: "Nouveau", t: "warn" },
  { v: "devis_envoye", l: "Devis envoye", t: "info" },
  { v: "confirme", l: "Confirme", t: "info" },
  { v: "paye", l: "Paye", t: "ok" },
  { v: "expedie", l: "Expedie", t: "ok" },
  { v: "annule", l: "Annule", t: "mute" },
];
const CANAUX = ["whatsapp", "email", "site", "telephone"];
const st = (v: string) => STATUTS.find((s) => s.v === v);

export default function Commandes() {
  const { items, chargement, charger } = useTable<Commande>(
    "orders",
    "id,number,customer_id,status,channel,lang,total_estimate,message,created_at,customers(name,company)"
  );
  const { items: clients } = useTable<Client>("customers", "id,name,company", { col: "name", asc: true });
  const { items: produits } = useTable<Produit>("products", "id,ref,fr_name,price", { col: "ref", asc: true });

  const [filtre, setFiltre] = useState("");
  const [edite, setEdite] = useState<Partial<Commande> | null>(null);
  const [aSupprimer, setASupprimer] = useState<Commande | null>(null);

  const vus = filtre ? items.filter((c) => c.status === filtre) : items;

  /** Cree un devis brouillon reprenant le montant de la commande. */
  async function faireDevis(c: Commande) {
    const { error } = await supabase.from("quotes").insert({
      order_id: c.id, customer_id: c.customer_id,
      amount: c.total_estimate, status: "brouillon",
      valid_until: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    });
    if (error) return toast("Echec : " + error.message, "err");
    await majChamp("orders", c.id, "status", "devis_envoye");
    toast("Devis brouillon cree — voir l'ecran Devis.");
    charger();
  }

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Commandes</h1>
          <p>{items.length} demandes · {items.filter((c) => c.status === "nouveau").length} a traiter</p>
        </div>
        <div className="head__act">
          <button className="btn btn--main" onClick={() => setEdite({ status: "nouveau", channel: "whatsapp", lang: "fr" })}>
            <Ico n="plus" s={16} /> Nouvelle commande
          </button>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${!filtre ? "on" : ""}`} onClick={() => setFiltre("")}>
          Toutes ({items.length})
        </button>
        {STATUTS.map((s) => {
          const n = items.filter((c) => c.status === s.v).length;
          return (
            <button key={s.v} className={`chip ${filtre === s.v ? "on" : ""}`}
                    onClick={() => setFiltre(filtre === s.v ? "" : s.v)}>
              {s.l} ({n})
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="tw">
          {chargement ? <Chargement /> : vus.length === 0 ? (
            <Vide titre="Aucune commande" texte="Elles arrivent des demandes de devis du site — ou saisissez-en une recue par WhatsApp."
                  action={<button className="btn btn--main" onClick={() => setEdite({ status: "nouveau", channel: "whatsapp", lang: "fr" })}>Saisir une commande</button>} />
          ) : (
            <table>
              <thead>
                <tr><th style={{ width: 70 }}>N°</th><th>Client</th><th>Canal</th><th>Total estime</th><th style={{ width: 160 }}>Statut</th><th style={{ width: 120 }}></th></tr>
              </thead>
              <tbody>
                {vus.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">#{c.number}</td>
                    <td>
                      <strong>{c.customers?.name ?? "Client non renseigne"}</strong>
                      <div className="sub">{c.customers?.company || jour(c.created_at)}</div>
                    </td>
                    <td><span className="tag tag--mute">{c.channel}</span></td>
                    <td className="num"><strong>{euros(c.total_estimate)}</strong></td>
                    <td>
                      <select value={c.status} style={{ padding: "6px 9px", fontSize: ".8rem" }}
                              onChange={async (e) => {
                                if (await majChamp("orders", c.id, "status", e.target.value)) {
                                  toast("Statut mis a jour."); charger();
                                }
                              }}>
                        {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="acts">
                        <button className="btn btn--ghost btn--icon" title="Ouvrir le detail"
                                onClick={() => setEdite(c)}><Ico n="pen" s={16} /></button>
                        <button className="btn btn--ghost btn--icon" title="Etablir un devis"
                                onClick={() => faireDevis(c)}><Ico n="bill" s={16} /></button>
                        <button className="btn btn--ghost btn--icon" title="Supprimer"
                                onClick={() => setASupprimer(c)}><Ico n="trash" s={16} /></button>
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
        <Detail
          commande={edite}
          clients={clients}
          produits={produits}
          onClose={() => setEdite(null)}
          onSaved={() => { setEdite(null); charger(); }}
        />
      )}

      {aSupprimer && (
        <Confirm
          titre={`Supprimer la commande #${aSupprimer.number} ?`}
          texte="Elle est retiree avec ses articles. Un devis deja etabli reste, sans commande rattachee."
          onCancel={() => setASupprimer(null)}
          onOk={async () => {
            if (await supprimer("orders", aSupprimer.id)) charger();
            setASupprimer(null);
          }}
        />
      )}
    </Shell>
  );
}

/* =========================================================
   Detail d'une commande : entete + articles
   ========================================================= */
function Detail({
  commande, clients, produits, onClose, onSaved,
}: {
  commande: Partial<Commande>;
  clients: Client[];
  produits: Produit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Commande>>({ ...commande });
  const [lignes, setLignes] = useState<Article[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const set = (k: keyof Commande, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!commande.id) return;
    supabase.from("order_items").select("*").eq("order_id", commande.id)
      .then(({ data }) => setLignes((data as Article[]) ?? []));
  }, [commande.id]);

  const total = lignes.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0);

  function ajouter() {
    setLignes((l) => [...l, { product_id: null, ref: "", name: "", qty: 1, unit_price: null }]);
  }
  function majLigne(i: number, patch: Partial<Article>) {
    setLignes((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function choisirProduit(i: number, id: string) {
    const p = produits.find((x) => x.id === id);
    majLigne(i, p
      ? { product_id: p.id, ref: p.ref, name: p.fr_name, unit_price: p.price }
      : { product_id: null });
  }

  async function valider() {
    setEnvoi(true);
    const entete = {
      customer_id: f.customer_id || null,
      status: f.status || "nouveau",
      channel: f.channel || "whatsapp",
      lang: f.lang || "fr",
      message: f.message ?? "",
      total_estimate: total,
    };

    let id = commande.id;
    if (id) {
      const { error } = await supabase.from("orders").update(entete).eq("id", id);
      if (error) { setEnvoi(false); return toast("Echec : " + error.message, "err"); }
      await supabase.from("order_items").delete().eq("order_id", id);
    } else {
      const { data, error } = await supabase.from("orders").insert(entete).select("id").single();
      if (error || !data) { setEnvoi(false); return toast("Echec : " + (error?.message ?? ""), "err"); }
      id = data.id;
    }

    const utiles = lignes.filter((l) => l.name.trim() || l.ref.trim());
    if (utiles.length) {
      const { error } = await supabase.from("order_items").insert(
        utiles.map((l) => ({
          order_id: id,
          product_id: l.product_id,
          ref: l.ref || "—",
          name: l.name || l.ref,
          qty: Math.max(1, Number(l.qty) || 1),
          unit_price: l.unit_price === null || String(l.unit_price) === "" ? null : Number(l.unit_price),
        }))
      );
      if (error) { setEnvoi(false); return toast("Articles refuses : " + error.message, "err"); }
    }

    setEnvoi(false);
    toast(commande.id ? "Commande mise a jour." : "Commande creee.");
    onSaved();
  }

  return (
    <Modal
      titre={commande.id ? `Commande #${commande.number}` : "Nouvelle commande"}
      sous={commande.id ? "Recue le " + jour(commande.created_at) : "Saisie manuelle d'une demande recue"}
      taille="wide"
      onClose={onClose}
      pied={
        <>
          <div className="left" style={{ fontSize: ".9rem" }}>
            Total estime <strong style={{ fontSize: "1.05rem" }}>{euros(total)}</strong>
          </div>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" onClick={valider} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="row--3" style={{ display: "grid", gap: 12 }}>
        <Champ label="Client">
          <select value={f.customer_id ?? ""} onChange={(e) => set("customer_id", e.target.value)}>
            <option value="">— non renseigne —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>
            ))}
          </select>
        </Champ>
        <Champ label="Canal">
          <select value={f.channel ?? "whatsapp"} onChange={(e) => set("channel", e.target.value)}>
            {CANAUX.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Champ>
        <Champ label="Statut">
          <select value={f.status ?? "nouveau"} onChange={(e) => set("status", e.target.value)}>
            {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </Champ>
      </div>

      <div className="section-t" style={{ marginTop: 6 }}>Articles demandes</div>
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {lignes.length === 0 && (
          <p className="sub">Aucun article. Ajoutez-en depuis le catalogue ou en texte libre.</p>
        )}
        {lignes.map((l, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "1fr 78px 108px 34px", gap: 8, alignItems: "center",
          }}>
            <select value={l.product_id ?? ""} onChange={(e) => choisirProduit(i, e.target.value)}
                    style={{ fontSize: ".82rem" }}>
              <option value="">— article libre —</option>
              {produits.map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.fr_name}</option>)}
            </select>
            <input value={l.qty} inputMode="numeric" title="Quantite"
                   style={{ fontSize: ".82rem" }}
                   onChange={(e) => majLigne(i, { qty: Number(e.target.value) || 0 })} />
            <input value={l.unit_price ?? ""} inputMode="decimal" placeholder="prix unit."
                   style={{ fontSize: ".82rem" }}
                   onChange={(e) => majLigne(i, {
                     unit_price: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")),
                   })} />
            <button className="btn btn--ghost btn--icon" title="Retirer"
                    onClick={() => setLignes((x) => x.filter((_, j) => j !== i))}>
              <Ico n="x" s={16} />
            </button>
            {!l.product_id && (
              <input value={l.name} placeholder="Designation libre"
                     style={{ gridColumn: "1 / -1", fontSize: ".82rem" }}
                     onChange={(e) => majLigne(i, { name: e.target.value, ref: l.ref || "LIBRE" })} />
            )}
          </div>
        ))}
      </div>
      <button className="btn btn--sm" onClick={ajouter}><Ico n="plus" s={15} /> Ajouter un article</button>

      <div style={{ marginTop: 18 }}>
        <Champ label="Message du client">
          <textarea value={f.message ?? ""} onChange={(e) => set("message", e.target.value)} />
        </Champ>
      </div>

      {f.status && (
        <span className={`tag tag--${st(f.status)?.t ?? "mute"}`}>{st(f.status)?.l ?? f.status}</span>
      )}
    </Modal>
  );
}
