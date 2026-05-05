# Back-office du blog MD Rénov'

Le dossier `admin` installe Decap CMS sur l'adresse :

`https://blog.mdrenov-menuiserie.com/admin/`

## Ce que cela permet

- Modifier les articles Markdown depuis une interface web.
- Ajouter une image principale par article.
- Renseigner titre SEO, description SEO, catégorie, tags, date et temps de lecture.
- Envoyer les changements dans GitHub, avec un workflow éditorial brouillon / validation / publication.

## Point important sur le site actuel

Le site actuel est statique : les pages visibles sont des fichiers `.html`.

Les fichiers édités dans Decap sont les miroirs Markdown `*.html.md`. Après modification d'un article dans le back-office, il faudra donc régénérer ou synchroniser la page HTML correspondante pour que le changement soit visible sur le site public.

La bonne évolution suivante serait d'ajouter un petit générateur : Markdown + champs SEO vers HTML, sitemap, `llms.txt` et pages catégories. Comme ça, Decap deviendra la source unique et chaque publication mettra le blog à jour automatiquement.

## Configuration obligatoire avant mise en ligne

Dans `admin/config.yml`, remplacer :

```yaml
repo: VOTRE-COMPTE/VOTRE-REPO
```

par le vrai dépôt GitHub, par exemple :

```yaml
repo: mdrenov/blog-mdrenov
```

Il faut aussi que l'utilisateur qui se connecte ait accès en écriture au dépôt GitHub.

## Authentification GitHub

Decap CMS utilise GitHub pour se connecter et écrire les fichiers. D'après la documentation Decap, le backend GitHub exige un serveur d'authentification OAuth. Sur Vercel, il faudra donc brancher un fournisseur OAuth compatible Decap ou déployer un petit service OAuth dédié.

Documentation utile :

- https://decapcms.org/docs/add-to-your-site/
- https://decapcms.org/docs/github-backend/
- https://decapcms.org/docs/configuration-options/
