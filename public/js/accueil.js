// =============================================================
// public/js/accueil.js : page d'accueil (stories 1 à 6)
// Page d'accueil : stories 1 à 6
//
// Organisation du fichier :
//   Démarrage   : lit les filtres de l'adresse, charge produits et marchés
//   Chargement  : interroge /api/prix à chaque changement de filtre
//   Affichage   : construit une « planche » par produit
//   Catégories  : puces de filtre (hors cadrage)
//
// <script type="module"> : le fichier peut utiliser import/export, et il
// s'exécute après la lecture complète du HTML (les éléments existent déjà).
// =============================================================
import { api } from './api.js';
import { el, choisirSiPresent, remplirSelect } from './dom.js';
import { formaterDate, formaterNombre, ilYA, libelleUnite, venduA } from './format.js';
import { chargerChartJs, dessinerGraphique, lignesComparables } from './graphique.js';
import { initialiserCarrousel } from './carrousel.js';
import { initialiserProposition, ouvrirProposition } from './proposition.js';

// Raccourci : $('#recherche') au lieu de document.querySelector('#recherche')
const $ = (selecteur) => document.querySelector(selecteur);

const filtres = $('#filtres');
const champRecherche = $('#recherche');
const champProduit = $('#filtre-produit');
const champMarche = $('#filtre-marche');
const boutonEffacer = $('#effacer-filtres');
const blocCategories = $('#categories');
const zonePuces = $('#puces-categories');
const zoneResultats = $('#resultats');
const resume = $('#resume');

// État de la page : les listes chargées une fois au démarrage
const etat = { produits: [], marches: [] };
// Numéro de la dernière requête lancée (voir charger())
let numeroRequete = 0;
// Délai de la recherche pendant la frappe (voir brancherEvenements())
let minuterie;
// Graphiques affichés : à détruire avant de reconstruire les planches
const graphiques = new Set();

// Icône Font Awesome de chaque catégorie (décorative). Une catégorie
// absente de cette liste reçoit l'icône du panier.
const ICONES_CATEGORIES = {
  'Céréales': 'fa-wheat-awn',
  'Féculents': 'fa-bowl-food',
  'Légumes': 'fa-carrot',
  'Légumineuses': 'fa-seedling',
  'Huiles': 'fa-bottle-droplet',
  'Poissons': 'fa-fish',
  'Viandes et œufs': 'fa-drumstick-bite',
  'Épicerie': 'fa-jar',
};
const icone = (classe) => el('i', { class: `fa-solid ${classe}`, 'aria-hidden': 'true' });
const iconeCategorie = (categorie) => icone(ICONES_CATEGORIES[categorie] ?? 'fa-basket-shopping');

initialiserCarrousel();
demarrer();

// ---------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------

async function demarrer() {
  // Les filtres sont gardés dans l'adresse : un lien partagé
  // (par WhatsApp, par exemple) rouvre la même vue.
  const params = new URLSearchParams(window.location.search);
  champRecherche.value = params.get('q') ?? '';

  let toutesLesLignes;
  try {
    // La grille complète, sans filtre, sert aux chiffres clés de l'en-tête
    [etat.produits, etat.marches, toutesLesLignes] = await Promise.all([
      api.produits(), api.marches(), api.prix(),
    ]);
  } catch (erreur) {
    etatVide(erreur.message, bouton('Réessayer', () => window.location.reload()));
    return;
  }

  afficherChiffres(toutesLesLignes);
  remplirSelect(champProduit, etat.produits.map((p) => ({ valeur: p.id, libelle: p.nom })), 'Tous');
  remplirSelect(champMarche, etat.marches.map((m) => ({ valeur: m.id, libelle: m.nom })), 'Tous');
  choisirSiPresent(champProduit, params.get('produit'));
  choisirSiPresent(champMarche, params.get('marche'));
  construirePuces(params.get('categorie'));

  initialiserProposition({ produits: etat.produits, marches: etat.marches });
  brancherEvenements();
  await charger();

  // Arrivée par /?proposer=1 (lien « Proposer un prix » des autres pages) : on ouvre le dialogue.
  // charger() a déjà réécrit l'adresse sans ce paramètre.
  if (params.has('proposer')) proposer();
}

