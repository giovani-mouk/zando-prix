// =============================================================
// public/js/suivi.js : suivi public des propositions (maquette du PM)
//
// Données : GET /api/registre (filtres, tri, page) et POST
// /api/propositions/:id/confirmations. Le registre ne contient jamais
// l'auteur d'une proposition : la page ne peut donc pas l'afficher.
// Tous les chiffres des cartes viennent de l'API (aucun n'est inventé).
// =============================================================
import { api } from './api.js';
import { el, remplirSelect } from './dom.js';
import { formaterDate, formaterMontant, formaterNombre, venduA } from './format.js';
import { marches as listeMarches } from './coquille.js';

const $ = (selecteur) => document.querySelector(selecteur);

// Au-delà de cet écart avec le prix affiché, la proposition est signalée
// comme inhabituelle (hypothèse à valider par le PM, @a-valider)
const SEUIL_ECART = 20; // %

const etat = { statut: '', page: 1, reponse: null, enCours: null };
let numeroRequete = 0;
let minuterie;

const ic = (nom) => el('span', { class: 'ms', 'aria-hidden': 'true' }, nom);

demarrer();

async function demarrer() {
  brancherEvenements();
  try {
    const [marches, produits] = await Promise.all([listeMarches(), api.produits()]);
    remplirSelect($('#suivi-marche'), marches.map((m) => ({ valeur: m.id, libelle: m.nom })), 'Tous les marchés (Brazzaville)');
    const categories = [...new Set(produits.map((p) => p.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    remplirSelect($('#suivi-categorie'), categories.map((c) => ({ valeur: c, libelle: c })), 'Toutes les catégories');
    $('#bandeau-marches').textContent = `Relevés dans les marchés de Brazzaville : ${marches.map((m) => m.nom.replace(/^Marché\s+/i, '')).join(', ')}`;
  } catch {
    // Les listes sont un confort : le registre reste consultable sans elles
  }
  await charger();
}

function brancherEvenements() {
  $('#filtres-suivi').addEventListener('submit', (e) => {
    e.preventDefault();
    etat.page = 1;
    charger();
  });
  $('#recherche-suivi').addEventListener('input', () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => { etat.page = 1; charger(); }, 250);
  });
  for (const id of ['#suivi-marche', '#suivi-categorie', '#suivi-tri']) {
    $(id).addEventListener('change', () => { etat.page = 1; charger(); });
  }
  document.querySelectorAll('.onglet-statut').forEach((onglet) => {
    onglet.addEventListener('click', () => {
      etat.statut = onglet.dataset.statut;
      etat.page = 1;
      document.querySelectorAll('.onglet-statut').forEach((o) => o.setAttribute('aria-pressed', String(o === onglet)));
      charger();
    });
  });

  // Fenêtre de confirmation
  const fenetre = $('#fenetre-confirmer');
  fenetre.querySelectorAll('[data-fermer]').forEach((b) => b.addEventListener('click', () => fenetre.close()));
  $('#formulaire-confirmer').addEventListener('submit', envoyerConfirmation);

  // « Actualiser » de l'en-tête : on recharge le registre sans recharger la page
  document.addEventListener('zp:actualiser', (e) => {
    e.preventDefault();
    charger();
  });
}

function filtres() {
  return {
    q: $('#recherche-suivi').value.trim(),
    marche_id: $('#suivi-marche').value,
    categorie: $('#suivi-categorie').value,
    tri: $('#suivi-tri').value,
    statut: etat.statut,
    page: etat.page > 1 ? etat.page : '',
  };
}

async function charger() {
  const numero = ++numeroRequete;
  const choisis = filtres();
  // Le lien de téléchargement suit les filtres affichés
  const lien = new URL('/api/registre.csv', window.location.origin);
  for (const [nom, valeur] of Object.entries(choisis)) if (valeur && nom !== 'page') lien.searchParams.set(nom, valeur);
  $('#telecharger').href = lien.pathname + lien.search;

  $('#registre').setAttribute('aria-busy', 'true');
  try {
    const reponse = await api.registre(choisis);
    if (numero !== numeroRequete) return;
    etat.reponse = reponse;
    afficher(reponse);
  } catch (erreur) {
    if (numero !== numeroRequete) return;
    $('#lignes-registre').replaceChildren(ligneMessage(erreur.message));
  } finally {
    if (numero === numeroRequete) $('#registre').setAttribute('aria-busy', 'false');
  }
}

// ---------------------------------------------------------------
// Chiffres clés, onglets, bandeau
// ---------------------------------------------------------------

function afficher(reponse) {
  const { compteurs, statistiques: s } = reponse;

  // Onglets : « Toutes (12) », « Validées (8) »…
  for (const [cle, nombre] of Object.entries(compteurs)) {
    const cible = document.querySelector(`[data-compte="${cle}"]`);
    if (cible) cible.textContent = `(${formaterNombre(nombre)})`;
  }

  // Carte 1 : relevés du mois, comparés au mois précédent
  $('#kpi-mois').textContent = formaterNombre(s.mois);
  const variation = s.mois_precedent > 0 ? Math.round(((s.mois - s.mois_precedent) / s.mois_precedent) * 100) : null;
  $('#kpi-mois-detail').replaceChildren(
    ...(variation === null
      ? [el('span', {}, 'Aucune proposition le mois précédent')]
      : [ic(variation >= 0 ? 'trending_up' : 'trending_down'),
        el('strong', {}, `${variation > 0 ? '+' : ''}${variation} %`),
        el('span', {}, ` vs mois précédent (${formaterNombre(s.mois_precedent)})`)]));

  // Carte 2 : validées et taux d'admission
  $('#kpi-validees').textContent = formaterNombre(compteurs.validee);
  $('#kpi-validees-detail').replaceChildren(
    s.taux_admission === null ? el('span', {}, 'Aucune proposition traitée') : el('span', { class: 'kpi__pastille kpi__pastille--vert' }, `${s.taux_admission} % admises`),
    el('span', {}, ' Prix du jour'));

  // Carte 3 : en attente et délai moyen de traitement
  $('#kpi-attente').textContent = formaterNombre(compteurs.en_attente);
  $('#kpi-attente-detail').replaceChildren(
    el('span', { class: 'kpi__pastille kpi__pastille--orange' }, 'À vérifier'),
    el('span', {}, s.delai_moyen_minutes === null ? ' Délai moyen : —' : ` Délai moyen : ${duree(s.delai_moyen_minutes)}`));

  // Carte 4 : écart moyen avec les prix affichés
  $('#kpi-ecart').replaceChildren(
    s.ecart_moyen === null ? '—' : formaterNombre(s.ecart_moyen),
    s.ecart_moyen === null ? '' : el('span', { class: 'kpi__devise' }, ' FCFA'));
  $('#kpi-ecart-detail').replaceChildren(ic('compare_arrows'), el('span', {}, ' Écart moyen avec les prix affichés'));

  // Bandeau civique
  $('#bandeau-taux').textContent = s.taux_admission === null ? "Taux d'admission : —" : `${s.taux_admission} % taux d'admission`;
  $('#bandeau-maj').textContent = `Mis à jour à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  afficherLignes(reponse);
}

// 220 minutes -> « 3 h 40 »
function duree(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 48) return `${Math.round(h / 24)} jours`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// ---------------------------------------------------------------
// Registre
// ---------------------------------------------------------------

function afficherLignes({ propositions, total, page, pages, par_page: parPage }) {
  $('#nombre-affichees').textContent = `${formaterNombre(total)} proposition${total > 1 ? 's' : ''} affichée${total > 1 ? 's' : ''}`;
  $('#lignes-registre').replaceChildren(...(propositions.length
    ? propositions.map(ligne)
    : [ligneMessage('Aucune proposition ne correspond à ces critères.')]));

  const debut = total === 0 ? 0 : (page - 1) * parPage + 1;
  const fin = Math.min(page * parPage, total);
  $('#registre-position').textContent = `Affichage de ${formaterNombre(debut)} à ${formaterNombre(fin)} sur ${formaterNombre(total)} propositions`;
  afficherPagination(page, pages);
}

// « Aujourd'hui, 10 h 15 », « Hier, 17 h 45 » ou « 20 sept., 09 h 40 »
function quand(horodatage) {
  const date = new Date(horodatage);
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
  const jour = new Date(date);
  jour.setHours(0, 0, 0, 0);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const ecart = Math.round((aujourdhui - jour) / 86_400_000);
  if (ecart === 0) return `Aujourd'hui, ${heure}`;
  if (ecart === 1) return `Hier, ${heure}`;
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${heure}`;
}

const STATUTS = {
  validee: { classe: 'vert', etiquette: 'Validée & publiée', repere: ['verified', 'Publiée'] },
  en_attente: { classe: 'orange', etiquette: 'En attente', repere: ['hourglass_top', 'En attente de contrôle'] },
  rejetee: { classe: 'rouge', etiquette: 'Rejetée', repere: ['block', 'Non admise'] },
};

function ligne(p) {
  const statut = STATUTS[p.statut];
  const { total: confirmations, identiques } = p.confirmations;

  // Écart avec le prix affiché (même produit, même marché, même unité)
  const pourcent = p.prix_affiche ? Math.round((p.ecart / p.prix_affiche) * 100) : null;
  const inhabituel = pourcent !== null && Math.abs(pourcent) > SEUIL_ECART;
  let comparaison;
  if (p.prix_affiche === null) {
    comparaison = el('p', { class: 'prix-registre__compare prix-registre__compare--neutre' }, 'Aucun prix affiché à comparer');
  } else if (inhabituel) {
    comparaison = el('p', { class: 'prix-registre__compare prix-registre__compare--alerte' },
      ic('warning'), `${pourcent > 0 ? '+' : '−'}${Math.abs(pourcent)} % vs prix affiché`);
  } else {
    comparaison = el('p', { class: `prix-registre__compare ${p.ecart <= 0 ? 'prix-registre__compare--baisse' : 'prix-registre__compare--hausse'}` },
      ic(p.ecart <= 0 ? 'arrow_downward' : 'arrow_upward'),
      el('span', {}, `${p.ecart > 0 ? '+' : p.ecart < 0 ? '−' : ''}${formaterNombre(Math.abs(p.ecart))} FCFA`),
      el('s', {}, formaterNombre(p.prix_affiche)));
  }

  const texteStatut = {
    validee: "Vérifiée par l'équipe et publiée dans les prix du jour.",
    rejetee: "Non retenue par l'équipe après vérification.",
    en_attente: confirmations > 0
      ? `${confirmations} confirmation${confirmations > 1 ? 's' : ''} reçue${confirmations > 1 ? 's' : ''}. En attente de vérification par l'équipe.`
      : "En attente de vérification par l'équipe. Vous l'avez vue au marché ? Confirmez-la.",
  }[p.statut];

  return el('tr', { class: `ligne-registre ligne-registre--${statut.classe}` },
    el('td', {},
      el('p', { class: 'ligne-registre__ref' }, p.reference),
      el('p', { class: 'ligne-registre__date' }, quand(p.recue_le)),
      el('p', { class: `ligne-registre__repere ligne-registre__repere--${statut.classe}` }, ic(statut.repere[0]), statut.repere[1])),
    el('td', {},
      el('div', { class: 'produit-registre' },
        vignette(p.produit),
        el('div', {},
          el('p', { class: 'produit-registre__nom' }, p.produit.nom),
          el('p', { class: 'produit-registre__format' }, `Vendu ${venduA(p.unite)}`),
          p.produit.categorie && el('span', { class: 'produit-registre__categorie' }, p.produit.categorie)))),
    el('td', {},
      el('p', { class: 'marche-registre__nom' }, p.marche.nom),
      el('p', { class: 'marche-registre__lieu' }, (p.marche.ville ?? '').split(/\s+-\s+/).pop())),
    el('td', {},
      el('p', { class: 'prix-registre__montant' }, formaterNombre(p.montant), el('span', {}, ' FCFA')),
      comparaison),
    el('td', {},
      el('p', { class: 'verif-registre__ligne' }, ic('groups'),
        confirmations === 0 ? 'Aucune confirmation' : `${confirmations} confirmation${confirmations > 1 ? 's' : ''}`),
      confirmations > 0 && el('p', { class: 'verif-registre__detail' }, `${identiques} prix identique${identiques > 1 ? 's' : ''}, ${confirmations - identiques} écart${confirmations - identiques > 1 ? 's' : ''}`),
      el('p', { class: 'verif-registre__detail' }, ic('schedule'), ` Constaté le ${formaterDate(p.date_constat)}`)),
    el('td', {},
      el('p', { class: `statut-registre statut-registre--${statut.classe}` },
        el('span', { class: 'statut-registre__point', 'aria-hidden': 'true' }),
        p.statut === 'en_attente' && confirmations > 0 ? `${statut.etiquette} (${confirmations})` : statut.etiquette),
      el('p', { class: 'statut-registre__texte' }, texteStatut)),
    el('td', {},
      p.statut === 'en_attente'
        ? el('button', { type: 'button', class: 'action-registre action-registre--confirmer', onclick: () => ouvrirConfirmation(p) },
          ic('check_circle'), 'Confirmer ce prix')
        : p.statut === 'validee'
          ? el('a', { class: 'action-registre', href: `/produit.html?id=${p.produit.id}` }, ic('fact_check'), 'Voir le produit')
          : el('p', { class: 'action-registre__note' }, ic('info'), ' Non publiée')));
}

