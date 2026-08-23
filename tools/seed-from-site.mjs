/**
 * Transforme le catalogue et les textes du site vitrine en données SQL.
 *
 *   node tools/seed-from-site.mjs [chemin/vers/site] > supabase/seed.sql
 *
 * Lit site/js/products.js et site/js/i18n.js. products.js s'évalue tel quel
 * (aucune dépendance au navigateur) ; i18n.js contient du code qui touche
 * à `location` et `localStorage`, on n'en extrait donc que l'objet I18N.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SITE = resolve(process.argv[2] || join(process.cwd(), "..", "site"));

/* ---------- lecture des sources ---------- */
const productsSrc = readFileSync(join(SITE, "js", "products.js"), "utf8");
const i18nSrc = readFileSync(join(SITE, "js", "i18n.js"), "utf8");

const { CATEGORIES, PRODUCTS } = new Function(
  `${productsSrc}; return { CATEGORIES, PRODUCTS };`
)();

// on isole l'objet I18N par équilibrage des accolades
function extractI18N(src) {
  const start = src.indexOf("const I18N = {");
  const open = src.indexOf("{", start);
  let depth = 0, end = -1, inStr = null, esc = false, inCom = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    // les commentaires sont sautés en premier : une apostrophe française dans
    // « /* à propos : profil d'entreprise */ » passait sinon pour une chaîne.
    if (inCom) {
      if (inCom === "//" && c === "\n") inCom = null;
      else if (inCom === "/*" && c === "*" && src[i + 1] === "/") { inCom = null; i++; }
      continue;
    }
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) { inCom = "/" + src[i + 1]; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  return new Function(`return ${src.slice(open, end + 1)};`)();
}
const I18N = extractI18N(i18nSrc);

