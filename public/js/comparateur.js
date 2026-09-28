// =============================================================
// public/js/comparateur.js : comparateur multi-marchés (maquette du PM)
//
// ORDINATEUR : jusqu'à 4 produits comparés (puces dans le champ de
// recherche), une catégorie, un choix de marchés, un tableau OU des
// cartes, puis un graphique des écarts par produit.
// TÉLÉPHONE : un produit, un marché ou tous, le meilleur tarif,
// l'écart des prix et une carte par marché, avec un bouton de partage.
//
// Données : GET /api/prix?produit_id=… pour chaque produit (une ligne
// par marché, y compris les marchés sans prix : RM04). Tous les chiffres
// sont calculés ici, à partir de ces lignes.
// Adresse : /comparateur.html?produit=1,3&vue=cartes
// =============================================================
import { api } from './api.js';
import { el } from './dom.js';
import { formaterDate, formaterNombre, ilYA, libelleUnite, venduA } from './format.js';
import { statistiques } from './statistiques.js';
import { marches as listeMarches, quartier } from './coquille.js';

const $ = (selecteur) => document.querySelector(selecteur);
const ic = (nom, classe = '') => el('span', { class: `ms ${classe}`.trim(), 'aria-hidden': 'true' }, nom);

const MAX_PRODUITS = 4;

const etat = {
  produits: [],
  marches: [],
  choisis: [],            // identifiants des produits comparés, dans l'ordre
  lignes: new Map(),      // identifiant de produit -> lignes de /api/prix
  masques: new Set(),     // marchés décochés (ordinateur)
  marcheMobile: '',       // marché choisi sur téléphone ('' = tous)
  vue: 'tableau',
};

demarrer();

// ---------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------

async function demarrer() {
  try {
    [etat.produits, etat.marches] = await Promise.all([api.produits(), listeMarches()]);
  } catch (erreur) {
    afficherErreur(erreur.message);
    return;
  }
  if (etat.produits.length === 0) {
    afficherErreur("Aucun produit n'est encore enregistré.");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const demandes = (params.get('produit') ?? '').split(',').map(Number)
    .filter((id) => etat.produits.some((p) => p.id === id));
  etat.choisis = (demandes.length ? demandes : [etat.produits[0].id]).slice(0, MAX_PRODUITS);
  if (params.get('vue') === 'cartes') {
    etat.vue = 'cartes';
    document.querySelector('input[name="vue"][value="cartes"]').checked = true;
  }

  $('#chapeau-comparateur').textContent = `Analysez les écarts de prix entre ${enumerer(etat.marches.map(nomCourt))} pour optimiser votre panier de la ménagère.`;
  preparerOutils();
  preparerMobile();
  await charger();
}

// « Total, Poto-Poto, Moungali et Ouenzé »
function enumerer(mots) {
  return mots.length < 2 ? mots.join('') : `${mots.slice(0, -1).join(', ')} et ${mots.at(-1)}`;
}
const nomCourt = (m) => (m.nom ?? m).replace(/^Marché\s+(de\s+|d'|du\s+)?/i, '');

// ---------------------------------------------------------------
// Barre d'outils (ordinateur)
// ---------------------------------------------------------------

function preparerOutils() {
  // Liste de suggestions du champ de recherche
  $('#liste-produits').replaceChildren(...etat.produits.map((p) => el('option', { value: p.nom })));
  const champ = $('#ajout-produit');
  const ajouter = () => {
    const texte = champ.value.trim().toLowerCase();
    if (!texte) return;
    const produit = etat.produits.find((p) => p.nom.toLowerCase() === texte)
      ?? etat.produits.find((p) => p.nom.toLowerCase().includes(texte));
    champ.value = '';
    if (produit) choisirProduits([...etat.choisis.filter((id) => id !== produit.id), produit.id].slice(-MAX_PRODUITS));
  };
  champ.addEventListener('change', ajouter);
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); ajouter(); }
  });
  preparerMicro(champ, ajouter);

  // Catégories : choisir une catégorie compare ses premiers produits
  const categories = [...new Set(etat.produits.map((p) => p.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const select = $('#choix-categorie');
  categories.forEach((c) => select.append(el('option', { value: c }, c)));
  select.addEventListener('change', () => {
    if (!select.value) return;
    choisirProduits(etat.produits.filter((p) => p.categorie === select.value).map((p) => p.id).slice(0, MAX_PRODUITS));
  });

  // Tableau ou cartes
  document.querySelectorAll('input[name="vue"]').forEach((radio) => radio.addEventListener('change', () => {
    etat.vue = radio.value;
    ecrireAdresse();
    afficher();
  }));

  construirePucesMarches();
}

// Recherche vocale en français, seulement si le navigateur la propose
function preparerMicro(champ, ajouter) {
  const Reconnaissance = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const bouton = $('#micro');
  if (!Reconnaissance) return; // bouton laissé masqué
  bouton.hidden = false;
  bouton.addEventListener('click', () => {
    const ecoute = new Reconnaissance();
    ecoute.lang = 'fr-FR';
    ecoute.maxAlternatives = 1;
    bouton.classList.add('champ-produits__micro--actif');
    ecoute.addEventListener('result', (e) => {
      champ.value = e.results[0][0].transcript;
      ajouter();
    });
    ecoute.addEventListener('end', () => bouton.classList.remove('champ-produits__micro--actif'));
    ecoute.start();
  });
}

function choisirProduits(ids) {
  if (ids.length === 0) return;
  etat.choisis = ids;
  charger();
}

function construirePucesMarches() {
  const tous = el('label', { class: 'puce-marche puce-marche--tous' },
    el('input', { type: 'checkbox', checked: true }), ic('check_circle'), el('span', {}, 'Tous les marchés'));
  tous.querySelector('input').addEventListener('change', (e) => {
    etat.masques = e.target.checked ? new Set() : new Set(etat.marches.map((m) => m.id));
    majPuces();
    afficher();
  });
  const puces = etat.marches.map((m) => {
    const puce = el('label', { class: 'puce-marche' },
      el('input', { type: 'checkbox', checked: true, value: m.id }), ic('location_on'), el('span', {}, nomCourt(m)));
    puce.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) etat.masques.delete(m.id);
      else etat.masques.add(m.id);
      majPuces();
      afficher();
    });
    return puce;
  });
  $('#puces-marches').replaceChildren(tous, ...puces);
}