function brancherEvenements() {
  // « Debounce » : on attend 250 ms sans nouvelle frappe avant de chercher.
  // Taper « manioc » ne déclenche ainsi qu'une requête au lieu de six,
  // ce qui compte sur une connexion mobile lente ou chère.
  champRecherche.addEventListener('input', () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(charger, 250);
  });
  champProduit.addEventListener('change', charger);
  champMarche.addEventListener('change', charger);
  // Un seul écouteur pour toutes les puces de catégorie : l'événement
  // « change » d'un bouton radio remonte jusqu'à leur conteneur.
  zonePuces.addEventListener('change', charger);

  filtres.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    clearTimeout(minuterie);
    charger();
  });

  boutonEffacer.addEventListener('click', () => {
    champRecherche.value = '';
    champProduit.value = '';
    champMarche.value = '';
    choisirCategorie('');
    charger();
    champRecherche.focus();
  });

  document.querySelectorAll('[data-proposer]').forEach((b) => {
    b.addEventListener('click', (evenement) => {
      evenement.preventDefault();
      proposer();
    });
  });
}

// ---------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------

// Recharge les prix selon les filtres. Problème classique : si l'on tape
// vite, deux requêtes partent et la plus ANCIENNE peut revenir en DERNIER,
// affichant des résultats périmés. Chaque appel prend donc un numéro, et
// seule la réponse portant le dernier numéro est affichée.
async function charger() {
  const numero = ++numeroRequete;
  const recherche = champRecherche.value.trim();
  const produitId = champProduit.value;
  const marcheId = champMarche.value;
  const categorie = categorieChoisie();

  ecrireAdresse({ q: recherche, produit: produitId, marche: marcheId, categorie });
  boutonEffacer.hidden = !(recherche || produitId || marcheId || categorie);
  // aria-busy : indique aux lecteurs d'écran que la zone se met à jour
  zoneResultats.setAttribute('aria-busy', 'true');

  try {
    // Promise.all lance les deux requêtes EN MÊME TEMPS et attend les deux :
    // plus rapide que de les enchaîner.
    const [lignes, trouves] = await Promise.all([
      api.prix({ produitId, marcheId, categorie }),
      recherche ? api.produits(recherche) : null,
    ]);
    // Une saisie plus récente a déjà relancé une requête : on ignore celle-ci
    if (numero !== numeroRequete) return;
    afficher(lignes, trouves, { recherche, produitId, marcheId, categorie });
  } catch (erreur) {
    if (numero !== numeroRequete) return;
    etatVide(erreur.message, bouton('Réessayer', charger));
  } finally {
    if (numero === numeroRequete) zoneResultats.setAttribute('aria-busy', 'false');
  }
}

// Met les filtres dans l'adresse (?q=riz&marche=2) sans recharger la page.
// replaceState (et non pushState) : on ne crée pas une entrée d'historique
// à chaque lettre tapée, le bouton « Retour » reste utilisable.
// « 24 produits suivis · 4 marchés · Dernier relevé : aujourd'hui »
function afficherChiffres(lignes) {
  const dates = lignes.filter((l) => l.disponible).map((l) => l.date_releve);
  $('#chiffre-produits').textContent = formaterNombre(etat.produits.length);
  $('#chiffre-marches').textContent = formaterNombre(etat.marches.length);
  // Les dates AAAA-MM-JJ se trient correctement comme du texte
  const derniere = dates.sort().at(-1);
  $('#chiffre-releve').textContent = derniere ? ilYA(derniere) : 'aucun';
  $('#chiffres').hidden = false;
}

function ecrireAdresse(valeurs) {
  const params = new URLSearchParams();
  for (const [nom, valeur] of Object.entries(valeurs)) if (valeur) params.set(nom, valeur);
  const chaine = params.toString();
  window.history.replaceState(null, '', chaine ? `?${chaine}` : window.location.pathname);
}

// ---------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------

