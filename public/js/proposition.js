// =============================================================
// public/js/proposition.js : dialogue « Proposer un prix »
// (story 7 et feature 20, maquette du PM)
//
// Sur ordinateur, une fenêtre ; sur téléphone, le même formulaire en
// plein écran (CSS). La proposition est anonyme : aucun nom, aucun
// téléphone. Après l'envoi, un lien mène à /confirmation.html?id=…
// =============================================================
import { api } from './api.js';
import { el, choisirSiPresent } from './dom.js';
import { aujourdhuiIso, formaterMontant, formaterNombre, ilYA, libelleUnite, venduA } from './format.js';

const $ = (selecteur) => document.querySelector(selecteur);
const ic = (nom) => el('span', { class: 'ms', 'aria-hidden': 'true' }, nom);

const dialogue = $('#proposition');
const vueFormulaire = $('#proposition-formulaire');
const vueMerci = $('#proposition-merci');
const formulaire = vueFormulaire.querySelector('form');
const champs = formulaire.elements;
const alerte = $('#proposition-erreur');
const boutonEnvoyer = formulaire.querySelector('[type="submit"]');

const NOMBRE_RACCOURCIS = 4;
const EMOJIS = [[/riz/i, '🌾'], [/tomate/i, '🍅'], [/oignon/i, '🧅'], [/banane|plantain/i, '🍌'], [/manioc|chikwangue/i, '🥔'],
  [/poisson|chinchard/i, '🐟'], [/huile/i, '🫒'], [/piment/i, '🌶️'], [/maïs|mais/i, '🌽'], [/arachide/i, '🥜']];
const emoji = (nom) => EMOJIS.find(([m]) => m.test(nom))?.[1] ?? '🛒';

let produits = [];
let marches = [];
let lignes = []; // grille des prix actuels (pour les indices « dernier prix vu »)

// Appelée une fois par accueil.js, quand les données sont chargées
export function initialiserProposition(donnees) {
  ({ produits, marches } = donnees);
  lignes = donnees.lignes ?? [];

  champs.produit_id.replaceChildren(el('option', { value: '' }, 'Choisir un produit'),
    ...produits.map((p) => el('option', { value: p.id }, p.nom)));
  champs.marche_id.replaceChildren(el('option', { value: '' }, 'Choisir un marché'),
    ...marches.map((m) => el('option', { value: m.id }, m.nom)));

  // Raccourcis : les premiers produits qui ont déjà un prix
  const avecPrix = new Set(lignes.filter((l) => l.disponible).map((l) => l.produit_id));
  $('#p-raccourcis').append(...produits.filter((p) => avecPrix.has(p.id)).slice(0, NOMBRE_RACCOURCIS).map((p) =>
    el('button', { type: 'button', class: 'raccourci-produit', 'data-produit': p.id, onclick: () => choisirProduit(p.id) },
      `${emoji(p.nom)} ${p.nom}`)));

  champs.produit_id.addEventListener('change', () => {
    const produit = produitChoisi();
    // L'unité habituelle du produit est proposée par défaut
    if (produit) formulaire.querySelector(`input[name="unite"][value="${produit.unite_reference}"]`).checked = true;
    majProduit();
    majIndices();
  });
  champs.marche_id.addEventListener('change', majIndices);
  formulaire.querySelectorAll('input[name="unite"]').forEach((r) => r.addEventListener('change', majIndices));

  // Date : aujourd'hui, hier ou une autre date
  formulaire.querySelectorAll('input[name="quand"]').forEach((r) => r.addEventListener('change', () => {
    const autre = r.value === 'autre' && r.checked;
    champs.date_constat.hidden = !autre;
    if (autre) champs.date_constat.focus();
  }));

  // Pavé de prix (téléphone)
  formulaire.querySelectorAll('[data-ajouter]').forEach((b) => b.addEventListener('click', () => {
    champs.montant.value = (Number(champs.montant.value) || 0) + Number(b.dataset.ajouter);
  }));
  formulaire.querySelector('[data-effacer-prix]').addEventListener('click', () => {
    champs.montant.value = '';
    champs.montant.focus();
  });

  champs.repere.addEventListener('input', () => {
    $('#p-repere-compteur').textContent = `${champs.repere.value.length} / 120 caractères`;
  });

  preparerPhoto();

  formulaire.addEventListener('submit', envoyer);
  dialogue.querySelectorAll('[data-fermer]').forEach((b) => b.addEventListener('click', () => dialogue.close()));
  dialogue.querySelector('[data-recommencer]').addEventListener('click', () => ouvrirProposition());
}

export function ouvrirProposition({ produitId, marcheId } = {}) {
  formulaire.reset();
  effacerErreurs();
  vueFormulaire.hidden = false;
  vueMerci.hidden = true;
  champs.date_constat.hidden = true;
  champs.date_constat.max = aujourdhuiIso();
  champs.date_constat.value = aujourdhuiIso();
  $('#p-repere-compteur').textContent = 'Max 120 caractères';
  retirerPhoto();

  choisirSiPresent(champs.produit_id, produitId);
  champs.produit_id.dispatchEvent(new Event('change'));
  choisirSiPresent(champs.marche_id, marcheId);
  majIndices();

  if (!dialogue.open) dialogue.showModal();
  const premierVide = [champs.produit_id, champs.marche_id, champs.montant].find((c) => !c.value);
  (premierVide ?? champs.montant).focus();
}