function majPuces() {
  $('#puces-marches .puce-marche--tous input').checked = etat.masques.size === 0;
  document.querySelectorAll('#puces-marches .puce-marche:not(.puce-marche--tous) input').forEach((c) => {
    c.checked = !etat.masques.has(Number(c.value));
  });
}

// Puces des produits comparés, dans le champ de recherche
function afficherProduitsChoisis() {
  $('#produits-choisis').replaceChildren(...etat.choisis.map((id) => {
    const produit = produitPar(id);
    return el('span', { class: 'puce-produit' },
      el('span', {}, produit.nom),
      etat.choisis.length > 1 && el('button', {
        type: 'button',
        'aria-label': `Retirer ${produit.nom} de la comparaison`,
        onclick: () => choisirProduits(etat.choisis.filter((x) => x !== id)),
      }, ic('close')));
  }));
}

// ---------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------

async function charger() {
  ecrireAdresse();
  afficherProduitsChoisis();
  try {
    const resultats = await Promise.all(etat.choisis.map((id) => api.prix({ produitId: id })));
    etat.lignes = new Map(etat.choisis.map((id, i) => [id, resultats[i]]));
    afficher();
    afficherMobile();
  } catch (erreur) {
    afficherErreur(erreur.message);
  }
}

function ecrireAdresse() {
  const params = new URLSearchParams({ produit: etat.choisis.join(',') });
  if (etat.vue === 'cartes') params.set('vue', 'cartes');
  window.history.replaceState(null, '', `?${params}`);
}

const produitPar = (id) => etat.produits.find((p) => p.id === id);
const lignesVisibles = (id) => (etat.lignes.get(id) ?? []).filter((l) => !etat.masques.has(l.marche_id));

// Du moins cher au plus cher ; autres unités, puis marchés sans prix
function trier(lignes) {
  const rang = (l) => (!l.disponible ? 2 : l.comparable ? 0 : 1);
  return [...lignes].sort((a, b) => rang(a) - rang(b) || (a.montant ?? 0) - (b.montant ?? 0));
}

