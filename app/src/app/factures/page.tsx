"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { Champ, Confirm, Ico, Modal, Chargement, Vide, toast } from "@/components/ui";
import { DEVISES, jour, majChamp, montant, supprimer, useTable } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import {
  Facture, LigneFacture as Ligne, STATUTS_FACTURE as STATUTS,
  numeroFacture, remiseLigne, statutFacture as st, totalFacture, totalLigne,
} from "@/lib/facture";
type Client = { id: string; name: string; company: string | null; phone: string | null; email: string | null; country: string | null };
type Produit = { id: string; ref: string; fr_name: string; price: number | null };
type Reglage = { key: string; value: string };

export default function Factures() {
  const { items, chargement, charger } = useTable<Facture>("invoices", "*");
  const { items: clients } = useTable<Client>("customers", "id,name,company,phone,email,country", { col: "name", asc: true });
  const { items: produits } = useTable<Produit>("products", "id,ref,fr_name,price", { col: "ref", asc: true });
  const { items: reglages } = useTable<Reglage>("settings", "key,value", { col: "position", asc: true });

  const [totaux, setTotaux] = useState<Record<string, number>>({});
  const [filtre, setFiltre] = useState("");
  const [edite, setEdite] = useState<Partial<Facture> | null>(null);
  const [aSupprimer, setASupprimer] = useState<Facture | null>(null);

  const reg = useMemo(() => Object.fromEntries(reglages.map((r) => [r.key, r.value])), [reglages]);
  const prefixe = reg["facture.prefixe"] || "INV";
  const numero = (f: Facture) => numeroFacture(f.number, prefixe);

  /* Les totaux vivent dans les lignes : on les additionne une fois pour
     toute la liste plutot que de recharger a chaque ligne affichee. */
  useEffect(() => {
    if (!items.length) { setTotaux({}); return; }
    supabase.from("invoice_items").select("invoice_id,rate,qty,discount").then(({ data }) => {
      const t: Record<string, number> = {};
      (data ?? []).forEach((l: any) => {
        t[l.invoice_id] = (t[l.invoice_id] ?? 0) + totalLigne(l);
      });
      setTotaux(t);
    });
  }, [items]);

  const vus = filtre ? items.filter((f) => f.status === filtre) : items;
  const du = items
    .filter((f) => !["payee", "annulee"].includes(f.status))
    .reduce((s, f) => s + Math.max(0, (totaux[f.id] ?? 0) - Number(f.paid_amount)), 0);

  return (
    <Shell>
      <div className="head">
        <div>
          <h1>Factures</h1>
          <p>{items.length} factures · {montant(du, reg["facture.devise"] || "USD")} en attente de reglement</p>
        </div>
        <div className="head__act">
          <button className="btn btn--main" onClick={() => setEdite({
            issue_date: new Date().toISOString().slice(0, 10),
            currency: reg["facture.devise"] || "USD",
            status: "brouillon", paid_amount: 0, bill_to: "",
          })}>
            <Ico n="plus" s={16} /> Nouvelle facture
          </button>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${!filtre ? "on" : ""}`} onClick={() => setFiltre("")}>
          Toutes ({items.length})
        </button>
        {STATUTS.map((s) => (
          <button key={s.v} className={`chip ${filtre === s.v ? "on" : ""}`}
                  onClick={() => setFiltre(filtre === s.v ? "" : s.v)}>
            {s.l} ({items.filter((f) => f.status === s.v).length})
          </button>
        ))}
      </div>

      <div className="card">
        <div className="tw">
          {chargement ? <Chargement /> : vus.length === 0 ? (
            <Vide titre="Aucune facture"
                  texte="Etablissez une facture depuis une commande, ou de zero : le modele reprend l'en-tete de la maison."
                  action={<button className="btn btn--main" onClick={() => setEdite({
                    issue_date: new Date().toISOString().slice(0, 10),
                    currency: reg["facture.devise"] || "USD", status: "brouillon", paid_amount: 0, bill_to: "",
                  })}>Creer une facture</button>} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>N°</th><th>Facture a</th><th>Date</th><th>Echeance</th>
                  <th>Total</th><th>Solde du</th><th style={{ width: 165 }}>Statut</th><th style={{ width: 116 }}></th>
                </tr>
              </thead>
              <tbody>
                {vus.map((f) => {
                  const total = totaux[f.id] ?? 0;
                  const solde = Math.max(0, total - Number(f.paid_amount));
                  return (
                    <tr key={f.id}>
                      <td className="mono">{numero(f)}</td>
                      <td>
                        <strong>{f.bill_to || "—"}</strong>
                        {f.bill_phone && <div className="sub">{f.bill_phone}</div>}
                      </td>
                      <td className="sub">{jour(f.issue_date)}</td>
                      <td className="sub">{jour(f.due_date)}</td>
                      <td className="num">{montant(total, f.currency)}</td>
                      <td className="num"><strong>{montant(solde, f.currency)}</strong></td>
                      <td>
                        <select value={f.status} style={{ padding: "6px 9px", fontSize: ".8rem" }}
                                onChange={async (e) => {
                                  if (await majChamp("invoices", f.id, "status", e.target.value)) {
                                    toast("Statut mis a jour."); charger();
                                  }
                                }}>
                          {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="acts">
                          <button className="btn btn--ghost btn--icon" title="Modifier"
                                  onClick={() => setEdite(f)}><Ico n="pen" s={16} /></button>
                          <a className="btn btn--ghost btn--icon" title="Imprimer / PDF"
                             href={`/factures/${f.id}/imprimer`} target="_blank" rel="noopener">
                            <Ico n="bill" s={16} />
                          </a>
                          <button className="btn btn--ghost btn--icon" title="Supprimer"
                                  onClick={() => setASupprimer(f)}><Ico n="trash" s={16} /></button>
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
        <Editeur facture={edite} clients={clients} produits={produits} prefixe={prefixe}
                 onClose={() => setEdite(null)}
                 onSaved={() => { setEdite(null); charger(); }} />
      )}

      {aSupprimer && (
        <Confirm
          titre={`Supprimer la facture ${numero(aSupprimer)} ?`}
          texte="Elle disparait avec ses lignes. Une facture deja remise a un client devrait plutot etre passee en « annulee »."
          onCancel={() => setASupprimer(null)}
          onOk={async () => {
            if (await supprimer("invoices", aSupprimer.id)) charger();
            setASupprimer(null);
          }}
        />
      )}
    </Shell>
  );
}

/* =========================================================
   L'editeur : entete, lignes, totaux
   ========================================================= */
function Editeur({
  facture, clients, produits, prefixe, onClose, onSaved,
}: {
  facture: Partial<Facture>;
  clients: Client[];
  produits: Produit[];
  prefixe: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Facture>>({ ...facture });
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const set = (k: keyof Facture, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!facture.id) { setLignes([{ product_id: null, description: "", rate: 0, qty: 1, discount: 0, position: 0 }]); return; }
    supabase.from("invoice_items").select("*").eq("invoice_id", facture.id).order("position")
      .then(({ data }) => setLignes((data as Ligne[]) ?? []));
  }, [facture.id]);

  const total = totalFacture(lignes);
  const solde = Math.round((total - Number(f.paid_amount || 0)) * 100) / 100;
  const devise = f.currency || "USD";

  function majLigne(i: number, patch: Partial<Ligne>) {
    setLignes((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  /** Reprendre un client de la base remplit l'adresse de facturation. */
  function choisirClient(id: string) {
    const c = clients.find((x) => x.id === id);
    setF((x) => ({
      ...x,
      customer_id: id || null,
      bill_to: c ? (c.company ? `${c.name} — ${c.company}` : c.name) : x.bill_to,
      bill_phone: c?.phone ?? x.bill_phone ?? null,
      bill_email: c?.email ?? x.bill_email ?? null,
      bill_address: c?.country ?? x.bill_address ?? null,
    }));
  }

  function choisirProduit(i: number, id: string) {
    const p = produits.find((x) => x.id === id);
    majLigne(i, p
      ? { product_id: p.id, description: `${p.fr_name} (${p.ref})`, rate: Number(p.price ?? 0) }
      : { product_id: null });
  }

  async function valider() {
    if (!f.bill_to?.trim()) return toast("Indiquez a qui la facture est adressee.", "err");
    setEnvoi(true);

    const entete = {
      customer_id: f.customer_id || null,
      order_id: f.order_id || null,
      bill_to: f.bill_to.trim(),
      bill_phone: f.bill_phone || null,
      bill_email: f.bill_email || null,
      bill_address: f.bill_address || null,
      issue_date: f.issue_date || new Date().toISOString().slice(0, 10),
      due_date: f.due_date || null,
      currency: devise,
      status: f.status || "brouillon",
      paid_amount: Number(f.paid_amount || 0),
      note: f.note ?? "",
    };

    let id = facture.id;
    if (id) {
      const { error } = await supabase.from("invoices").update(entete).eq("id", id);
      if (error) { setEnvoi(false); return toast("Echec : " + error.message, "err"); }
      await supabase.from("invoice_items").delete().eq("invoice_id", id);
    } else {
      const { data, error } = await supabase.from("invoices").insert(entete).select("id").single();
      if (error || !data) { setEnvoi(false); return toast("Echec : " + (error?.message ?? ""), "err"); }
      id = data.id;
    }

    const utiles = lignes.filter((l) => l.description.trim() || Number(l.rate) > 0);
    if (utiles.length) {
      const { error } = await supabase.from("invoice_items").insert(
        utiles.map((l, i) => ({
          invoice_id: id,
          product_id: l.product_id,
          description: l.description || "—",
          rate: Number(l.rate) || 0,
          qty: Number(l.qty) || 1,
          discount: Number(l.discount) || 0,
          position: i,
        }))
      );
      if (error) { setEnvoi(false); return toast("Lignes refusees : " + error.message, "err"); }
    }

    setEnvoi(false);
    toast(facture.id ? "Facture mise a jour." : "Facture creee.");
    onSaved();
  }

  return (
    <Modal
      titre={facture.id ? `Facture ${numeroFacture(facture.number!, prefixe)}` : "Nouvelle facture"}
      sous="Le modele imprime reprend l'en-tete des Reglages."
      taille="wide"
      onClose={onClose}
      pied={
        <>
          <div className="left" style={{ fontSize: ".9rem" }}>
            Total <strong style={{ fontSize: "1.05rem" }}>{montant(total, devise)}</strong>
            {" · "}Solde du <strong style={{ color: solde > 0 ? "var(--err)" : "var(--ok)" }}>{montant(solde, devise)}</strong>
          </div>
          {facture.id && (
            <a className="btn" href={`/factures/${facture.id}/imprimer`} target="_blank" rel="noopener">
              <Ico n="bill" s={16} /> Imprimer
            </a>
          )}
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--main" onClick={valider} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="row">
        <Champ label="Client de la base" aide="Facultatif : remplit l'adresse de facturation.">
          <select value={f.customer_id ?? ""} onChange={(e) => choisirClient(e.target.value)}>
            <option value="">— saisie libre —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>
            ))}
          </select>
        </Champ>
        <Champ label="Facturer a">
          <input value={f.bill_to ?? ""} onChange={(e) => set("bill_to", e.target.value)} />
        </Champ>
      </div>

      <div className="row--3" style={{ display: "grid", gap: 12 }}>
        <Champ label="Telephone">
          <input value={f.bill_phone ?? ""} onChange={(e) => set("bill_phone", e.target.value)} />
        </Champ>
        <Champ label="E-mail">
          <input value={f.bill_email ?? ""} onChange={(e) => set("bill_email", e.target.value)} />
        </Champ>
        <Champ label="Adresse / pays">
          <input value={f.bill_address ?? ""} onChange={(e) => set("bill_address", e.target.value)} />
        </Champ>
      </div>

      <div className="row--3" style={{ display: "grid", gap: 12 }}>
        <Champ label="Date">
          <input type="date" value={f.issue_date ?? ""} onChange={(e) => set("issue_date", e.target.value)} />
        </Champ>
        <Champ label="Echeance">
          <input type="date" value={f.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
        </Champ>
        <Champ label="Devise">
          <select value={devise} onChange={(e) => set("currency", e.target.value)}>
            {DEVISES.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}
          </select>
        </Champ>
      </div>

      {/* ---------- les lignes ---------- */}
      <div className="section-t" style={{ marginTop: 6 }}>Lignes de la facture</div>
      <div className="tw" style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-m)", marginBottom: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Designation</th>
              <th style={{ width: 108 }}>Prix unit.</th>
              <th style={{ width: 78 }}>Qte</th>
              <th style={{ width: 92 }}>Remise %</th>
              <th style={{ width: 116 }}>Montant</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i}>
                <td>
                  <select value={l.product_id ?? ""} onChange={(e) => choisirProduit(i, e.target.value)}
                          style={{ fontSize: ".78rem", marginBottom: 5 }}>
                    <option value="">— saisie libre —</option>
                    {produits.map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.fr_name}</option>)}
                  </select>
                  <input value={l.description} placeholder="Designation sur la facture"
                         style={{ fontSize: ".82rem" }}
                         onChange={(e) => majLigne(i, { description: e.target.value })} />
                </td>
                <td>
                  <input className="num" inputMode="decimal" value={l.rate}
                         style={{ padding: "6px 8px", fontSize: ".82rem" }}
                         onChange={(e) => majLigne(i, { rate: Number(e.target.value.replace(",", ".")) || 0 })} />
                </td>
                <td>
                  <input className="num" inputMode="decimal" value={l.qty}
                         style={{ padding: "6px 8px", fontSize: ".82rem" }}
                         onChange={(e) => majLigne(i, { qty: Number(e.target.value.replace(",", ".")) || 0 })} />
                </td>
                <td>
                  <input className="num" inputMode="decimal" value={l.discount}
                         style={{ padding: "6px 8px", fontSize: ".82rem" }}
                         onChange={(e) => majLigne(i, { discount: Number(e.target.value.replace(",", ".")) || 0 })} />
                </td>
                <td className="num">
                  <strong>{montant(totalLigne(l), devise)}</strong>
                  {Number(l.discount) > 0 && (
                    <div className="sub" style={{ color: "var(--err)" }}>
                      −{montant(remiseLigne(l), devise)}
                    </div>
                  )}
                </td>
                <td>
                  <button className="btn btn--ghost btn--icon" title="Retirer"
                          onClick={() => setLignes((x) => x.filter((_, j) => j !== i))}>
                    <Ico n="x" s={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn--sm"
              onClick={() => setLignes((l) => [...l, { product_id: null, description: "", rate: 0, qty: 1, discount: 0, position: l.length }])}>
        <Ico n="plus" s={15} /> Ajouter une ligne
      </button>

      <div className="row" style={{ marginTop: 18 }}>
        <Champ label="Deja regle" aide="Le solde du se calcule tout seul.">
          <input className="num" inputMode="decimal" value={f.paid_amount ?? 0}
                 onChange={(e) => set("paid_amount", Number(e.target.value.replace(",", ".")) || 0)} />
        </Champ>
        <Champ label="Statut">
          <select value={f.status ?? "brouillon"} onChange={(e) => set("status", e.target.value)}>
            {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </Champ>
      </div>

      <Champ label="Note" aide="Apparait en bas de la facture imprimee.">
        <textarea value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} />
      </Champ>

      {f.status && <span className={`tag tag--${st(f.status)?.t ?? "mute"}`}>{st(f.status)?.l}</span>}
    </Modal>
  );
}
