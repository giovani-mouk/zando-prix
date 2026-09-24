// =============================================================
// public/js/a-propos.js : liste des marchés suivis, lue depuis l'API
// Écrire la liste en dur dans le HTML la rendrait fausse dès qu'un
// marché serait ajouté en base.
// =============================================================
import { api } from './api.js';
import { el } from './dom.js';

try {
  const marches = await api.marches();
  if (marches.length > 0) {
    document.querySelector('#liste-marches').replaceChildren(
      ...marches.map((m) => el('li', {}, el('strong', {}, m.nom), el('span', {}, m.ville))),
    );
    document.querySelector('#bloc-marches').hidden = false;
  }
} catch {
  // API injoignable : la section reste simplement masquée, le reste de la page suffit
}