// Médiane des prix comparables : la « référence » de la maquette
function mediane(stats) {
  const m = stats.comparables.map((l) => l.montant);
  const milieu = Math.floor(m.length / 2);
  return m.length % 2 ? m[milieu] : Math.round((m[milieu - 1] + m[milieu]) / 2);
}

// Situation d'un prix : meilleur, plus cher, dans la moyenne, autre unité, absent
function situation(ligne, stats) {
  if (!ligne.disponible) return 'absent';
  if (!ligne.comparable) return 'autre-unite';
  if (!stats || stats.comparables.length < 2) return 'seul';
  if (ligne.montant === stats.min) return 'meilleur';
  if (ligne.montant === stats.max) return 'eleve';
  return 'standard';
}

const pourcent = (valeur, base) => Math.round(((valeur - base) / base) * 100);
const lienProposer = (produitId, marcheId) => `/?proposer=1&produit=${produitId}${marcheId ? `&marche=${marcheId}` : ''}`;
const COULEURS = { meilleur: 'vert', eleve: 'orange', standard: 'sarcelle' };

// ---------------------------------------------------------------
// Affichage (ordinateur)
// ---------------------------------------------------------------

function afficher() {
  const groupes = etat.choisis.map((id) => {
    const lignes = lignesVisibles(id);
    return { produit: produitPar(id), lignes, stats: statistiques(lignes) };
  });

  afficherEcartMax(groupes);

  const total = groupes.reduce((n, g) => n + g.lignes.length, 0);
  $('#resume').textContent = `${groupes.length} produit${groupes.length > 1 ? 's' : ''} comparé${groupes.length > 1 ? 's' : ''} sur ${total} ligne${total > 1 ? 's' : ''}.`;

  $('#tableau-comparatif').hidden = etat.vue !== 'tableau';
  $('#vue-cartes').hidden = etat.vue !== 'cartes';

  if (total === 0) {
    $('#lignes-comparateur').replaceChildren(ligneMessage('Aucun marché sélectionné.'));
    $('#vue-cartes').replaceChildren(el('p', { class: 'chargement' }, 'Aucun marché sélectionné.'));
  } else {
    let pair = false;
    $('#lignes-comparateur').replaceChildren(...groupes.flatMap(({ produit, lignes, stats }) =>
      trier(lignes).map((ligne) => {
        pair = !pair;
        return ligneTableau(ligne, produit, stats, pair);
      })));
    $('#vue-cartes').replaceChildren(...groupes.map(({ produit, lignes, stats }) =>
      el('div', { class: 'groupe-cartes' },
        groupes.length > 1 && el('h2', { class: 'groupe-cartes__titre' }, produit.nom),
        el('div', { class: 'groupe-cartes__grille' }, ...trier(lignes).map((l) => carteMarche(l, produit, stats))))));
  }

  $('#jauges').replaceChildren(...groupes.filter((g) => g.stats && g.lignes.length > 1).map(jauge));
  afficherAppel(groupes[0]);
}

// Encart « Écart maximum observé » : le produit dont l'écart relatif est le plus grand
function afficherEcartMax(groupes) {
  const avecEcart = groupes.filter((g) => g.stats && g.stats.comparables.length > 1 && g.stats.ecart > 0)
    .sort((a, b) => b.stats.pourcentage - a.stats.pourcentage);
  const encart = $('#encart-ecart');
  encart.hidden = avecEcart.length === 0;
  if (encart.hidden) return;
  const { produit, stats } = avecEcart[0];
  $('#ecart-valeur').replaceChildren(`+${formaterNombre(stats.ecart)} FCFA `,
    el('span', {}, `/ ${libelleUnite(produit.unite_reference)}`));
  const moinsCher = stats.moinsChers[0].marche;
  $('#ecart-detail').textContent = `Soit ${stats.pourcentage} % d'économie ${/^marché /i.test(moinsCher) ? 'au' : 'à'} ${moinsCher}`
    + (groupes.length > 1 ? ` (${produit.nom})` : '');
}

