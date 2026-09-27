// =============================================================
// public/js/confirmation.js : confirmation d'envoi d'une proposition
// (maquette « Proposition envoyée avec succès »)
// Adresse : /confirmation.html?id=12&cle=… ; données : GET /api/propositions/12/suivi?cle=…
// La clé est remise à l'envoi : seule la personne qui a proposé le prix
// peut suivre sa proposition (le registre complet est réservé à l'équipe).
// =============================================================
import { api } from './api.js';
import { el } from './dom.js';
import { formaterDate, formaterInstant, formaterMontant, formaterNombre, libelleUnite, venduA } from './format.js';

const $ = (selecteur) => document.querySelector(selecteur);

const STATUTS = {
  en_attente: ['En attente de validation', "Cette proposition est en cours d'examen. L'équipe la compare aux prix déjà relevés dans ce marché avant de la publier.", 'attente'],
  validee: ['Publiée', 'Cette proposition a été vérifiée : elle est maintenant le prix affiché pour ce produit dans ce marché.', 'publiee'],
  rejetee: ['Non retenue', "Après vérification, l'équipe n'a pas retenu cette proposition. Elle reste visible dans le registre.", 'rejetee'],
};

demarrer();

async function demarrer() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const cle = params.get('cle');
  try {
    if (!id || !cle) throw Object.assign(new Error(), { statut: 404 });
    afficher(await api.suiviProposition(id, cle));
  } catch (erreur) {
    $('#chargement').hidden = true;
    if (erreur.statut === 404) $('#introuvable').hidden = false;
    else {
      $('#chargement').hidden = false;
      $('#chargement').textContent = erreur.message;
    }
  }
}

function afficher(p) {
  const [statut, texte, classe] = STATUTS[p.statut];
  $('#statut-libelle').textContent = statut;
  $('#statut-texte').textContent = texte;
  $('#statut-audit').classList.add(`statut-audit--${classe}`);
  $('#reference').textContent = p.reference;

  $('#d-produit').textContent = p.produit.nom;
  $('#d-unite').textContent = `Vendu ${venduA(p.unite)}`;
  $('#d-marche').textContent = p.marche.nom;
  $('#d-ville').textContent = p.marche.ville ?? 'Brazzaville';
  $('#d-montant').textContent = formaterMontant(p.montant);
  $('#d-ecart').textContent = p.ecart === null ? 'Aucun prix affiché pour comparer'
    : p.ecart === 0 ? 'Identique au prix affiché'
      : `${p.ecart > 0 ? '+' : '−'}${formaterNombre(Math.abs(p.ecart))} FCFA ${p.ecart > 0 ? 'au-dessus' : 'sous'} le prix affiché`;
  $('#d-ecart').classList.add(p.ecart > 0 ? 'texte-orange' : 'texte-vert');
  $('#d-date').textContent = formaterDate(p.date_constat);
  $('#d-recue').textContent = `Reçue le ${formaterInstant(p.recue_le)}`;

  // Position de votre prix par rapport au prix affiché
  if (p.prix_affiche !== null) {
    const bas = Math.min(p.montant, p.prix_affiche) * 0.8;
    const haut = Math.max(p.montant, p.prix_affiche) * 1.2;
    const position = (v) => `${Math.round(((v - bas) / (haut - bas)) * 100)}%`;
    $('#pos-affiche').style.left = position(p.prix_affiche);
    $('#pos-vous').style.left = position(p.montant);
    $('#leg-affiche').textContent = `Prix affiché : ${formaterMontant(p.prix_affiche)} / ${libelleUnite(p.produit.unite_reference)}`;
    $('#leg-vous').textContent = `Votre relevé : ${formaterMontant(p.montant)}`;
    $('#position').hidden = false;
  }

  if (p.statut === 'validee') afficherEnLigne(p);
  $('#partager').addEventListener('click', () => partager(p));
  $('#chargement').hidden = true;
  $('#confirmation').hidden = false;
  document.title = `${p.reference} : proposition envoyée – Zando Prix`;
}

// Proposition publiée : écran « Bravo ! Votre cotation est officiellement en ligne »
async function afficherEnLigne(p) {
  $('#titre-confirmation').textContent = 'Bravo ! Votre cotation est officiellement en ligne 🎉';
  const delai = p.traitee_le ? Math.max(1, Math.round((new Date(p.traitee_le) - new Date(p.recue_le)) / 60_000)) : null;
  const duree = delai === null ? '' : delai < 60 ? ` en ${delai} min` : delai < 1440 ? ` en ${Math.round(delai / 60)} h` : ` en ${Math.round(delai / 1440)} j`;
  document.querySelector('.carte-confirmation__merci').textContent = `Vérifiée par l'équipe de modération${duree}. Votre contribution aide désormais toutes les familles qui consultent Zando Prix.`;
  document.querySelector('.carte-confirmation__verifie').lastChild.textContent = ' Statut : en ligne';
  $('#en-ligne').hidden = false;
  $('#en-ligne-montant').textContent = formaterMontant(p.montant);
  $('#en-ligne-unite').textContent = `${venduA(p.unite)}`;
  $('#lien-principal').href = `/comparateur.html?produit=${p.produit.id}`;
  $('#lien-principal-texte').textContent = 'Voir le produit dans le comparateur';

  // Meilleur prix ? Comparaison avec les prix affichés aujourd'hui
  try {
    const lignes = await api.prix({ produitId: p.produit.id });
    const la = lignes.find((l) => l.marche_id === p.marche.id);
    const comparables = lignes.filter((l) => l.disponible && l.comparable);
    if (la && la.montant === p.montant && la.est_meilleur_prix) $('#en-ligne-meilleur').hidden = false;
    if (comparables.length > 1 && p.unite === p.produit.unite_reference) {
      const moyenne = Math.round(comparables.reduce((t, l) => t + l.montant, 0) / comparables.length);
      const ecart = p.montant - moyenne;
      $('#en-ligne-ecart').textContent = ecart === 0 ? 'Égal à la moyenne' : `${ecart > 0 ? '+' : '−'}${formaterNombre(Math.abs(ecart))} FCFA vs moyenne`;
    }
  } catch { /* la confirmation reste lisible sans cette comparaison */ }
}

async function partager(p) {
  const texte = `J'ai relevé le prix ${p.produit.nom.match(/^[aeiouyhé]/i) ? "de l'" : 'du '}${p.produit.nom.toLowerCase()} à ${formaterMontant(p.montant)} (${p.marche.nom}) sur Zando Prix. Comparez les prix des marchés de Brazzaville :`;
  const url = `${window.location.origin}/`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Zando Prix', text: texte, url });
      return;
    }
    await navigator.clipboard.writeText(`${texte} ${url}`);
    $('#toast-message').textContent = 'Message copié ! Prêt à partager.';
    $('#toast').hidden = false;
    setTimeout(() => { $('#toast').hidden = true; }, 3500);
  } catch { /* partage annulé */ }
}

