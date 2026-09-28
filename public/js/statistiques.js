// =============================================================
// public/js/statistiques.js : calculs sur les prix d'un produit
//
// Utilisé par l'accueil (« Dès 750 FCFA »), le comparateur et la page
// produit. Tout part des lignes renvoyées par /api/prix : rien n'est
// inventé, et un calcul impossible (moins de deux prix) renvoie null.
//
// RM05 : seuls les prix disponibles ET dans l'unité de référence
// (comparable = true) entrent dans les calculs.
// =============================================================
import { el } from './dom.js';
import { formaterMontant, formaterNombre, libelleUnite, venduA } from './format.js';

// Prix comparables d'un produit, du moins cher au plus cher
export function lignesComparables(lignes) {
  return lignes
    .filter((l) => l.disponible && l.comparable)
    .sort((a, b) => a.montant - b.montant || a.marche.localeCompare(b.marche, 'fr'));
}

// { min, max, moyenne, ecart, pourcentage, moinsChers, plusChers } ou null
export function statistiques(lignes) {
  const comparables = lignesComparables(lignes);
  if (comparables.length === 0) return null;

  const montants = comparables.map((l) => l.montant);
  const min = Math.min(...montants);
  const max = Math.max(...montants);
  const moyenne = Math.round(montants.reduce((total, m) => total + m, 0) / montants.length);

  return {
    comparables,
    min,
    max,
    moyenne,
    ecart: max - min,
    // Économie en choisissant le moins cher plutôt que le plus cher
    pourcentage: max > 0 ? Math.round(((max - min) / max) * 100) : 0,
    moinsChers: comparables.filter((l) => l.montant === min),
    plusChers: comparables.filter((l) => l.montant === max),
  };
}

// Position d'un prix par rapport à la moyenne, pour le tableau comparatif
export function situation(ligne, stats) {
  if (!ligne.disponible) return { code: 'absent', texte: 'Non disponible' };
  if (!ligne.comparable) return { code: 'autre-unite', texte: `Vendu ${venduA(ligne.unite)}, non comparé` };
  if (!stats || stats.comparables.length < 2) return { code: 'seul', texte: 'Seul prix relevé' };
  if (ligne.montant === stats.min) {
    const ecartMoyenne = Math.round(((stats.moyenne - ligne.montant) / stats.moyenne) * 100);
    return { code: 'meilleur', texte: ecartMoyenne > 0 ? `−${ecartMoyenne} % vs moyenne` : 'Meilleur prix' };
  }
  if (ligne.montant === stats.max) {
    const ecartMoyenne = Math.round(((ligne.montant - stats.moyenne) / stats.moyenne) * 100);
    return { code: 'eleve', texte: `+${ecartMoyenne} % vs moyenne` };
  }
  return { code: 'standard', texte: 'Dans la moyenne' };
}

// Jauge horizontale des écarts (maquette du PM) : une barre par marché,
// longueur proportionnelle au prix. Construite en HTML et non en image :
// chaque ligne est lisible par un lecteur d'écran, et rien n'est téléchargé.
export function construireJauge(lignes, stats, { avecMoyenne = false } = {}) {
  const lignesJauge = [...lignes].sort((a, b) =>
    Number(!(a.disponible && a.comparable)) - Number(!(b.disponible && b.comparable))
    || (a.montant ?? 0) - (b.montant ?? 0));

  return lignesJauge.map((ligne) => {
    if (!ligne.disponible || !ligne.comparable) {
      return el('div', { class: 'jauge__ligne jauge__ligne--vide' },
        el('p', { class: 'jauge__marche' }, ligne.marche),
        el('p', { class: 'jauge__valeur' }, ligne.disponible ? 'Autre unité' : 'Donnée manquante'),
        el('div', { class: 'jauge__piste' },
          el('span', { class: 'jauge__attente' },
            ligne.disponible ? `Vendu ${venduA(ligne.unite)} : non comparé` : "En attente d'un relevé")));
    }

    const couleur = ligne.montant === stats.min ? 'vert'
      : ligne.montant === stats.max && stats.max !== stats.min ? 'orange' : 'sarcelle';
    // Au moins 8 % de largeur, pour que la barre la plus courte reste visible
    const largeur = Math.max(8, Math.round((ligne.montant / stats.max) * 100));
    const difference = ligne.montant - stats.min;

    return el('div', { class: 'jauge__ligne' },
      el('p', { class: 'jauge__marche' },
        couleur === 'vert' && el('i', { class: 'fa-solid fa-circle-check', 'aria-hidden': 'true' }),
        ' ', ligne.marche),
      el('p', { class: `jauge__valeur jauge__valeur--${couleur}` },
        formaterMontant(ligne.montant),
        difference > 0 && el('span', { class: 'jauge__difference' }, ` (+${formaterNombre(difference)} FCFA)`)),
      el('div', { class: 'jauge__piste' },
        el('span', {
          class: `jauge__barre jauge__barre--${couleur}`,
          style: `width: ${largeur}%`,
        }, el('span', { class: 'jauge__etiquette', 'aria-hidden': 'true' }, `${formaterNombre(ligne.montant)} F`)),
        avecMoyenne && el('span', {
          class: 'jauge__moyenne',
          style: `left: ${Math.round((stats.moyenne / stats.max) * 100)}%`,
          title: `Prix moyen : ${formaterMontant(stats.moyenne)}`,
          'aria-hidden': 'true',
        })));
  });
}

// « Le moins cher : Marché Total. Pour 10 kg, vous économisez 7 000 FCFA
//   par rapport au Marché Poto-Poto. »
export function conseil(stats, uniteReference) {
  if (!stats || stats.comparables.length < 2 || stats.ecart === 0) return null;
  const moinsCher = stats.moinsChers.map((l) => l.marche).join(' et ');
  const plusCher = stats.plusChers[0].marche;
  const unite = libelleUnite(uniteReference);
  // « 10 kg », « 10 litres », « 10 tas » (déjà au pluriel), « 10 pièces »
  const quantite = uniteReference === 'kg' ? '10 kg' : `10 ${unite.endsWith('s') ? unite : `${unite}s`}`;
  // « au Marché Poto-Poto », mais « à Poto-Poto » si le nom ne commence pas par « Marché »
  const article = /^marché /i.test(plusCher) ? 'au' : 'à';
  return `Le moins cher : ${moinsCher}. Pour ${quantite}, vous économisez `
    + `${formaterMontant(stats.ecart * 10)} par rapport ${article} ${plusCher}.`;
}