function ligneTableau(ligne, produit, stats, pair) {
  const s = situation(ligne, stats);
  const couleur = COULEURS[s] ?? 'gris';
  const recent = ligne.fraicheur === 'recent';

  const celluleProduit = el('td', {},
    el('div', { class: `cellule-produit${s === 'absent' ? ' cellule-produit--attenue' : ''}` },
      vignette(produit, 'cellule-produit__visuel'),
      el('div', {},
        el('span', { class: 'cellule-produit__nom' }, produit.nom),
        el('span', { class: 'cellule-produit__unite' }, `Unité étalon • ${libelleUnite(produit.unite_reference)}`))));

  const celluleMarche = el('td', {},
    el('p', { class: 'cellule-marche__nom' }, ic('store', `texte-${couleur}`), el('span', {}, ligne.marche)),
    el('p', { class: 'cellule-marche__quartier' }, quartierDe(ligne.marche_id)));

  const cellulePrix = ligne.disponible
    ? el('td', {},
      el('p', { class: `prix-releve prix-releve--${s}` }, formaterNombre(ligne.montant),
        el('span', {}, ligne.comparable ? ' FCFA' : ` FCFA / ${libelleUnite(ligne.unite)}`)),
      el('p', { class: `prix-releve__note prix-releve__note--${s}` },
        { meilleur: 'Prix le plus bas', eleve: 'Tarif élevé', standard: 'Dans la moyenne', seul: 'Seul prix relevé', 'autre-unite': 'Autre unité, non comparé' }[s]))
    : el('td', {},
      el('p', { class: 'prix-absent' }, 'Prix non disponible'),
      el('p', { class: 'cellule-marche__quartier' }, 'Aucun relevé pour ce marché'));

  const celluleFraicheur = ligne.disponible
    ? el('td', {},
      el('span', { class: `pastille-fraicheur pastille-fraicheur--${ligne.fraicheur}` },
        recent ? el('span', { class: 'pastille-fraicheur__point', 'aria-hidden': 'true' }) : ic('warning'),
        recent ? 'Récent' : 'Ancien'),
      el('p', { class: `date-fraicheur${recent ? '' : ' date-fraicheur--ancien'}` },
        `${majuscule(ilYA(ligne.date_releve))} (${formaterDate(ligne.date_releve)})`))
    : el('td', {}, el('p', { class: 'tiret' }, '—'), el('p', { class: 'date-fraicheur date-fraicheur--vide' }, 'Aucune donnée disponible'));

  const moyenne = stats?.moyenne;
  const celluleStatut = el('td', {}, {
    meilleur: el('div', { class: 'statut-eco' },
      el('span', { class: 'etiquette-trophee' }, ic('emoji_events'), 'Meilleur prix'),
      moyenne && ligne.montant < moyenne && el('span', { class: 'statut-eco__detail' }, `${pourcent(ligne.montant, moyenne)} % vs moyenne`)),
    eleve: el('span', { class: 'etiquette-cher' }, ic('trending_up'), `+${pourcent(ligne.montant, stats?.min ?? ligne.montant)} % plus cher`),
    standard: el('span', { class: 'etiquette-standard' }, 'Prix standard'),
    seul: el('span', { class: 'etiquette-standard' }, 'Seul prix relevé'),
    'autre-unite': el('span', { class: 'etiquette-standard' }, `Vendu ${venduA(ligne.unite)}`),
    absent: el('span', { class: 'etiquette-absent' }, 'Non disponible'),
  }[s]);

  // Actions : comme la maquette, selon la situation du prix
  const lien = lienProposer(produit.id, ligne.marche_id);
  let actions;
  if (!ligne.disponible) {
    actions = [el('a', { class: 'action-renseigner', href: lien }, ic('edit_note'), 'Renseigner ce prix')];
  } else if (!recent || s === 'eleve') {
    actions = [el('a', { class: 'action-signaler', href: lien }, ic('notification_add'), 'Signaler nouveau prix')];
  } else {
    actions = [el('a', { class: 'action-detail', href: `/produit.html?id=${produit.id}` }, 'Détail')];
    if (s === 'meilleur') actions.push(el('a', { class: 'action-actualiser', href: lien }, ic('refresh'), 'Actualiser'));
  }

  return el('tr', { class: pair ? '' : 'ligne-teintee' },
    celluleProduit, celluleMarche, cellulePrix, celluleFraicheur, celluleStatut,
    el('td', { class: 'a-droite' }, el('div', { class: 'actions-ligne' }, ...actions)));
}

