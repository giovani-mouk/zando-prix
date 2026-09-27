// =============================================================
// public/js/export.js : export et impression du registre (feature 21)
// (maquette « Export & Impression du Registre »)
//
// Données : GET /api/registre?tout=1 avec les filtres choisis (période,
// marché, statut). Le même filtre sert au CSV (/api/registre.csv).
// - Impression / PDF : l'aperçu est la feuille imprimée (voir @media print).
// - Excel : fichier .xlsx fabriqué dans le navigateur avec SheetJS,
//   téléchargé depuis cdnjs au premier clic seulement.
// - Empreinte : SHA-256 des données exportées, calculée par le navigateur.
// =============================================================
import { api } from './api.js';
import { el } from './dom.js';
import { formaterDate, formaterInstant, formaterMontant, formaterNombre, libelleUnite, venduA } from './format.js';
import { marches as listeMarches } from './coquille.js';

const $ = (selecteur) => document.querySelector(selecteur);

// url + integrite : l'empreinte est écrite par « npm run cdn:integrite »
const SHEETJS = {
  url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  integrite: '',
};

const STATUTS = { en_attente: 'En attente', validee: 'Publiée', rejetee: 'Non retenue' };
const CONSTATS = { direct: "Relevé sur l'étal", ticket: 'Ticket ou reçu', pesee: 'Pesée sur balance' };
const LIGNES_PAR_FEUILLE = { portrait: 18, paysage: 11 };

let registre = [];
let marches = [];
let zoom = 1;

demarrer();

async function demarrer() {
  marches = await listeMarches().catch(() => []);
  marches.forEach((m) => $('#marche').append(el('option', { value: m.id }, m.nom)));

  ['#periode', '#marche', '#publiees', '#depuis'].forEach((s) => $(s).addEventListener('change', charger));
  document.querySelectorAll('input[name="orientation"], .options-export input, .colonnes-export input')
    .forEach((c) => c.addEventListener('change', afficher));
  $('#tout-cocher').addEventListener('click', () => {
    document.querySelectorAll('.colonnes-export input').forEach((c) => { c.checked = true; });
    afficher();
  });
  document.querySelectorAll('[data-imprimer]').forEach((b) => b.addEventListener('click', imprimer));
  $('#excel').addEventListener('click', exporterExcel);
  $('#zoom-moins').addEventListener('click', () => changerZoom(-0.1));
  $('#zoom-plus').addEventListener('click', () => changerZoom(0.1));
  $('#plein-ecran').addEventListener('click', () => $('#apercu-cadre').requestFullscreen?.());
  preparerDonneesOuvertes();
  await charger();
}

// ---------------------------------------------------------------
// Filtres et chargement
// ---------------------------------------------------------------

function isoIlYA(jours) {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function filtres() {
  const periode = $('#periode').value;
  $('#bloc-date').hidden = periode !== 'perso';
  const depuis = periode === 'tout' ? undefined : periode === 'perso' ? ($('#depuis').value || undefined) : isoIlYA(Number(periode));
  return {
    depuis,
    marche_id: $('#marche').value || undefined,
    statut: $('#publiees').checked ? 'validee' : undefined,
  };
}

function libellePeriode(depuis) {
  return depuis ? `du ${formaterDate(depuis)} au ${formaterDate(isoIlYA(0))}` : 'tout le registre';
}

async function charger() {
  const f = filtres();
  const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined));
  $('#lien-csv').href = `/api/registre.csv${params.size ? `?${params}` : ''}`;
  try {
    const reponse = await api.registre({ ...f, tout: '1' });
    registre = reponse.propositions;
    $('#volume').textContent = `${formaterNombre(reponse.total)} cotation${reponse.total > 1 ? 's' : ''}`;
    $('#volume-date').textContent = `Mise à jour : ${formaterInstant(new Date().toISOString())}`;
    await afficher();
  } catch (erreur) {
    // Page réservée à l'équipe (décision du PM) : sans connexion, vers la page de connexion
    if (erreur.statut === 401) { window.location.href = `/connexion.html?retour=${encodeURIComponent(window.location.pathname)}`; return; }
    $('#f-lignes').replaceChildren(el('tr', {}, el('td', { class: 'chargement' }, erreur.message)));
  }
}

// ---------------------------------------------------------------
// Aperçu (= feuille imprimée)
// ---------------------------------------------------------------

