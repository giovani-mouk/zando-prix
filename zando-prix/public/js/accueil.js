// =============================================================
// public/js/accueil.js : page d'accueil (stories 1 à 6, maquette du PM)
//
// La page a deux présentations, comme la maquette :
// - ORDINATEUR : recherche, barre de filtres, une carte par produit,
//   tendance de la semaine, baromètre de fraîcheur ;
// - TÉLÉPHONE : votre marché, produits indispensables, panier type,
//   « Prix du jour en direct » ; « Tout voir » affiche la liste complète.
// Les deux lisent les mêmes données. Tous les chiffres sont calculés à
// partir de l'API : aucune valeur de la maquette n'est recopiée.
//
// Organisation du fichier :
//   Démarrage   : lit l'adresse (?q=, ?marche=, ?categorie=), charge les données
//   Liste       : filtres, tri, cartes par produit (ordinateur, et « Tout voir »)
//   Téléphone   : votre marché, raccourcis, panier type, prix en direct
//   Tendance    : bandeau « Tendance globale de la semaine »
// =============================================================
import { api } from './api.js';
import { el, choisirSiPresent, remplirSelect } from './dom.js';
import { formaterDate, formaterNombre, ilYA, libelleUnite, venduA } from './format.js';
import { statistiques } from './statistiques.js';
import { choisirMarcheReference, lireMarcheReference } from './coquille.js';
import { initialiserProposition, ouvrirProposition } from './proposition.js';

const $ = (selecteur) => document.querySelector(selecteur);

const champRecherche = $('#recherche');
const champMarche = $('#filtre-marche');
const boutonEffacer = $('#effacer-filtres');
const boutonEffacerRecherche = $('#effacer-recherche');
const blocCategories = $('#categories');
const zonePuces = $('#puces-categories');
const zoneResultats = $('#resultats');
const resume = $('#resume');

// Données chargées au démarrage (et à chaque « Actualiser »)
const etat = { produits: [], marches: [], lignes: [], produitDemande: '' };
// Numéro de la dernière requête lancée (voir charger())
let numeroRequete = 0;
let minuterie;

const NOMBRE_FREQUENTS = 8;       // raccourcis sous la recherche (ordinateur)
const NOMBRE_INDISPENSABLES = 7;  // raccourcis défilants (téléphone)
const NOMBRE_EN_DIRECT = 4;       // produits de « Prix du jour en direct » (téléphone)

// Icône Material Symbols (décorative)
const ic = (nom) => el('span', { class: 'ms', 'aria-hidden': 'true' }, nom);

// Pictogrammes des raccourcis mobiles (maquette), d'après le nom du produit
const EMOJIS = [
  [/riz/i, '🌾'], [/tomate/i, '🍅'], [/banane|plantain/i, '🍌'], [/oignon/i, '🧅'],
  [/maïs|mais/i, '🌽'], [/manioc|chikwangue|igname|patate/i, '🥔'], [/piment/i, '🌶️'],
  [/poisson|chinchard/i, '🐟'], [/huile/i, '🫒'], [/arachide/i, '🥜'], [/haricot/i, '🫘'],
  [/œuf|oeuf/i, '🥚'], [/poulet/i, '🍗'], [/saka|gombo/i, '🥬'], [/farine/i, '🌾'],
];
const emoji = (nom) => EMOJIS.find(([motif]) => motif.test(nom))?.[1] ?? '🛒';

demarrer();

// ---------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------