// Vue cartes (maquette : 4 cartes par ligne)
function carteMarche(ligne, produit, stats) {
  const s = situation(ligne, stats);
  const titre = el('p', { class: 'carte-comparateur__marche' }, ic('store', `texte-${COULEURS[s] ?? 'gris'}`), el('span', {}, nomCourt(ligne.marche)));
  const lien = lienProposer(produit.id, ligne.marche_id);

  if (!ligne.disponible) {
    return el('article', { class: 'carte-comparateur carte-comparateur--absent' },
      el('div', {}, titre,
        el('p', { class: 'carte-comparateur__absent' }, 'Non disponible'),
        el('p', { class: 'carte-comparateur__vide' }, 'Aucune donnée disponible')),
      el('a', { class: 'bouton-carte bouton-carte--principal', href: lien }, 'Renseigner ce prix'));
  }

  const recent = ligne.fraicheur === 'recent';
  const precision = {
    meilleur: stats?.moyenne > ligne.montant ? `${pourcent(ligne.montant, stats.moyenne)} %` : 'Meilleur prix',
    eleve: `+${pourcent(ligne.montant, stats?.min ?? ligne.montant)} %`,
    standard: 'Standard',
    'autre-unite': `Vendu ${venduA(ligne.unite)}`,
  }[s] ?? 'Seul prix';

  const boutons = (recent && s !== 'eleve')
    ? [el('a', { class: 'bouton-carte', href: `/produit.html?id=${produit.id}` }, 'Détail')]
    : [el('a', { class: 'bouton-carte bouton-carte--orange', href: lien }, 'Signaler nouveau prix')];
  if (recent && s === 'meilleur') boutons.push(el('a', { class: 'bouton-carte bouton-carte--vert', href: lien }, 'Actualiser'));

  return el('article', { class: 'carte-comparateur' },
    s === 'meilleur' && el('span', { class: 'carte-comparateur__ruban' }, 'Meilleur prix'),
    el('div', {},
      titre,
      el('p', { class: `carte-comparateur__prix prix-releve--${s}` }, formaterNombre(ligne.montant), el('span', {}, ' FCFA')),
      el('span', { class: `carte-comparateur__etat carte-comparateur__etat--${recent ? 'recent' : 'ancien'}` },
        recent ? el('span', { class: 'pastille-fraicheur__point', 'aria-hidden': 'true' }) : ic('warning'),
        `${majuscule(ilYA(ligne.date_releve))} • ${precision}`)),
    el('div', { class: 'carte-comparateur__actions' }, ...boutons));
}

