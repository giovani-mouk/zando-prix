// =============================================================
// Feature 14 : contacter l'équipe, lire les messages
// =============================================================
import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';

function envoyer(world, corps) {
  return world.api.post('/api/messages').send(corps);
}

// Identifiant d'un message d'après le nom de son expéditeur
async function idMessage(world, nom) {
  const { rows } = await world.db.query('SELECT id FROM messages WHERE nom = $1', [nom]);
  assert.equal(rows.length, 1, `Messages de ${nom} en base : ${rows.length}`);
  return rows[0].id;
}

async function nombreNonLus(world) {
  const { rows } = await world.db.query('SELECT COUNT(*)::int AS n FROM messages WHERE lu_le IS NULL');
  return rows[0].n;
}

// ---------------------------------------------------------------
// Contexte
// ---------------------------------------------------------------

Given('les messages reçus suivants :', async function (table) {
  for (const ligne of table.hashes()) {
    assert.ok(['oui', 'non'].includes(ligne.lu), `lu doit valoir oui ou non : ${ligne.lu}`);
    const minutes = Number(ligne['reçu il y a (minutes)']);
    await this.db.query(
      `INSERT INTO messages (nom, email, contenu, created_at, lu_le)
       VALUES ($1, $2, $3,
               now() - make_interval(mins => $4),
               CASE WHEN $5 THEN now() END)`,
      [ligne.nom, 'visiteur@exemple.cg', ligne.message, minutes, ligne.lu === 'oui'],
    );
  }
});

Given("j'ai déjà envoyé {int} messages dans l'heure", async function (nombre) {
  for (let i = 1; i <= nombre; i += 1) {
    const reponse = await envoyer(this, {
      nom: 'Patrick', email: 'patrick@exemple.cg', message: `Message numéro ${i}`,
    });
    assert.equal(reponse.status, 201);
  }
});

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

// Comme le formulaire : un champ vide n'est pas envoyé
When("j'envoie le message suivant :", async function (table) {
  const [ligne] = table.hashes();
  this.reponse = await envoyer(this, {
    nom: ligne.nom || undefined,
    email: ligne['e-mail'] || undefined,
    message: ligne.message || undefined,
  });
});

When('un robot envoie un message en remplissant le champ caché', async function () {
  this.reponse = await envoyer(this, {
    nom: 'Robot',
    email: 'robot@spam.example',
    message: 'Achetez maintenant !',
    site_web: 'https://spam.example',
  });
});

When('je consulte les messages', async function () {
  this.reponse = await this.api.get('/api/messages');
});

When('je marque le message de {string} comme lu', async function (nom) {
  const id = await idMessage(this, nom);
  this.reponse = await this.api.patch(`/api/messages/${id}`).send({ lu: true });
});

// ---------------------------------------------------------------
// Résultats
// ---------------------------------------------------------------

Then('mon message est bien reçu', function () {
  assert.equal(this.reponse.status, 201, JSON.stringify(this.reponse.body));
  assert.equal(typeof this.reponse.body.confirmation, 'string');
});

Then('on lui répond comme si le message était reçu', function () {
  assert.equal(this.reponse.status, 201);
  assert.equal(typeof this.reponse.body.confirmation, 'string');
});

Then('mon message est refusé', function () {
  assert.equal(this.reponse.status, 400);
});

Then('mon message est refusé avec le message {string}', function (message) {
  assert.equal(this.reponse.status, 429);
  assert.equal(this.reponse.body.erreur?.message, message);
});

// {int} message(s) non lu(s) : les parenthèses rendent le « s » facultatif
Then("l'équipe a reçu {int} message(s) non lu(s)", async function (nombre) {
  assert.equal(await nombreNonLus(this), nombre);
});

Then("l'équipe n'a reçu aucun message", async function () {
  const { rows } = await this.db.query('SELECT COUNT(*)::int AS n FROM messages');
  assert.equal(rows[0].n, 0);
});

Then('je vois les messages dans cet ordre :', function (table) {
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
  const actuel = this.reponse.body.map((m) => ({ nom: m.nom, lu: m.lu ? 'oui' : 'non' }));
  assert.deepEqual(actuel, table.hashes());
});

Then('le message de {string} est indiqué comme lu par {string}', async function (nom, administrateur) {
  assert.equal(this.reponse.status, 200, JSON.stringify(this.reponse.body));
  const liste = await this.api.get('/api/messages');
  const message = liste.body.find((m) => m.nom === nom);
  assert.ok(message, `Message de ${nom} absent de la liste`);
  assert.equal(message.lu, true);
  assert.equal(message.lu_par, administrateur);
});
