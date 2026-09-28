// =============================================================
// public/js/fraicheur.js : guide de fraîcheur et d'étalonnage
// (maquette « Guide Fraîcheur & Étalonnage des Mesures »)
//
// - Étalons traditionnels : construits à partir des prix réellement
//   relevés dans une unité traditionnelle (tas, pièce, botte, sac).
//   L'équivalence en kilos n'est affichée que lorsqu'elle aura été
//   mesurée par l'équipe : rien n'est estimé à sa place.
// - Simulateur : prix payé ÷ quantité, comparé aux prix au kilo (ou au
//   litre) relevés à Brazzaville pour le même produit.
// =============================================================
import { api } from './api.js';
import { el } from './dom.js';
import { formaterMontant, formaterNombre, libelleUnite, venduA } from './format.js';
import { statistiques } from './statistiques.js';

const $ = (selecteur) => document.querySelector(selecteur);
const ic = (nom, classe = '') => el('span', { class: `ms ${classe}`.trim(), 'aria-hidden': 'true' }, nom);

const UNITES_TRADITIONNELLES = ['tas', 'piece', 'botte', 'sac'];
const NOMBRE_ETALONS = 6;
// « 400 F le tas », « 250 F la pièce »
const ARTICLES = { tas: 'le tas', piece: 'la pièce', botte: 'la botte', sac: 'le sac' };
const ICONES = { tas: 'nutrition', piece: 'category', botte: 'eco', sac: 'inventory_2' };
const CONSEILS = {
  tas: "Comparez la taille des tas d'un étal à l'autre : un tas plus gros peut justifier un prix plus élevé.",
  piece: 'Comparez le calibre des pièces : deux pièces au même prix ne pèsent pas toujours le même poids.',
  botte: 'Vérifiez la fraîcheur des feuilles et la taille de la botte avant de comparer les prix.',
  sac: "Vérifiez le poids écrit sur le sac et son état : un sac entamé ne se compare pas à un sac plein.",
};