function afficher(lignes, trouves, { recherche, produitId, marcheId, categorie }) {
  // Un Set permet de tester « cet identifiant est-il trouvé ? » instantanément
  const idsTrouves = trouves && new Set(trouves.map((p) => p.id));

  // Regroupe les lignes de la grille par produit
  const groupes = new Map();
  for (const ligne of lignes) {
    if (idsTrouves && !idsTrouves.has(ligne.produit_id)) continue;
    if (!groupes.has(ligne.produit_id)) groupes.set(ligne.produit_id, []);
    groupes.get(ligne.produit_id).push(ligne);
  }

  if (groupes.size === 0) {
    if (recherche) {
      etatVide(
        `Aucun produit ne correspond à « ${recherche} ».`,
        bouton('Effacer la recherche', () => {
          champRecherche.value = '';
          charger();
          champRecherche.focus();
        }),
      );
    } else {
      etatVide("Aucun produit n'est encore enregistré.");
    }
    return;
  }

  const aDesPrix = (lignesProduit) => lignesProduit.some((l) => l.disponible);
  const nombrePrix = [...groupes.values()].filter(aDesPrix).length;
  const marche = etat.marches.find((m) => String(m.id) === marcheId);

  // RM04 : aucune information n'est inventée, l'absence est dite clairement
  const precisions = [categorie && `la catégorie ${categorie}`, marche?.nom].filter(Boolean);
  if (nombrePrix === 0 && precisions.length > 0) {
    etatVide(`Aucun prix disponible pour ${precisions.join(' et ')} pour le moment.`, boutonProposer());
    return;
  }
  if (nombrePrix === 0 && !recherche && !produitId) {
    etatVide('Aucun prix disponible pour le moment.', boutonProposer());
    return;
  }

  // Produits avec des prix d'abord, puis ceux qui n'en ont pas
  const planches = [...groupes.values()]
    .sort((a, b) => Number(aDesPrix(b)) - Number(aDesPrix(a)))
    .map((lignesProduit) => planche(lignesProduit, Boolean(marche)));

  detruireGraphiques();
  zoneResultats.replaceChildren(...planches);

  // Un seul produit affiché (filtre ou recherche précise) : son graphique
  // s'ouvre directement, c'est la vue la plus parlante.
  if (planches.length === 1) planches[0].querySelector('.planche__graphique-bouton')?.click();

  const total = groupes.size === 1 ? '1 produit affiché' : `${groupes.size} produits affichés`;
  resume.classList.remove('sr-only');
  resume.textContent = total
    + (categorie ? ` dans la catégorie ${categorie}` : '')
    + (marche ? ` pour ${marche.nom}` : '');
}

// Une « planche » = la carte d'un produit avec les prix de chaque marché.
// el() crée les éléments HTML sans jamais passer par innerHTML (voir dom.js).
function planche(lignes, filtreMarche) {
  const { produit_id: id, produit: nom } = lignes[0];
  const produit = etat.produits.find((p) => p.id === id);
  const disponibles = lignes.filter((l) => l.disponible);
  const idTitre = `produit-${id}`;

  // Graphique : seulement s'il y a au moins deux prix à comparer.
  // Chart.js n'est téléchargé qu'au premier clic (voir graphique.js).
  const comparables = lignesComparables(lignes);
  const avecGraphique = comparables.length >= 2;
  const zoneGraphique = avecGraphique
    ? el('div', { class: 'planche__graphique', id: `graphique-${id}`, hidden: true },
      el('div', { class: 'graphique', style: `height: ${comparables.length * 2.75 + 2.5}rem` },
        el('canvas', {})),
      el('p', { class: 'graphique__erreur', role: 'status', hidden: true }),
      el('p', { class: 'graphique__legende' },
        el('span', { class: 'graphique__pastille', 'aria-hidden': 'true' }),
        ' Meilleur prix'))
    : null;

  return el('article', { class: 'planche', 'aria-labelledby': idTitre },
    el('header', { class: 'planche__entete' },
      vignette(produit, nom),
      el('div', { class: 'planche__intitule' },
        produit?.categorie && el('p', { class: 'planche__categorie' },
          iconeCategorie(produit.categorie), ' ', produit.categorie),
        el('h2', { class: 'planche__titre', id: idTitre }, nom),
        produit && el('p', { class: 'planche__unite' }, `Prix comparés ${venduA(produit.unite_reference)}`)),
      avecGraphique && el('button', {
        type: 'button',
        class: 'planche__graphique-bouton',
        'aria-expanded': 'false',
        'aria-controls': `graphique-${id}`,
        title: 'Comparer en graphique',
        onclick: (e) => basculerGraphique(e.currentTarget, zoneGraphique, nom, comparables),
      },
      // Icône locale et non Font Awesome : ce bouton doit rester visible
      // même si le CDN d'icônes ne répond pas
      el('img', { src: '/images/icone-graphique.svg', alt: '', width: 20, height: 20 }),
      el('span', { class: 'sr-only' }, `Comparer les prix de ${nom} en graphique`))),

    zoneGraphique,

    // Sans filtre de marché, un produit sans aucun prix a un message unique.
    // Avec un filtre, on affiche la ligne du marché : "Prix non disponible".
    disponibles.length === 0 && !filtreMarche
      ? el('p', { class: 'planche__vide' }, 'Aucun prix disponible pour ce produit pour le moment.')
      : el('ul', { class: 'releves' }, trier(lignes).map(releve)),

    el('footer', { class: 'planche__pied' },
      el('button', {
        type: 'button',
        class: 'bouton bouton--secondaire bouton--compact planche__proposer',
        'aria-label': `Proposer un prix pour ${nom}`,
        onclick: () => proposer(id),
      }, icone('fa-plus'), ' Proposer un prix')));
}

