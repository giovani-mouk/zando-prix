// =============================================================
// public/js/admin.js : tableau de bord de l'espace administrateur
// Espace administrateur : story 8, features 12, 13 et 14
// Vue Propositions : corriger, publier ou supprimer les propositions reçues.
// Vue Messages : lire les messages de la page Contact.
// Vue Administrateurs : comptes de l'équipe et changement de mot de passe (feature 16).
//
// Important : ce fichier ne « protège » rien. N'importe qui peut lire
// son code ou ouvrir la page. La protection est dans l'API (session.js) :
// sans session valide, aucune donnée n'est renvoyée et aucune action
// n'est acceptée. Ce script se contente de rediriger vers la connexion
// quand l'API répond 401, pour offrir un parcours agréable.
// =============================================================
import { api } from './api.js';
import { el, remplirSelect } from './dom.js';
import {
  UNITES, aujourdhuiIso, formaterDate, formaterInstant, formaterMontant, formaterNombre, libelleUnite, venduA,
} from './format.js';

// Comment le prix a été constaté (feature 20)
const CONSTATS = { direct: "relevé sur l'étal", ticket: 'ticket ou reçu', pesee: 'pesée sur balance' };

const LIBELLES = { en_attente: 'En attente', validee: 'Publiée', rejetee: 'Rejetée' };
const VIDES = {
  en_attente: 'Aucune proposition en attente. Tout est à jour.',
  validee: "Aucune proposition publiée pour l'instant.",
  rejetee: "Aucune proposition supprimée pour l'instant.",
  '': "Aucune proposition reçue pour l'instant.",
};
const CHAMPS_CORRECTION = ['produit_id', 'marche_id', 'montant', 'unite', 'date_constat'];

const contenu = document.querySelector('#contenu');
const VUES = ['propositions', 'messages', 'officiels', 'administrateurs'];
const liensMenu = [...document.querySelectorAll('.menu__lien')];

const listeMessages = document.querySelector('#liste-messages');
const aucunMessage = document.querySelector('#aucun-message');
const annonceMessages = document.querySelector('#annonce-messages');
const onglets = [...document.querySelectorAll('.onglet')];
const corpsTableau = document.querySelector('#lignes');
const conteneurTableau = document.querySelector('#conteneur-tableau');
const aucune = document.querySelector('#aucune');
const annonce = document.querySelector('#annonce');

const dialogueCorrection = document.querySelector('#correction');
const formulaireCorrection = dialogueCorrection.querySelector('form');
const champs = formulaireCorrection.elements;
const alerteCorrection = document.querySelector('#correction-erreur');

const dialogueSuppression = document.querySelector('#suppression');
const alerteSuppression = document.querySelector('#suppression-erreur');
const boutonSupprimer = document.querySelector('#suppression-confirmer');

let propositions = [];
let messages = [];
let comptes = [];
let filtre = 'en_attente';
let enCorrection = null;   // proposition ouverte dans le dialogue de correction
let aSupprimer = null;     // proposition dont on demande confirmation

// File de modération (maquette du PM)
let prixAffiches = [];     // grille des prix actuels (/api/prix), pour comparer
let produitsListe = [];
const selection = new Set(); // propositions cochées pour la validation groupée
const CLE_GARDE_FOUS = 'zando-prix:garde-fous';
const ACTUALISATION_MS = 30_000;
const ic = (nom, classe = '') => el('span', { class: `ms ${classe}`.trim(), 'aria-hidden': 'true' }, nom);

// ---------------------------------------------------------------
// Session
// ---------------------------------------------------------------

// Sans session valide, retour à la page de connexion
function versConnexion() {
  const retour = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/connexion.html?retour=${retour}`);
}

// Toute réponse 401 signifie que la session a expiré ou a été fermée
function gererErreur(erreur, zone = annonce) {
  if (erreur.statut === 401) {
    versConnexion();
    return;
  }
  zone.textContent = erreur.message;
  zone.hidden = false;
}

document.querySelector('#deconnexion').addEventListener('click', async () => {
  try {
    await api.deconnexion();
  } finally {
    window.location.replace('/');
  }
});

afficherIcones();
demarrer();

// Les icônes (police Material Symbols) ne deviennent visibles qu'une fois la
// police chargée : sinon le navigateur afficherait leur nom (« search »…).
function afficherIcones() {
  if (!document.fonts?.load) return;
  document.fonts.load('24px "Material Symbols Outlined"', 'search')
    .then((polices) => { if (polices.length > 0) document.documentElement.classList.add('icones-pretes'); })
    .catch(() => {});
}

// Démarrage : on demande d'abord à l'API qui est connecté. La page reste
// masquée (#contenu hidden) tant que la réponse n'est pas arrivée, pour ne
// pas montrer un tableau vide à quelqu'un qui va être redirigé.
async function demarrer() {
  let administrateur;
  try {
    ({ administrateur } = await api.moi());
  } catch (erreur) {
    if (erreur.statut === 401) return versConnexion();
    annonce.textContent = erreur.message;
    contenu.hidden = false;
    return;
  }

  // Pastille verte « Connecté » dans la barre latérale
  document.querySelector('#session-nom').textContent = administrateur.nom;
  document.querySelector('#session-email').textContent = administrateur.email;
  document.querySelector('#etat-connexion').hidden = false;
  contenu.hidden = false;

  // Navigation entre les vues par l'adresse (#propositions, #messages) :
  // le bouton Retour du navigateur fonctionne, et un lien peut ouvrir une vue.
  window.addEventListener('hashchange', afficherVue);
  afficherVue();

  // Les cartes « En attente », « Publiées », « Rejetées » ouvrent l'onglet correspondant
  document.querySelectorAll('[data-aller]').forEach((carte) => {
    carte.addEventListener('click', () => {
      filtre = carte.dataset.aller;
      annonce.textContent = '';
      afficher();
    });
  });

  initialiserCorrection();
  initialiserSuppression();
  onglets.forEach((onglet) => {
    onglet.addEventListener('click', () => {
      filtre = onglet.dataset.statut;
      annonce.textContent = '';
      afficher();
    });
  });

  initialiserComptes();
  initialiserFile();
  initialiserOfficiels();
  await Promise.all([chargerReferences(), chargerMessages(), chargerComptes(), chargerOfficiels()]);
  await charger();

  // Actualisation automatique de la file (maquette : « auto : 30 s »), sauf
  // si l'onglet est caché ou si un dialogue est ouvert
  setInterval(() => {
    const dialogueOuvert = document.querySelector('dialog[open]');
    if (!document.hidden && !dialogueOuvert && vueCourante() === 'propositions') charger();
  }, ACTUALISATION_MS);
}

// Prix affichés, produits et marchés : pour comparer chaque proposition
async function chargerReferences() {
  try {
    const [prix, produitsApi, marches] = await Promise.all([api.prix(), api.produits(), api.marches()]);
    prixAffiches = prix;
    produitsListe = produitsApi;
    const select = document.querySelector('#filtre-marche-admin');
    const choisi = select.value;
    remplirSelect(select, marches.map((m) => ({ valeur: m.id, libelle: m.nom })), 'Tous les marchés');
    select.value = choisi;
    const suivis = new Set(prix.filter((l) => l.disponible).map((l) => l.produit_id)).size;
    const dernier = prix.filter((l) => l.disponible).map((l) => l.date_releve).sort().at(-1);
    document.querySelector('#ref-prix').textContent = `${suivis} produits suivis dans ${marches.length} marchés${dernier ? ` • dernier relevé le ${formaterDate(dernier)}` : ''}.`;
  } catch (erreur) {
    gererErreur(erreur);
  }
}

// ---------------------------------------------------------------
// Vues et barre latérale
// ---------------------------------------------------------------

function vueCourante() {
  const demandee = window.location.hash.slice(1);
  return VUES.includes(demandee) ? demandee : 'propositions';
}

function afficherVue() {
  const vue = vueCourante();
  for (const nom of VUES) {
    document.querySelector(`#vue-${nom}`).hidden = nom !== vue;
  }
  for (const lien of liensMenu) {
    // aria-current="page" : annonce aux lecteurs d'écran la section ouverte
    if (lien.dataset.vue === vue) lien.setAttribute('aria-current', 'page');
    else lien.removeAttribute('aria-current');
  }
}

