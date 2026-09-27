// =============================================================
// public/js/contact.js : formulaire de la page Contact (feature 14)
// Même principe que le dialogue « Proposer un prix » : l'API valide,
// la page affiche ses messages sous le bon champ.
// =============================================================
import { api } from './api.js';
import { formaterNombre } from './format.js';

const CHAMPS = ['nom', 'email', 'message'];
const MESSAGE_MAX = 2000;

const formulaire = document.querySelector('#formulaire-contact');
const champs = formulaire.elements;
const alerte = document.querySelector('#contact-erreur');
const bouton = formulaire.querySelector('[type="submit"]');
const compteur = document.querySelector('#compteur-message');
const vueFormulaire = document.querySelector('#vue-formulaire');
const vueMerci = document.querySelector('#vue-merci');

// Caractères restants, affichés seulement quand on approche de la limite
// (annoncer chaque frappe serait pénible avec un lecteur d'écran)
champs.message.addEventListener('input', () => {
  const restants = MESSAGE_MAX - champs.message.value.length;
  compteur.textContent = restants <= 200
    ? `Encore ${formaterNombre(restants)} caractère${restants > 1 ? 's' : ''}.`
    : `${formaterNombre(MESSAGE_MAX)} caractères au plus.`;
});

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  effacerErreurs();

  bouton.disabled = true;
  bouton.textContent = 'Envoi en cours…';
  try {
    const { confirmation } = await api.envoyerMessage({
      nom: champs.nom.value.trim() || undefined,
      email: champs.email.value.trim() || undefined,
      message: champs.message.value.trim() || undefined,
      // Vide pour un humain ; rempli seulement par un robot
      site_web: champs.site_web.value || undefined,
    });
    formulaire.reset();
    vueFormulaire.hidden = true;
    vueMerci.hidden = false;
    document.querySelector('#merci-texte').textContent = confirmation;
    vueMerci.querySelector('h2').focus();
  } catch (erreur) {
    afficherErreur(erreur);
  } finally {
    bouton.disabled = false;
    bouton.textContent = 'Envoyer le message';
  }
});

document.querySelector('#nouveau-message').addEventListener('click', () => {
  vueMerci.hidden = true;
  vueFormulaire.hidden = false;
  champs.nom.focus();
});

function afficherErreur(erreur) {
  if (CHAMPS.includes(erreur.champ)) {
    const message = document.querySelector(`#erreur-${erreur.champ}`);
    message.textContent = erreur.message;
    message.hidden = false;
    champs[erreur.champ].setAttribute('aria-invalid', 'true');
    champs[erreur.champ].focus();
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
