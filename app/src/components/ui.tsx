"use client";

/**
 * Briques d'interface partagees par tout le back-office.
 *
 * L'idee : une seule facon d'ouvrir une fenetre, de confirmer une
 * suppression et d'annoncer un enregistrement. Les ecrans ne
 * s'occupent plus que de leurs donnees.
 */

import { useEffect, useState } from "react";

/* =========================================================
   Notifications
   ========================================================= */
type Toast = { id: number; texte: string; type: "ok" | "err" };
let abonnes: ((t: Toast[]) => void)[] = [];
let file: Toast[] = [];
let seq = 0;

function diffuser() {
  abonnes.forEach((f) => f([...file]));
}

/** Affiche une notification en bas a droite. */
export function toast(texte: string, type: "ok" | "err" = "ok") {
  const t = { id: ++seq, texte, type };
  file = [...file, t];
  diffuser();
  setTimeout(() => {
    file = file.filter((x) => x.id !== t.id);
    diffuser();
  }, type === "err" ? 5200 : 2800);
}

export function Toasts() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    abonnes.push(setItems);
    return () => { abonnes = abonnes.filter((f) => f !== setItems); };
  }, []);
  if (!items.length) return null;
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>{t.texte}</div>
      ))}
    </div>
  );
}

/* =========================================================
   Fenetre modale
   ========================================================= */