// Compteurs de la barre latérale et des cartes, recalculés après chaque action
function mettreAJourCompteurs() {
  const compter = (statut) => propositions.filter((p) => p.statut === statut).length;
  for (const statut of ['en_attente', 'validee', 'rejetee']) {
    document.querySelector(`#nombre-${statut}`).textContent = String(compter(statut));
  }
  const nonLus = messages.filter((m) => !m.lu).length;
  document.querySelector('#nombre-messages').textContent = String(nonLus);

  pastille(document.querySelector('#compteur-propositions'), compter('en_attente'), 'en attente');
  pastille(document.querySelector('#compteur-messages'), nonLus, 'non lu');
}

// Petit nombre à droite d'un lien du menu ; masqué quand il vaut 0
function pastille(element, nombre, qualificatif) {
  element.hidden = nombre === 0;
  element.textContent = String(nombre);
  // Texte complet pour les lecteurs d'écran : « 2 en attente » plutôt que « 2 »
  element.setAttribute('aria-label', `${nombre} ${qualificatif}${nombre > 1 ? 's' : ''}`);
}

async function charger() {
  try {
    propositions = await api.propositions();
    afficher();
  } catch (erreur) {
    gererErreur(erreur);
  }
}

// Remplace une proposition dans la liste locale par la version renvoyée par
// l'API après une action : on affiche l'état réel, sans tout recharger.
function remplacer(proposition) {
  propositions = propositions.map((q) => (q.id === proposition.id ? proposition : q));
}

// ---------------------------------------------------------------
// Tableau
// ---------------------------------------------------------------

function afficher() {
  for (const onglet of onglets) {
    const statut = onglet.dataset.statut;
    const nombre = statut ? propositions.filter((p) => p.statut === statut).length : propositions.length;
    onglet.setAttribute('aria-pressed', String(statut === filtre));
    onglet.querySelector('.compteur').textContent = `(${nombre})`;
  }

  const visibles = filtrer(filtre ? propositions.filter((p) => p.statut === filtre) : propositions);
  mettreAJourCompteurs();
  mettreAJourIndicateurs();
  // Une proposition déjà traitée ne peut plus être cochée
  for (const id of [...selection]) if (!propositions.some((p) => p.id === id && p.statut === 'en_attente')) selection.delete(id);
  majSelection();
  corpsTableau.replaceChildren(...visibles.map(carte));
  conteneurTableau.hidden = visibles.length === 0;
  aucune.hidden = visibles.length > 0;
  aucune.textContent = VIDES[filtre];
}

const resume = (p) => `${p.produit} au ${p.marche}, ${formaterMontant(p.montant)}`;

// "Publiée le 24 sept. à 10 h 12 par Grâce Mabiala"
function mentionTraitement(p) {
  const verbe = p.statut === 'validee' ? 'Publiée' : 'Supprimée';
  const par = p.traitee_par ? ` par ${p.traitee_par}` : '';
  return `${verbe} le ${formaterInstant(p.traitee_le)}${par}`;
}

// Prix affiché aujourd'hui pour le même produit et le même marché
function prixAffiche(p) {
  return prixAffiches.find((l) => l.produit_id === p.produit_id && l.marche_id === p.marche_id && l.disponible) ?? null;
}

// Écart entre la proposition et le prix affiché (même unité seulement)
function ecartDe(p) {
  const affiche = prixAffiche(p);
  if (!affiche || affiche.unite !== p.unite) return null;
  return { affiche, montant: p.montant - affiche.montant, pourcent: ((p.montant - affiche.montant) / affiche.montant) * 100 };
}

// Garde-fous : signalements choisis par l'administrateur (mémorisés dans ce navigateur)
function gardeFous() {
  try {
    return { ecart: true, unite: true, date: true, ...JSON.parse(localStorage.getItem(CLE_GARDE_FOUS) ?? '{}') };
  } catch {
    return { ecart: true, unite: true, date: true };
  }
}