function choisirProduit(id) {
  champs.produit_id.value = String(id);
  champs.produit_id.dispatchEvent(new Event('change'));
}

const produitChoisi = () => produits.find((p) => String(p.id) === champs.produit_id.value);
const marcheChoisi = () => marches.find((m) => String(m.id) === champs.marche_id.value);

// Carte du produit choisi (vignette, nom, catégorie)
function majProduit() {
  const produit = produitChoisi();
  $('#p-nom').textContent = produit ? produit.nom : 'Choisir un produit';
  $('#p-detail').textContent = produit ? `${produit.categorie ?? 'Produit de base'} • vendu ${venduA(produit.unite_reference)}` : 'Touchez pour choisir dans la liste';
  $('#p-visuel').replaceChildren(produit?.image ? el('img', { src: produit.image, alt: '' }) : ic('grain'));
  document.querySelectorAll('.raccourci-produit').forEach((b) => b.classList.toggle('raccourci-produit--actif', b.dataset.produit === champs.produit_id.value));
}

// Indices réels : dernier prix vu dans ce marché, marché sans donnée récente
function majIndices() {
  const produit = produitChoisi();
  const marche = marcheChoisi();
  const ligne = produit && marche ? lignes.find((l) => l.produit_id === produit.id && l.marche_id === marche.id) : null;

  const alerteMarche = $('#p-alerte-marche');
  alerteMarche.hidden = !ligne || (ligne.disponible && ligne.fraicheur === 'recent');
  if (!alerteMarche.hidden) {
    $('#p-alerte-texte').replaceChildren(el('strong', {}, 'Marché prioritaire : '),
      ligne.disponible
        ? `le dernier prix du ${produit.nom.toLowerCase()} à ${marche.nom} date de ${ilYA(ligne.date_releve).replace(/^il y a /, '')}. Votre relevé aidera à le mettre à jour.`
        : `aucun prix du ${produit.nom.toLowerCase()} n'a encore été relevé à ${marche.nom}. Votre relevé comblera ce manque.`);
  }

  const indice = $('#p-indice');
  indice.hidden = !ligne?.disponible;
  if (!indice.hidden) {
    $('#p-indice-texte').replaceChildren(`Dernier prix vu à ${marche.nom} : `,
      el('strong', {}, `${formaterMontant(ligne.montant)} / ${libelleUnite(ligne.unite)}`));
  }
}

// ---------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------

function dateChoisie() {
  const quand = formulaire.querySelector('input[name="quand"]:checked').value;
  if (quand === 'autre') return champs.date_constat.value;
  const jour = new Date();
  jour.setDate(jour.getDate() - Number(quand));
  // Date locale (et non UTC) au format AAAA-MM-JJ
  return `${jour.getFullYear()}-${String(jour.getMonth() + 1).padStart(2, '0')}-${String(jour.getDate()).padStart(2, '0')}`;
}

async function envoyer(evenement) {
  evenement.preventDefault();
  effacerErreurs();
  const corps = {
    produit_id: Number(champs.produit_id.value) || undefined,
    marche_id: Number(champs.marche_id.value) || undefined,
    montant: champs.montant.value === '' ? undefined : Number(champs.montant.value),
    unite: formulaire.querySelector('input[name="unite"]:checked')?.value,
    date_constat: dateChoisie(),
    constat: champs.constat.value || undefined,
    repere: champs.repere.value.trim() || undefined,
    photo_url: photo.url || undefined,
  };
  if (photo.envoi) {
    alerte.textContent = "Patientez : la photo est en cours d'envoi.";
    alerte.hidden = false;
    return;
  }

  boutonEnvoyer.disabled = true;
  try {
    const { proposition, cle_suivi: cle } = await api.proposer(corps);
    afficherMerci(proposition, cle);
  } catch (erreur) {
    afficherErreur(erreur);
  } finally {
    boutonEnvoyer.disabled = false;
  }
}

function afficherMerci(proposition, cle) {
  vueFormulaire.hidden = true;
  vueMerci.hidden = false;
  $('#merci-texte').replaceChildren('Votre proposition de ', el('strong', {}, `${formaterNombre(proposition.montant)} FCFA`),
    ` ${venduA(proposition.unite)} pour `, el('strong', {}, proposition.marche),
    " a été transmise à l'équipe pour vérification. Elle sera publiée une fois validée.");
  $('#merci-reference').textContent = `Référence #PROP-${String(proposition.id).padStart(4, '0')}`;
  // Lien privé de suivi : la clé n'est connue que de cette personne
  $('#merci-suivre').href = `/confirmation.html?id=${proposition.id}&cle=${encodeURIComponent(cle)}`;
  $('#merci-titre').focus();
}

