// =============================================================
// Routes /api/registre : registre public des propositions (feature 18)
// Maquette « Suivi & Transparence des Propositions Citoyennes »
//
// GET /api/registre      liste filtrée, triée et paginée + compteurs + statistiques
// GET /api/registre.csv  le même registre, complet, au format CSV
//
// Règle de confidentialité : le registre ne contient JAMAIS l'auteur
// d'une proposition ni l'administrateur qui l'a traitée. Les colonnes
// sont choisies une à une ci-dessous : aucune n'est ajoutée par accident.
// =============================================================
import { Router } from 'express';
import { pool } from '../db.js';
import { ErreurApi } from '../erreurs.js';
import { STATUTS, dateValide, entierPositif, idOptionnel, normaliser, texteOptionnel } from '../validation.js';

const router = Router();

const PAR_PAGE = 25;
const EXPORT_MAX = 5000;
const TRIS = ['recent', 'prix_croissant', 'prix_decroissant', 'ecart'];

// « #PROP-0042 » : référence publique, lisible au téléphone ou au marché
export const reference = (id) => `#PROP-${String(id).padStart(4, '0')}`;

// prix_affiche : le prix en vigueur pour ce produit dans ce marché, dans la
// même unité, à la date où la proposition a été constatée. Les prix créés
// par la proposition elle-même (une fois publiée) ne comptent pas.
const SELECT_REGISTRE = `
  SELECT p.id, p.created_at, p.date_constat, p.montant, p.unite, p.statut, p.traitee_le, p.constat,
         pr.id AS produit_id, pr.nom AS produit, pr.categorie, pr.image, pr.unite_reference,
         m.id AS marche_id, m.nom AS marche, m.ville,
         (SELECT x.montant FROM prix x
          WHERE x.produit_id = p.produit_id
            AND x.marche_id = p.marche_id
            AND x.unite = p.unite
            AND x.date_releve <= p.date_constat
            AND x.proposition_id IS DISTINCT FROM p.id
          ORDER BY x.date_releve DESC, x.id DESC
          LIMIT 1) AS prix_affiche,
         (SELECT COUNT(*)::int FROM confirmations c WHERE c.proposition_id = p.id) AS confirmations,
         (SELECT COUNT(*)::int FROM confirmations c WHERE c.proposition_id = p.id AND c.conforme) AS confirmations_identiques
  FROM propositions p
  JOIN produits pr ON pr.id = p.produit_id
  JOIN marches  m  ON m.id  = p.marche_id
  WHERE ($1::int IS NULL OR p.marche_id = $1)
    AND ($2::text IS NULL OR pr.categorie = $2)
    AND ($3::date IS NULL OR p.date_constat >= $3)`;

// Lit et contrôle les filtres communs à la liste et au CSV
function lireFiltres(query) {
  const statut = texteOptionnel(query.statut, 'statut');
  if (statut !== undefined && !STATUTS.includes(statut)) {
    throw new ErreurApi(400, `Le statut doit valoir ${STATUTS.join(', ')}.`, 'statut');
  }
  const tri = texteOptionnel(query.tri, 'tri') ?? 'recent';
  if (!TRIS.includes(tri)) {
    throw new ErreurApi(400, `Le tri doit valoir ${TRIS.join(', ')}.`, 'tri');
  }
  // Période (page d'export) : seulement les prix constatés depuis cette date
  const depuis = texteOptionnel(query.depuis, 'depuis');
  if (depuis !== undefined && !dateValide(depuis)) {
    throw new ErreurApi(400, 'La date de début doit être au format AAAA-MM-JJ.', 'depuis');
  }
  return {
    statut,
    tri,
    depuis,
    marcheId: idOptionnel(query.marche_id, 'marche_id'),
    categorie: texteOptionnel(query.categorie, 'categorie'),
    recherche: normaliser(texteOptionnel(query.q, 'q') ?? ''),
  };
}

// Registre filtré (hors statut) et trié ; le statut est appliqué ensuite,
// pour que les compteurs des onglets restent justes.
async function lireRegistre({ marcheId, categorie, recherche, tri, depuis }) {
  const { rows } = await pool.query(SELECT_REGISTRE, [marcheId ?? null, categorie ?? null, depuis ?? null]);

  const lignes = rows.map((r) => ({
    id: r.id,
    reference: reference(r.id),
    recue_le: r.created_at,
    date_constat: r.date_constat,
    produit: { id: r.produit_id, nom: r.produit, categorie: r.categorie, image: r.image, unite_reference: r.unite_reference },
    marche: { id: r.marche_id, nom: r.marche, ville: r.ville },
    montant: r.montant,
    unite: r.unite,
    // Comment le prix a été constaté (le repère, lui, n'est jamais public)
    constat: r.constat,
    statut: r.statut,
    traitee_le: r.traitee_le,
    prix_affiche: r.prix_affiche,
    ecart: r.prix_affiche === null ? null : r.montant - r.prix_affiche,
    confirmations: { total: r.confirmations, identiques: r.confirmations_identiques },
  }));

  // Recherche sans accents ni majuscules, sur le produit, le marché ou la référence
  const trouvees = recherche
    ? lignes.filter((l) => [l.produit.nom, l.marche.nom, l.reference].some((t) => normaliser(t).includes(recherche)))
    : lignes;

  const comparer = {
    recent: (a, b) => b.recue_le - a.recue_le || b.id - a.id,
    prix_croissant: (a, b) => a.montant - b.montant || b.id - a.id,
    prix_decroissant: (a, b) => b.montant - a.montant || b.id - a.id,
    ecart: (a, b) => Math.abs(b.ecart ?? 0) - Math.abs(a.ecart ?? 0) || b.id - a.id,
  }[tri];
  return trouvees.sort(comparer);
}