function signalements(p) {
  const regles = gardeFous();
  const produit = produitsListe.find((x) => x.id === p.produit_id);
  const ecart = ecartDe(p);
  const liste = [];
  if (regles.ecart && ecart && Math.abs(ecart.pourcent) > 50) liste.push({ code: 'ecart', texte: `Écart anormal (${ecart.pourcent > 0 ? '+' : ''}${Math.round(ecart.pourcent)} %)` });
  if (regles.unite && produit && p.unite !== produit.unite_reference) liste.push({ code: 'unite', texte: `Unité à vérifier (vendu ${venduA(p.unite)})` });
  if (regles.date && joursDepuis(p.date_constat) >= 7) liste.push({ code: 'date', texte: 'Relevé de 7 jours ou plus' });
  return liste;
}

function joursDepuis(iso) {
  return Math.floor((Date.now() - new Date(`${String(iso).slice(0, 10)}T12:00:00`)) / 86_400_000);
}

function ilYAMinutes(instant) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(instant)) / 60_000));
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 60 * 24) return `il y a ${Math.round(minutes / 60)} h`;
  return `il y a ${Math.round(minutes / 1440)} j`;
}

// Filtres de la barre d'outils : texte, marché, niveau d'écart
function filtrer(liste) {
  const texte = document.querySelector('#filtre-texte').value.trim().toLowerCase();
  const marche = document.querySelector('#filtre-marche-admin').value;
  const niveau = document.querySelector('#filtre-ecart').value;
  return liste.filter((p) => {
    if (texte && ![p.produit, p.marche, reference(p)].some((t) => t.toLowerCase().includes(texte))) return false;
    if (marche && String(p.marche_id) !== marche) return false;
    if (niveau) {
      const e = ecartDe(p);
      if (niveau === 'sans') return !e;
      if (!e) return false;
      const abs = Math.abs(e.pourcent);
      if (niveau === 'conforme' && abs > 10) return false;
      if (niveau === 'ecart' && abs <= 10) return false;
      if (niveau === 'anormal' && abs <= 50) return false;
    }
    return true;
  });
}

const reference = (p) => `#PROP-${String(p.id).padStart(4, '0')}`;

// Carte d'une proposition (maquette : « File de modération »)
function carte(p) {
  const produit = produitsListe.find((x) => x.id === p.produit_id);
  const ecart = ecartDe(p);
  const alertes = p.statut === 'en_attente' ? signalements(p) : [];
  const niveau = alertes.some((a) => a.code === 'ecart') ? 'rouge' : alertes.length ? 'orange' : 'vert';
  const abs = ecart ? Math.abs(ecart.pourcent) : null;

  const badge = alertes.length
    ? el('span', { class: 'badge-moderation badge-moderation--rouge' }, el('span', { class: 'badge-moderation__point' }), alertes[0].texte)
    : ecart
      ? el('span', { class: `badge-moderation badge-moderation--${abs <= 10 ? 'vert' : 'orange'}` }, el('span', { class: 'badge-moderation__point' }), abs <= 10 ? 'Marge acceptable' : 'Écart à vérifier')
      : el('span', { class: 'badge-moderation' }, el('span', { class: 'badge-moderation__point' }), 'Aucun prix à comparer');

  const coche = p.statut === 'en_attente'
    ? el('input', {
      type: 'checkbox',
      class: 'carte-moderation__coche',
      'aria-label': `Sélectionner ${reference(p)} pour la validation groupée`,
      checked: selection.has(p.id),
      onchange: (e) => {
        if (e.target.checked) selection.add(p.id);
        else selection.delete(p.id);
        majSelection();
      },
    })
    : null;

  // Photo de l'étal jointe par la personne (feature 24), sinon l'illustration du produit
  const image = p.photo_url
    ? el('a', { href: p.photo_url, target: '_blank', rel: 'noopener', class: 'carte-moderation__lien-photo', title: 'Ouvrir la photo en grand' },
      el('img', { class: 'carte-moderation__photo', src: p.photo_url, alt: `Photo de l'étal jointe à ${reference(p)}`, loading: 'lazy' }),
      el('span', { class: 'carte-moderation__preuve' }, ic('photo_camera'), 'Photo jointe'))
    : produit?.image
    ? el('img', { class: 'carte-moderation__photo', src: produit.image, alt: '' })
    : el('span', { class: 'carte-moderation__photo vignette--initiale', 'aria-hidden': 'true' }, p.produit.charAt(0));

  // Barre : prix proposé par rapport au prix affiché
  const comparaison = ecart
    ? el('div', { class: `comparaison-moderation comparaison-moderation--${abs > 50 ? 'rouge' : abs > 10 ? 'orange' : 'vert'}` },
      el('div', { class: 'comparaison-moderation__haut' },
        el('div', {}, el('p', { class: 'comparaison-moderation__libelle' }, 'Prix citoyen déclaré'),
          el('p', { class: 'comparaison-moderation__prix' }, formaterMontant(p.montant))),
        el('div', { class: 'comparaison-moderation__droite' }, el('p', { class: 'comparaison-moderation__libelle' }, 'Prix affiché actuel'),
          el('p', { class: 'comparaison-moderation__reference' }, formaterMontant(ecart.affiche.montant)))),
      el('div', { class: 'comparaison-moderation__piste' },
        el('span', { style: `width: ${Math.min(100, Math.round((Math.min(p.montant, ecart.affiche.montant) / Math.max(p.montant, ecart.affiche.montant)) * 100))}%` })),
      el('p', { class: 'comparaison-moderation__detail' },
        `${ecart.montant > 0 ? '+' : ecart.montant < 0 ? '−' : ''}${formaterNombre(Math.abs(ecart.montant))} FCFA (${ecart.pourcent > 0 ? '+' : ''}${formaterNombre(Math.round(ecart.pourcent * 10) / 10)} %)`,
        ` • relevé affiché le ${formaterDate(ecart.affiche.date_releve)}`))
    : el('div', { class: 'comparaison-moderation' },
      el('p', { class: 'comparaison-moderation__libelle' }, 'Prix citoyen déclaré'),
      el('p', { class: 'comparaison-moderation__prix' }, `${formaterMontant(p.montant)} / ${libelleUnite(p.unite)}`),
      el('p', { class: 'comparaison-moderation__detail' }, prixAffiche(p) ? `Prix affiché dans une autre unité (${formaterMontant(prixAffiche(p).montant)} / ${libelleUnite(prixAffiche(p).unite)})` : 'Aucun prix affiché pour ce produit dans ce marché : cette proposition comblerait un manque.'));

  const actions = p.statut === 'en_attente'
    ? el('div', { class: 'actions actions-moderation' },
      el('button', { type: 'button', class: 'action-approuver', 'aria-label': `Publier : ${resume(p)}`, onclick: (e) => publier(p, e.currentTarget) },
        ic('check_circle'), 'Approuver & publier'),
      el('button', { type: 'button', class: 'action-corriger', 'aria-label': `Corriger : ${resume(p)}`, onclick: () => ouvrirCorrection(p) },
        ic('tune'), 'Corriger'),
      el('button', { type: 'button', class: 'action-rejeter', 'aria-label': `Rejeter : ${resume(p)}`, onclick: () => ouvrirSuppression(p) },
        ic('cancel'), el('span', { class: 'sr-only' }, 'Rejeter')))
    : el('p', { class: `traitee statut statut--${p.statut}` }, mentionTraitement(p),
      p.corrigee_le ? ` • corrigée par ${p.corrigee_par ?? 'un administrateur'}` : '');

  return el('article', { class: `carte-moderation carte-moderation--${p.statut === 'en_attente' ? niveau : 'traitee'}` },
    el('div', { class: 'carte-moderation__entete' },
      coche,
      el('span', { class: 'carte-moderation__ref' }, reference(p)),
      badge,
      el('span', { class: 'carte-moderation__temps' }, ic('schedule'), ilYAMinutes(p.created_at)),
      p.statut !== 'en_attente' && el('span', { class: `statut statut--${p.statut}` }, LIBELLES[p.statut])),
    el('p', { class: 'carte-moderation__contributeur' },
      'Contributeur : ', el('strong', {}, p.auteur ?? 'Anonyme'),
      p.confirmations > 0 && el('span', { class: 'pastille-contributions' },
        `${p.confirmations} confirmation${p.confirmations > 1 ? 's' : ''} dont ${p.confirmations_identiques} identique${p.confirmations_identiques > 1 ? 's' : ''}`)),
    el('div', { class: 'carte-moderation__corps' },
      el('div', { class: 'carte-moderation__visuel' }, image,
        p.constat && el('span', { class: 'carte-moderation__constat' }, ic(p.constat === 'ticket' ? 'receipt_long' : p.constat === 'pesee' ? 'scale' : 'storefront'), CONSTATS[p.constat])),
      el('div', { class: 'carte-moderation__details' },
        el('div', { class: 'carte-moderation__titre-ligne' },
          el('h3', { class: 'carte-moderation__titre' }, `${p.produit} — vendu ${venduA(p.unite)}`),
          produit?.categorie && el('span', { class: 'carte-moderation__categorie' }, produit.categorie)),
        el('p', { class: 'carte-moderation__lieu' }, ic('storefront'), p.marche,
          p.repere ? ` • ${p.repere}` : '', ` • constaté le ${formaterDate(p.date_constat)}`),
        comparaison,
        officielPour(p),
        alertes.length > 1 && el('ul', { class: 'carte-moderation__alertes' }, ...alertes.slice(1).map((a) => el('li', {}, ic('warning'), a.texte))),
        actions)));
}

