// =============================================================
// public/js/graphique.js : comparaison des prix en graphique (Chart.js)
//
// Chart.js (environ 70 Ko compressés) est chargé depuis cdnjs SEULEMENT
// au premier clic sur un bouton « graphique ». Ainsi :
// - l'affichage des prix n'attend jamais le CDN, même sur une connexion lente ;
// - un visiteur qui ne regarde aucun graphique ne télécharge rien de plus.
// Si le CDN ne répond pas, la planche affiche un message et les prix
// restent lisibles : le graphique n'est qu'un complément.
// =============================================================
import { formaterNombre, libelleUnite } from './format.js';

// Adresse du fichier sur cdnjs. « integrite » (SRI) est l'empreinte du
// fichier attendu : le navigateur refuse un fichier modifié sur le CDN.
// Elle est calculée et écrite par : npm run cdn:integrite
export const CHART_JS = {
  url: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.1/chart.umd.min.js',
  integrite: 'sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ',
};

const DELAI_MAX = 10_000; // au-delà de 10 s, on considère le CDN injoignable

let chargement = null;

// Ajoute la balise <script> une seule fois ; les appels suivants
// réutilisent la même promesse (déjà résolue ou en cours).
export function chargerChartJs() {
  if (typeof window.Chart === 'function') return Promise.resolve(window.Chart);

  chargement ??= new Promise((resoudre, rejeter) => {
    const script = document.createElement('script');
    script.src = CHART_JS.url;
    if (CHART_JS.integrite) script.integrity = CHART_JS.integrite;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';

    const minuterie = setTimeout(() => rejeter(new Error('Chart.js : délai dépassé')), DELAI_MAX);
    script.addEventListener('load', () => {
      clearTimeout(minuterie);
      if (typeof window.Chart === 'function') resoudre(window.Chart);
      else rejeter(new Error('Chart.js chargé mais introuvable'));
    });
    script.addEventListener('error', () => {
      clearTimeout(minuterie);
      rejeter(new Error('Chart.js : chargement impossible'));
    });
    document.head.append(script);
  }).catch((erreur) => {
    // On oublie l'échec : un prochain clic pourra réessayer (réseau revenu)
    chargement = null;
    throw erreur;
  });

  return chargement;
}

// Un graphique n'a de sens qu'avec au moins deux prix comparables
export function lignesComparables(lignes) {
  return lignes
    .filter((l) => l.disponible && l.comparable)
    .sort((a, b) => a.montant - b.montant);
}

// Couleurs lues dans les variables CSS : une seule source (styles.css)
function couleur(variable) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

let reglagesFaits = false;
function reglerParDefaut() {
  if (reglagesFaits) return;
  // Même police que le reste du site
  window.Chart.defaults.font.family = '"Archivo", system-ui, sans-serif';
  window.Chart.defaults.color = couleur('--encre-douce');
  reglagesFaits = true;
}

// Texte équivalent au graphique, pour les lecteurs d'écran (le <canvas>
// est une image : sans ce texte, il serait muet)
export function resumeGraphique(nom, lignes) {
  const moinsCher = lignes[0];
  const plusCher = lignes[lignes.length - 1];
  const unite = libelleUnite(moinsCher.unite);
  return `${nom} : de ${formaterNombre(moinsCher.montant)} FCFA le ${unite} au ${moinsCher.marche} `
    + `à ${formaterNombre(plusCher.montant)} FCFA le ${unite} au ${plusCher.marche}.`;
}

// Dessine un graphique en barres horizontales dans le <canvas> donné.
// Renvoie l'objet Chart : il faudra appeler .destroy() avant de retirer
// le canvas de la page, sinon Chart.js garde des écouteurs en mémoire.
export function dessinerGraphique(canvas, nom, lignes) {
  reglerParDefaut();
  const vert = couleur('--vert');
  const bleu = couleur('--bleu');
  const moinsAnimations = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', resumeGraphique(nom, lignes));

  return new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: lignes.map((l) => l.marche),
      datasets: [{
        data: lignes.map((l) => l.montant),
        // Vert pour le meilleur prix (même règle que l'étiquette), bleu sinon
        backgroundColor: lignes.map((l) => (l.est_meilleur_prix ? vert : `${bleu}99`)),
        borderRadius: 6,
        maxBarThickness: 26,
      }],
    },
    options: {
      indexAxis: 'y',              // barres horizontales : les noms de marchés restent lisibles
      responsive: true,
      maintainAspectRatio: false,  // la hauteur vient du conteneur (voir styles.css)
      animation: moinsAnimations ? false : { duration: 450 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (contexte) => {
              const ligne = lignes[contexte.dataIndex];
              const fraicheur = ligne.fraicheur === 'recent' ? 'récent' : 'ancien';
              return `${formaterNombre(ligne.montant)} FCFA / ${libelleUnite(ligne.unite)} (${fraicheur})`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,       // sans zéro, une petite différence paraîtrait énorme
          ticks: { callback: (valeur) => formaterNombre(valeur) },
          grid: { color: couleur('--trait') },
        },
        y: {
          grid: { display: false },
          ticks: { color: couleur('--encre'), font: { weight: '600' } },
        },
      },
    },
  });
}
