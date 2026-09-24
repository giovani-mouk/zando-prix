// =============================================================
// cucumber.js : configuration de Cucumber, lue par « npm test »
// =============================================================
// Configuration Cucumber JS
// Profil par défaut : tests d'API avec Supertest.
// Un profil "e2e" (Playwright) sera ajouté plus tard, avec ses propres
// step definitions dans features/step_definitions/e2e/.
export default {
  // Où trouver les spécifications (** = tous les sous-dossiers)
  paths: ['features/**/*.feature'],
  // Les scénarios d'interface (@e2e) seront exécutés par Playwright, pas par l'API
  tags: 'not @e2e',
  // Fichiers JavaScript chargés avant les tests : d'abord le support
  // (World, hooks), puis les step definitions qui relient chaque phrase
  // Gherkin à du code. Tous sont chargés, quel que soit le fichier .feature.
  import: [
    'features/support/**/*.js',
    'features/step_definitions/api/**/*.js',
  ],
  // Barre de progression dans le terminal + rapport HTML détaillé
  // (reports/cucumber.html, à ouvrir dans un navigateur après un échec)
  format: ['progress-bar', 'html:reports/cucumber.html'],
  // Quand une phrase n'a pas encore de définition, Cucumber propose un
  // modèle de code à copier : on le veut en style async/await.
  formatOptions: { snippetInterface: 'async-await' },
};
