// Carrousel de photos à côté du grand titre (hors cadrage, @a-valider)
//
// - Grand écran uniquement : sur mobile, rien n'est affiché ni téléchargé.
// - Bouton pause (WCAG 2.2.2), arrêt au survol, arrêt définitif dès que
//   le clavier entre dans le carrousel ou qu'une photo est choisie.
// - Aucun défilement automatique si l'appareil demande moins d'animations.
import { el } from './dom.js';

const INTERVALLE = 6000;
// matchMedia : la même requête média qu'en CSS, mais lisible en JavaScript.
// .matches dit si elle est vraie maintenant ; l'événement « change »
// prévient quand elle change (fenêtre redimensionnée, tablette tournée).
const grandEcran = window.matchMedia('(min-width: 60rem)');
const moinsAnimations = window.matchMedia('(prefers-reduced-motion: reduce)');

export function initialiserCarrousel() {
  const carrousel = document.querySelector('#carrousel');
  if (!carrousel) return;

  let arreter = null;
  // « arreter » contient la fonction d'arrêt renvoyée par monter() :
  // non nulle = carrousel installé. On l'installe en passant en grand
  // écran, et on stoppe le minuteur en repassant en petit écran.
  const suivreEcran = () => {
    if (grandEcran.matches && !arreter) arreter = monter(carrousel);
    else if (!grandEcran.matches && arreter) { arreter(); arreter = null; }
  };
  suivreEcran();
  grandEcran.addEventListener('change', suivreEcran);
}

// Installe le carrousel ; renvoie une fonction qui arrête le défilement
function monter(carrousel) {
  const zone = carrousel.querySelector('.carrousel__diapos');
  const diapos = [...carrousel.querySelectorAll('.diapo')];
  const boutonPause = carrousel.querySelector('.carrousel__pause');
  let courante = 0;
  let minuterie = null;
  let enPause = moinsAnimations.matches;
  let survol = false;

  // Photo manquante : la diapositive garde sa légende sur un fond sobre
  for (const diapo of diapos) {
    diapo.querySelector('img').addEventListener('error', () => {
      diapo.classList.add('diapo--sans-photo');
    }, { once: true });
  }

  const points = diapos.map((diapo, i) => el('button', {
    type: 'button',
    class: 'carrousel__point',
    'aria-label': `Photo ${i + 1} : ${diapo.querySelector('figcaption').textContent}`,
    onclick: () => { afficher(i); enPause = true; planifier(); },
  }));
  carrousel.querySelector('.carrousel__points').replaceChildren(...points);

  // Télécharge une photo seulement quand elle va être affichée
  function charger(i) {
    const image = diapos[i].querySelector('img');
    if (!image.getAttribute('src') && image.dataset.src) image.src = image.dataset.src;
  }

  function afficher(i) {
    // Le modulo (%) fait boucler : après la dernière photo vient la première,
    // et « + diapos.length » évite un nombre négatif en reculant depuis 0.
    courante = (i + diapos.length) % diapos.length;
    charger(courante);
    // On précharge aussi la suivante, pour qu'elle apparaisse sans attente
    charger((courante + 1) % diapos.length);
    diapos.forEach((diapo, k) => {
      diapo.classList.toggle('diapo--active', k === courante);
      diapo.setAttribute('aria-hidden', String(k !== courante));
    });
    points.forEach((point, k) => point.setAttribute('aria-current', String(k === courante)));
  }

  function planifier() {
    clearInterval(minuterie);
    minuterie = null;
    const tourne = !enPause && !survol && !document.hidden;
    if (tourne) minuterie = setInterval(() => afficher(courante + 1), INTERVALLE);
    // Pendant le défilement, les lecteurs d'écran ne sont pas interrompus
    zone.setAttribute('aria-live', tourne ? 'off' : 'polite');
    boutonPause.textContent = enPause ? 'Reprendre le défilement' : 'Mettre en pause';
  }

  boutonPause.addEventListener('click', () => { enPause = !enPause; planifier(); });
  carrousel.addEventListener('mouseenter', () => { survol = true; planifier(); });
  carrousel.addEventListener('mouseleave', () => { survol = false; planifier(); });
  // Au clavier, le défilement s'arrête et ne reprend que sur demande
  carrousel.addEventListener('focusin', (e) => {
    if (e.target !== boutonPause && !enPause) { enPause = true; planifier(); }
  });
  // Onglet en arrière-plan (document.hidden) : on arrête le minuteur,
  // inutile de consommer batterie et données pour une page invisible.
  document.addEventListener('visibilitychange', planifier);

  carrousel.hidden = false;
  document.querySelector('#entete-contenu').classList.add('entete__contenu--avec-carrousel');
  afficher(0);
  planifier();

  return () => { clearInterval(minuterie); minuterie = null; };
}
