// =============================================================
// GET /api/photos/signature : autorisation d'envoyer UNE photo (feature 24)
// Réponse : { disponible: false } si Cloudinary n'est pas configuré.
// =============================================================
import { Router } from 'express';
import { DOSSIER, configurationPhotos, signer } from '../photos.js';

const router = Router();

router.get('/signature', (req, res) => {
  const config = configurationPhotos();
  if (!config) return res.json({ disponible: false });
  const timestamp = Math.floor(Date.now() / 1000);
  const parametres = { folder: DOSSIER, timestamp };
  res.set('Cache-Control', 'no-store');
  res.json({
    disponible: true,
    compte: config.compte,
    cle: config.cle,
    dossier: DOSSIER,
    timestamp,
    signature: signer(parametres, config.secret),
  });
});

export default router;
