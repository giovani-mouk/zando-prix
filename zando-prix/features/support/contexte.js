// Objets partagés entre les hooks et le World.
// Remplis dans BeforeAll (voir hooks.js).
//
// Pourquoi un fichier à part ? Cucumber crée un nouveau World pour chaque
// scénario, alors que l'application et le pool de connexions ne sont créés
// qu'une fois pour toute la série de tests. Ce petit objet exporté sert de
// « boîte » commune : hooks.js la remplit, world.js y lit.
export const contexte = { app: null, pool: null };