// Indicateurs du haut et colonne de droite, tous calculés sur les propositions
function mettreAJourIndicateurs() {
  const maintenant = Date.now();
  const traitees = propositions.filter((p) => p.statut !== 'en_attente' && p.traitee_le);
  const recentes = traitees.filter((p) => maintenant - new Date(p.traitee_le) < 30 * 86_400_000);
  const aujourdhui = aujourdhuiIso();
  const enAttente = propositions.filter((p) => p.statut === 'en_attente');

  const vieilles = enAttente.filter((p) => maintenant - new Date(p.created_at) > 24 * 3_600_000).length;
  document.querySelector('#detail-attente').textContent = vieilles ? `${vieilles} en attente depuis plus de 24 h` : 'Aucune en retard';
  const publieesJour = propositions.filter((p) => p.statut === 'validee' && String(p.traitee_le).slice(0, 10) === aujourdhui).length;
  document.querySelector('#detail-publiees').textContent = `${publieesJour} aujourd'hui`;
  const rejeteesMois = recentes.filter((p) => p.statut === 'rejetee').length;
  document.querySelector('#detail-rejetees').textContent = `${rejeteesMois} sur 30 jours`;

  // Délai moyen entre réception et décision (30 derniers jours)
  const delais = recentes.map((p) => (new Date(p.traitee_le) - new Date(p.created_at)) / 60_000).filter((d) => d >= 0);
  const moyenne = delais.length ? delais.reduce((a, b) => a + b, 0) / delais.length : null;
  document.querySelector('#delai-moyen').textContent = moyenne === null ? 'Pas encore de décision'
    : moyenne < 60 ? `${Math.round(moyenne)} min` : moyenne < 1440 ? `${Math.round(moyenne / 60)} h` : `${Math.round(moyenne / 1440)} j`;

  // Taux d'approbation (30 derniers jours)
  const directes = recentes.filter((p) => p.statut === 'validee' && !p.corrigee_le).length;
  const corrigees = recentes.filter((p) => p.statut === 'validee' && p.corrigee_le).length;
  const total = recentes.length;
  const pct = (n) => (total ? `${Math.round((n / total) * 100)} %` : '–');
  document.querySelector('#taux-approbation').textContent = total ? pct(directes + corrigees) : '–';
  document.querySelector('#anneau-approbation').style.setProperty('--taux', total ? (directes + corrigees) / total : 0);
  document.querySelector('#part-directes').textContent = pct(directes);
  document.querySelector('#part-corrigees').textContent = pct(corrigees);
  document.querySelector('#part-rejetees').textContent = pct(rejeteesMois);

  // Flux actif (barre latérale)
  const marches = [...new Set(enAttente.map((p) => p.marche.replace(/^Marché\s+/i, '')))];
  document.querySelector('#flux-actif').hidden = enAttente.length === 0;
  document.querySelector('#flux-texte').textContent = `${enAttente.length} proposition${enAttente.length > 1 ? 's' : ''} en attente`
    + (marches.length ? ` sur ${marches.slice(0, 2).join(' & ')}${marches.length > 2 ? '…' : ''}.` : '.');
}