const nomCourt = (nom) => nom.replace(/^Marché\s+(de\s+|d'|du\s+)?/i, '');

let etat;

demarrer();

async function demarrer() {
  $('#imprimer').addEventListener('click', () => window.print());
  try {
    const [produits, lignes] = await Promise.all([api.produits(), api.prix()]);
    etat = { produits, lignes };
  } catch (erreur) {
    $('#etalons').replaceChildren(el('p', { class: 'chargement' }, erreur.message));
    return;
  }
  afficherEtalons();
  preparerSimulateur();
}

// ---------------------------------------------------------------
// Étalons traditionnels
// ---------------------------------------------------------------

function afficherEtalons() {
  const groupes = new Map();
  for (const l of etat.lignes.filter((x) => x.disponible && UNITES_TRADITIONNELLES.includes(x.unite))) {
    const cle = `${l.produit_id}-${l.unite}`;
    if (!groupes.has(cle)) groupes.set(cle, { produit: etat.produits.find((p) => p.id === l.produit_id), unite: l.unite, lignes: [] });
    groupes.get(cle).lignes.push(l);
  }
  const etalons = [...groupes.values()].sort((a, b) => b.lignes.length - a.lignes.length).slice(0, NOMBRE_ETALONS);

  $('#nombre-etalons').textContent = `Affichage de ${etalons.length} étalon${etalons.length > 1 ? 's' : ''} relevé${etalons.length > 1 ? 's' : ''}`;
  if (etalons.length === 0) {
    $('#etalons').replaceChildren(el('p', { class: 'chargement' }, "Aucun prix n'a encore été relevé dans une unité traditionnelle."));
    return;
  }
  $('#etalons').replaceChildren(...etalons.map(carteEtalon));

  // Raccourcis de recherche : les premiers étalons
  const zone = $('#raccourcis-etalons');
  zone.append(...etalons.slice(0, 4).map((e) => el('button', {
    type: 'button',
    class: 'raccourci-etalon',
    onclick: () => {
      $('#recherche-etalons').value = e.produit.nom;
      filtrer();
    },
  }, `1 ${libelleUnite(e.unite)} ${e.produit.nom.toLowerCase()}`)));
  zone.hidden = false;
  $('#recherche-etalons').addEventListener('input', filtrer);
}

function carteEtalon({ produit, unite, lignes }) {
  const montants = lignes.map((l) => l.montant).sort((a, b) => a - b);
  const formats = montants[0] === montants.at(-1)
    ? `${formaterNombre(montants[0])} F ${ARTICLES[unite]}`
    : `${formaterNombre(montants[0])} F à ${formaterNombre(montants.at(-1))} F`;
  const marches = [...new Set(lignes.map((l) => nomCourt(l.marche)))];
  const reference = produit.unite_reference === unite;

  const image = produit.image
    ? el('img', { class: 'etalon__photo', src: produit.image, alt: '', loading: 'lazy' })
    : el('span', { class: 'etalon__photo vignette--initiale', 'aria-hidden': 'true' }, produit.nom.charAt(0));

  const ligne = (libelle, valeur, classe = '') => el('div', { class: 'etalon__ligne' },
    el('span', {}, libelle), el('span', { class: classe }, valeur));

  return el('article', { class: 'etalon', 'data-recherche': `${produit.nom} ${libelleUnite(unite)} ${marches.join(' ')}`.toLowerCase() },
    el('div', { class: 'etalon__haut' },
      el('div', { class: 'etalon__titres' },
        el('span', { class: 'etalon__icone' }, ic(ICONES[unite] ?? 'category')),
        el('div', {},
          el('h3', { class: 'etalon__titre' }, `${produit.nom} ${venduA(unite)}`),
          el('p', { class: 'etalon__sous' }, reference ? 'Unité de référence du produit' : `Référence du produit : ${venduA(produit.unite_reference)}`))),
      el('span', { class: 'etalon__marches' }, marches.length > 2 ? 'Plusieurs marchés' : marches.join(' & '))),
    el('div', { class: 'etalon__image' }, image, el('span', { class: 'etalon__etiquette' }, lignes[0].marche)),
    el('div', { class: 'etalon__lignes' },
      ligne('Unité marchande :', libelleUnite(unite).replace(/^./, (c) => c.toUpperCase())),
      ligne('Prix observés :', formats),
      ligne('Équivalence métrique :', reference ? 'Unité de référence' : "Pesée de l'équipe à venir", reference ? '' : 'etalon__attente'),
      el('div', { class: 'etalon__ligne etalon__ligne--prix' },
        el('span', {}, reference ? `Prix ${venduA(unite)} :` : 'Prix au kg standardisé :'),
        el('span', { class: 'etalon__prix' }, reference ? `${formaterNombre(Math.round(montants.reduce((a, b) => a + b, 0) / montants.length))} FCFA` : '—'))),
    el('p', { class: 'etalon__conseil' }, ic('tips_and_updates'), el('span', {}, el('strong', {}, 'Conseil : '), CONSEILS[unite])));
}

function filtrer() {
  const texte = $('#recherche-etalons').value.trim().toLowerCase();
  let visibles = 0;
  document.querySelectorAll('.etalon').forEach((carte) => {
    const garde = !texte || texte.split(/\s+/).every((mot) => carte.dataset.recherche.includes(mot));
    carte.hidden = !garde;
    if (garde) visibles += 1;
  });
  $('#etalons-aucun').hidden = visibles > 0;
}

// ---------------------------------------------------------------
// Simulateur
// ---------------------------------------------------------------

function preparerSimulateur() {
  // Produits vendus au kilo ou au litre, avec au moins un prix comparable
  const produits = etat.produits.filter((p) => ['kg', 'litre'].includes(p.unite_reference)
    && statistiques(etat.lignes.filter((l) => l.produit_id === p.id)));
  const select = $('#sim-produit');
  select.replaceChildren(...produits.map((p) => el('option', { value: p.id }, `${p.nom} (${venduA(p.unite_reference)})`)));

  const formulaire = $('#formulaire-simulateur');
  const poids = $('#sim-poids');
  const majPoids = () => {
    const produit = produits.find((p) => String(p.id) === select.value);
    const unite = produit?.unite_reference === 'litre' ? 'L' : 'kg';
    $('#sim-poids-texte').textContent = `${formaterNombre(Number(poids.value))} ${unite}`;
  };
  poids.addEventListener('input', () => { majPoids(); calculer(produits); });
  select.addEventListener('change', () => { majPoids(); calculer(produits); });
  $('#sim-prix').addEventListener('input', () => calculer(produits));
  formulaire.addEventListener('submit', (e) => { e.preventDefault(); calculer(produits); });
  formulaire.addEventListener('reset', () => setTimeout(() => { majPoids(); calculer(produits); }));
  majPoids();
  calculer(produits);
}

function calculer(produits) {
  const produit = produits.find((p) => String(p.id) === $('#sim-produit').value);
  const prix = Number($('#sim-prix').value);
  const quantite = Number($('#sim-poids').value);
  if (!produit || !(prix > 0) || !(quantite > 0)) {
    $('#sim-resultat').textContent = '—';
    $('#sim-message').textContent = 'Indiquez un prix payé et une quantité supérieurs à zéro.';
    $('#sim-verdict').hidden = true;
    $('#sim-jauge').hidden = true;
    return;
  }

  const unite = libelleUnite(produit.unite_reference);
  const parUnite = Math.round(prix / quantite);
  const stats = statistiques(etat.lignes.filter((l) => l.produit_id === produit.id));
  $('#sim-resultat').textContent = formaterNombre(parUnite);
  $('#sim-unite').textContent = `FCFA / ${unite}`;

  // Verdict : comparé aux prix relevés pour ce produit
  let verdict;
  if (parUnite <= stats.min) verdict = ['Excellente affaire', 'vert', 'thumb_up', `moins cher que tous les prix relevés à Brazzaville (le plus bas : ${formaterMontant(stats.min)}).`];
  else if (parUnite <= stats.moyenne) verdict = ['Bonne affaire', 'vert', 'thumb_up', `sous la moyenne des marchés de Brazzaville (${formaterMontant(stats.moyenne)}).`];
  else if (parUnite <= stats.max) verdict = ['Prix conforme', 'neutre', 'thumb_up', 'dans la fourchette des prix relevés à Brazzaville.'];
  else verdict = ['Au-dessus des prix relevés', 'orange', 'thumb_down', `plus cher que tous les prix relevés à Brazzaville (le plus haut : ${formaterMontant(stats.max)}).`];

  const [titre, couleur, icone, suite] = verdict;
  const badge = $('#sim-verdict');
  badge.hidden = false;
  badge.className = `resultat-simulateur__verdict resultat-simulateur__verdict--${couleur}`;
  badge.replaceChildren(ic(couleur === 'orange' ? 'warning' : 'check_circle'), titre);

  $('#sim-message').replaceChildren(ic(icone), el('span', {},
    `Ce prix pour ${formaterNombre(quantite)} ${produit.unite_reference === 'litre' ? 'L' : 'kg'} de `, el('strong', {}, produit.nom.toLowerCase()), ` est ${suite}`));

  // Jauge : du prix le plus bas au plus haut, avec votre prix placé dessus
  const jauge = $('#sim-jauge');
  jauge.hidden = stats.comparables.length < 2;
  if (!jauge.hidden) {
    const bas = stats.min * 0.8;
    const haut = stats.max * 1.2;
    const position = Math.min(100, Math.max(0, ((parUnite - bas) / (haut - bas)) * 100));
    $('#sim-min').textContent = `${nomCourt(stats.moinsChers[0].marche)} (plancher : ${formaterNombre(stats.min)} F)`;
    $('#sim-max').textContent = `${nomCourt(stats.plusChers[0].marche)} (plafond : ${formaterNombre(stats.max)} F)`;
    $('#sim-position').style.left = `${position}%`;
    $('#sim-position').className = `resultat-simulateur__curseur-prix resultat-simulateur__curseur-prix--${couleur}`;
    $('#sim-moyenne').textContent = `${formaterNombre(stats.moyenne)} F`;
  }
}