const COLONNES = {
  reference: ['Réf. & date', (p) => [el('strong', {}, p.reference), el('small', {}, formaterDate(p.date_constat))]],
  produit: ['Produit & unité', (p) => [el('strong', {}, p.produit.nom), el('small', {}, `Vendu ${venduA(p.unite)}`)]],
  marche: ['Marché', (p) => [el('strong', {}, p.marche.nom), el('small', {}, p.marche.ville ?? '')]],
  prix: ['Prix & écart', (p) => [el('strong', {}, `${formaterNombre(p.montant)} FCFA`),
    el('small', { class: p.ecart > 0 ? 'texte-orange' : 'texte-vert' },
      p.ecart === null ? 'Pas de prix affiché' : p.ecart === 0 ? '= prix affiché' : `${p.ecart > 0 ? '+' : '−'}${formaterNombre(Math.abs(p.ecart))} F`)]],
  constat: ['Constatation', (p) => [el('span', {}, CONSTATS[p.constat] ?? 'Non précisé')]],
  statut: ['Statut', (p) => [el('span', { class: `statut-feuille statut-feuille--${p.statut}` }, STATUTS[p.statut])]],
};

const colonnesChoisies = () => [...document.querySelectorAll('.colonnes-export input')].filter((c) => c.checked).map((c) => c.value);

