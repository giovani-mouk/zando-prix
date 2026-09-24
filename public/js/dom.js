// =============================================================
// public/js/dom.js : construire la page en toute sécurité
// =============================================================
//
// Crée un élément sans jamais passer par innerHTML :
// les textes venant de l'API ne peuvent pas injecter de HTML.
//
// Pourquoi c'est important : le nom d'auteur d'une proposition est saisi
// par n'importe qui. Avec innerHTML, un auteur nommé
//   <img src=x onerror="…code malveillant…">
// exécuterait ce code dans la page de l'administrateur (faille « XSS »).
// Ici, tout texte est ajouté comme texte : il s'affiche tel quel, sans
// jamais être interprété comme du HTML.
//
// Exemple d'utilisation :
//   el('p', { class: 'note' }, 'Bonjour ', el('strong', {}, nom))
//   donne <p class="note">Bonjour <strong>…</strong></p>
export function el(balise, attributs = {}, ...enfants) {
  const noeud = document.createElement(balise);

  for (const [nom, valeur] of Object.entries(attributs)) {
    if (valeur === undefined || valeur === null || valeur === false) continue;
    if (nom === 'class') noeud.className = valeur;
    else if (nom === 'dataset') Object.assign(noeud.dataset, valeur);
    // onclick: () => … devient un écouteur d'événement « click »
    else if (nom.startsWith('on') && typeof valeur === 'function') {
      noeud.addEventListener(nom.slice(2), valeur);
    } else noeud.setAttribute(nom, valeur === true ? '' : valeur);
  }

  for (const enfant of enfants.flat()) {
    if (enfant === undefined || enfant === null || enfant === false) continue;
    noeud.append(enfant instanceof Node ? enfant : String(enfant));
  }
  return noeud;
}

// Remplit une liste déroulante en conservant la valeur choisie si possible
export function remplirSelect(select, options, libelleVide) {
  const valeurActuelle = select.value;
  select.replaceChildren(
    ...(libelleVide ? [el('option', { value: '' }, libelleVide)] : []),
    ...options.map(({ valeur, libelle }) => el('option', { value: valeur }, libelle)),
  );
  choisirSiPresent(select, valeurActuelle);
}

// Sélectionne une valeur seulement si elle existe dans la liste
export function choisirSiPresent(select, valeur) {
  if (valeur && [...select.options].some((option) => option.value === String(valeur))) {
    select.value = String(valeur);
  }
}