async function demarrer() {
  // Les filtres sont gardés dans l'adresse : un lien partagé rouvre la même vue
  const params = new URLSearchParams(window.location.search);
  champRecherche.value = params.get('q') ?? '';
  etat.produitDemande = params.get('produit') ?? '';

  try {
    await chargerDonnees();
  } catch (erreur) {
    etatVide(erreur.message, bouton('Réessayer', () => window.location.reload()));
    return;
  }

  remplirSelect(champMarche, etat.marches.map((m) => ({ valeur: m.id, libelle: m.nom })), 'Tous les marchés');
  choisirSiPresent(champMarche, params.get('marche'));
  construirePuces(params.get('categorie'));
  if (params.get('tri') === 'fraicheur') document.querySelector('input[name="tri"][value="fraicheur"]').checked = true;
  // Arrivée depuis un lien « ?marche= » ou une recherche : la liste complète est utile aussi sur téléphone
  if (params.get('q') || params.get('marche') || params.get('categorie')) document.body.classList.add('voir-tout');

  initialiserProposition({ produits: etat.produits, marches: etat.marches });
  brancherEvenements();
  afficherMobile();
  afficherTendance();
  await charger();

  // Arrivée par /?proposer=1 (liens « Proposer un prix » des autres pages)
  if (params.has('proposer')) proposer(etat.produitDemande || undefined, params.get('marche') || undefined);
}

// Produits, marchés et grille complète des prix (sert aux cartes du téléphone,
// aux raccourcis et aux chiffres clés). La tendance est chargée à part :
// son absence ne doit pas empêcher d'afficher les prix.
async function chargerDonnees() {
  [etat.produits, etat.marches, etat.lignes] = await Promise.all([
    api.produits(), api.marches(), api.prix(),
  ]);
  afficherChiffres();
  construireFrequents();
}

function brancherEvenements() {
  // « Debounce » : on attend 250 ms sans nouvelle frappe avant de chercher
  champRecherche.addEventListener('input', () => {
    boutonEffacerRecherche.hidden = champRecherche.value === '';
    clearTimeout(minuterie);
    minuterie = setTimeout(charger, 250);
  });
  boutonEffacerRecherche.addEventListener('click', () => {
    champRecherche.value = '';
    boutonEffacerRecherche.hidden = true;
    charger();
    champRecherche.focus();
  });
  $('#recherche-rapide').addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    clearTimeout(minuterie);
    await charger();
    allerAuxResultats();
  });

  champMarche.addEventListener('change', charger);
  zonePuces.addEventListener('change', charger);
  document.querySelectorAll('input[name="tri"]').forEach((radio) => radio.addEventListener('change', charger));
  $('#filtres').addEventListener('submit', (evenement) => evenement.preventDefault());

  boutonEffacer.addEventListener('click', () => {
    champRecherche.value = '';
    champMarche.value = '';
    choisirCategorie('');
    charger();
  });

  document.querySelectorAll('[data-proposer]').forEach((b) => {
    b.addEventListener('click', (evenement) => {
      evenement.preventDefault();
      proposer();
    });
  });

  // Téléphone
  $('#recherche-mobile').addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    champRecherche.value = $('#recherche-mobile-champ').value.trim();
    await montrerTout();
  });
  $('#tout-voir').addEventListener('click', () => {
    const ouvert = document.body.classList.toggle('voir-tout');
    $('#tout-voir').setAttribute('aria-expanded', String(ouvert));
    if (ouvert) allerAuxResultats();
  });
  $('#changer-marche').addEventListener('click', changerDeMarche);

  // Événements de l'en-tête (coquille.js)
  document.addEventListener('zp:marche', afficherMobile);
  document.addEventListener('zp:actualiser', async (evenement) => {
    evenement.preventDefault(); // pas de rechargement de page : on recharge les données
    try {
      await chargerDonnees();
      afficherMobile();
      afficherTendance();
      await charger();
    } catch (erreur) {
      etatVide(erreur.message, bouton('Réessayer', () => window.location.reload()));
    }
  });
}

// ---------------------------------------------------------------
// Liste complète : filtres, tri et cartes par produit
// ---------------------------------------------------------------

