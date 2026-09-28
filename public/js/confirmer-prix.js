// =============================================================
// public/js/confirmer-prix.js : bouton « Confirmer » d'un prix affiché
// (feature 22, maquette : accueil mobile et fiche produit)
//
// Une petite fenêtre demande « Ce prix est-il toujours le même ? ».
// La réponse est un signal pour l'équipe : le prix n'est jamais modifié
// automatiquement. Si le prix a changé, on propose d'envoyer le nouveau.
// =============================================================
import { api } from './api.js';
import { el } from './dom.js';
import { formaterDate, formaterMontant, libelleUnite } from './format.js';

const ic = (nom) => el('span', { class: 'ms', 'aria-hidden': 'true' }, nom);

let dialogue;

// ligne : une ligne de /api/prix ; options.proposer(produitId, marcheId) :
// ouvre le formulaire de proposition (sinon, lien vers l'accueil)
export function ouvrirConfirmation(ligne, { proposer, apres } = {}) {
  dialogue?.remove();
  const message = el('p', { class: 'confirmer-prix__message', role: 'status', 'aria-live': 'polite' });
  const choix = el('div', { class: 'confirmer-prix__choix' },
    el('button', { type: 'button', class: 'confirmer-prix__oui', onclick: () => repondre(true) }, ic('thumb_up'), 'Oui, toujours le même'),
    el('button', { type: 'button', class: 'confirmer-prix__non', onclick: () => repondre(false) }, ic('thumb_down'), 'Non, il a changé'));

  dialogue = el('dialog', { class: 'confirmer-prix', 'aria-labelledby': 'confirmer-prix-titre' },
    el('button', { type: 'button', class: 'confirmer-prix__fermer', 'aria-label': 'Fermer', onclick: () => dialogue.close() }, ic('close')),
    el('p', { class: 'confirmer-prix__surtitre' }, ic('verified_user'), 'Vérification citoyenne'),
    el('h2', { class: 'confirmer-prix__titre', id: 'confirmer-prix-titre' }, 'Ce prix est-il toujours le même ?'),
    el('div', { class: 'confirmer-prix__prix' },
      el('p', {}, el('strong', {}, ligne.produit), ` • ${ligne.marche}`),
      el('p', { class: 'confirmer-prix__montant' }, `${formaterMontant(ligne.montant)} / ${libelleUnite(ligne.unite)}`),
      el('p', { class: 'confirmer-prix__date' }, `Relevé le ${formaterDate(ligne.date_releve)}`)),
    choix,
    message,
    el('p', { class: 'confirmer-prix__note' }, "Votre réponse est anonyme. Elle aide l'équipe à savoir quels prix revérifier."));
  document.body.append(dialogue);
  dialogue.addEventListener('close', () => dialogue.remove());
  dialogue.showModal();

  async function repondre(conforme) {
    choix.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const resultat = await api.confirmerPrix(ligne.prix_id, conforme);
      choix.remove();
      message.replaceChildren(ic('check_circle'), resultat.message);
      message.classList.add('confirmer-prix__message--ok');
      if (!conforme) {
        const lien = proposer
          ? el('button', { type: 'button', class: 'confirmer-prix__proposer', onclick: () => { dialogue.close(); proposer(ligne.produit_id, ligne.marche_id); } }, ic('add_circle'), 'Proposer le nouveau prix')
          : el('a', { class: 'confirmer-prix__proposer', href: `/?proposer=1&produit=${ligne.produit_id}&marche=${ligne.marche_id}` }, ic('add_circle'), 'Proposer le nouveau prix');
        message.after(lien);
      }
      apres?.(resultat);
    } catch (erreur) {
      choix.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      message.replaceChildren(ic('info'), erreur.message);
      message.classList.remove('confirmer-prix__message--ok');
    }
  }
}