/* ---------- utilitaires SQL ---------- */
const q = v =>
  v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`;
const n = v => (v === null || v === undefined ? "null" : String(v));

const out = [];
out.push(`-- =============================================================
--  Données initiales — reprises du site vitrine
--  Généré par tools/seed-from-site.mjs, ne pas modifier à la main.
--  Relançable : chaque insertion est idempotente (on conflict).
-- =============================================================
begin;
`);

/* ---------- catégories et sous-catégories ---------- */
out.push("-- ---------- gammes ----------");
CATEGORIES.forEach((c, i) => {
  out.push(
    `insert into public.categories (slug, fr_name, en_name, position) values ` +
      `(${q(c.id)}, ${q(c.fr)}, ${q(c.en)}, ${i}) ` +
      `on conflict (slug) do update set fr_name = excluded.fr_name, ` +
      `en_name = excluded.en_name, position = excluded.position;`
  );
  c.subs.forEach((s, j) => {
    out.push(
      `insert into public.subcategories (category_id, slug, fr_name, en_name, position) ` +
        `select id, ${q(s.id)}, ${q(s.fr)}, ${q(s.en)}, ${j} from public.categories ` +
        `where slug = ${q(c.id)} ` +
        `on conflict (category_id, slug) do update set fr_name = excluded.fr_name, ` +
        `en_name = excluded.en_name, position = excluded.position;`
    );
  });
});

/* ---------- produits ---------- */
out.push("\n-- ---------- références ----------");
/* `ref` est unique et suit la position dans le catalogue : retirer une
   référence décale toutes les suivantes, et l'upsert réclamerait un `ref`
   encore détenu par une autre ligne. On les rend provisoirement uniques ;
   les insertions qui suivent reposent la bonne valeur, dans la même
   transaction. Les commandes passées ne bougent pas — `order_items` fige
   la référence au moment de la commande. */
out.push("update public.products set ref = 'TMP-' || id::text;");
PRODUCTS.forEach((p, i) => {
  const setQty = p.setQty ?? null;
  out.push(
    `insert into public.products (ref, slug, category_id, subcategory_id, ` +
      `fr_name, fr_desc, en_name, en_desc, price, price_from, unit, set_qty, ` +
      `sizes, tag, image_path, position) select ${q(p.ref)}, ${q(p.id)}, c.id, s.id, ` +
      `${q(p.fr.name)}, ${q(p.fr.desc)}, ${q(p.en.name)}, ${q(p.en.desc)}, ` +
      `${n(p.price ?? null)}, ${p.from ? "true" : "false"}, ${q(p.unit || "piece")}, ` +
      `${n(setQty)}, ${q(p.sizes ?? null)}, ${q(p.tag ?? null)}, ` +
      `${q("produits/" + p.cat + "/" + p.sub + "/" + p.img + ".webp")}, ${i} ` +
      `from public.categories c ` +
      `left join public.subcategories s on s.category_id = c.id and s.slug = ${q(p.sub)} ` +
      `where c.slug = ${q(p.cat)} ` +
      // le classement fait partie de la fiche : une reference deplacee d'une
      // sous-gamme a l'autre doit suivre, sinon elle reste dans l'ancienne.
      `on conflict (slug) do update set ref = excluded.ref, ` +
      `category_id = excluded.category_id, subcategory_id = excluded.subcategory_id, ` +
      `fr_name = excluded.fr_name, ` +
      `fr_desc = excluded.fr_desc, en_name = excluded.en_name, en_desc = excluded.en_desc, ` +
      `price = excluded.price, price_from = excluded.price_from, unit = excluded.unit, ` +
      `set_qty = excluded.set_qty, sizes = excluded.sizes, tag = excluded.tag, ` +
      `image_path = excluded.image_path, position = excluded.position;`
  );
});

/* ---------- planches de motifs ----------
   Une reference vendue en assortiment porte la collection dans laquelle
   l'atelier puise : ce sont les photos secondaires (product_images).
   L'acheteur les voit, mais ne choisit pas. */
const avecGalerie = PRODUCTS.filter(p => Array.isArray(p.gallery) && p.gallery.length);
if (avecGalerie.length) {
  out.push("\n-- ---------- planches de motifs ----------");
  avecGalerie.forEach(p => {
    out.push(
      `delete from public.product_images where product_id = ` +
        `(select id from public.products where slug = ${q(p.id)});`
    );
    p.gallery.forEach((nom, j) => {
      const chemin = String(nom).includes("://")
        ? nom
        : "produits/" + p.cat + "/" + p.sub + "/" + nom + ".webp";
      out.push(
        `insert into public.product_images (product_id, path, alt, position) ` +
          `select id, ${q(chemin)}, ${q(p.fr.name)}, ${j} ` +
          `from public.products where slug = ${q(p.id)};`
      );
    });
  });
}

/* ---------- references retirees du catalogue ----------
   Le site est la source de verite : ce qui n'y figure plus disparait de la
   base. Les commandes passees ne bougent pas, order_items fige ses colonnes. */
out.push("\n-- ---------- références retirées ----------");
out.push(
  `delete from public.products where slug not in (` +
    PRODUCTS.map(p => q(p.id)).join(", ") +
    `);`
);

/* ---------- textes ---------- */
out.push("\n-- ---------- textes du site ----------");
const keys = new Set([...Object.keys(I18N.fr), ...Object.keys(I18N.en)]);
[...keys].sort().forEach(k => {
  const section = k.split(".")[0];
  out.push(
    `insert into public.contents (key, fr, en, section) values ` +
      `(${q(k)}, ${q(I18N.fr[k] ?? "")}, ${q(I18N.en[k] ?? "")}, ${q(section)}) ` +
      `on conflict (key) do update set fr = excluded.fr, en = excluded.en, ` +
      `section = excluded.section;`
  );
});

out.push("\ncommit;");
out.push(
  `\n-- Résumé : ${CATEGORIES.length} gammes, ` +
    `${CATEGORIES.reduce((s, c) => s + c.subs.length, 0)} sous-gammes, ` +
    `${PRODUCTS.length} références, ${keys.size} textes.`
);

process.stdout.write(out.join("\n") + "\n");