async function afficher() {
  const orientation = document.querySelector('input[name="orientation"]:checked').value;
  const condense = $('#opt-condense').checked;
  const feuille = $('#feuille');
  feuille.classList.toggle('feuille--paysage', orientation === 'paysage');
  feuille.classList.toggle('feuille--condensee', condense);
  // Orientation de la page imprimée
  let style = document.querySelector('#style-impression');
  if (!style) style = document.head.appendChild(el('style', { id: 'style-impression' }));
  style.textContent = `@page { size: A4 ${orientation === 'paysage' ? 'landscape' : 'portrait'}; margin: 12mm; }`;

  const f = filtres();
  const maintenant = new Date();
  $('#f-numero').textContent = `N° REG-CG-${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
  $('#f-horodatage').textContent = `Horodatage : ${formaterInstant(maintenant.toISOString())}`;
  $('#f-periode').textContent = libellePeriode(f.depuis);
  const couverts = new Set(registre.map((p) => p.marche.nom));
  $('#f-marches').textContent = couverts.size ? `${couverts.size} (${[...couverts].join(', ')})` : 'aucun';

  // Empreinte SHA-256 des données exportées
  const empreinte = $('#opt-empreinte').checked ? await sha256(JSON.stringify(registre.map((p) => [p.reference, p.montant, p.unite, p.date_constat, p.statut]))) : '';
  $('#f-empreinte').textContent = empreinte ? `SHA-256 : ${empreinte.slice(0, 8)}…${empreinte.slice(-4)}` : '';
  $('#f-empreinte').title = empreinte;
  $('#f-mentions').hidden = !$('#opt-mentions').checked;

  $('#f-chiffres').replaceChildren(...chiffres());

  const colonnes = colonnesChoisies();
  $('#f-entete').replaceChildren(...colonnes.map((c) => el('th', {}, COLONNES[c][0])));
  $('#f-lignes').replaceChildren(...(registre.length
    ? registre.map((p) => el('tr', {}, ...colonnes.map((c) => el('td', {}, ...COLONNES[c][1](p)))))
    : [el('tr', {}, el('td', { colspan: colonnes.length, class: 'chargement' }, 'Aucune proposition pour ces filtres.'))]));

  const parFeuille = Math.round(LIGNES_PAR_FEUILLE[orientation] * (condense ? 1.5 : 1));
  const feuilles = Math.max(1, Math.ceil(registre.length / parFeuille));
  $('#estimation').textContent = `${condense ? 'Bordereau condensé' : 'Bordereau'} : ${feuilles} feuillet${feuilles > 1 ? 's' : ''} A4`;
  $('#apercu-feuille').textContent = `(${feuilles} feuillet${feuilles > 1 ? 's' : ''})`;
  $('#f-feuillet').textContent = `Extrait de ${registre.length} proposition${registre.length > 1 ? 's' : ''} • ${feuilles} feuillet${feuilles > 1 ? 's' : ''} A4`;
}

// Quatre chiffres clés, calculés sur l'extrait
function chiffres() {
  const publiees = registre.filter((p) => p.statut === 'validee').length;
  const parProduit = new Map();
  registre.forEach((p) => parProduit.set(p.produit.nom, [...(parProduit.get(p.produit.nom) ?? []), p]));
  const [produit, lignes] = [...parProduit.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  const avecEcart = registre.filter((p) => p.ecart !== null).sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));
  const bloc = (libelle, valeur, detail) => el('div', { class: 'chiffre-feuille' },
    el('p', { class: 'chiffre-feuille__libelle' }, libelle), el('p', { class: 'chiffre-feuille__valeur' }, valeur),
    el('p', { class: 'chiffre-feuille__detail' }, detail));
  return [
    bloc('Propositions', formaterNombre(registre.length), `dont ${publiees} publiée${publiees > 1 ? 's' : ''}`),
    produit
      ? bloc(`${produit} (moyenne)`, formaterMontant(Math.round(lignes.reduce((t, p) => t + p.montant, 0) / lignes.length)), `${lignes.length} proposition${lignes.length > 1 ? 's' : ''}`)
      : bloc('Produit le plus relevé', '—', ''),
    avecEcart.length
      ? bloc('Écart max constaté', `${avecEcart[0].ecart > 0 ? '+' : '−'}${formaterNombre(Math.abs(avecEcart[0].ecart))} F`, `${avecEcart[0].produit.nom}, ${avecEcart[0].marche.nom}`)
      : bloc('Écart max constaté', '—', 'aucun prix affiché à comparer'),
    bloc('Marchés couverts', String(new Set(registre.map((p) => p.marche.nom)).size), `sur ${marches.length} suivis`),
  ];
}

async function sha256(texte) {
  if (!crypto.subtle) return '';
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

function changerZoom(pas) {
  zoom = Math.min(1.5, Math.max(0.5, Math.round((zoom + pas) * 10) / 10));
  $('#feuille').style.setProperty('--zoom', zoom);
  $('#zoom-valeur').textContent = `${Math.round(zoom * 100)}%`;
}

function imprimer() {
  window.print();
  toast('Document prêt : choisissez « Enregistrer au format PDF » pour obtenir un fichier.');
}

// ---------------------------------------------------------------
// Excel (.xlsx) avec SheetJS, chargé à la demande depuis cdnjs
// ---------------------------------------------------------------

let promesseSheetJs;
function chargerSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  promesseSheetJs ??= new Promise((resoudre, rejeter) => {
    const script = el('script', { src: SHEETJS.url, crossorigin: 'anonymous', referrerpolicy: 'no-referrer' });
    if (SHEETJS.integrite) script.integrity = SHEETJS.integrite;
    script.addEventListener('load', () => resoudre(window.XLSX));
    script.addEventListener('error', () => { promesseSheetJs = null; rejeter(new Error("Le module Excel n'a pas pu être téléchargé. Utilisez le CSV, qui s'ouvre aussi dans Excel.")); });
    document.head.append(script);
  });
  return promesseSheetJs;
}

async function exporterExcel() {
  const bouton = $('#excel');
  bouton.disabled = true;
  try {
    const XLSX = await chargerSheetJs();
    const lignes = registre.map((p) => ({
      'Référence': p.reference,
      'Reçue le': new Date(p.recue_le),
      'Produit': p.produit.nom,
      'Catégorie': p.produit.categorie,
      'Marché': p.marche.nom,
      'Prix (FCFA)': p.montant,
      'Unité': libelleUnite(p.unite),
      'Constatée le': p.date_constat,
      'Constatation': CONSTATS[p.constat] ?? '',
      'Statut': STATUTS[p.statut],
      'Prix affiché (FCFA)': p.prix_affiche,
      'Écart (FCFA)': p.ecart,
    }));
    const feuille = XLSX.utils.json_to_sheet(lignes);
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, 'Registre');
    XLSX.writeFile(classeur, `registre-zando-prix-${isoIlYA(0)}.xlsx`);
    toast('Fichier Excel généré.');
  } catch (erreur) {
    toast(erreur.message);
  } finally {
    bouton.disabled = false;
  }
}

// ---------------------------------------------------------------
// Données ouvertes
// ---------------------------------------------------------------

function preparerDonneesOuvertes() {
  const adresse = `${window.location.origin}/api/registre?tout=1&statut=validee`;
  $('#exemple-curl').textContent = `curl "${adresse}" \\\n  -H "Accept: application/json"\n\n# Même extrait en CSV :\ncurl -o registre.csv "${window.location.origin}/api/registre.csv?statut=validee"`;
  $('#copier-api').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(adresse);
      toast("Adresse de l'API copiée.");
    } catch {
      toast(adresse);
    }
  });
}

let minuterie;
function toast(message) {
  $('#toast-message').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(minuterie);
  minuterie = setTimeout(() => { $('#toast').hidden = true; }, 4000);
}