// Recharge les prix selon les filtres. Chaque appel prend un numéro, et seule
// la réponse portant le dernier numéro est affichée : une réponse lente et
// périmée ne remplace jamais une réponse plus récente.
async function charger() {
  const numero = ++numeroRequete;
  const recherche = champRecherche.value.trim();
  const marcheId = champMarche.value;
  const categorie = categorieChoisie();
  const tri = document.querySelector('input[name="tri"]:checked')?.value ?? 'prix';

  ecrireAdresse({ q: recherche, marche: marcheId, categorie, tri: tri === 'prix' ? '' : tri });
  boutonEffacer.hidden = !(recherche || marcheId || categorie);
  boutonEffacerRecherche.hidden = recherche === '';
  zoneResultats.setAttribute('aria-busy', 'true');

  try {
    const [lignes, trouves] = await Promise.all([
      api.prix({ marcheId, categorie }),
      recherche ? api.produits(recherche) : null,
    ]);
    if (numero !== numeroRequete) return;
    afficher(lignes, trouves, { recherche, marcheId, categorie, tri });
  } catch (erreur) {
    if (numero !== numeroRequete) return;
    etatVide(erreur.message, bouton('Réessayer', charger));
  } finally {
    if (numero === numeroRequete) zoneResultats.setAttribute('aria-busy', 'false');
  }
}

// replaceState : met les filtres dans l'adresse sans créer d'entrée d'historique
function ecrireAdresse(valeurs) {
  const params = new URLSearchParams();
  for (const [nom, valeur] of Object.entries(valeurs)) if (valeur) params.set(nom, valeur);
  const chaine = params.toString();
  window.history.replaceState(null, '', chaine ? `?${chaine}` : window.location.pathname);
}

// « Relevés consolidés sur 4 marchés · 24 produits »
function afficherChiffres() {
  const note = $('#chiffres');
  const s = (n) => (n > 1 ? 's' : '');
  note.textContent = `Relevés consolidés sur ${etat.marches.length} marché${s(etat.marches.length)}`
    + ` · ${etat.produits.length} produit${s(etat.produits.length)}`;
  note.hidden = false;
}

function afficher(lignes, trouves, { recherche, marcheId, categorie, tri }) {
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
      etatVide(`Aucun produit ne correspond à « ${recherche} ».`, bouton('Effacer la recherche', () => {
        champRecherche.value = '';
        charger();
        champRecherche.focus();
      }));
    } else {
      etatVide("Aucun produit n'est encore enregistré.");
    }
    return;
  }

  const aDesPrix = (lignesProduit) => lignesProduit.some((l) => l.disponible);
  const marche = etat.marches.find((m) => String(m.id) === marcheId);

  // RM04 : aucune information n'est inventée, l'absence est dite clairement
  if ([...groupes.values()].every((l) => !aDesPrix(l))) {
    const precisions = [categorie && `la catégorie ${categorie}`, marche?.nom].filter(Boolean);
    etatVide(`Aucun prix disponible${precisions.length ? ` pour ${precisions.join(' et ')}` : ''} pour le moment.`, boutonProposer());
    return;
  }

  // Tri « Fraîcheur récente » : les produits relevés le plus récemment d'abord
  const derniereDate = (l) => l.filter((x) => x.disponible).map((x) => x.date_releve).sort().at(-1) ?? '';
  const groupesTries = [...groupes.values()].sort((a, b) =>
    Number(aDesPrix(b)) - Number(aDesPrix(a))
    || (tri === 'fraicheur' ? derniereDate(b).localeCompare(derniereDate(a)) : 0));

  zoneResultats.replaceChildren(...groupesTries.map((l) => carteProduit(l, Boolean(marche), tri)));

  const total = groupes.size === 1 ? '1 produit affiché' : `${groupes.size} produits affichés`;
  resume.classList.remove('sr-only');
  resume.textContent = total + (categorie ? ` dans la catégorie ${categorie}` : '') + (marche ? ` pour ${marche.nom}` : '');
}

