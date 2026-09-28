// =============================================================
// public/js/coquille.js : éléments communs à toutes les pages publiques
// (l'« enveloppe » de la maquette : en-tête et pied de page)
//
// - « Votre marché » dans l'en-tête : mémorisé dans ce navigateur
//   (localStorage), jamais envoyé au serveur ;
// - bouton « Actualiser » (téléphone) ;
// - liste des marchés du pied de page, lue depuis l'API.
//
// Les autres scripts lisent le marché choisi avec lireMarcheReference()
// et sont prévenus d'un changement par l'événement « zp:marche ».
// =============================================================
import { api } from './api.js';
import { el } from './dom.js';

const CLE = 'zando-prix:marche';

export function lireMarcheReference() {
  try {
    return localStorage.getItem(CLE) ?? '';
  } catch {
    return ''; // stockage désactivé (navigation privée stricte) : pas de marché mémorisé
  }
}

export function choisirMarcheReference(id) {
  try {
    if (id) localStorage.setItem(CLE, String(id));
    else localStorage.removeItem(CLE);
  } catch {
    // stockage indisponible : le choix vaut seulement pour cette page
  }
  const select = document.querySelector('#marche-reference');
  if (select) select.value = id ? String(id) : '';
  document.dispatchEvent(new CustomEvent('zp:marche', { detail: { id: id ? String(id) : '' } }));
}

// Liste des marchés, chargée une seule fois et partagée avec les autres scripts
let promesseMarches;
export function marches() {
  promesseMarches ??= api.marches();
  return promesseMarches;
}

// « Brazzaville - Bacongo » -> « Bacongo »
export const quartier = (marche) => (marche.ville ?? '').split(/\s+-\s+/).pop();

afficherIcones();
demarrer();

// Les icônes (police Material Symbols) ne deviennent visibles qu'une fois la
// police chargée : sinon le navigateur afficherait leur nom (« search »…).
function afficherIcones() {
  if (!document.fonts?.load) return;
  document.fonts.load('24px "Material Symbols Outlined"', 'search')
    .then((polices) => {
      if (polices.length > 0) document.documentElement.classList.add('icones-pretes');
    })
    .catch(() => {});
}

async function demarrer() {
  const select = document.querySelector('#marche-reference');

  document.querySelectorAll('[data-actualiser]').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      // L'accueil recharge ses prix sans recharger la page ; les autres pages se rechargent
      const evenement = new CustomEvent('zp:actualiser', { cancelable: true });
      if (document.dispatchEvent(evenement)) window.location.reload();
    });
  });

  let liste;
  try {
    liste = await marches();
  } catch {
    return; // API injoignable : l'en-tête reste utilisable, sans liste de marchés
  }

  if (select) {
    liste.forEach((m) => select.append(el('option', { value: m.id }, m.nom)));
    const memorise = lireMarcheReference();
    // Un marché supprimé depuis la dernière visite est oublié
    if (memorise && liste.some((m) => String(m.id) === memorise)) select.value = memorise;
    else if (memorise) choisirMarcheReference('');
    select.addEventListener('change', () => choisirMarcheReference(select.value));
  }

  const pied = document.querySelector('#pied-liste-marches');
  if (pied) {
    pied.replaceChildren(...liste.map((m) =>
      el('li', {}, el('a', { href: `/?marche=${m.id}` }, `${m.nom} — ${quartier(m)}`))));
  }
}
