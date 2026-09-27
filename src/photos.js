// =============================================================
// src/photos.js : photos de preuve envoyées chez Cloudinary
//
// Configuration : variable d'environnement CLOUDINARY_URL, telle que donnée
// par le tableau de bord Cloudinary : cloudinary://CLE:SECRET@NOM_DU_COMPTE
// Sans elle, la fonction photo est simplement désactivée.
//
// Le navigateur envoie la photo directement chez Cloudinary (elle ne passe
// pas par notre serveur) avec une SIGNATURE calculée ici : sans le secret,
// personne ne peut déposer de fichier sur notre compte. La photo est
// recompressée dans le téléphone avant l'envoi, ce qui retire aussi les
// informations cachées (position GPS, modèle du téléphone).
// =============================================================
import { createHash } from 'node:crypto';

export const DOSSIER = 'zando-prix/propositions';

// Lue à chaque appel : la configuration peut changer sans redémarrer (tests)
export function configurationPhotos() {
  const url = process.env.CLOUDINARY_URL;
  const morceaux = url && /^cloudinary:\/\/([^:]+):([^@]+)@([\w-]+)$/.exec(url.trim());
  return morceaux ? { cle: morceaux[1], secret: morceaux[2], compte: morceaux[3] } : null;
}

// Signature Cloudinary : SHA-1 des paramètres triés, suivis du secret
export function signer(parametres, secret) {
  const chaine = Object.keys(parametres).sort().map((cle) => `${cle}=${parametres[cle]}`).join('&');
  return createHash('sha1').update(chaine + secret).digest('hex');
}

// Une photo n'est acceptée que si elle vient de NOTRE compte Cloudinary
export function photoAcceptee(url) {
  const config = configurationPhotos();
  if (!config || typeof url !== 'string' || url.length > 300) return false;
  return url.startsWith(`https://res.cloudinary.com/${config.compte}/image/upload/`);
}
