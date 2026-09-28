// =============================================================
// public/js/produit.js : fiche d'un produit (maquette du PM)
//
// Adresse : /produit.html?id=3 (sans identifiant : le premier produit)
// Données : GET /api/produits, GET /api/prix?produit_id=3 (une ligne par
// marché, y compris sans prix : RM04) et GET /api/produits/3/historique
// (derniers relevés et stabilité sur 30 jours).
// Tous les chiffres sont calculés à partir de ces réponses.
// =============================================================
import { api } from './api.js';
import { el } from './dom.js';
import { formaterDate, formaterMontant, formaterNombre, ilYA, libelleUnite, venduA } from './format.js';
import { statistiques } from './statistiques.js';
import { marches as listeMarches, quartier } from './coquille.js';

const $ = (selecteur) => document.querySelector(selecteur);
const ic = (nom, classe = '') => el('span', { class: `ms ${classe}`.trim(), 'aria-hidden': 'true' }, nom);

const NIVEAUX = {
  tres_stable: { libelle: 'Très stable', icone: 'check_circle', classe: 'vert' },
  stable: { libelle: 'Stable', icone: 'check_circle', classe: 'vert' },
  variable: { libelle: 'Variable', icone: 'trending_up', classe: 'orange' },
  instable: { libelle: 'Instable', icone: 'warning', classe: 'orange' },
};
const CLE_FAVORIS = 'zando-prix:favoris';

let contexte; // { produit, lignes, stats, historique, marches }

demarrer();

async function demarrer() {
  const demande = new URLSearchParams(window.location.search).get('id');
  try {
    const [produits, marches] = await Promise.all([api.produits(), listeMarches()]);
    const produit = demande === null ? produits[0] : produits.find((p) => p.id === Number(demande));
    if (!produit) {
      introuvable();
      return;
    }
    const [lignes, historique] = await Promise.all([
      api.prix({ produitId: produit.id }),
      // L'historique est un complément : sans lui, la fiche reste utile
      api.historique(produit.id).catch(() => ({ releves: [], stabilite: { disponible: false } })),
    ]);
    contexte = { produit, lignes, stats: statistiques(lignes), historique, marches };
    afficherOrdinateur();
    afficherTelephone();
    $('#chargement-produit').hidden = true;
    $('#fiche').hidden = false;
    $('#mobile-fiche').hidden = false;
    document.title = `${produit.nom} : prix dans les marchés de Brazzaville – Zando Prix`;
  } catch (erreur) {
    if (erreur.statut === 404) introuvable();
    else $('#chargement-produit').textContent = erreur.message;
  } finally {
    $('#contenu-produit').setAttribute('aria-busy', 'false');
  }
}

function introuvable() {
  $('#chargement-produit').hidden = true;
  $('#introuvable').hidden = false;
  document.title = 'Produit introuvable : Zando Prix';
}

// ---------------------------------------------------------------
// Outils
// ---------------------------------------------------------------

