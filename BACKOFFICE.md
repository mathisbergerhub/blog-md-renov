# Back-office du blog MD Renov'

Le back-office est disponible sur :

`https://blog.mdrenov-menuiserie.com/admin/`

## Fonctionnement actuel

Le CMS enregistre les articles dans Supabase. Les pages publiques, les categories, le sitemap et le fichier `llms.txt` lisent Supabase en production.

Quand un article est publie, modifie, archive ou desarchive, le changement est visible sans attendre une reconstruction Vercel.

## Actions disponibles

- Creer un article avec titre, SEO, categorie, tags, image principale, parties, tableaux, CTA, FAQ et sources.
- Modifier un article publie avec la meme logique que la creation.
- Archiver un article pour le retirer du blog public.
- Desarchiver un article pour le remettre en ligne.
- Supprimer une archive.

## Variables Vercel indispensables

Ces valeurs doivent rester uniquement dans Vercel, jamais dans le code :

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MDR_ADMIN_PASSWORD_HASH`
- `MDR_COOKIE_SECRET`

Les anciennes variables GitHub peuvent rester pour compatibilite ou secours, mais Supabase est la source principale du back-office.

## Controle avant remise

Verifier :

- `/admin/manage` demande bien le mot de passe.
- `/api/manage-content` repond `401` sans connexion.
- Un article publie apparait dans sa categorie et dans sa page publique.
- `/sitemap.xml` contient les articles publics.
- `/llms.txt` contient les articles publics pour les moteurs IA.
