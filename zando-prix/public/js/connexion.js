// =============================================================
// public/js/connexion.js : page de connexion à l'espace administrateur
// Page de connexion à l'espace administrateur (feature 12)
//
// Le JavaScript ne voit jamais le cookie de session (il est HttpOnly) :
// après une connexion réussie, c'est le navigateur qui le garde et le
// renvoie tout seul. Cette page n'a donc qu'à rediriger.
// =============================================================
import { api } from './api.js';

const ACCUEIL_ADMIN = '/admin.html';

const formulaire = document.querySelector('#formulaire-connexion');
const alerte = document.querySelector('#connexion-erreur');
const bouton = formulaire.querySelector('[type="submit"]');
const { email, mot_de_passe: motDePasse } = formulaire.elements;

// Page à rouvrir après la connexion. Seul un chemin du site est accepté
// ("/..." mais pas "//autre-site.com") : sinon un lien piégé pourrait
// renvoyer l'administrateur vers un faux site après sa connexion.
function destination() {
  const retour = new URLSearchParams(window.location.search).get('retour');
  return retour && retour.startsWith('/') && !retour.startsWith('//') && !retour.startsWith('/\\')
    ? retour
    : ACCUEIL_ADMIN;
}

// Déjà connecté : inutile de montrer le formulaire
api.moi()
  .then(() => window.location.replace(destination()))
  .catch(() => email.focus());

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  alerte.hidden = true;

  if (!email.value.trim() || !motDePasse.value) {
    afficherErreur('Saisissez votre e-mail et votre mot de passe.');
    (email.value.trim() ? motDePasse : email).focus();
    return;
  }

  bouton.disabled = true;
  bouton.textContent = 'Connexion…';
  try {
    await api.connexion(email.value.trim(), motDePasse.value);
    // replace() et non « location.href = » : la page de connexion ne reste
    // pas dans l'historique, le bouton Retour n'y ramène pas.
    window.location.replace(destination());
  } catch (erreur) {
    afficherErreur(erreur.message);
    motDePasse.value = '';
    motDePasse.focus();
    bouton.disabled = false;
    bouton.textContent = 'Se connecter';
  }
});

function afficherErreur(message) {
  alerte.textContent = message;
  alerte.hidden = false;
}
