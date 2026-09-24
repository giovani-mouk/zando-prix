// =============================================================
// public/js/responsable.js : page d'administration des propositions
// Espace administrateur : story 8, features 12 et 13
// Corriger, publier ou supprimer les propositions reçues.
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

  document.querySelector('#session-nom').textContent = administrateur.nom;
  document.querySelector('#session').hidden = false;
  contenu.hidden = false;

  initialiserCorrection();
  initialiserSuppression();
  onglets.forEach((onglet) => {
    onglet.addEventListener('click', () => {
      filtre = onglet.dataset.statut;
      annonce.textContent = '';
      afficher();
    });
  });

  await charger();
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
