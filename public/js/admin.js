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
  UNITES, aujourdhuiIso, formaterDate, formaterInstant, formaterMontant, libelleUnite,
} from './format.js';

const LIBELLES = { en_attente: 'En attente', validee: 'Publiée', rejetee: 'Rejetée' };
const VIDES = {
  en_attente: 'Aucune proposition en attente. Tout est à jour.',
  validee: "Aucune proposition publiée pour l'instant.",
  rejetee: "Aucune proposition supprimée pour l'instant.",
  '': "Aucune proposition reçue pour l'instant.",
};
const CHAMPS_CORRECTION = ['produit_id', 'marche_id', 'montant', 'unite', 'date_constat'];

const contenu = document.querySelector('#contenu');
const VUES = ['propositions', 'messages', 'administrateurs'];
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

demarrer();

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
  await Promise.all([charger(), chargerMessages(), chargerComptes()]);
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

  const visibles = filtre ? propositions.filter((p) => p.statut === filtre) : propositions;
  mettreAJourCompteurs();
  corpsTableau.replaceChildren(...visibles.map(ligne));
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

function ligne(p) {
  return el('tr', {},
    el('td', { class: 'date' }, formaterInstant(p.created_at)),
    el('th', { scope: 'row' }, p.produit),
    el('td', {}, p.marche),
    el('td', { class: 'nombre' },
      `${formaterMontant(p.montant)} / ${libelleUnite(p.unite)}`,
      p.corrigee_le
        ? el('span', { class: 'mention' }, `Corrigé par ${p.corrigee_par ?? 'un administrateur'}`)
        : null),
    el('td', { class: 'date' }, formaterDate(p.date_constat)),
    el('td', {}, p.auteur ?? 'Anonyme'),
    el('td', {}, el('span', { class: `statut statut--${p.statut}` }, LIBELLES[p.statut])),
    el('td', {}, p.statut === 'en_attente'
      ? el('div', { class: 'actions' },
        el('button', {
          type: 'button',
          class: 'bouton bouton--valider bouton--compact',
          'aria-label': `Publier : ${resume(p)}`,
          onclick: (e) => publier(p, e.currentTarget),
        }, 'Publier'),
        el('button', {
          type: 'button',
          class: 'bouton bouton--secondaire bouton--compact',
          'aria-label': `Corriger : ${resume(p)}`,
          onclick: () => ouvrirCorrection(p),
        }, 'Corriger'),
        el('button', {
          type: 'button',
          class: 'bouton bouton--rejeter bouton--compact',
          'aria-label': `Supprimer : ${resume(p)}`,
          onclick: () => ouvrirSuppression(p),
        }, 'Supprimer'))
      : el('span', { class: 'traitee' }, mentionTraitement(p))));
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