// Graphique des écarts d'un produit (maquette : « Écarts constatés »)
function jauge({ produit, lignes, stats }) {
  const reference = mediane(stats);
  const plafond = stats.max * 1.05; // un peu d'air à droite de la barre la plus longue
  const moinsCher = stats.moinsChers[0];

  const barres = trier(lignes).map((ligne) => {
    const s = situation(ligne, stats);
    if (!ligne.disponible || !ligne.comparable) {
      return el('div', { class: 'barre-ecart barre-ecart--vide' },
        el('div', { class: 'barre-ecart__haut' },
          el('span', { class: 'barre-ecart__marche' }, ligne.marche),
          el('span', { class: 'barre-ecart__valeur' }, ligne.disponible ? `Vendu ${venduA(ligne.unite)}` : 'Donnée manquante')),
        el('div', { class: 'barre-ecart__piste' },
          el('span', { class: 'barre-ecart__attente' }, ligne.disponible ? 'Autre unité : non comparé' : "En attente d'un relevé citoyen")));
    }
    const couleur = COULEURS[s] ?? 'sarcelle';
    let detail;
    if (s === 'meilleur') detail = reference > ligne.montant ? `(−${formaterNombre(reference - ligne.montant)} FCFA vs référence)` : '(le moins cher)';
    else if (ligne.montant === reference) detail = '(Prix médian de la ville)';
    else if (s === 'eleve') detail = `(+${formaterNombre(ligne.montant - moinsCher.montant)} FCFA vs ${nomCourt(moinsCher.marche)})`;
    else detail = `(${ligne.montant > reference ? '+' : '−'}${formaterNombre(Math.abs(ligne.montant - reference))} FCFA vs référence)`;

    return el('div', { class: 'barre-ecart' },
      el('div', { class: 'barre-ecart__haut' },
        el('span', { class: 'barre-ecart__marche' },
          s === 'meilleur' && ic('verified', 'texte-vert'), s === 'eleve' && ic('trending_up', 'texte-orange'),
          el('span', {}, ligne.marche)),
        el('span', { class: `barre-ecart__valeur texte-${couleur}` }, `${formaterNombre(ligne.montant)} FCFA `,
          el('span', { class: 'barre-ecart__detail' }, detail))),
      el('div', { class: 'barre-ecart__piste' },
        el('span', {
          class: `barre-ecart__barre barre-ecart__barre--${couleur}`,
          style: `width: ${Math.max(10, Math.round((ligne.montant / plafond) * 100))}%`,
        }, `${formaterNombre(ligne.montant)} F`)));
  });

  const unite = libelleUnite(produit.unite_reference);
  const quantite = produit.unite_reference === 'kg' ? '10 kg' : `10 ${unite.endsWith('s') ? unite : `${unite}s`}`;
  const conseil = stats.ecart > 0
    ? `Privilégiez ${moinsCher.marche} pour ce produit (gain estimé : ${formaterNombre(stats.ecart * 10)} FCFA sur ${quantite}).`
    : 'Même prix dans tous les marchés comparés.';

  return el('section', { class: 'jauge-comparateur', 'aria-label': `Écarts constatés : ${produit.nom}` },
    el('div', { class: 'jauge-comparateur__entete' },
      el('div', {},
        el('p', { class: 'jauge-comparateur__surtitre' }, ic('bar_chart'), "Graphique d'alignement entre marchés"),
        el('h2', { class: 'jauge-comparateur__titre' }, `Écarts constatés : ${produit.nom} (${unite})`)),
      el('ul', { class: 'jauge-comparateur__legende' },
        el('li', {}, el('span', { class: 'pastille-legende pastille-legende--vert' }), 'Le plus abordable'),
        el('li', {}, el('span', { class: 'pastille-legende pastille-legende--sarcelle' }), 'Moyenne marché'),
        el('li', {}, el('span', { class: 'pastille-legende pastille-legende--orange' }), 'Coût élevé'))),
    el('div', { class: 'jauge-comparateur__barres' }, ...barres),
    el('div', { class: 'jauge-comparateur__conseil' },
      el('p', {}, ic('lightbulb', 'texte-vert-profond'), el('span', {}, el('strong', {}, 'Conseil du panier : '), conseil)),
      el('a', { href: `/produit.html?id=${produit.id}` }, 'Voir la fiche produit →')));
}

// Appel citoyen : les marchés où le prix manque ou est ancien
function afficherAppel(groupe) {
  if (!groupe) return;
  const aMettreAJour = groupe.lignes.filter((l) => !l.disponible || l.fraicheur === 'ancien').map((l) => nomCourt(l.marche));
  $('#titre-appel').textContent = aMettreAJour.length
    ? `Vous avez fait vos courses à ${aMettreAJour.slice(0, 2).join(' ou ')} ?`
    : 'Vous avez fait vos courses récemment ?';
  $('#appel-proposer').href = lienProposer(groupe.produit.id);
}

// ---------------------------------------------------------------
// Téléphone
// ---------------------------------------------------------------

function preparerMobile() {
  const select = $('#m-choix-produit');
  etat.produits.forEach((p) => select.append(el('option', { value: p.id }, p.nom)));
  select.addEventListener('change', () => {
    const id = Number(select.value);
    choisirProduits([id, ...etat.choisis.filter((x) => x !== id)].slice(0, MAX_PRODUITS));
  });

  const boutons = [];
  const puce = (valeur, libelle) => {
    const bouton = el('button', {
      type: 'button',
      role: 'radio',
      class: 'puce-mobile',
      'aria-checked': String(valeur === ''),
      onclick: () => {
        etat.marcheMobile = valeur;
        boutons.forEach((b) => b.setAttribute('aria-checked', String(b === bouton)));
        afficherMobile();
      },
    }, libelle);
    boutons.push(bouton);
    return bouton;
  };
  $('#m-marches').replaceChildren(puce('', `Tous les marchés (${etat.marches.length})`), ...etat.marches.map((m) => puce(String(m.id), nomCourt(m))));

  $('#partager').addEventListener('click', partager);
}

