# Checklist de mise en ligne publique — Blog MD Rénov'

À suivre le jour où le blog passe de « validation interne » à **ouvert au public**.
Coche chaque point dans l'ordre.

## 1. Sécurité (à faire AVANT d'ouvrir)
- [ ] Définir les variables d'environnement sur Vercel (Settings → Environment Variables) :
  - `MDR_COOKIE_SECRET` (secret aléatoire long)
  - `MDR_BLOG_PASSWORD_HASH` (SHA-256 du nouveau mot de passe blog)
  - `MDR_ADMIN_PASSWORD_HASH` (SHA-256 d'un mot de passe admin **différent**)
- [ ] Vérifier que le dépôt GitHub est bien en **privé**.

## 2. Retirer le mot de passe d'accès au blog
Le fichier `middleware.js` protège tout le site par mot de passe. Pour ouvrir le blog
au public **tout en gardant `/admin` et `/api` protégés**, il faut adapter ce fichier
(laisser le blog passer en accès libre, conserver le gate admin).
- [ ] Ouvrir le blog au public dans `middleware.js` (demander à un dev / à Claude).
- [ ] Garder le back-office `/admin` et les `/api` protégés par mot de passe.

## 3. Autoriser l'indexation par Google
- [ ] Remplacer le contenu de `robots.txt` par :
  ```
  User-agent: *
  Allow: /

  Sitemap: https://blog.mdrenov-menuiserie.com/sitemap.xml
  ```
- [ ] Vérifier qu'aucune page ne renvoie d'en-tête `X-Robots-Tag: noindex`
      (cet en-tête disparaît automatiquement une fois le gate retiré — étape 2).

## 4. Référencement
- [ ] Créer/ouvrir **Google Search Console** pour le domaine `blog.mdrenov-menuiserie.com`.
- [ ] Soumettre le sitemap : `https://blog.mdrenov-menuiserie.com/sitemap.xml`.
- [ ] Demander l'indexation de la page d'accueil et de 3-4 articles clés.

## 5. Vérifications finales
- [ ] Tester quelques URL sans `.html` (ex. `/maprimerenov-2026-haute-savoie`) → doivent s'ouvrir.
- [ ] Tester un partage Facebook/WhatsApp d'un article → l'aperçu (image + titre) s'affiche.
- [ ] Vérifier l'affichage mobile (menu, images, tableaux).
- [ ] Redéployer depuis Vercel après chaque changement et attendre le ✅ vert.

## 6. Contenu (qualité / confiance)
- [ ] Vérifier les chiffres des aides (MaPrimeRénov', montants, dates) — sujet sensible.
- [ ] Remplacer si possible les images générées par IA par de **vraies photos de chantiers**.
- [ ] Ajouter un nom/visage d'expert (auteur) pour renforcer la confiance.

---
_Dernière mise à jour : 30 juin 2026._