const nomCourt = (nom) => nom.replace(/^Marché\s+(de\s+|d'|du\s+)?/i, '');
const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const lienProposer = (marcheId) => `/?proposer=1&produit=${contexte.produit.id}${marcheId ? `&marche=${marcheId}` : ''}`;
const villeDe = (marcheId) => contexte.marches.find((m) => m.id === marcheId)?.ville ?? '';
const quartierDe = (marcheId) => {
  const m = contexte.marches.find((x) => x.id === marcheId);
  return m ? quartier(m) : '';
};
// « 1 kg au détail », « 1 tas », « 1 litre »
const uniteDetail = (unite) => (unite === 'kg' ? '1 kg au détail' : `1 ${libelleUnite(unite)}`);

// Du moins cher au plus cher ; autres unités, puis marchés sans prix
function trier(lignes) {
  const rang = (l) => (!l.disponible ? 2 : l.comparable ? 0 : 1);
  return [...lignes].sort((a, b) => rang(a) - rang(b) || (a.montant ?? 0) - (b.montant ?? 0));
}

function situation(ligne) {
  const { stats } = contexte;
  if (!ligne.disponible) return 'absent';
  if (!ligne.comparable) return 'autre-unite';
  if (!stats || stats.comparables.length < 2) return 'seul';
  if (ligne.montant === stats.min) return 'meilleur';
  if (ligne.montant === stats.max) return 'eleve';
  return 'standard';
}

// Largeur des barres : la moyenne au milieu (50 %), les écarts amplifiés
// pour rester lisibles (comme sur la maquette : −6 % -> 25 %, +6 % -> 75 %).
// Si les écarts sont grands, l'amplification diminue : la barre la plus
// courte garde 25 % (son texte reste lisible), la plus longue 95 %.
function largeur(montant) {
  const { moyenne, min, max } = contexte.stats;
  const ecartBas = (moyenne - min) / moyenne;
  const ecartHaut = (max - moyenne) / moyenne;
  const facteur = Math.min(400, ecartBas > 0 ? 25 / ecartBas : 400, ecartHaut > 0 ? 45 / ecartHaut : 400);
  return Math.round(50 + ((montant - moyenne) / moyenne) * facteur);
}

function image(classe) {
  const { produit } = contexte;
  if (!produit.image) return el('span', { class: `${classe} vignette--initiale`, 'aria-hidden': 'true' }, produit.nom.charAt(0));
  const img = el('img', { class: classe, src: produit.image, alt: '' });
  img.addEventListener('error', () => img.replaceWith(el('span', { class: `${classe} vignette--initiale`, 'aria-hidden': 'true' }, produit.nom.charAt(0))), { once: true });
  return img;
}

// ---------------------------------------------------------------
// Ordinateur
// ---------------------------------------------------------------

function afficherOrdinateur() {
  const { produit, lignes, stats } = contexte;
  const disponibles = lignes.filter((l) => l.disponible);
  const unite = libelleUnite(produit.unite_reference);

  // Fil d'Ariane
  $('#ariane-categorie').textContent = produit.categorie ?? 'Produits';
  $('#ariane-categorie').href = produit.categorie ? `/?categorie=${encodeURIComponent(produit.categorie)}` : '/';
  $('#ariane-produit').textContent = `${produit.nom} (${uniteDetail(produit.unite_reference).replace(' au détail', '')})`;

  // Visuel
  $('#visuel').prepend(image('visuel-produit__photo'));
  $('#visuel-categorie').textContent = produit.categorie ?? 'Produit de base';
  $('#visuel-unite').textContent = `Vendu ${venduA(produit.unite_reference)}`;
  $('#visuel-reference').textContent = `Unité étalon : ${uniteDetail(produit.unite_reference)}`;
  $('#visuel-suivi').textContent = disponibles.length ? `Suivi dans ${disponibles.length} marché${disponibles.length > 1 ? 's' : ''}` : 'Pas encore de prix';

  // Équivalences : seules les données réelles (pesées de l'équipe à venir)
  $('#equivalences-texte').replaceChildren('Unité de référence citoyenne : ', el('strong', {}, uniteDetail(produit.unite_reference)),
    ". Les équivalences en tas et en sacs seront publiées après les pesées de l'équipe dans les marchés.");
  $('#equivalences-tuiles').replaceChildren(...(stats ? [
    tuile('Au meilleur prix', formaterMontant(stats.min), stats.moinsChers[0].marche, 'vert'),
    tuile('Au prix le plus haut', formaterMontant(stats.max), stats.plusChers[0].marche, stats.ecart > 0 ? 'orange' : 'vert'),
  ] : []));

  // Étiquettes, titre, description
  $('#etiquette-suivi').hidden = disponibles.length === 0;
  $('#code-produit').textContent = `Réf. produit : #PRD-${String(produit.id).padStart(4, '0')}`;
  $('#nom-produit').textContent = produit.nom;
  const noms = disponibles.map((l) => nomCourt(l.marche));
  $('#description-produit').textContent = disponibles.length
    ? `Prix ${venduA(produit.unite_reference)} relevés dans les marchés de Brazzaville (${noms.join(', ')}). Chaque prix est daté et vérifié par l'équipe avant publication.`
    : "Aucun prix n'a encore été relevé pour ce produit. Soyez le premier à en proposer un.";
  $('#appel-phrase').textContent = `Aidez les ménages brazzavillois en signalant le prix ${produit.nom.match(/^[aeiouyhéèêâ]/i) ? "de l'" : 'du '}${produit.nom.toLowerCase()} dans votre marché.`;
  $('#fiche-proposer').href = lienProposer();

  $('#metriques').replaceChildren(...metriques(unite));

  // Cartes par marché
  $('#note-comparatif').replaceChildren('Base étalon : ', el('strong', {}, uniteDetail(produit.unite_reference).replace(' au détail', '')),
    ' • Trié du plus avantageux au moins renseigné');
  $('#cartes-marches').replaceChildren(...trier(lignes).map(carteMarche));

  afficherJauge();
  afficherHistorique();
}

function tuile(libelle, valeur, marche, couleur) {
  return el('div', { class: 'tuile-equivalence' },
    el('span', { class: 'tuile-equivalence__libelle' }, libelle),
    el('span', { class: 'tuile-equivalence__valeur' }, valeur),
    el('span', { class: `tuile-equivalence__detail texte-${couleur}` }, marche));
}

function metriques(unite) {
  const { stats, historique } = contexte;
  const bloc = (libelle, icone, classeIcone, contenu, detail) => el('div', { class: 'metrique' },
    el('div', { class: 'metrique__haut' }, el('span', {}, libelle), ic(icone, classeIcone)),
    el('div', { class: 'metrique__corps' }, contenu, el('span', { class: 'metrique__detail' }, detail)));

  const prix = (valeur, classe = '') => el('p', { class: `metrique__prix ${classe}` }, formaterNombre(valeur), el('span', {}, ' FCFA'));

  const moyenne = stats
    ? bloc('Prix moyen Brazzaville', 'analytics', 'texte-vert', prix(stats.moyenne), `Unité : ${uniteDetail(contexte.produit.unite_reference)}`)
    : bloc('Prix moyen Brazzaville', 'analytics', 'texte-vert', el('p', { class: 'metrique__vide' }, 'Pas encore de prix'), `Unité : ${unite}`);

  const ecart = stats && stats.comparables.length > 1
    ? bloc('Écart de marché', 'swap_driving_apps_wheel', 'texte-orange-vif', prix(stats.ecart, 'texte-orange'),
      `Écart max ${nomCourt(stats.moinsChers[0].marche)} / ${nomCourt(stats.plusChers[0].marche)}`)
    : bloc('Écart de marché', 'swap_driving_apps_wheel', 'texte-orange-vif', el('p', { class: 'metrique__vide' }, '—'), 'Il faut au moins deux marchés');

  const s = historique.stabilite;
  const niveau = s.disponible ? NIVEAUX[s.niveau] : null;
  const stabilite = bloc(`Stabilité (${s.jours ?? 30} j)`, niveau?.classe === 'orange' ? 'trending_up' : 'trending_flat', 'texte-vert-profond',
    niveau
      ? el('p', { class: `metrique__niveau texte-${niveau.classe === 'vert' ? 'vert-profond' : 'orange'}` }, ic(niveau.icone), niveau.libelle)
      : el('p', { class: 'metrique__vide' }, 'À venir'),
    niveau ? `Fluctuation de ${formaterNombre(s.fluctuation)} % sur le mois` : "Pas encore 30 jours d'historique");

  return [moyenne, ecart, stabilite];
}

function carteMarche(ligne) {
  const s = situation(ligne);
  const { stats } = contexte;
  const titre = el('div', {},
    el('p', { class: 'carte-marche-fiche__nom' }, el('span', {}, nomCourt(ligne.marche)),
      el('span', { class: 'carte-marche-fiche__complet' }, `— ${ligne.marche}`)),
    el('p', { class: 'carte-marche-fiche__lieu' }, ic('location_on'), villeDe(ligne.marche_id)));

  if (!ligne.disponible) {
    return el('article', { class: 'carte-marche-fiche' },
      el('div', { class: 'carte-marche-fiche__haut' }, titre,
        el('span', { class: 'badge-fiche badge-fiche--gris' }, ic('hourglass_empty'), 'Prix non disponible')),
      el('div', { class: 'carte-marche-fiche__vide' },
        el('span', { class: 'carte-marche-fiche__rond' }, ic('visibility_off')),
        el('p', { class: 'carte-marche-fiche__vide-titre' }, 'Aucune donnée récente'),
        el('p', {}, `Aucun prix relevé pour ce marché. Soyez le premier à renseigner le prix ${contexte.produit.nom.match(/^[aeiouyhé]/i) ? "de l'" : 'du '}${contexte.produit.nom.toLowerCase()} à ${nomCourt(ligne.marche)} !`)),
      el('div', { class: 'carte-marche-fiche__pied' },
        el('span', {}, '0 relevé'),
        el('a', { class: 'lien-ajouter', href: lienProposer(ligne.marche_id) }, ic('add_location_alt'), `Ajouter le prix de ${nomCourt(ligne.marche)}`)));
  }

  const recent = ligne.fraicheur === 'recent';
  const badge = s === 'meilleur'
    ? el('span', { class: 'badge-fiche badge-fiche--vert' }, ic('emoji_events'), 'Meilleur prix')
    : !recent
      ? el('span', { class: 'badge-fiche badge-fiche--orange' }, ic('history'), 'Information ancienne')
      : el('span', { class: 'badge-fiche' }, ic('schedule', 'texte-vert'), s === 'autre-unite' ? 'Autre unité' : 'Prix récent');

  const couleurPrix = s === 'meilleur' ? 'vert' : !recent || s === 'eleve' ? 'orange' : '';
  const dateTexte = `Relevé ${ilYA(ligne.date_releve)} (${formaterDate(ligne.date_releve)})`;

  let bas;
  if (!recent) {
    bas = el('p', { class: 'carte-marche-fiche__alerte' }, ic('warning'),
      el('span', {}, el('strong', {}, 'Attention : '), "ce prix n'a pas été actualisé depuis plus de 7 jours. Il peut avoir évolué sous l'effet des arrivages."));
  } else if (s === 'meilleur') {
    bas = el('div', { class: 'carte-marche-fiche__ligne' },
      stats.ecart > 0
        ? el('span', { class: 'texte-vert-profond fort' }, ic('savings'), `Économie de ${formaterMontant(stats.ecart)} par rapport au prix le plus haut`)
        : el('span', {}, 'Même prix partout'),
      el('span', { class: 'petit' }, 'Indice le plus bas'));
  } else if (s === 'autre-unite') {
    bas = el('div', { class: 'carte-marche-fiche__ligne' }, el('span', {}, `Vendu ${venduA(ligne.unite)} : non comparé aux autres marchés`));
  } else {
    bas = el('div', { class: 'carte-marche-fiche__ligne' },
      el('span', {}, ligne.montant === stats?.moyenne ? 'Aligné sur la moyenne de Brazzaville' : `${ligne.montant > (stats?.moyenne ?? 0) ? '+' : '−'}${formaterMontant(Math.abs(ligne.montant - (stats?.moyenne ?? ligne.montant)))} par rapport à la moyenne`),
      el('span', { class: 'petit' }, s === 'eleve' ? 'Prix le plus haut' : 'Prix standard'));
  }

  const barre = ligne.comparable && stats && stats.comparables.length > 1
    ? el('div', { class: 'carte-marche-fiche__piste', 'aria-hidden': 'true' },
      el('span', { class: `carte-marche-fiche__barre carte-marche-fiche__barre--${s === 'meilleur' ? 'vert' : s === 'eleve' || !recent ? 'orange' : 'clair'}`, style: `width: ${largeur(ligne.montant)}%` }))
    : null;

  const pied = recent
    ? el('div', { class: 'carte-marche-fiche__pied' },
      el('span', {}, ic('how_to_reg', 'texte-vert'), ligne.source === 'proposition' ? 'Proposé par un habitant, vérifié par l\'équipe' : 'Relevé officiel, vérifié par l\'équipe'),
      el('a', { class: 'lien-signaler', href: lienProposer(ligne.marche_id) }, 'Signaler un changement', ic('edit')))
    : el('div', { class: 'carte-marche-fiche__pied' },
      el('span', {}, 'Besoin de fiabilisation urgente'),
      el('a', { class: 'lien-mettre-a-jour', href: lienProposer(ligne.marche_id) }, ic('sync'), 'Mettre à jour ce prix'));

  return el('article', { class: 'carte-marche-fiche' },
    el('div', { class: 'carte-marche-fiche__haut' }, titre, badge),
    el('div', { class: `carte-marche-fiche__bloc${recent ? '' : ' carte-marche-fiche__bloc--ancien'}` },
      el('div', { class: 'carte-marche-fiche__prix-ligne' },
        el('p', { class: `carte-marche-fiche__prix ${couleurPrix ? `texte-${couleurPrix}` : ''}` }, formaterNombre(ligne.montant),
          el('span', {}, ` FCFA / ${libelleUnite(ligne.unite)}`)),
        el('span', { class: `pastille-releve${recent ? '' : ' pastille-releve--ancien'}` }, el('span', { class: 'pastille-releve__point' }), dateTexte)),
      barre, bas),
    pied);
}

function afficherJauge() {
  const { produit, lignes, stats } = contexte;
  const bloc = $('#bloc-jauge');
  bloc.hidden = !stats || stats.comparables.length < 2;
  if (bloc.hidden) return;

  $('#titre-jauge').textContent = `Jauge comparative des écarts de prix ${venduA(produit.unite_reference)}`;
  $('#legende-moyenne').textContent = `Moyenne (${formaterNombre(stats.moyenne)} F)`;

  $('#jauge').replaceChildren(...trier(lignes).filter((l) => l.disponible && l.comparable).map((ligne) => {
    const s = situation(ligne);
    const ecart = ligne.montant - stats.moyenne;
    const etiquette = s === 'meilleur'
      ? el('span', { class: 'etiquette-jauge etiquette-jauge--vert' }, 'Optimal')
      : s === 'eleve'
        ? el('span', { class: 'etiquette-jauge etiquette-jauge--orange' }, `+${formaterNombre(ligne.montant - stats.min)} F écart`)
        : el('span', { class: 'etiquette-jauge' }, 'Conforme');
    const texteBarre = ecart === 0 ? 'Moyenne exacte' : `${ecart > 0 ? '+' : '−'}${formaterNombre(Math.abs(ecart))} F vs moyenne`;
    return el('div', { class: 'ligne-jauge' },
      el('div', { class: 'ligne-jauge__haut' },
        el('p', { class: 'ligne-jauge__marche' }, el('span', {}, `${nomCourt(ligne.marche)} — ${ligne.marche}`), etiquette),
        el('p', { class: `ligne-jauge__prix texte-${s === 'meilleur' ? 'vert' : s === 'eleve' ? 'orange' : 'encre'}` }, formaterMontant(ligne.montant))),
      el('div', { class: 'ligne-jauge__piste' },
        el('span', { class: 'ligne-jauge__moyenne', 'aria-hidden': 'true' }),
        el('span', { class: `ligne-jauge__barre ligne-jauge__barre--${s === 'meilleur' ? 'vert' : s === 'eleve' ? 'orange' : 'clair'}`, style: `width: ${largeur(ligne.montant)}%` }, texteBarre)));
  }));

  // Exemple chiffré : 15 unités par mois (hypothèse d'illustration, affichée comme telle)
  const quantite = produit.unite_reference === 'kg' ? '15 kg' : `15 ${libelleUnite(produit.unite_reference)}${libelleUnite(produit.unite_reference).endsWith('s') ? '' : 's'}`;
  const gain = stats.ecart * 15;
  $('#jauge-exemple').replaceChildren('Par exemple, pour une famille qui achète ', el('strong', {}, `${quantite} par mois`),
    `, s'approvisionner à ${stats.moinsChers[0].marche} représente une économie directe de `, el('strong', {}, formaterMontant(gain)),
    ` par rapport à ${stats.plusChers[0].marche}.`);
  const impact = stats.pourcentage < 5 ? 'Faible' : stats.pourcentage < 15 ? 'Moyen' : 'Élevé';
  $('#jauge-impact').textContent = `Indice d'impact ménage : ${impact}`;
}

function afficherHistorique() {
  const { releves } = contexte.historique;
  const bloc = $('#bloc-historique');
  const liste = releves.slice(0, 5);
  bloc.hidden = liste.length === 0;
  if (bloc.hidden) return;
  $('#titre-historique').textContent = liste.length > 1 ? `Historique récent des ${liste.length} derniers relevés vérifiés` : 'Dernier relevé vérifié';
  $('#historique').replaceChildren(...liste.map((r) => {
    const ancien = joursDepuis(r.date_releve) >= 7;
    return el('li', { class: 'ligne-historique' },
      el('div', { class: 'ligne-historique__gauche' },
        el('span', { class: `ligne-historique__icone${ancien ? ' ligne-historique__icone--ancien' : ''}` },
          ic(ancien ? 'schedule' : r.source === 'proposition' ? 'person_check' : 'storefront')),
        el('div', {},
          el('p', { class: 'ligne-historique__marche' }, el('span', {}, r.marche),
            el('span', { class: `ligne-historique__badge${ancien ? ' ligne-historique__badge--ancien' : r.source === 'proposition' ? '' : ' ligne-historique__badge--vert'}` },
              ancien ? 'À actualiser' : r.source === 'proposition' ? 'Proposition vérifiée' : 'Observation directe')),
          el('p', { class: 'ligne-historique__texte' },
            r.source === 'proposition' ? 'Proposé par un habitant, vérifié par l\'équipe' : 'Relevé par l\'équipe Zando Prix',
            r.comparable ? '' : ` • vendu ${venduA(r.unite)}`))),
      el('div', { class: 'ligne-historique__droite' },
        el('div', { class: 'ligne-historique__prix-bloc' },
          el('p', { class: `ligne-historique__prix${ancien ? ' texte-orange' : ''}` }, formaterMontant(r.montant)),
          el('p', { class: 'ligne-historique__date' }, formaterDate(r.date_releve))),
        el('span', { class: `ligne-historique__etat${ancien ? ' ligne-historique__etat--ancien' : ''}`, title: ancien ? 'Cotation ancienne' : 'Validation conforme' },
          ic(ancien ? 'priority_high' : 'done_all'))));
  }));
}

function joursDepuis(iso) {
  return Math.round((Date.now() - new Date(`${iso}T12:00:00`)) / 86_400_000);
}

// ---------------------------------------------------------------
// Téléphone
// ---------------------------------------------------------------

function afficherTelephone() {
  const { produit, lignes, stats, historique } = contexte;
  const unite = libelleUnite(produit.unite_reference);

  $('#m-image').prepend(image('visuel-mobile__photo'));
  $('#m-categorie').textContent = `${produit.categorie ?? 'Produit de base'} • Vendu ${venduA(produit.unite_reference)}`;
  $('#m-nom').textContent = produit.nom;

  // Synthèse : prix moyen, meilleur prix, écart
  const colonne = (libelle, valeur, sous, classe = '') => el('div', { class: `synthese-mobile__colonne ${classe}` },
    el('p', { class: 'synthese-mobile__libelle' }, libelle),
    el('p', { class: 'synthese-mobile__valeur' }, valeur, el('span', {}, valeur === '—' ? '' : ' F')),
    el('p', { class: 'synthese-mobile__sous' }, sous));
  $('#m-synthese').replaceChildren(
    colonne('Prix moyen', stats ? formaterNombre(stats.moyenne) : '—', 'Brazzaville'),
    el('div', { class: 'synthese-mobile__colonne synthese-mobile__colonne--top' },
      el('p', { class: 'synthese-mobile__libelle' }, ic('military_tech'), 'Top prix'),
      el('p', { class: 'synthese-mobile__valeur' }, stats ? formaterNombre(stats.min) : '—', el('span', {}, stats ? ' F' : '')),
      el('p', { class: 'synthese-mobile__sous' }, stats ? nomCourt(stats.moinsChers[0].marche) : '')),
    colonne('Écart max', stats && stats.comparables.length > 1 ? formaterNombre(stats.ecart) : '—', 'entre marchés', 'synthese-mobile__colonne--droite'));

  // Équivalences : la mesure de référence (réelle) ; les autres après les pesées
  $('#m-equivalences').replaceChildren(
    el('div', { class: 'equivalence-m' },
      el('div', { class: 'equivalence-m__gauche' },
        el('span', { class: 'equivalence-m__rond' }, `1${produit.unite_reference === 'kg' ? 'k' : ''}`),
        el('div', {}, el('p', { class: 'equivalence-m__nom' }, uniteDetail(produit.unite_reference)), el('p', { class: 'equivalence-m__sous' }, 'Unité de référence'))),
      el('div', { class: 'equivalence-m__droite' },
        el('p', { class: 'equivalence-m__prix' }, stats ? (stats.min === stats.max ? `${formaterNombre(stats.min)} F` : `${formaterNombre(stats.min)} - ${formaterNombre(stats.max)} F`) : '—'),
        el('p', { class: 'equivalence-m__sous' }, "Prix d'accès"))),
    el('p', { class: 'equivalence-m__note' }, ic('scale'), "Tas, sacs et autres mesures : équivalences publiées après les pesées de l'équipe."));

  // Relevés par marché
  $('#m-nombre-marches').textContent = `${lignes.length} marché${lignes.length > 1 ? 's' : ''}`;
  $('#m-marches').replaceChildren(...trier(lignes).map(carteMarcheMobile));

  // Historique
  const releves = historique.releves.slice(0, 3);
  $('#m-historique-bloc').hidden = releves.length === 0;
  $('#m-historique-nombre').textContent = `${releves.length} dernier${releves.length > 1 ? 's' : ''}`;
  $('#m-historique').replaceChildren(...releves.map((r) => {
    const ancien = joursDepuis(r.date_releve) >= 7;
    return el('li', { class: 'historique-m' },
      el('div', { class: 'historique-m__gauche' },
        el('span', { class: `historique-m__avatar${ancien ? ' historique-m__avatar--ancien' : ''}` }, nomCourt(r.marche).charAt(0)),
        el('div', {},
          el('p', { class: 'historique-m__nom' }, nomCourt(r.marche), ic(ancien ? 'shield' : 'verified', ancien ? 'texte-gris' : 'texte-vert-profond')),
          el('p', { class: 'historique-m__quand' }, `${quartierDe(r.marche_id) || nomCourt(r.marche)} • ${majuscule(ilYA(r.date_releve))}`))),
      el('div', { class: 'historique-m__droite' },
        el('p', { class: `historique-m__prix${ancien ? ' texte-orange' : ' texte-vert-profond'}` }, formaterMontant(r.montant)),
        el('p', { class: 'historique-m__source' }, r.source === 'proposition' ? 'Proposition vérifiée' : 'Relevé officiel')));
  }));

  $('#m-proposer').href = lienProposer();
  preparerPartageEtFavori(unite);
}

function carteMarcheMobile(ligne) {
  const s = situation(ligne);
  if (!ligne.disponible) {
    return el('article', { class: 'marche-m marche-m--absent' },
      el('div', {}, el('h3', { class: 'marche-m__nom' }, nomCourt(ligne.marche)), el('p', { class: 'marche-m__sous' }, 'Aucune donnée certifiée pour le moment')),
      el('div', { class: 'marche-m__droite' },
        el('p', { class: 'marche-m__non' }, 'Non disponible'),
        el('a', { class: 'marche-m__premier', href: lienProposer(ligne.marche_id) }, 'Soyez le premier')));
  }
  const recent = ligne.fraicheur === 'recent';
  const badge = s === 'meilleur'
    ? el('span', { class: 'marche-m__badge marche-m__badge--vert' }, '🟢 Meilleur prix')
    : !recent ? el('span', { class: 'marche-m__badge marche-m__badge--orange' }, '🟠 Relevé ancien') : null;
  return el('article', { class: 'marche-m' },
    el('div', { class: 'marche-m__haut' },
      el('div', {},
        el('div', { class: 'marche-m__titre' }, el('h3', { class: 'marche-m__nom' }, nomCourt(ligne.marche)), badge),
        el('p', { class: 'marche-m__sous' }, villeDe(ligne.marche_id))),
      el('div', { class: 'marche-m__prix-bloc' },
        el('p', { class: `marche-m__prix${s === 'meilleur' ? ' texte-vert-profond' : !recent || s === 'eleve' ? ' texte-orange' : ''}` }, `${formaterNombre(ligne.montant)} F`),
        el('p', { class: 'marche-m__sous' }, `/ ${libelleUnite(ligne.unite)}`))),
    el('div', { class: 'marche-m__bas' },
      recent
        ? el('span', { class: 'marche-m__quand' }, ic('schedule', 'texte-vert-profond'), `Mis à jour ${ilYA(ligne.date_releve)}`)
        : el('span', { class: 'marche-m__quand texte-orange' }, ic('warning'), `À actualiser (${ilYA(ligne.date_releve)})`),
      recent
        ? el('span', { class: `marche-m__source${s === 'meilleur' ? ' texte-vert-profond' : ''}` }, ligne.source === 'proposition' ? 'Proposé par un habitant' : 'Relevé officiel')
        : el('a', { class: 'marche-m__lien', href: lienProposer(ligne.marche_id) }, 'Mettre à jour ce prix')));
}

// Partage (WhatsApp, SMS…) et favori mémorisé dans ce navigateur
function preparerPartageEtFavori(unite) {
  const { produit, stats } = contexte;
  document.querySelector('[data-partager]').addEventListener('click', async () => {
    const texte = stats
      ? `${produit.nom} à Brazzaville : dès ${formaterNombre(stats.min)} FCFA / ${unite} (${stats.moinsChers[0].marche}), selon Zando Prix.`
      : `${produit.nom} : les prix des marchés de Brazzaville sur Zando Prix.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Zando Prix', text: texte, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(`${texte} ${window.location.href}`);
      toast('Lien copié ! Prêt à partager.');
    } catch (erreur) {
      if (erreur.name !== 'AbortError') toast("Le partage n'a pas pu être ouvert.");
    }
  });

  const bouton = document.querySelector('[data-favori]');
  const lire = () => { try { return JSON.parse(localStorage.getItem(CLE_FAVORIS) ?? '[]'); } catch { return []; } };
  const ecrire = (liste) => { try { localStorage.setItem(CLE_FAVORIS, JSON.stringify(liste)); } catch { /* stockage indisponible */ } };
  const maj = () => {
    const favori = lire().includes(produit.id);
    bouton.setAttribute('aria-pressed', String(favori));
    bouton.querySelector('.ms').textContent = favori ? 'favorite' : 'favorite_border';
    bouton.querySelector('.sr-only').textContent = favori ? 'Retirer des favoris' : 'Ajouter aux favoris';
  };
  bouton.addEventListener('click', () => {
    const liste = lire();
    const favori = liste.includes(produit.id);
    ecrire(favori ? liste.filter((id) => id !== produit.id) : [...liste, produit.id]);
    maj();
    toast(favori ? 'Retiré de vos favoris.' : 'Ajouté à vos favoris : il apparaît en premier dans vos produits indispensables.');
  });
  maj();
}

let minuterieToast;
function toast(message) {
  $('#toast-message').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}