function afficherMobile() {
  const produit = produitPar(etat.choisis[0]);
  const lignes = etat.lignes.get(produit.id) ?? [];
  const stats = statistiques(lignes);
  const unite = libelleUnite(produit.unite_reference);

  $('#m-produit').textContent = produit.nom;
  $('#m-unite').textContent = `Conditionnement : ${venduA(produit.unite_reference)}`;
  $('#m-choix-produit').value = String(produit.id);
  $('#m-visuel').replaceChildren(produit.image ? el('img', { src: produit.image, alt: '', width: 48, height: 48 }) : ic('grain'));

  // Meilleur tarif
  $('#m-meilleur').hidden = !stats;
  if (stats) {
    const meilleur = stats.moinsChers[0];
    $('#m-meilleur-prix').replaceChildren(el('span', { class: 'meilleur-tarif__montant' }, formaterNombre(stats.min)),
      el('span', { class: 'meilleur-tarif__devise' }, ' FCFA'), el('span', { class: 'meilleur-tarif__unite' }, ` / ${unite}`));
    $('#m-meilleur-marche').textContent = meilleur.marche;
    $('#m-fiabilite').textContent = meilleur.fraicheur === 'recent' ? 'Prix récent' : 'Prix ancien';
    const economie = stats.comparables.length > 1 && stats.ecart > 0;
    $('#m-economie').hidden = !economie;
    if (economie) {
      $('#m-economie-texte').replaceChildren("Économisez jusqu'à ", el('strong', {}, `${formaterNombre(stats.ecart)} FCFA / ${unite}`),
        ` par rapport à ${stats.plusChers[0].marche}.`);
    }
  }

  // Écart des prix : repères min, milieu, max
  const avecEcart = Boolean(stats) && stats.comparables.length > 1;
  $('#m-ecart').hidden = !avecEcart;
  if (avecEcart) {
    const milieu = stats.comparables[Math.floor(stats.comparables.length / 2)];
    $('#m-moyenne').textContent = `Moyenne : ${formaterNombre(stats.moyenne)} F`;
    const repere = (ligne, libelle, classe) => el('div', { class: `repere repere--${classe}` },
      el('span', { class: 'repere__prix' }, `${formaterNombre(ligne.montant)} F${libelle}`),
      el('span', { class: 'repere__marche' }, nomCourt(ligne.marche)));
    $('#m-reperes').replaceChildren(
      repere(stats.comparables[0], ' (Min)', 'min'),
      stats.comparables.length > 2 ? repere(milieu, '', 'milieu') : el('span'),
      repere(stats.comparables.at(-1), ' (Max)', 'max'));
  }

  const affichees = trier(lignes).filter((l) => !etat.marcheMobile || String(l.marche_id) === etat.marcheMobile);
  $('#m-cartes').replaceChildren(...affichees.map((l) => carteMobile(l, produit, stats)));
}