function majSelection() {
  document.querySelector('#nombre-selection').textContent = String(selection.size);
  document.querySelector('#validation-groupee').disabled = selection.size === 0;
}

// Outils de la file : filtres, actualisation, garde-fous, validation groupée
function initialiserFile() {
  ['#filtre-texte', '#filtre-marche-admin', '#filtre-ecart'].forEach((id) => {
    document.querySelector(id).addEventListener('input', afficher);
  });
  document.querySelector('#rafraichir').addEventListener('click', async () => {
    await Promise.all([chargerReferences(), charger()]);
    annonce.textContent = 'File actualisée.';
  });

  const regles = gardeFous();
  document.querySelectorAll('[data-garde-fou]').forEach((interrupteur) => {
    interrupteur.checked = regles[interrupteur.dataset.gardeFou] !== false;
    interrupteur.addEventListener('change', () => {
      const actuelles = gardeFous();
      actuelles[interrupteur.dataset.gardeFou] = interrupteur.checked;
      try { localStorage.setItem(CLE_GARDE_FOUS, JSON.stringify(actuelles)); } catch { /* stockage indisponible */ }
      afficher();
    });
  });

  document.querySelector('#validation-groupee').addEventListener('click', validerSelection);
}

// Publie une à une les propositions cochées, et annonce le résultat
async function validerSelection() {
  const bouton = document.querySelector('#validation-groupee');
  bouton.disabled = true;
  let publiees = 0;
  const echecs = [];
  for (const id of [...selection]) {
    try {
      const { proposition } = await api.decider(id, 'validee');
      remplacer(proposition);
      publiees += 1;
    } catch (erreur) {
      if (erreur.statut === 401) return versConnexion();
      echecs.push(`#PROP-${String(id).padStart(4, '0')} (${erreur.message})`);
    }
    selection.delete(id);
  }
  annonce.textContent = `${publiees} proposition${publiees > 1 ? 's' : ''} publiée${publiees > 1 ? 's' : ''}.`
    + (echecs.length ? ` Non publiée${echecs.length > 1 ? 's' : ''} : ${echecs.join(', ')}.` : '');
  if (echecs.length) await charger();
  else afficher();
  annonce.focus();
}

// ---------------------------------------------------------------
// Publier
// ---------------------------------------------------------------

async function publier(p, bouton) {
  const boutons = bouton.closest('.actions').querySelectorAll('button');
  boutons.forEach((b) => { b.disabled = true; });

  try {
    const { proposition } = await api.decider(p.id, 'validee');
    remplacer(proposition);
    annonce.textContent = `Proposition publiée : ${p.produit} à ${formaterMontant(p.montant)} / `
      + `${libelleUnite(p.unite)} au ${p.marche} est maintenant le prix affiché.`;
    afficher();
  } catch (erreur) {
    gererErreur(erreur);
    // 409 ou 404 : un autre administrateur l'a traitée entre-temps
    if (erreur.statut === 409 || erreur.statut === 404) await charger();
    else boutons.forEach((b) => { b.disabled = false; });
  }
  // La ligne peut avoir disparu de la vue : on garde le focus à un endroit stable
  annonce.focus();
}

// ---------------------------------------------------------------
// Supprimer (la proposition passe en « rejetée » et reste dans l'historique)
// ---------------------------------------------------------------

function initialiserSuppression() {
  dialogueSuppression.querySelector('[data-fermer]').addEventListener('click', () => dialogueSuppression.close());
  boutonSupprimer.addEventListener('click', confirmerSuppression);
}

function ouvrirSuppression(p) {
  aSupprimer = p;
  alerteSuppression.hidden = true;
  document.querySelector('#suppression-aide').textContent =
    `${resume(p)} / ${libelleUnite(p.unite)}. Elle ne sera pas publiée, `
    + 'mais restera visible dans l\'onglet « Rejetées ».';
  dialogueSuppression.showModal();
  // Le focus va sur « Annuler » : l'action destructive demande un geste volontaire
  dialogueSuppression.querySelector('[data-fermer]').focus();
}

async function confirmerSuppression() {
  const p = aSupprimer;
  boutonSupprimer.disabled = true;
  try {
    const { proposition } = await api.decider(p.id, 'rejetee');
    remplacer(proposition);
    dialogueSuppression.close();
    annonce.textContent = `Proposition supprimée : ${p.produit} au ${p.marche}.`;
    afficher();
    annonce.focus();
  } catch (erreur) {
    gererErreur(erreur, alerteSuppression);
    if (erreur.statut === 409 || erreur.statut === 404) await charger();
  } finally {
    boutonSupprimer.disabled = false;
  }
}

// ---------------------------------------------------------------
// Corriger avant publication
// ---------------------------------------------------------------

async function initialiserCorrection() {
  dialogueCorrection.querySelector('[data-fermer]').addEventListener('click', () => dialogueCorrection.close());
  formulaireCorrection.addEventListener('submit', enregistrerCorrection);

  remplirSelect(
    champs.unite,
    Object.keys(UNITES).map((unite) => ({ valeur: unite, libelle: UNITES[unite].vendu })),
  );

  try {
    const [produits, marches] = await Promise.all([api.produits(), api.marches()]);
    remplirSelect(champs.produit_id, produits.map((p) => ({ valeur: p.id, libelle: p.nom })));
    remplirSelect(champs.marche_id, marches.map((m) => ({ valeur: m.id, libelle: m.nom })));
  } catch (erreur) {
    gererErreur(erreur);
  }
}

function ouvrirCorrection(p) {
  enCorrection = p;
  effacerErreurs();
  document.querySelector('#correction-aide').textContent =
    `Proposée par ${p.auteur ?? 'un anonyme'} le ${formaterInstant(p.created_at)}. `
    + 'La correction ne publie pas la proposition : vous pourrez la publier ensuite.';

  champs.produit_id.value = String(p.produit_id);
  champs.marche_id.value = String(p.marche_id);
  champs.montant.value = String(p.montant);
  champs.unite.value = p.unite;
  champs.date_constat.value = p.date_constat;
  champs.date_constat.max = aujourdhuiIso();

  dialogueCorrection.showModal();
  champs.montant.focus();
  champs.montant.select();
}