// Chiffres des quatre cartes de la maquette, tous calculés sur la base réelle
async function statistiques() {
  const { rows: [s] } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS mois,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()) - interval '1 month'
                         AND created_at <  date_trunc('month', now()))::int AS mois_precedent,
      COUNT(*) FILTER (WHERE statut = 'validee')::int AS validees,
      COUNT(*) FILTER (WHERE statut = 'rejetee')::int AS rejetees,
      ROUND(AVG(EXTRACT(EPOCH FROM traitee_le - created_at) / 60)
            FILTER (WHERE traitee_le >= now() - interval '30 days'))::int AS delai_minutes
    FROM propositions`);
  const traitees = s.validees + s.rejetees;
  return {
    mois: s.mois,
    mois_precedent: s.mois_precedent,
    taux_admission: traitees > 0 ? Math.round((s.validees / traitees) * 100) : null,
    delai_moyen_minutes: s.delai_minutes,
  };
}

router.get('/', async (req, res) => {
  const filtres = lireFiltres(req.query);
  const page = idOptionnel(req.query.page, 'page') ?? 1;

  const registre = await lireRegistre(filtres);
  const compteurs = { total: registre.length };
  for (const statut of STATUTS) compteurs[statut] = registre.filter((l) => l.statut === statut).length;

  const filtrees = filtres.statut ? registre.filter((l) => l.statut === filtres.statut) : registre;
  // tout=1 : toutes les lignes d'un coup (page d'export), dans la limite d'EXPORT_MAX
  const tout = texteOptionnel(req.query.tout, 'tout') === '1';
  const parPage = tout ? EXPORT_MAX : PAR_PAGE;
  const pages = Math.max(1, Math.ceil(filtrees.length / parPage));

  // Écart moyen entre les prix proposés et les prix affichés (valeur absolue)
  const ecarts = registre.filter((l) => l.ecart !== null).map((l) => Math.abs(l.ecart));
  const stats = await statistiques();
  stats.ecart_moyen = ecarts.length ? Math.round(ecarts.reduce((a, b) => a + b, 0) / ecarts.length) : null;

  res.json({
    propositions: filtrees.slice((page - 1) * parPage, page * parPage),
    total: filtrees.length,
    page,
    pages,
    par_page: parPage,
    compteurs,
    statistiques: stats,
  });
});

// Une proposition du registre, par son numéro (page de confirmation d'envoi).
// Mêmes informations publiques que la liste : ni auteur, ni repère.
router.get('/:id', async (req, res) => {
  const id = entierPositif(req.params.id);
  const ligne = id === null ? undefined : (await lireRegistre({})).find((l) => l.id === id);
  if (!ligne) throw new ErreurApi(404, 'Proposition introuvable.');
  res.json(ligne);
});

// Une cellule CSV : entre guillemets si elle contient ; " ou un retour à la ligne
const cellule = (valeur) => {
  const texte = valeur === null || valeur === undefined ? '' : String(valeur);
  return /[;"\n\r]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
};

// Monté à part dans app.js sur /api/registre.csv
// Une ligne du registre (même format que la liste), pour le suivi privé
// d'une proposition par la personne qui l'a envoyée (routes/propositions.js)
export async function ligneDuRegistre(id) {
  return (await lireRegistre({})).find((l) => l.id === id);
}

export async function exporterCsv(req, res) {
  const filtres = lireFiltres(req.query);
  const registre = await lireRegistre(filtres);
  const lignes = filtres.statut ? registre.filter((l) => l.statut === filtres.statut) : registre;

  const entete = ['reference', 'recue_le', 'produit', 'categorie', 'marche', 'montant_fcfa', 'unite',
    'date_constat', 'constat', 'statut', 'prix_affiche_fcfa', 'ecart_fcfa', 'confirmations', 'confirmations_identiques'];
  const corps = lignes.map((l) => [
    l.reference, l.recue_le.toISOString(), l.produit.nom, l.produit.categorie, l.marche.nom, l.montant, l.unite,
    l.date_constat, l.constat, l.statut, l.prix_affiche, l.ecart, l.confirmations.total, l.confirmations.identiques,
  ].map(cellule).join(';'));

  const jour = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="registre-zando-prix-${jour}.csv"`);
  // \uFEFF (BOM) : Excel reconnaît alors l'UTF-8 et affiche bien les accents
  res.send(`\uFEFF${[entete.join(';'), ...corps].join('\r\n')}\r\n`);
}

export default router;