export function Modal({
  titre, sous, taille = "", onClose, children, pied,
}: {
  titre: string;
  sous?: string;
  taille?: "" | "wide" | "sm";
  onClose: () => void;
  children: React.ReactNode;
  pied?: React.ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${taille ? "modal--" + taille : ""}`}>
        <div className="modal__h">
          <div>
            <h2>{titre}</h2>
            {sous && <p>{sous}</p>}
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Fermer">
            <Ico n="x" />
          </button>
        </div>
        <div className="modal__b">{children}</div>
        {pied && <div className="modal__f">{pied}</div>}
      </div>
    </div>
  );
}

/** Demande de confirmation avant une suppression. */
export function Confirm({
  titre, texte, onCancel, onOk, libelle = "Supprimer",
}: {
  titre: string; texte: string; onCancel: () => void;
  onOk: () => void | Promise<void>; libelle?: string;
}) {
  const [envoi, setEnvoi] = useState(false);
  return (
    <Modal
      titre={titre}
      taille="sm"
      onClose={onCancel}
      pied={
        <>
          <button className="btn" onClick={onCancel}>Annuler</button>
          <button
            className="btn btn--danger"
            disabled={envoi}
            onClick={async () => { setEnvoi(true); await onOk(); setEnvoi(false); }}
          >
            {envoi ? "…" : libelle}
          </button>
        </>
      }
    >
      <p style={{ fontSize: ".88rem", color: "var(--ink-2)" }}>{texte}</p>
    </Modal>
  );
}

/* =========================================================
   Champs
   ========================================================= */
export function Champ({
  label, aide, children, plein,
}: { label: string; aide?: string; children: React.ReactNode; plein?: boolean }) {
  return (
    <div className="field" style={plein ? { gridColumn: "1 / -1" } : undefined}>
      <label>{label}</label>
      {children}
      {aide && <small>{aide}</small>}
    </div>
  );
}

export function Vide({ titre, texte, action }: { titre: string; texte: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <b>{titre}</b>
      <p>{texte}</p>
      {action}
    </div>
  );
}

export function Chargement({ lignes = 5 }: { lignes?: number }) {
  return (
    <div style={{ padding: 18, display: "grid", gap: 10 }}>
      {Array.from({ length: lignes }).map((_, i) => (
        <div key={i} className="skel" style={{ height: 34, opacity: 1 - i * 0.13 }} />
      ))}
    </div>
  );
}

/* =========================================================
   Icones (trait, 18px)
   ========================================================= */
const CHEMINS: Record<string, React.ReactNode> = {
  home: <><path d="M3 9.5 10 3l7 6.5" /><path d="M5 8.5V17h10V8.5" /></>,
  edit: <><path d="M12.5 3.5 16.5 7.5 7 17H3v-4z" /><path d="M11 5 15 9" /></>,
  box: <><path d="M10 2.5 17 6v8l-7 3.5L3 14V6z" /><path d="M3 6l7 3.5L17 6" /><path d="M10 9.5V17.5" /></>,
  tag: <><path d="M3 3h6l8 8-6 6-8-8z" /><circle cx="6.5" cy="6.5" r="1.2" /></>,
  text: <><path d="M4 5h12" /><path d="M4 10h12" /><path d="M4 15h7" /></>,
  users: <><circle cx="7.5" cy="7" r="2.8" /><path d="M2.5 16c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" /><path d="M13.5 11.8c2.2.3 4 1.9 4 4.2" /><circle cx="14" cy="7.4" r="2.2" /></>,
  cart: <><circle cx="8" cy="16.5" r="1.3" /><circle cx="15" cy="16.5" r="1.3" /><path d="M2.5 3h2l2 9.5h9l1.8-6.5H6" /></>,
  bill: <><path d="M4.5 2.5h11v15l-2.2-1.5-2.2 1.5-2.2-1.5L6.7 17.5 4.5 16z" /><path d="M7.5 7h5" /><path d="M7.5 10.5h5" /></>,
  bell: <><path d="M6 8a4 4 0 1 1 8 0c0 4 1.5 5 1.5 5h-11S6 12 6 8z" /><path d="M8.5 16a1.8 1.8 0 0 0 3 0" /></>,
  plus: <><path d="M10 4v12" /><path d="M4 10h12" /></>,
  x: <><path d="M5 5l10 10" /><path d="M15 5 5 15" /></>,
  pen: <><path d="M13.5 3.2 16.8 6.5 7.6 15.7l-4.1.8.8-4.1z" /></>,
  trash: <><path d="M4 5.5h12" /><path d="M8 5.5V3.5h4v2" /><path d="M5.5 5.5 6.3 17h7.4l.8-11.5" /></>,
  copy: <><rect x="6.5" y="6.5" width="10" height="10" rx="2" /><path d="M13 4.5H5a1.5 1.5 0 0 0-1.5 1.5v8" /></>,
  search: <><circle cx="9" cy="9" r="5.2" /><path d="M13 13l4 4" /></>,
  eye: <><path d="M1.8 10S4.8 4.8 10 4.8 18.2 10 18.2 10 15.2 15.2 10 15.2 1.8 10 1.8 10z" /><circle cx="10" cy="10" r="2.2" /></>,
  eyeoff: <><path d="M3 3l14 14" /><path d="M7.4 5.6A8.7 8.7 0 0 1 10 5.2c5.2 0 8.2 4.8 8.2 4.8a15 15 0 0 1-3 3.4" /><path d="M5 6.9A15 15 0 0 0 1.8 10S4.8 14.8 10 14.8c1 0 1.9-.2 2.7-.5" /></>,
  menu: <><path d="M3 5.5h14" /><path d="M3 10h14" /><path d="M3 14.5h14" /></>,
  back: <><path d="M16 10H4" /><path d="M9 5 4 10l5 5" /></>,
  check: <><path d="M4 10.5 8 14.5 16 6" /></>,
  out: <><path d="M8 17H4.5v-14H8" /><path d="M12 13.5 15.5 10 12 6.5" /><path d="M15.5 10H7" /></>,
  sun: <><circle cx="10" cy="10" r="3.4" /><path d="M10 2v1.8M10 16.2V18M18 10h-1.8M3.8 10H2M15.7 4.3l-1.3 1.3M5.6 14.4l-1.3 1.3M15.7 15.7l-1.3-1.3M5.6 5.6 4.3 4.3" /></>,
  moon: <><path d="M16.6 12.1A6.9 6.9 0 0 1 7.9 3.4a6.9 6.9 0 1 0 8.7 8.7z" /></>,
  cog: <><circle cx="10" cy="10" r="2.6" /><path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" /></>,
};

export function Ico({ n, s = 18 }: { n: keyof typeof CHEMINS | string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {CHEMINS[n] ?? null}
    </svg>
  );
}