// Erreur de l'API : message sous le champ concerné (« champ » de la réponse)
function afficherErreur(erreur) {
  const zone = erreur.champ && formulaire.querySelector(`[data-erreur="${erreur.champ}"]`);
  if (zone) {
    zone.textContent = erreur.message;
    zone.hidden = false;
    const champ = champs[erreur.champ] ?? formulaire.querySelector(`[name="${erreur.champ}"]`);
    champ?.setAttribute?.('aria-invalid', 'true');
    champ?.focus?.();
  } else {
    alerte.textContent = erreur.message;
    alerte.hidden = false;
  }
}

function effacerErreurs() {
  alerte.hidden = true;
  formulaire.querySelectorAll('[data-erreur]').forEach((z) => { z.hidden = true; z.textContent = ''; });
  formulaire.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
}

// ---------------------------------------------------------------
// Photo de l'étal (feature 24)
// La photo est réduite et recompressée dans le téléphone : le fichier
// envoyé est plus léger (données mobiles) et ne contient plus les
// informations cachées de l'original (position GPS, modèle du téléphone).
// Elle part directement chez Cloudinary, avec une autorisation signée
// par notre serveur ; seule son adresse est jointe à la proposition.
// ---------------------------------------------------------------

const TAILLE_MAX = 1280;   // pixels, côté le plus long
const QUALITE = 0.72;      // JPEG
const photo = { url: null, envoi: null };

async function preparerPhoto() {
  try {
    const { disponible } = await api.signaturePhoto();
    if (!disponible) return; // stockage non configuré : pas de photo
  } catch {
    return;
  }
  $('#bloc-photo').hidden = false;
  $('#p-photo').addEventListener('change', (e) => {
    const fichier = e.target.files?.[0];
    if (fichier) envoyerPhoto(fichier);
  });
  $('#p-photo-retirer').addEventListener('click', retirerPhoto);
}

function retirerPhoto() {
  photo.url = null;
  photo.envoi = null;
  const champ = $('#p-photo');
  if (champ) champ.value = '';
  $('#p-photo-apercu').hidden = true;
}

async function envoyerPhoto(fichier) {
  const etat = $('#p-photo-etat');
  const zoneErreur = formulaire.querySelector('[data-erreur="photo_url"]');
  zoneErreur.hidden = true;
  $('#p-photo-apercu').hidden = false;
  etat.textContent = 'Préparation…';
  photo.url = null;

  const envoi = (async () => {
    const image = await reduire(fichier);
    $('#p-photo-image').src = URL.createObjectURL(image);
    etat.textContent = 'Envoi de la photo…';
    const autorisation = await api.signaturePhoto();
    if (!autorisation.disponible) throw new Error("L'envoi de photos n'est pas disponible.");
    const donnees = new FormData();
    donnees.append('file', image, 'etal.jpg');
    donnees.append('api_key', autorisation.cle);
    donnees.append('timestamp', autorisation.timestamp);
    donnees.append('folder', autorisation.dossier);
    donnees.append('signature', autorisation.signature);
    const reponse = await fetch(`https://api.cloudinary.com/v1_1/${autorisation.compte}/image/upload`, { method: 'POST', body: donnees });
    if (!reponse.ok) throw new Error("La photo n'a pas pu être envoyée. Réessayez ou envoyez sans photo.");
    return (await reponse.json()).secure_url;
  })();
  photo.envoi = envoi;
  try {
    const url = await envoi;
    if (photo.envoi !== envoi) return; // photo retirée ou remplacée entre-temps
    photo.url = url;
    etat.replaceChildren(el('span', { class: 'ms', 'aria-hidden': 'true' }, 'check_circle'), ' Preuve prête');
  } catch (erreur) {
    if (photo.envoi !== envoi) return;
    etat.textContent = '';
    $('#p-photo-apercu').hidden = true;
    zoneErreur.textContent = erreur.message;
    zoneErreur.hidden = false;
  } finally {
    if (photo.envoi === envoi) photo.envoi = null;
  }
}

// Réduit l'image (côté le plus long : 1 280 px) et la réencode en JPEG.
// Redessiner l'image sur un canevas supprime toutes les métadonnées.
async function reduire(fichier) {
  let source;
  try {
    source = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch {
    throw new Error("Cette image n'a pas pu être lue. Essayez une autre photo.");
  }
  const echelle = Math.min(1, TAILLE_MAX / Math.max(source.width, source.height));
  const canevas = document.createElement('canvas');
  canevas.width = Math.round(source.width * echelle);
  canevas.height = Math.round(source.height * echelle);
  canevas.getContext('2d').drawImage(source, 0, 0, canevas.width, canevas.height);
  return new Promise((resoudre, rejeter) => {
    canevas.toBlob((blob) => (blob ? resoudre(blob) : rejeter(new Error("La photo n'a pas pu être préparée."))), 'image/jpeg', QUALITE);
  });
}

