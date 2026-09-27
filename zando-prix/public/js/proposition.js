// =============================================================
// public/js/proposition.js : dialogue « Proposer un prix » (story 7)
// =============================================================
import { api } from './api.js';
import { remplirSelect, choisirSiPresent } from './dom.js';
import { UNITES, aujourdhuiIso, formaterDate, formaterMontant, libelleUnite } from './format.js';

const dialogue = document.querySelector('#proposition');
const vueFormulaire = document.querySelector('#proposition-formulaire');
const vueMerci = document.querySelector('#proposition-merci');
const formulaire = vueFormulaire.querySelector('form');
const champs = formulaire.elements;
const alerte = document.querySelector('#proposition-erreur');
const boutonEnvoyer = formulaire.querySelector('[type="submit"]');

const CHAMPS = ['produit_id', 'marche_id', 'montant', 'unite', 'date_constat', 'auteur'];

let produits = [];
let marches = [];

// Appelée une fois par accueil.js, quand produits et marchés sont chargés.
// « export » : ces fonctions sont utilisables par les autres modules ;
// le reste du fichier reste privé.
export function initialiserProposition(donnees) {
  ({ produits, marches } = donnees);

  remplirSelect(champs.produit_id, produits.map((p) => ({ valeur: p.id, libelle: p.nom })), 'Choisir un produit');
  remplirSelect(champs.marche_id, marches.map((m) => ({ valeur: m.id, libelle: m.nom })), 'Choisir un marché');
  remplirSelect(
    champs.unite,
    Object.keys(UNITES).map((unite) => ({ valeur: unite, libelle: `${UNITES[unite].vendu}` })),
  );

  // Proposer l'unité habituelle du produit choisi
  champs.produit_id.addEventListener('change', () => {
    const produit = produits.find((p) => String(p.id) === champs.produit_id.value);
    if (produit) champs.unite.value = produit.unite_reference;
  });

  formulaire.addEventListener('submit', envoyer);
  dialogue.querySelectorAll('[data-fermer]').forEach((bouton) => {
    bouton.addEventListener('click', () => dialogue.close());
  });
  dialogue.querySelector('[data-recommencer]').addEventListener('click', () => ouvrirProposition());
}

export function ouvrirProposition({ produitId, marcheId } = {}) {
  formulaire.reset();
  effacerErreurs();
  vueFormulaire.hidden = false;
  vueMerci.hidden = true;

  champs.date_constat.value = aujourdhuiIso();
  champs.date_constat.max = aujourdhuiIso();
  choisirSiPresent(champs.produit_id, produitId);
  champs.produit_id.dispatchEvent(new Event('change'));
  choisirSiPresent(champs.marche_id, marcheId);

  // showModal() : l'élément natif <dialog> gère seul le fond grisé, la
  // touche Échap et le blocage du focus à l'intérieur du dialogue
  // (accessibilité au clavier sans une ligne de code en plus).
  if (!dialogue.open) dialogue.showModal();
  const premierVide = [champs.produit_id, champs.marche_id, champs.montant].find((c) => !c.value);
  (premierVide ?? champs.montant).focus();
}

// "1 200" -> 1200 ; "750.5" ou "abc" restent du texte et seront refusés par l'API
function valeurSaisie(texte) {
  const nettoye = texte.replace(/\s/g, '');
  if (nettoye === '') return undefined;
  return /^\d+$/.test(nettoye) ? Number(nettoye) : nettoye;
}

async function envoyer(evenement) {
  // Empêche le navigateur d'envoyer le formulaire lui-même (rechargement
  // de page) : c'est notre code qui l'envoie à l'API avec fetch.
  evenement.preventDefault();
  effacerErreurs();

  // La validation est faite par l'API : une seule source de vérité
  const proposition = {
    produit_id: valeurSaisie(champs.produit_id.value),
    marche_id: valeurSaisie(champs.marche_id.value),
    montant: valeurSaisie(champs.montant.value),
    unite: champs.unite.value || undefined,
    date_constat: champs.date_constat.value || undefined,
    auteur: champs.auteur.value.trim() || undefined,
  };

  // Bouton désactivé pendant l'envoi : un double clic n'envoie pas deux propositions
  boutonEnvoyer.disabled = true;
  boutonEnvoyer.textContent = 'Envoi en cours…';
  try {
    const reponse = await api.proposer(proposition);
    afficherMerci(reponse);
  } catch (erreur) {
    afficherErreur(erreur);
  } finally {
    boutonEnvoyer.disabled = false;
    boutonEnvoyer.textContent = 'Envoyer la proposition';
  }
}

function afficherMerci({ proposition, message }) {
  vueFormulaire.hidden = true;
  vueMerci.hidden = false;
  document.querySelector('#merci-message').textContent = message;
  document.querySelector('#merci-recapitulatif').textContent =
    `${proposition.produit} à ${formaterMontant(proposition.montant)} / ${libelleUnite(proposition.unite)}, `
    + `${proposition.marche}, vu le ${formaterDate(proposition.date_constat)}. `
    + 'Statut : en attente de vérification.';
  vueMerci.querySelector('h2').focus();
}

// L'API indique le champ fautif (erreur.champ) : on affiche le message sous
// ce champ, on le marque aria-invalid (annoncé par les lecteurs d'écran)
// et on y place le curseur pour que l'utilisateur corrige tout de suite.
function afficherErreur(erreur) {
  const champ = CHAMPS.includes(erreur.champ) ? champs[erreur.champ] : null;
  if (champ) {
    const message = document.querySelector(`#erreur-${erreur.champ}`);
    message.textContent = erreur.message;
    message.hidden = false;
    champ.setAttribute('aria-invalid', 'true');
    champ.focus();
  } else {
    alerte.textContent = erreur.message;
    alerte.hidden = false;
  }
}

function effacerErreurs() {
  alerte.hidden = true;
  for (const nom of CHAMPS) {
    champs[nom].removeAttribute('aria-invalid');
    const message = document.querySelector(`#erreur-${nom}`);
    message.hidden = true;
    message.textContent = '';
  }
}
