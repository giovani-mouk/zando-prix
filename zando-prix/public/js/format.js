// =============================================================
// public/js/format.js : mise en forme pour l'affichage
// Mise en forme des montants, unités et dates pour l'affichage
//
// L'API renvoie des données brutes (750, "kg", "2026-09-20") ;
// ce module les transforme en texte lisible (« 750 FCFA », « au kilo »,
// « 20 septembre »). Aucune autre partie du front ne formate elle-même.
// =============================================================

// Intl.NumberFormat est fourni par le navigateur : il applique les règles
// françaises (espace insécable entre les milliers : 1 200). On le crée une
// seule fois, car sa construction est coûteuse.
const nombres = new Intl.NumberFormat('fr-FR');

export const formaterNombre = (valeur) => nombres.format(valeur);
export const formaterMontant = (valeur) => `${nombres.format(valeur)} FCFA`;

// Même liste que le domaine unite_mesure (db/schema.sql)
export const UNITES = {
  kg: { libelle: 'kg', vendu: 'au kilo' },
  litre: { libelle: 'litre', vendu: 'au litre' },
  tas: { libelle: 'tas', vendu: 'au tas' },
  piece: { libelle: 'pièce', vendu: 'à la pièce' },
  botte: { libelle: 'botte', vendu: 'à la botte' },
  sac: { libelle: 'sac', vendu: 'au sac' },
};

// ?. (chaînage optionnel) : si l'unité est inconnue, UNITES[unite] vaut undefined
// et l'expression s'arrête sans erreur ; ?? fournit alors une valeur de repli.
export const libelleUnite = (unite) => UNITES[unite]?.libelle ?? unite;
export const venduA = (unite) => UNITES[unite]?.vendu ?? `par ${unite}`;

// "2026-09-20" -> Date locale. new Date("2026-09-20") serait lue en UTC
// et pourrait afficher la veille selon le fuseau horaire.
export function versDate(iso) {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

export function aujourdhuiIso() {
  const d = new Date();
  const deuxChiffres = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
}

// "2026-09-20" -> "20 septembre" (l'année seulement si ce n'est pas l'année en cours)
export function formaterDate(iso) {
  const date = versDate(iso);
  const options = { day: 'numeric', month: 'long' };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
  return date.toLocaleDateString('fr-FR', options);
}

// Horodatage complet (created_at, traitee_le) -> "23 septembre"
export function formaterInstant(horodatage) {
  return new Date(horodatage).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// "aujourd'hui", "hier", "il y a 3 jours"
export function ilYA(iso) {
  // Soustraire deux dates donne des millisecondes ; 86 400 000 ms = 1 jour.
  // Math.round absorbe l'heure en plus ou en moins des changements d'heure.
  const jours = Math.round((versDate(aujourdhuiIso()) - versDate(iso)) / 86_400_000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return 'hier';
  return `il y a ${jours} jours`;
}