// Ouvre ou ferme le graphique d'une planche. Il n'est dessiné qu'à la
// première ouverture : rien n'est calculé pour les produits qu'on ne regarde pas.
async function basculerGraphique(bouton, zone, nom, lignes) {
  const ouvrir = zone.hidden;
  zone.hidden = !ouvrir;
  bouton.setAttribute('aria-expanded', String(ouvrir));
  bouton.classList.toggle('planche__graphique-bouton--actif', ouvrir);
  if (!ouvrir || zone.dataset.dessine) return;

  const erreur = zone.querySelector('.graphique__erreur');
  const cadre = zone.querySelector('.graphique');
  erreur.hidden = true;
  cadre.hidden = false;
  bouton.setAttribute('aria-busy', 'true');
  try {
    await chargerChartJs();
    // La planche a pu être retirée pendant le téléchargement (filtre changé)
    if (!zone.isConnected) return;
    graphiques.add(dessinerGraphique(zone.querySelector('canvas'), nom, lignes));
    zone.dataset.dessine = 'oui';
  } catch (probleme) {
    // Un problème de graphique ne doit jamais casser la page : on l'explique,
    // les prix restent affichés juste au-dessus.
    console.error(probleme);
    cadre.hidden = true;
    erreur.textContent = 'Le graphique ne peut pas être affiché pour le moment. Les prix ci-dessus restent valables.';
    erreur.hidden = false;
  } finally {
    bouton.removeAttribute('aria-busy');
  }
}

function detruireGraphiques() {
  for (const graphique of graphiques) graphique.destroy();
  graphiques.clear();
}

// Photo du produit. Sans photo, ou si le fichier est introuvable,
// on affiche l'initiale : jamais d'image cassée.
function vignette(produit, nom) {
  const initiale = () =>
    el('span', { class: 'vignette vignette--initiale', 'aria-hidden': 'true' }, nom.charAt(0));
  if (!produit?.image) return initiale();

  // alt vide : le nom du produit est écrit juste à côté
  const image = el('img', {
    class: 'vignette',
    src: produit.image,
    alt: '',
    width: 72,
    height: 72,
    loading: 'lazy',
    decoding: 'async',
  });
  image.addEventListener('error', () => image.replaceWith(initiale()), { once: true });
  return image;
}

// Du moins cher au plus cher ; unités non comparables puis prix manquants à la fin
function trier(lignes) {
  const rang = (l) => (!l.disponible ? 2 : l.comparable ? 0 : 1);
  return [...lignes].sort((a, b) =>
    rang(a) - rang(b)
    || (a.montant ?? 0) - (b.montant ?? 0)
    || a.marche.localeCompare(b.marche, 'fr'));
}

