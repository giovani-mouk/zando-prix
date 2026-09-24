// =============================================================
// public/js/menu.js : menu burger sur téléphone (pages publiques)
//
// Amélioration progressive : sans JavaScript, le bouton reste caché
// et les liens restent visibles sous le logo. Ce script :
// - affiche le bouton et range les liens dans un menu déroulant ;
// - garde aria-expanded à jour (annoncé par les lecteurs d'écran) ;
// - ferme le menu avec Échap, au clic sur un lien ou en dehors ;
// - le referme en repassant sur grand écran.
// =============================================================

const barre = document.querySelector('.entete__barre');
const bouton = document.querySelector('.burger');
const navigation = document.querySelector('#navigation');

// Même seuil que dans styles.css (@media (max-width: 48rem))
const petitEcran = window.matchMedia('(max-width: 48rem)');

if (barre && bouton && navigation) {
  // Ce seul attribut active les règles CSS du menu déroulant
  barre.dataset.menu = 'ferme';
  bouton.hidden = false;

  const ouvert = () => barre.dataset.menu === 'ouvert';

  function basculer(ouvrir, { rendreFocus = false } = {}) {
    barre.dataset.menu = ouvrir ? 'ouvert' : 'ferme';
    bouton.setAttribute('aria-expanded', String(ouvrir));
    // Le focus revient au bouton quand on ferme au clavier : on ne se perd pas dans la page
    if (!ouvrir && rendreFocus) bouton.focus();
  }

  bouton.addEventListener('click', () => {
    basculer(!ouvert());
    // À l'ouverture, le premier lien reçoit le focus pour enchaîner au clavier
    if (ouvert()) navigation.querySelector('a')?.focus();
  });

  document.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Escape' && ouvert()) basculer(false, { rendreFocus: true });
  });

  // Clic sur un lien du menu, ou n'importe où en dehors : on ferme
  document.addEventListener('click', (evenement) => {
    if (!ouvert()) return;
    const dansLeMenu = navigation.contains(evenement.target) && !evenement.target.closest('a');
    if (!dansLeMenu && !bouton.contains(evenement.target)) basculer(false);
  });

  // Retour sur grand écran : le menu ouvert n'a plus de sens
  petitEcran.addEventListener('change', () => {
    if (!petitEcran.matches) basculer(false);
  });
}
