// =============================================================
// public/js/officiels.js : prix officiels du Ministère du Commerce
// comparés aux prix des étals (feature 23, maquette du PM)
//
// On ne compare que ce qui est comparable : même produit, même unité.
// « Prix des étals » = moyenne des prix affichés dans les marchés choisis.
// =============================================================
import { api } from './api.js';
import { el } from './dom.js';
import { formaterDate, formaterMontant, formaterNombre, venduA } from './format.js';

const $ = (selecteur) => document.querySelector(selecteur);
const ic = (nom, classe = '') => el('span', { class: `ms ${classe}`.trim(), 'aria-hidden': 'true' }, nom);
const nomCourt = (nom) => nom.replace(/^Marché\s+(de\s+|d'|du\s+)?/i, '');

let officiels = [];
let lignes = [];

demarrer();

async function demarrer() {
  try {
    const [o, l, marches] = await Promise.all([api.prixOfficiels(), api.prix(), api.marches()]);
    officiels = o;
    lignes = l;
    $('#filtre-marche-officiels').append(...marches.map((m) => el('option', { value: m.id }, m.nom)));
  } catch (erreur) {
    $('#cartes-officiels').replaceChildren(el('p', { class: 'chargement' }, erreur.message));
    return;
  }
  if (officiels.length) {
    const derniere = officiels.map((x) => x.date_effet).sort().at(-1);
    $('#maj-officiels').textContent = `Dernier texte officiel : ${formaterDate(derniere)}`;
    $('#maj-officiels').hidden = false;
  }
  $('#filtre-marche-officiels').addEventListener('change', afficher);
  $('#recherche-officiels').addEventListener('input', afficher);
  afficher();
}

// Prix des étals pour un prix officiel : même produit, même unité
function prixDesEtals(officiel, marcheId) {
  const releves = lignes.filter((l) => l.disponible && l.produit_id === officiel.produit.id && l.unite === officiel.unite
    && (!marcheId || String(l.marche_id) === marcheId));
  if (releves.length === 0) return null;
  const montants = releves.map((l) => l.montant);
  const moyenne = Math.round(montants.reduce((a, b) => a + b, 0) / montants.length);
  const max = Math.max(...montants);
  return { releves, moyenne, min: Math.min(...montants), max, maxMarche: releves.find((l) => l.montant === max).marche };
}

function afficher() {
  const marcheId = $('#filtre-marche-officiels').value;
  const texte = $('#recherche-officiels').value.trim().toLowerCase();
  const choisis = officiels.filter((o) => !texte || o.produit.nom.toLowerCase().includes(texte));

  // Indice de tension : écart moyen entre prix des étals et prix officiel
  const ecarts = officiels.map((o) => ({ o, e: prixDesEtals(o, marcheId) })).filter((x) => x.e)
    .map(({ o, e }) => ((e.moyenne - o.montant) / o.montant) * 100);
  $('#indice-tension').hidden = ecarts.length === 0;
  if (ecarts.length) {
    const moyenne = Math.round((ecarts.reduce((a, b) => a + b, 0) / ecarts.length) * 10) / 10;
    $('#tension-valeur').textContent = `${moyenne > 0 ? '+' : moyenne < 0 ? '−' : ''}${formaterNombre(Math.abs(moyenne))} %`;
    $('#tension-valeur').className = `indice-tension__valeur ${moyenne > 0 ? 'texte-orange' : 'texte-vert'}`;
    $('#tension-texte').textContent = `Écart moyen entre les prix des étals et les prix officiels, sur ${ecarts.length} prix comparable${ecarts.length > 1 ? 's' : ''}.`;
  }

  if (officiels.length === 0) {
    $('#resume-officiels').textContent = '';
    $('#cartes-officiels').replaceChildren(el('div', { class: 'vide' },
      el('p', { class: 'vide__message' }, "Aucun prix officiel n'a encore été publié. Les prix du Ministère du Commerce apparaîtront ici dès que l'équipe les aura saisis.")));
    return;
  }
  $('#resume-officiels').textContent = `${choisis.length} prix officiel${choisis.length > 1 ? 's' : ''} affiché${choisis.length > 1 ? 's' : ''}.`;
  $('#cartes-officiels').replaceChildren(...(choisis.length
    ? choisis.map((o) => carte(o, prixDesEtals(o, marcheId)))
    : [el('p', { class: 'chargement' }, 'Aucun produit ne correspond à votre recherche.')]));
}

function carte(o, etals) {
  const plafond = o.type === 'plafond';
  const depasse = plafond && etals && etals.max > o.montant;
  const ecart = etals ? etals.moyenne - o.montant : null;
  const pourcent = etals ? Math.round((ecart / o.montant) * 1000) / 10 : null;
  const signe = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');

  // Échelle : prix officiel, moyenne des étals, relevé le plus haut
  const echelle = etals && el('div', { class: 'echelle-officielle' },
    el('p', { class: 'echelle-officielle__titre' }, 'Échelle constatée'),
    el('div', { class: 'echelle-officielle__piste' },
      ...[[o.montant, 'officiel'], [etals.moyenne, 'moyenne'], [etals.max, 'max']].map(([v, c]) => {
        const bas = Math.min(o.montant, etals.min) * 0.9;
        const haut = Math.max(o.montant, etals.max) * 1.1;
        return el('span', { class: `echelle-officielle__repere echelle-officielle__repere--${c}`, style: `left: ${Math.round(((v - bas) / (haut - bas)) * 100)}%` });
      })),
    el('ul', { class: 'echelle-officielle__legende' },
      el('li', {}, el('span', { class: 'pastille-echelle pastille-echelle--officiel' }), `${formaterMontant(o.montant)} (${plafond ? 'plafond' : 'officiel'})`),
      el('li', {}, el('span', { class: 'pastille-echelle pastille-echelle--moyenne' }), `${formaterMontant(etals.moyenne)} (moyenne des étals)`),
      el('li', {}, el('span', { class: 'pastille-echelle pastille-echelle--max' }), `${formaterMontant(etals.max)} (${nomCourt(etals.maxMarche)})`)));

  return el('article', { class: `carte-officielle${depasse ? ' carte-officielle--alerte' : ''}` },
    depasse && el('p', { class: 'carte-officielle__alerte' }, ic('warning'), 'Dépassement du plafond légal constaté'),
    el('div', { class: 'carte-officielle__entete' },
      o.produit.image ? el('img', { class: 'carte-officielle__vignette', src: o.produit.image, alt: '' }) : null,
      el('div', {},
        el('p', { class: 'carte-officielle__categorie' }, o.produit.categorie ?? 'Produit de base'),
        el('h2', { class: 'carte-officielle__nom' }, o.produit.nom),
        el('p', { class: 'carte-officielle__unite' }, `Vendu ${venduA(o.unite)}`))),
    el('div', { class: 'carte-officielle__prix' },
      el('div', { class: 'bloc-officiel' },
        el('p', { class: 'bloc-officiel__type' }, ic(plafond ? 'gavel' : 'assured_workload'), plafond ? 'Plafond légal' : 'Prix indicatif officiel'),
        el('p', { class: 'bloc-officiel__montant' }, formaterNombre(o.montant), el('span', {}, ' FCFA')),
        el('p', { class: 'bloc-officiel__reference' }, o.reference),
        el('p', { class: 'bloc-officiel__source' }, ic('verified_user'), `Ministère du Commerce • depuis le ${formaterDate(o.date_effet)}`)),
      etals
        ? el('div', { class: 'bloc-etals' },
          el('p', { class: 'bloc-etals__type' }, ic('storefront'), 'Prix moyen des étals'),
          el('p', { class: `bloc-etals__montant ${ecart > 0 ? 'texte-orange' : 'texte-vert'}` }, formaterNombre(etals.moyenne), el('span', {}, ' FCFA')),
          el('p', { class: `bloc-etals__ecart ${ecart > 0 ? 'texte-orange' : 'texte-vert'}` },
            ecart === 0 ? 'Égal au prix officiel' : `${signe(ecart)}${formaterNombre(Math.abs(ecart))} FCFA (${signe(pourcent)}${formaterNombre(Math.abs(pourcent))} %)`),
          el('p', { class: 'bloc-etals__source' }, ic('verified'), `${etals.releves.length} marché${etals.releves.length > 1 ? 's' : ''} : ${etals.releves.map((l) => nomCourt(l.marche)).join(', ')}`))
        : el('div', { class: 'bloc-etals bloc-etals--vide' },
          el('p', { class: 'bloc-etals__type' }, ic('storefront'), 'Prix des étals'),
          el('p', {}, `Aucun prix relevé ${venduA(o.unite)} pour ce produit${$('#filtre-marche-officiels').value ? ' dans ce marché' : ''}.`))),
    echelle,
    el('div', { class: 'carte-officielle__actions' },
      el('a', { class: 'bouton-carte', href: `/produit.html?id=${o.produit.id}` }, ic('history'), 'Voir la fiche produit'),
      el('a', { class: 'bouton-carte bouton-carte--vert', href: `/?proposer=1&produit=${o.produit.id}` }, ic('add_circle'), 'Proposer un prix')));
}