// Une ligne de prix d'un marché. Les informations de couleur (meilleur prix,
// fraîcheur) sont TOUJOURS doublées d'un texte (« Meilleur prix », « Récent ») :
// une information portée par la seule couleur échappe aux daltoniens.
function releve(ligne) {
  if (!ligne.disponible) {
    return el('li', { class: 'releve releve--absent' },
      el('span', { class: 'releve__marche' }, ligne.marche),
      el('span', { class: 'releve__absent' }, 'Prix non disponible'));
  }

  const classes = [
    'releve',
    ligne.est_meilleur_prix && 'releve--meilleur',
    !ligne.comparable && 'releve--hors-comparaison',
  ].filter(Boolean).join(' ');

  const recent = ligne.fraicheur === 'recent';

  return el('li', { class: classes },
    el('span', { class: 'releve__marche' }, ligne.marche),
    el('span', { class: 'releve__prix' },
      // <data value="1200">1 200</data> : texte formaté pour l'humain,
      // valeur brute lisible par les programmes (et par les tests e2e)
      el('data', { class: 'releve__montant', value: ligne.montant }, formaterNombre(ligne.montant)),
      el('span', { class: 'releve__unite' }, `FCFA / ${libelleUnite(ligne.unite)}`)),
    el('span', { class: 'releve__infos' },
      ligne.est_meilleur_prix && el('span', { class: 'etiquette-meilleur' }, 'Meilleur prix'),
      el('span', { class: `fraicheur fraicheur--${ligne.fraicheur}` }, recent ? 'Récent' : 'Ancien'),
      el('span', {}, `Relevé le ${formaterDate(ligne.date_releve)} (${ilYA(ligne.date_releve)})`),
      !ligne.comparable && el('span', { class: 'note' }, `Vendu ${venduA(ligne.unite)}, non comparé`),
      ligne.source === 'proposition' && el('span', { class: 'note' }, 'Proposé par un utilisateur, vérifié')));
}

// ---------------------------------------------------------------
// Catégories (hors cadrage, @a-valider)
// ---------------------------------------------------------------

// Boutons radio : navigation au clavier avec les flèches, sans code en plus
function construirePuces(categorieDemandee) {
  const categories = [...new Set(etat.produits.map((p) => p.categorie).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
  if (categories.length === 0) return;

  const puce = (valeur, libelle, classeIcone) =>
    el('label', { class: 'puce' },
      el('input', { type: 'radio', name: 'categorie', value: valeur }),
      el('span', {}, icone(classeIcone), libelle));

  zonePuces.replaceChildren(
    puce('', 'Toutes', 'fa-border-all'),
    ...categories.map((c) => puce(c, c, ICONES_CATEGORIES[c] ?? 'fa-basket-shopping')),
  );
  choisirCategorie(categories.includes(categorieDemandee) ? categorieDemandee : '');
  blocCategories.hidden = false;
}

// input:checked = le bouton radio coché ; ?.value évite une erreur s'il n'y en a pas
function categorieChoisie() {
  return zonePuces.querySelector('input:checked')?.value ?? '';
}

function choisirCategorie(valeur) {
  const radio = [...zonePuces.querySelectorAll('input')].find((r) => r.value === valeur);
  if (radio) radio.checked = true;
}

// ---------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------

function etatVide(message, action) {
  detruireGraphiques();
  zoneResultats.replaceChildren(
    el('div', { class: 'vide' }, el('p', { class: 'vide__message' }, message), action));
  // Le message est déjà visible dans l'encadré : le résumé ne sert qu'aux lecteurs d'écran
  resume.classList.add('sr-only');
  resume.textContent = message;
}

function bouton(libelle, action) {
  return el('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: action }, libelle);
}

function boutonProposer() {
  return el('button', { type: 'button', class: 'bouton bouton--principal', onclick: () => proposer() }, 'Proposer un prix');
}

function proposer(produitId) {
  ouvrirProposition({
    produitId: produitId ?? (champProduit.value || undefined),
    marcheId: champMarche.value || undefined,
  });
}