// Carte d'un produit (maquette : « Prix du Jour dans les Marchés »)
function carteProduit(lignes, filtreMarche, tri) {
  const { produit_id: id, produit: nom } = lignes[0];
  const produit = etat.produits.find((p) => p.id === id);
  const stats = statistiques(lignes);
  const disponibles = lignes.filter((l) => l.disponible);
  const idTitre = `produit-${id}`;

  return el('article', { class: 'carte-prix', 'aria-labelledby': idTitre },
    el('div', { class: 'carte-prix__entete' },
      el('div', { class: 'carte-prix__produit' },
        vignette(produit, nom, 'carte-prix__vignette'),
        el('div', {},
          produit?.categorie && el('p', { class: 'carte-prix__categorie' }, produit.categorie),
          el('h3', { class: 'carte-prix__nom', id: idTitre }, nom),
          produit && el('p', { class: 'carte-prix__unite' }, `Unité étalon : ${venduA(produit.unite_reference)}`))),
      // « Dès 750 FCFA » : le prix comparable le plus bas
      stats && el('p', { class: 'carte-prix__des' },
        el('span', { class: 'carte-prix__des-libelle' }, 'Dès'),
        el('span', { class: 'carte-prix__des-montant' }, `${formaterNombre(stats.min)} `,
          el('span', { class: 'carte-prix__des-devise' }, 'FCFA')))),

    disponibles.length === 0 && !filtreMarche
      ? el('p', { class: 'carte-prix__vide' }, 'Aucun prix disponible pour ce produit pour le moment.')
      : el('ul', { class: 'carte-prix__marches' }, trier(lignes, tri).map(ligneMarche)),

    el('a', { class: 'carte-prix__lien', href: `/comparateur.html?produit=${id}` },
      el('span', {}, 'Voir comparatif complet'), ic('arrow_forward')));
}

// Du moins cher au plus cher (ou du plus récent au plus ancien) ;
// autres unités puis marchés sans prix à la fin
function trier(lignes, tri) {
  const rang = (l) => (!l.disponible ? 2 : l.comparable ? 0 : 1);
  return [...lignes].sort((a, b) => rang(a) - rang(b)
    || (tri === 'fraicheur'
      ? (b.date_releve ?? '').localeCompare(a.date_releve ?? '')
      : (a.montant ?? 0) - (b.montant ?? 0))
    || a.marche.localeCompare(b.marche, 'fr'));
}

// Une ligne de marché. La couleur (meilleur prix, fraîcheur) est TOUJOURS
// doublée d'un texte : une information portée par la seule couleur
// échappe aux daltoniens.
function ligneMarche(ligne) {
  if (!ligne.disponible) {
    return el('li', { class: 'ligne-marche ligne-marche--absent' },
      el('div', { class: 'ligne-marche__gauche' },
        ic('location_on'),
        el('div', {},
          el('p', { class: 'ligne-marche__nom' }, ligne.marche),
          el('p', { class: 'ligne-marche__meta' }, 'Aucun prix relevé'))),
      el('span', { class: 'etiquette-grise' }, 'Aucune donnée récente'));
  }

  const recent = ligne.fraicheur === 'recent';
  const classes = ['ligne-marche', ligne.est_meilleur_prix && 'ligne-marche--meilleur', !ligne.comparable && 'ligne-marche--autre-unite']
    .filter(Boolean).join(' ');

  return el('li', { class: classes },
    el('div', { class: 'ligne-marche__gauche' },
      ic('location_on'),
      el('div', {},
        el('p', { class: 'ligne-marche__nom' }, ligne.marche),
        el('p', { class: `ligne-marche__meta ligne-marche__meta--${ligne.fraicheur}` },
          el('span', { class: 'ligne-marche__point', 'aria-hidden': 'true' }),
          el('time', { datetime: ligne.date_releve, title: `Relevé le ${formaterDate(ligne.date_releve)}` },
            `Relevé ${ilYA(ligne.date_releve)} • ${recent ? 'Récent' : 'Ancien'}`)),
        !ligne.comparable && el('p', { class: 'ligne-marche__note' }, `Vendu ${venduA(ligne.unite)}, non comparé`),
        ligne.source === 'proposition' && el('p', { class: 'ligne-marche__note' }, 'Proposé par un habitant, vérifié'))),
    el('div', { class: 'ligne-marche__droite' },
      ligne.est_meilleur_prix && el('span', { class: 'etiquette-meilleur' }, 'Meilleur prix'),
      el('p', { class: 'ligne-marche__prix' },
        // <data value="750"> : valeur brute lisible par les programmes (tests e2e)
        el('data', { class: 'ligne-marche__montant', value: ligne.montant }, formaterNombre(ligne.montant)),
        el('span', { class: 'ligne-marche__devise' }, ligne.comparable ? ' FCFA' : ` FCFA / ${libelleUnite(ligne.unite)}`))));
}