function vignette(produit) {
  const initiale = () => el('span', { class: 'produit-registre__image vignette--initiale', 'aria-hidden': 'true' }, produit.nom.charAt(0));
  if (!produit.image) return initiale();
  const image = el('img', { class: 'produit-registre__image', src: produit.image, alt: '', width: 48, height: 48, loading: 'lazy' });
  image.addEventListener('error', () => image.replaceWith(initiale()), { once: true });
  return image;
}

function ligneMessage(texte) {
  return el('tr', {}, el('td', { colspan: 7, class: 'registre__message' }, texte));
}

// Pagination : première, précédente, pages proches, dernière
function afficherPagination(page, pages) {
  const zone = $('#pagination');
  if (pages <= 1) {
    zone.replaceChildren();
    return;
  }
  const aller = (n) => () => {
    etat.page = n;
    charger();
    $('#registre').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const numeros = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const boutons = [];
  numeros.forEach((n, i) => {
    if (i > 0 && n - numeros[i - 1] > 1) boutons.push(el('span', { class: 'pagination__trou', 'aria-hidden': 'true' }, '…'));
    boutons.push(el('button', {
      type: 'button',
      class: 'pagination__page',
      'aria-current': n === page ? 'page' : null,
      'aria-label': `Page ${n}`,
      onclick: aller(n),
    }, String(n)));
  });
  zone.replaceChildren(
    el('button', { type: 'button', class: 'pagination__fleche', disabled: page === 1, 'aria-label': 'Page précédente', onclick: aller(page - 1) }, ic('chevron_left')),
    ...boutons,
    el('button', { type: 'button', class: 'pagination__fleche', disabled: page === pages, 'aria-label': 'Page suivante', onclick: aller(page + 1) }, ic('chevron_right')));
}

// ---------------------------------------------------------------
// Confirmer un prix
// ---------------------------------------------------------------

function ouvrirConfirmation(p) {
  etat.enCours = p;
  $('#confirmer-produit').textContent = `${p.produit.nom} – ${p.marche.nom}`;
  $('#confirmer-prix').replaceChildren(formaterMontant(p.montant), el('span', {}, ` (vendu ${venduA(p.unite)})`));
  $('#confirmer-erreur').hidden = true;
  $('#formulaire-confirmer').reset();
  const fenetre = $('#fenetre-confirmer');
  fenetre.showModal();
  $('#confirmer-role').focus();
}

async function envoyerConfirmation(evenement) {
  evenement.preventDefault();
  const formulaire = evenement.currentTarget;
  const bouton = formulaire.querySelector('[type="submit"]');
  bouton.disabled = true;
  try {
    const { confirmation } = await api.confirmer(etat.enCours.id, {
      role: formulaire.elements.role.value,
      conforme: formulaire.elements.conforme.value === 'oui',
      commentaire: formulaire.elements.commentaire.value.trim() || undefined,
    });
    $('#fenetre-confirmer').close();
    afficherToast(confirmation);
    await charger();
  } catch (erreur) {
    $('#confirmer-erreur').textContent = erreur.message;
    $('#confirmer-erreur').hidden = false;
  } finally {
    bouton.disabled = false;
  }
}

let minuterieToast;
function afficherToast(texte) {
  const toast = $('#toast');
  $('#toast-texte').textContent = texte;
  toast.hidden = false;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => { toast.hidden = true; }, 5000);
}