// "1 200" -> 1200 ; "750.5" ou "abc" restent du texte et seront refusés par l'API
function valeurSaisie(texte) {
  const nettoye = texte.replace(/\s/g, '');
  if (nettoye === '') return undefined;
  return /^\d+$/.test(nettoye) ? Number(nettoye) : nettoye;
}

async function enregistrerCorrection(evenement) {
  evenement.preventDefault();
  effacerErreurs();

  const bouton = formulaireCorrection.querySelector('[type="submit"]');
  bouton.disabled = true;
  try {
    // La validation est faite par l'API, avec les mêmes règles qu'une proposition
    const { proposition } = await api.corriger(enCorrection.id, {
      produit_id: valeurSaisie(champs.produit_id.value),
      marche_id: valeurSaisie(champs.marche_id.value),
      montant: valeurSaisie(champs.montant.value),
      unite: champs.unite.value || undefined,
      date_constat: champs.date_constat.value || undefined,
    });
    remplacer(proposition);
    dialogueCorrection.close();
    annonce.textContent = `Proposition corrigée : ${resume(proposition)} / `
      + `${libelleUnite(proposition.unite)}. Elle est toujours en attente de publication.`;
    afficher();
    annonce.focus();
  } catch (erreur) {
    afficherErreurCorrection(erreur);
    if (erreur.statut === 409 || erreur.statut === 404) await charger();
  } finally {
    bouton.disabled = false;
  }
}

function afficherErreurCorrection(erreur) {
  if (erreur.statut === 401) return versConnexion();

  if (CHAMPS_CORRECTION.includes(erreur.champ)) {
    const message = document.querySelector(`#c-erreur-${erreur.champ}`);
    message.textContent = erreur.message;
    message.hidden = false;
    champs[erreur.champ].setAttribute('aria-invalid', 'true');
    champs[erreur.champ].focus();
  } else {
    alerteCorrection.textContent = erreur.message;
    alerteCorrection.hidden = false;
  }
}

function effacerErreurs() {
  alerteCorrection.hidden = true;
  for (const nom of CHAMPS_CORRECTION) {
    champs[nom].removeAttribute('aria-invalid');
    const message = document.querySelector(`#c-erreur-${nom}`);
    message.hidden = true;
    message.textContent = '';
  }
}

// ---------------------------------------------------------------
// Messages de la page Contact (feature 14)
// ---------------------------------------------------------------

async function chargerMessages() {
  try {
    messages = await api.messages();
    afficherMessages();
  } catch (erreur) {
    gererErreur(erreur, annonceMessages);
  }
}

function afficherMessages() {
  mettreAJourCompteurs();
  listeMessages.replaceChildren(...messages.map(carteMessage));
  listeMessages.hidden = messages.length === 0;
  aucunMessage.hidden = messages.length > 0;
}

function carteMessage(m) {
  // Lien mailto: la messagerie de l'administrateur s'ouvre, adresse et objet remplis.
  // encodeURIComponent protège les caractères spéciaux (espaces, accents, &).
  const reponse = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Votre message à Zando Prix')}`;

  return el('li', { class: `message${m.lu ? '' : ' message--non-lu'}` },
    el('div', { class: 'message__entete' },
      el('p', { class: 'message__expediteur' },
        !m.lu && el('span', { class: 'message__nouveau' }, 'Nouveau'),
        el('strong', {}, m.nom),
        el('span', { class: 'message__email' }, m.email)),
      el('p', { class: 'message__date' }, `Reçu le ${formaterInstant(m.created_at)}`)),
    // Le texte est affiché tel quel (el() n'interprète jamais le HTML)
    el('p', { class: 'message__contenu' }, m.message),
    el('div', { class: 'message__actions' },
      el('a', { class: 'bouton bouton--principal bouton--compact', href: reponse }, 'Répondre'),
      el('button', {
        type: 'button',
        class: 'bouton bouton--secondaire bouton--compact',
        onclick: (e) => basculerLu(m, e.currentTarget),
      }, m.lu ? 'Marquer comme non lu' : 'Marquer comme lu'),
      m.lu && m.lu_par && el('span', { class: 'traitee' }, `Lu par ${m.lu_par}`)));
}

async function basculerLu(m, bouton) {
  bouton.disabled = true;
  try {
    const { message } = await api.marquerMessage(m.id, !m.lu);
    messages = messages.map((x) => (x.id === message.id ? message : x));
    annonceMessages.textContent = message.lu
      ? `Message de ${message.nom} marqué comme lu.`
      : `Message de ${message.nom} marqué comme non lu.`;
    afficherMessages();
    annonceMessages.focus();
  } catch (erreur) {
    gererErreur(erreur, annonceMessages);
    bouton.disabled = false;
  }
}

// ---------------------------------------------------------------
// Comptes administrateurs (feature 16)
// ---------------------------------------------------------------

const lignesComptes = document.querySelector('#lignes-comptes');
const annonceComptes = document.querySelector('#annonce-comptes');
const formulaireCompte = document.querySelector('#formulaire-compte');
const formulaireMdp = document.querySelector('#formulaire-mdp');

function initialiserComptes() {
  formulaireCompte.addEventListener('submit', creerCompte);
  formulaireMdp.addEventListener('submit', changerMotDePasse);
  document.querySelector('#generer-mdp').addEventListener('click', () => {
    const champ = formulaireCompte.elements.mot_de_passe;
    champ.value = motDePasseAleatoire();
    champ.focus();
    champ.select();
  });
}

async function chargerComptes() {
  try {
    comptes = await api.comptes();
    afficherComptes();
  } catch (erreur) {
    gererErreur(erreur, annonceComptes);
  }
}

function afficherComptes() {
  lignesComptes.replaceChildren(...comptes.map(ligneCompte));
}