// Photo du produit ; sans photo (ou fichier introuvable) : l'initiale
function vignette(produit, nom, classe) {
  const initiale = () => el('span', { class: `${classe} vignette--initiale`, 'aria-hidden': 'true' }, nom.charAt(0));
  if (!produit?.image) return initiale();
  const image = el('img', { class: classe, src: produit.image, alt: '', width: 64, height: 64, loading: 'lazy', decoding: 'async' });
  image.addEventListener('error', () => image.replaceWith(initiale()), { once: true });
  return image;
}

// Catégories : boutons radio présentés comme des onglets (« Tous les vivres » d'abord)
function construirePuces(categorieDemandee) {
  const categories = [...new Set(etat.produits.map((p) => p.categorie).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
  if (categories.length === 0) return;

  const puce = (valeur, libelle) =>
    el('label', { class: 'puce' },
      el('input', { type: 'radio', name: 'categorie', value: valeur }),
      el('span', {}, libelle));

  zonePuces.replaceChildren(puce('', 'Tous les vivres'), ...categories.map((c) => puce(c, c)));
  choisirCategorie(categories.includes(categorieDemandee) ? categorieDemandee : '');
  blocCategories.hidden = false;
}

function categorieChoisie() {
  return zonePuces.querySelector('input:checked')?.value ?? '';
}

function choisirCategorie(valeur) {
  const radio = [...zonePuces.querySelectorAll('input')].find((r) => r.value === valeur);
  if (radio) radio.checked = true;
}

// Raccourcis « Fréquents » : les premiers produits du catalogue qui ont un prix
function construireFrequents() {
  const frequents = produitsAvecPrix().slice(0, NOMBRE_FREQUENTS);
  if (frequents.length === 0) return;
  $('#puces-frequentes').replaceChildren(...frequents.map((produit) =>
    el('button', {
      type: 'button',
      class: 'puce-rapide',
      onclick: async () => {
        champRecherche.value = produit.nom;
        await charger();
        allerAuxResultats();
      },
    }, produit.nom)));
  $('#frequents').hidden = false;
}

function produitsAvecPrix() {
  const avecPrix = new Set(etat.lignes.filter((l) => l.disponible).map((l) => l.produit_id));
  return etat.produits.filter((p) => avecPrix.has(p.id));
}

function allerAuxResultats() {
  const cible = window.matchMedia('(max-width: 47.99rem)').matches ? $('#tous-les-prix') : $('#titre-prix');
  cible.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  zoneResultats.focus({ preventScroll: true });
}

// Téléphone : affiche la liste complète puis y descend
async function montrerTout() {
  document.body.classList.add('voir-tout');
  $('#tout-voir').setAttribute('aria-expanded', 'true');
  await charger();
  allerAuxResultats();
}

// ---------------------------------------------------------------
// Téléphone : votre marché, raccourcis, panier type, prix en direct
// ---------------------------------------------------------------

function marcheReference() {
  const id = lireMarcheReference();
  return etat.marches.find((m) => String(m.id) === id) ?? null;
}

function afficherMobile() {
  const reference = marcheReference();
  const semaine = etat.lignes.filter((l) => l.disponible && joursDepuis(l.date_releve) < 7
    && (!reference || l.marche_id === reference.id));

  $('#position-nom').textContent = reference ? reference.nom : 'Tous les marchés';
  $('#position-detail').textContent = `${semaine.length} relevé${semaine.length > 1 ? 's' : ''} cette semaine`;

  afficherIndispensables();
  afficherPanier(reference);
  afficherEnDirect(reference);
}

function joursDepuis(iso) {
  return Math.round((Date.now() - new Date(`${iso}T12:00:00`)) / 86_400_000);
}

// Bouton « Changer de marché » : le marché le plus proche si la position des
// marchés est connue et que la personne l'accepte ; sinon, la liste des marchés.
async function changerDeMarche() {
  const select = $('#marche-reference');
  const avecPosition = etat.marches.filter((m) => m.latitude !== null && m.longitude !== null);
  if (avecPosition.length === 0 || !navigator.geolocation) {
    select.focus();
    select.showPicker?.();
    return;
  }
  navigator.geolocation.getCurrentPosition((position) => {
    // La position reste dans le navigateur : elle n'est jamais envoyée au serveur
    const { latitude, longitude } = position.coords;
    const distance = (m) => (m.latitude - latitude) ** 2 + (m.longitude - longitude) ** 2;
    const proche = [...avecPosition].sort((a, b) => distance(a) - distance(b))[0];
    choisirMarcheReference(proche.id);
    $('#position-libelle').textContent = 'Position détectée';
  }, () => {
    select.focus();
    select.showPicker?.();
  }, { timeout: 8000, maximumAge: 600_000 });
}

// Favoris choisis sur les fiches produit (mémorisés dans ce navigateur)
function favoris() {
  try {
    return JSON.parse(localStorage.getItem('zando-prix:favoris') ?? '[]');
  } catch {
    return [];
  }
}

function afficherIndispensables() {
  // Les favoris d'abord, puis les premiers produits du catalogue
  const ids = favoris();
  const produits = [...produitsAvecPrix()]
    .sort((a, b) => Number(ids.includes(b.id)) - Number(ids.includes(a.id)))
    .slice(0, NOMBRE_INDISPENSABLES);
  const bloc = document.querySelector('.indispensables');
  bloc.hidden = produits.length === 0;
  const cherche = champRecherche.value.trim().toLowerCase();
  $('#indispensables').replaceChildren(...produits.map((produit) =>
    el('button', {
      type: 'button',
      class: `raccourci${produit.nom.toLowerCase() === cherche ? ' raccourci--actif' : ''}`,
      onclick: async () => {
        champRecherche.value = produit.nom;
        $('#recherche-mobile-champ').value = produit.nom;
        afficherIndispensables();
        await montrerTout();
      },
    }, el('span', { 'aria-hidden': 'true' }, emoji(produit.nom)), el('span', {}, produit.nom))));
}

// Panier type : les produits dont on connaît le prix (dans l'unité de
// référence) dans les DEUX marchés comparés. Rien n'est estimé.
function afficherPanier(reference) {
  const carte = $('#carte-panier');
  const comparables = etat.lignes.filter((l) => l.disponible && l.comparable);
  const prixDe = (marcheId) => new Map(comparables.filter((l) => l.marche_id === marcheId).map((l) => [l.produit_id, l.montant]));

  const comparer = (a, b) => {
    const pa = prixDe(a.id);
    const pb = prixDe(b.id);
    const communs = [...pa.keys()].filter((id) => pb.has(id));
    const totalA = communs.reduce((t, id) => t + pa.get(id), 0);
    const totalB = communs.reduce((t, id) => t + pb.get(id), 0);
    return { a, b, communs: communs.length, totalA, totalB, ecart: totalB - totalA };
  };

  // Sans marché choisi, on part du marché le moins cher sur l'ensemble
  const candidats = etat.marches.flatMap((a) => etat.marches.filter((b) => b.id !== a.id).map((b) => comparer(a, b)))
    .filter((c) => c.communs >= 2);
  const pour = reference ? candidats.filter((c) => c.a.id === reference.id) : candidats;
  // La comparaison la plus parlante : le plus grand écart
  const choix = pour.sort((x, y) => Math.abs(y.ecart) - Math.abs(x.ecart))[0];

  carte.hidden = !choix || choix.ecart === 0;
  if (carte.hidden) return;

  const court = (m) => m.nom.replace(/^Marché\s+(de\s+|du\s+)?/i, '');
  const economie = choix.ecart > 0;
  $('#titre-panier').textContent = economie
    ? `−${formaterNombre(choix.ecart)} FCFA d'économie`
    : `+${formaterNombre(-choix.ecart)} FCFA de plus`;
  $('#panier-texte').textContent = `Sur le panier type ${court(choix.a)} vs ${choix.b.nom} (${choix.communs} produits relevés dans les deux marchés).`;
  $('#panier-a').textContent = `${court(choix.a)} : ${formaterNombre(choix.totalA)} F`;
  $('#panier-b').textContent = `${court(choix.b)} : ${formaterNombre(choix.totalB)} F`;
  $('#panier-barre').style.width = `${Math.round(Math.min(choix.totalA / choix.totalB, 1) * 100)}%`;
}

// « Prix du jour en direct » : les premiers produits qui ont au moins
// deux prix comparables. Deux grandes cartes, puis deux vignettes.
function afficherEnDirect(reference) {
  const parProduit = new Map();
  for (const l of etat.lignes) {
    if (!parProduit.has(l.produit_id)) parProduit.set(l.produit_id, []);
    parProduit.get(l.produit_id).push(l);
  }
  const choisis = etat.produits
    .map((p) => ({ produit: p, lignes: parProduit.get(p.id) ?? [] }))
    .filter(({ lignes }) => (statistiques(lignes)?.comparables.length ?? 0) >= 2)
    .slice(0, NOMBRE_EN_DIRECT);

  $('#tout-voir').textContent = `Tout voir (${etat.produits.length})`;

  const grandes = choisis.slice(0, 2).map(({ produit, lignes }) => carteDirecte(produit, lignes, reference));
  const petites = choisis.slice(2);
  const vignettes = petites.length > 0
    ? [el('div', { class: 'vignettes-direct' }, ...petites.map(({ produit, lignes }) => vignetteDirecte(produit, lignes)))]
    : [];
  $('#en-direct').replaceChildren(...grandes, ...vignettes);
}

function carteDirecte(produit, lignes, reference) {
  const stats = statistiques(lignes);
  const comparables = stats.comparables; // du moins cher au plus cher
  // Marché mis en avant : le vôtre s'il a un prix comparable, sinon le moins cher
  const principal = comparables.find((l) => reference && l.marche_id === reference.id) ?? comparables[0];
  // Marché de comparaison : le moins cher si le vôtre ne l'est pas, sinon le suivant
  const autre = principal.montant === stats.min
    ? comparables.find((l) => l !== principal)
    : comparables[0];
  const ecart = principal.montant - autre.montant;
  const court = (nom) => nom.replace(/^Marché\s+/i, '');

  return el('article', { class: 'carte-direct' },
    el('div', { class: 'carte-direct__haut' },
      el('div', { class: 'carte-direct__produit' },
        vignette(produit, produit.nom, 'carte-direct__vignette'),
        el('div', { class: 'carte-direct__textes' },
          el('h3', { class: 'carte-direct__nom' }, produit.nom),
          el('p', { class: 'carte-direct__unite' }, `Unité étalon : ${venduA(produit.unite_reference)}`),
          el('p', { class: 'carte-direct__releve' }, ic('schedule'), ` Relevé ${ilYA(principal.date_releve)} à ${court(principal.marche)}`))),
      principal.est_meilleur_prix && el('span', { class: 'etiquette-meilleur' }, 'Meilleur prix')),
    el('div', { class: 'carte-direct__comparaison' },
      el('div', {},
        el('p', { class: 'carte-direct__marche' }, court(principal.marche)),
        el('p', { class: `carte-direct__prix${principal.est_meilleur_prix ? ' carte-direct__prix--vert' : ''}` },
          formaterNombre(principal.montant), el('span', {}, ' FCFA'))),
      el('span', { class: 'carte-direct__separateur', 'aria-hidden': 'true' }),
      el('div', { class: 'carte-direct__droite' },
        el('p', { class: 'carte-direct__marche carte-direct__marche--pale' }, court(autre.marche)),
        el('p', { class: 'carte-direct__prix carte-direct__prix--pale' },
          formaterNombre(autre.montant), el('span', {}, ' FCFA')))),
    el('div', { class: 'carte-direct__bas' },
      el('span', { class: `pastille-ecart${ecart > 0 ? ' pastille-ecart--orange' : ''}` },
        el('span', { class: 'pastille-ecart__point', 'aria-hidden': 'true' }),
        ecart <= 0 ? `Écart favorable : −${formaterNombre(-ecart)} FCFA` : `Écart : +${formaterNombre(ecart)} FCFA`),
      el('a', { class: 'carte-direct__historique', href: `/produit.html?id=${produit.id}` },
        'Historique', ic('chevron_right'))));
}

function vignetteDirecte(produit, lignes) {
  const stats = statistiques(lignes);
  const meilleur = stats.moinsChers[0];
  return el('a', { class: 'vignette-direct', href: `/produit.html?id=${produit.id}` },
    el('div', { class: 'vignette-direct__image' },
      vignette(produit, produit.nom, 'vignette-direct__photo'),
      el('span', { class: 'vignette-direct__marche' }, meilleur.marche.replace(/^Marché\s+/i, ''))),
    el('div', { class: 'vignette-direct__texte' },
      el('p', { class: 'vignette-direct__nom' }, produit.nom),
      el('p', { class: 'vignette-direct__unite' }, `Unité étalon : ${venduA(produit.unite_reference)}`),
      el('p', { class: 'vignette-direct__prix' }, formaterNombre(stats.min), el('span', {}, 'F')),
      el('p', { class: 'vignette-direct__date' }, `Relevé ${ilYA(meilleur.date_releve)}`)));
}

// ---------------------------------------------------------------
// Tendance de la semaine (GET /api/tendance)
// ---------------------------------------------------------------

async function afficherTendance() {
  const bloc = $('#tendance');
  let tendance;
  try {
    tendance = await api.tendance();
  } catch {
    bloc.hidden = true; // la tendance est un complément : sans elle, les prix suffisent
    return;
  }
  bloc.hidden = !tendance.disponible;
  if (!tendance.disponible) return;

  const pourcent = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formaterNombre(Math.abs(v))} %`;
  const { categorie, sens } = tendance;
  const mot = categorie.variation < 0 ? 'Baisse' : categorie.variation > 0 ? 'Hausse' : 'Stabilité';
  $('#tendance-phrase').textContent = categorie.variation === 0
    ? 'Prix stables sur les 7 derniers jours.'
    : `${mot} des prix ${categorie.nom === 'Autres' ? '' : `de la catégorie ${categorie.nom} `}(${pourcent(categorie.variation)}) sur 7 jours. Variation générale : ${pourcent(tendance.variation)}.`;

  const icone = { baisse: 'trending_down', hausse: 'trending_up', stabilite: 'trending_flat' }[sens];
  $('#tendance-icone').replaceChildren(ic(icone));
  $('#tendance-pastille').textContent = { baisse: 'Baisse générale', hausse: 'Hausse générale', stabilite: 'Stabilité générale' }[sens];
  bloc.dataset.sens = sens;

  // Courbe : 100 points de large, 24 de haut, marges de 3 en haut et en bas
  const serie = tendance.serie;
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const y = (v) => (max === min ? 12 : 21 - ((v - min) / (max - min)) * 18);
  const trace = serie.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (serie.length - 1)) * 100).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  $('#tendance-trace').setAttribute('d', trace);
}

// ---------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------

function etatVide(message, action) {
  zoneResultats.replaceChildren(
    el('div', { class: 'vide' }, el('p', { class: 'vide__message' }, message), action));
  resume.classList.add('sr-only');
  resume.textContent = message;
}

function bouton(libelle, action) {
  return el('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: action }, libelle);
}

function boutonProposer() {
  return el('button', { type: 'button', class: 'bouton bouton--principal', onclick: () => proposer() }, 'Proposer un prix');
}

function proposer(produitId, marcheId) {
  ouvrirProposition({
    produitId: produitId ?? (etat.produitDemande || undefined),
    marcheId: marcheId ?? (champMarche.value || lireMarcheReference() || undefined),
  });
}