function carteMobile(ligne, produit, stats) {
  const s = situation(ligne, stats);
  const icone = { meilleur: 'location_city', eleve: 'store', absent: 'shopping_basket' }[s] ?? 'storefront';
  const lien = lienProposer(produit.id, ligne.marche_id);
  const entete = el('div', { class: 'carte-marche-m__haut' },
    el('div', { class: 'carte-marche-m__gauche' },
      el('span', { class: `carte-marche-m__icone carte-marche-m__icone--${s}` }, ic(icone)),
      el('div', { class: 'carte-marche-m__textes' },
        el('h3', { class: 'carte-marche-m__nom' }, nomCourt(ligne.marche)),
        el('p', { class: 'carte-marche-m__quartier' }, quartierDe(ligne.marche_id)))),
    ligne.disponible
      ? el('div', { class: 'carte-marche-m__prix' },
        el('span', { class: `carte-marche-m__montant prix-releve--${s}` }, `${formaterNombre(ligne.montant)} F`),
        el('span', { class: 'carte-marche-m__unite' }, `par ${libelleUnite(ligne.unite)}`))
      : el('span', { class: 'carte-marche-m__non' }, 'Non renseigné'));

  if (!ligne.disponible) {
    return el('article', { class: 'carte-marche-m' }, entete,
      el('div', { class: 'carte-marche-m__encadre carte-marche-m__encadre--gris' },
        el('p', { class: 'carte-marche-m__aide' }, el('span', { class: 'carte-marche-m__rond' }, ic('help_outline')), 'Aucun prix relevé pour ce marché.'),
        el('a', { class: 'carte-marche-m__bouton', href: lien }, ic('add_circle'), 'Renseigner le prix')));
  }
  if (ligne.fraicheur === 'ancien') {
    return el('article', { class: 'carte-marche-m' }, entete,
      el('div', { class: 'carte-marche-m__encadre carte-marche-m__encadre--orange' },
        el('p', { class: 'carte-marche-m__alerte' }, ic('warning'), `Ancien (${ilYA(ligne.date_releve)})`),
        el('a', { class: 'carte-marche-m__bouton carte-marche-m__bouton--orange', href: lien }, ic('edit_calendar'), 'Mettre à jour')));
  }
  const libelle = { meilleur: 'Meilleur prix', eleve: 'Le plus cher', 'autre-unite': `Vendu ${venduA(ligne.unite)}` }[s] ?? 'Prix dans la moyenne';
  return el('article', { class: `carte-marche-m${s === 'meilleur' ? ' carte-marche-m--meilleur' : ''}` }, entete,
    el('div', { class: 'carte-marche-m__bas' },
      el('span', { class: `etat-m etat-m--${s}` }, el('span', { class: 'etat-m__point', 'aria-hidden': 'true' }), libelle),
      el('p', { class: 'carte-marche-m__meta' }, ic(s === 'meilleur' ? 'verified_user' : 'history'),
        `${majuscule(ilYA(ligne.date_releve))} · ${ligne.source === 'proposition' ? 'proposé par un habitant' : 'relevé officiel'}`)));
}

// Partage : WhatsApp, SMS… via le menu de partage du téléphone ; sinon, le lien est copié
async function partager() {
  const produit = produitPar(etat.choisis[0]);
  const stats = statistiques(etat.lignes.get(produit.id) ?? []);
  const texte = stats
    ? `${produit.nom} à Brazzaville : dès ${formaterNombre(stats.min)} FCFA ${venduA(produit.unite_reference)} (${stats.moinsChers[0].marche}), selon Zando Prix.`
    : `${produit.nom} : comparez les prix des marchés de Brazzaville sur Zando Prix.`;
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Zando Prix', text: texte, url });
      return;
    }
    await navigator.clipboard.writeText(`${texte} ${url}`);
    toast('Lien de comparaison copié ! Prêt à partager.');
  } catch (erreur) {
    if (erreur.name !== 'AbortError') toast("Le partage n'a pas pu être ouvert.");
  }
}

// ---------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------

function quartierDe(marcheId) {
  const marche = etat.marches.find((m) => m.id === marcheId);
  return marche ? quartier(marche) : '';
}

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

function vignette(produit, classe) {
  const initiale = () => el('span', { class: `${classe} vignette--initiale`, 'aria-hidden': 'true' }, produit.nom.charAt(0));
  if (!produit.image) return initiale();
  const image = el('img', { class: classe, src: produit.image, alt: '', width: 48, height: 48, loading: 'lazy' });
  image.addEventListener('error', () => image.replaceWith(initiale()), { once: true });
  return image;
}

function ligneMessage(texte) {
  return el('tr', {}, el('td', { colspan: 6, class: 'chargement' }, texte));
}

function afficherErreur(message) {
  $('#lignes-comparateur').replaceChildren(ligneMessage(message));
  $('#resume').textContent = message;
  $('#encart-ecart').hidden = true;
  $('#m-cartes').replaceChildren(el('p', { class: 'chargement' }, message));
}

let minuterieToast;
function toast(message) {
  $('#toast-message').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}