function ligneCompte(c) {
  let action;
  if (c.moi) {
    // Pas de bouton sur sa propre ligne : on ne peut pas se désactiver soi-même
    action = el('span', { class: 'traitee' }, 'Vous');
  } else {
    action = el('button', {
      type: 'button',
      class: `bouton ${c.actif ? 'bouton--rejeter' : 'bouton--valider'} bouton--compact`,
      'aria-label': `${c.actif ? 'Désactiver' : 'Réactiver'} le compte de ${c.nom}`,
      onclick: (e) => basculerCompte(c, e.currentTarget),
    }, c.actif ? 'Désactiver' : 'Réactiver');
  }

  return el('tr', {},
    el('th', { scope: 'row' }, c.nom),
    el('td', { class: 'compte__email' }, c.email),
    el('td', {}, el('span', { class: `statut ${c.actif ? 'statut--actif' : 'statut--inactif'}` },
      c.actif ? 'Actif' : 'Désactivé')),
    el('td', { class: 'date' }, c.derniere_connexion ? formaterInstant(c.derniere_connexion) : '—'),
    el('td', {}, action));
}

async function basculerCompte(c, bouton) {
  bouton.disabled = true;
  try {
    const { administrateur } = await api.activerCompte(c.id, !c.actif);
    comptes = comptes.map((x) => (x.id === administrateur.id ? administrateur : x));
    annonceComptes.textContent = administrateur.actif
      ? `Compte de ${administrateur.nom} réactivé.`
      : `Compte de ${administrateur.nom} désactivé. Ses sessions ouvertes ont été fermées.`;
    afficherComptes();
    annonceComptes.focus();
  } catch (erreur) {
    gererErreur(erreur, annonceComptes);
    bouton.disabled = false;
  }
}

// 16 caractères tirés avec le générateur cryptographique du navigateur
// (jamais Math.random, qui est prévisible). Les caractères faciles à
// confondre (0/O, 1/l/I) sont exclus : le mot de passe sera recopié à la main.
function motDePasseAleatoire(longueur = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_!';
  const tirage = crypto.getRandomValues(new Uint32Array(longueur));
  return Array.from(tirage, (n) => alphabet[n % alphabet.length]).join('');
}

// Affiche l'erreur de l'API sous le bon champ d'un formulaire.
// « prefixe » : n- pour le nouveau compte, m- pour le mot de passe.
function erreurFormulaire(formulaire, prefixe, alerte, erreur) {
  if (erreur.statut === 401) return versConnexion();
  const message = erreur.champ && document.querySelector(`#${prefixe}erreur-${erreur.champ}`);
  if (message) {
    message.textContent = erreur.message;
    message.hidden = false;
    const champ = formulaire.elements[erreur.champ];
    champ.setAttribute('aria-invalid', 'true');
    champ.focus();
  } else {
    alerte.textContent = erreur.message;
    alerte.hidden = false;
  }
}

function effacerErreursFormulaire(formulaire, alerte) {
  alerte.hidden = true;
  formulaire.querySelectorAll('.erreur').forEach((p) => { p.hidden = true; p.textContent = ''; });
  formulaire.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
}

async function creerCompte(evenement) {
  evenement.preventDefault();
  const alerte = document.querySelector('#compte-erreur');
  effacerErreursFormulaire(formulaireCompte, alerte);
  const champs = formulaireCompte.elements;
  const bouton = formulaireCompte.querySelector('[type="submit"]');
  bouton.disabled = true;
  try {
    const { administrateur } = await api.creerCompte({
      nom: champs.nom.value.trim() || undefined,
      email: champs.email.value.trim() || undefined,
      mot_de_passe: champs.mot_de_passe.value || undefined,
    });
    comptes = [...comptes, administrateur];
    formulaireCompte.reset();
    annonceComptes.textContent = `Compte créé pour ${administrateur.nom} (${administrateur.email}). `
      + 'Transmettez-lui son mot de passe provisoire par un moyen sûr.';
    afficherComptes();
    annonceComptes.focus();
  } catch (erreur) {
    erreurFormulaire(formulaireCompte, 'n-', alerte, erreur);
  } finally {
    bouton.disabled = false;
  }
}

async function changerMotDePasse(evenement) {
  evenement.preventDefault();
  const alerte = document.querySelector('#mdp-erreur');
  effacerErreursFormulaire(formulaireMdp, alerte);
  const champs = formulaireMdp.elements;

  // Seule vérification faite dans le navigateur : les deux saisies identiques.
  // Tout le reste (ancien mot de passe, longueur) est vérifié par l'API.
  if (champs.nouveau.value !== champs.confirmation.value) {
    erreurFormulaire(formulaireMdp, 'm-', alerte, {
      champ: 'confirmation', message: 'Les deux saisies du nouveau mot de passe sont différentes.',
    });
    return;
  }

  const bouton = formulaireMdp.querySelector('[type="submit"]');
  bouton.disabled = true;
  try {
    const { confirmation } = await api.changerMotDePasse(champs.actuel.value, champs.nouveau.value);
    formulaireMdp.reset();
    annonceComptes.textContent = confirmation;
    annonceComptes.focus();
  } catch (erreur) {
    erreurFormulaire(formulaireMdp, 'm-', alerte, erreur);
  } finally {
    bouton.disabled = false;
  }
}

// ---------------------------------------------------------------
// Prix officiels du Ministère du Commerce (feature 23)
// ---------------------------------------------------------------

let prixOfficiels = [];       // tout l'historique (retirés compris)
let officielsEnVigueur = [];  // ceux affichés publiquement aujourd'hui

// Ligne « Prix officiel » d'une carte de modération (même produit, même unité)
function officielPour(p) {
  const officiels = officielsEnVigueur.filter((o) => o.produit.id === p.produit_id && o.unite === p.unite);
  if (officiels.length === 0) return null;
  return el('ul', { class: 'officiels-carte' }, ...officiels.map((o) => {
    const depasse = o.type === 'plafond' && p.montant > o.montant;
    return el('li', { class: `officiels-carte__ligne${depasse ? ' officiels-carte__ligne--alerte' : ''}` },
      ic('gavel'),
      el('span', {}, `${o.type === 'plafond' ? 'Plafond légal' : 'Prix indicatif'} du Ministère : `,
        el('strong', {}, `${formaterMontant(o.montant)} / ${libelleUnite(o.unite)}`), ` (${o.reference})`),
      depasse && el('span', { class: 'officiels-carte__depasse' }, `Dépasse le plafond de ${formaterMontant(p.montant - o.montant)}`));
  }));
}

function initialiserOfficiels() {
  const formulaire = document.querySelector('#formulaire-officiel');
  document.querySelector('#o-date').value = aujourdhuiIso();
  formulaire.addEventListener('submit', saisirOfficiel);
}

async function chargerOfficiels() {
  try {
    [prixOfficiels, officielsEnVigueur] = await Promise.all([api.prixOfficielsTous(), api.prixOfficiels()]);
  } catch (erreur) {
    gererErreur(erreur, document.querySelector('#annonce-officiels'));
    return;
  }
  // Listes du formulaire (les produits sont chargés par chargerReferences)
  const produits = produitsListe.length ? produitsListe : await api.produits();
  const selectProduit = document.querySelector('#o-produit');
  if (selectProduit.options.length === 0) {
    remplirSelect(selectProduit, produits.map((x) => ({ valeur: x.id, libelle: x.nom })), 'Choisir un produit');
    remplirSelect(document.querySelector('#o-unite'), Object.keys(UNITES).map((u) => ({ valeur: u, libelle: UNITES[u].vendu })));
    selectProduit.addEventListener('change', () => {
      const produit = produits.find((x) => String(x.id) === selectProduit.value);
      if (produit) document.querySelector('#o-unite').value = produit.unite_reference;
    });
  }
  afficherOfficiels();
  // Panneau « Bases de référence » de la file de modération
  const etat = document.querySelector('#ref-ministere-etat');
  const texte = document.querySelector('#ref-ministere');
  if (officielsEnVigueur.length) {
    etat.textContent = 'À jour';
    etat.classList.add('reference-base__etat--vert');
    const derniere = officielsEnVigueur.map((o) => o.date_effet).sort().at(-1);
    texte.replaceChildren(`${officielsEnVigueur.length} prix officiel${officielsEnVigueur.length > 1 ? 's' : ''} en vigueur • dernier texte du ${formaterDate(derniere)}. `,
      el('a', { href: '#officiels' }, 'Gérer'));
  }
  if (propositions.length) afficher();
}

function etatOfficiel(o) {
  if (o.retire_le) return ['Retiré', 'rejetee'];
  if (officielsEnVigueur.some((v) => v.id === o.id)) return ['En vigueur', 'validee'];
  if (o.date_effet > aujourdhuiIso()) return ['À venir', 'en_attente'];
  return ['Remplacé', 'rejetee'];
}

function afficherOfficiels() {
  const corps = document.querySelector('#lignes-officiels');
  if (prixOfficiels.length === 0) {
    corps.replaceChildren(el('tr', {}, el('td', { colspan: 7, class: 'chargement' }, 'Aucun prix officiel saisi pour le moment.')));
    return;
  }
  corps.replaceChildren(...prixOfficiels.map((o) => {
    const [etat, classe] = etatOfficiel(o);
    return el('tr', {},
      el('td', {}, el('strong', {}, o.produit.nom)),
      el('td', {}, o.type === 'plafond' ? 'Plafond' : 'Indicatif'),
      el('td', {}, `${formaterMontant(o.montant)} / ${libelleUnite(o.unite)}`),
      el('td', {}, formaterDate(o.date_effet)),
      el('td', {}, o.reference, el('span', { class: 'note' }, ` • saisi par ${o.saisi_par ?? 'un administrateur'}`)),
      el('td', {}, el('span', { class: `statut statut--${classe}` }, etat)),
      el('td', {}, !o.retire_le && el('button', {
        type: 'button', class: 'bouton bouton--secondaire bouton--compact',
        'aria-label': `Retirer le prix officiel de ${o.produit.nom}`,
        onclick: (e) => retirerOfficiel(o, e.currentTarget),
      }, 'Retirer')));
  }));
}

async function saisirOfficiel(evenement) {
  evenement.preventDefault();
  const formulaire = evenement.currentTarget;
  const annonceOfficiels = document.querySelector('#annonce-officiels');
  const alerte = document.querySelector('#officiel-erreur');
  alerte.hidden = true;
  formulaire.querySelectorAll('[data-erreur-officiel]').forEach((z) => { z.hidden = true; });
  const champs = formulaire.elements;
  const bouton = formulaire.querySelector('[type="submit"]');
  bouton.disabled = true;
  try {
    const { prix_officiel: o } = await api.saisirPrixOfficiel({
      produit_id: Number(champs.produit_id.value) || undefined,
      type: formulaire.querySelector('input[name="type"]:checked')?.value,
      montant: champs.montant.value === '' ? undefined : Number(champs.montant.value),
      unite: champs.unite.value,
      date_effet: champs.date_effet.value,
      reference: champs.reference.value.trim() || undefined,
    });
    annonceOfficiels.textContent = `Prix officiel enregistré : ${o.produit.nom}, ${formaterMontant(o.montant)} / ${libelleUnite(o.unite)}.`;
    champs.montant.value = '';
    champs.reference.value = '';
    await chargerOfficiels();
  } catch (erreur) {
    if (erreur.statut === 401) return versConnexion();
    const zone = erreur.champ && formulaire.querySelector(`[data-erreur-officiel="${erreur.champ}"]`);
    if (zone) {
      zone.textContent = erreur.message;
      zone.hidden = false;
    } else {
      alerte.textContent = erreur.message;
      alerte.hidden = false;
    }
  } finally {
    bouton.disabled = false;
  }
}

async function retirerOfficiel(o, bouton) {
  if (!window.confirm(`Retirer le prix officiel de ${o.produit.nom} (${formaterMontant(o.montant)}) ? Il restera dans l'historique.`)) return;
  bouton.disabled = true;
  try {
    await api.retirerPrixOfficiel(o.id);
    document.querySelector('#annonce-officiels').textContent = `Prix officiel de ${o.produit.nom} retiré.`;
    await chargerOfficiels();
  } catch (erreur) {
    bouton.disabled = false;
    gererErreur(erreur, document.querySelector('#annonce-officiels'));
  }
}

