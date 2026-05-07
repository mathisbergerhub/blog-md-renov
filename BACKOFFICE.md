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

Decap CMS utilise GitHub pour se connecter et écrire les fichiers. D'après la documentation Decap, le backend GitHub exige un serveur d'authentification OAuth.

Le projet contient maintenant deux fonctions Vercel :

- `/api/auth` : redirige vers GitHub pour autoriser Decap.
- `/api/callback` : récupère le token GitHub et le renvoie à Decap.

Dans `admin/config.yml`, Decap est configuré pour utiliser :

```yaml
base_url: https://blog.mdrenov-menuiserie.com
auth_endpoint: api/auth
auth_scope: repo
```

## Configuration GitHub OAuth à faire

Dans GitHub, aller dans :

`Settings` > `Developer settings` > `OAuth Apps` > `New OAuth App`

Renseigner :

- `Application name` : `MD Rénov Blog Decap`
- `Homepage URL` : `https://blog.mdrenov-menuiserie.com`
- `Authorization callback URL` : `https://blog.mdrenov-menuiserie.com/api/callback`

Après création, copier :

- `Client ID`
- `Client Secret`

## Variables d'environnement Vercel à ajouter

Dans Vercel, projet du blog :

`Settings` > `Environment Variables`

Ajouter :

```text
GITHUB_CLIENT_ID=client_id_github
GITHUB_CLIENT_SECRET=client_secret_github
OAUTH_BASE_URL=https://blog.mdrenov-menuiserie.com
GITHUB_OAUTH_SCOPE=repo
```

Ensuite, redéployer le site.

## Test final

Ouvrir :

`https://blog.mdrenov-menuiserie.com/admin/`

Le bouton de connexion ne doit plus ouvrir `api.netlify.com`. Il doit ouvrir GitHub, puis revenir sur `/api/callback`.

Documentation utile :

- https://decapcms.org/docs/add-to-your-site/
- https://decapcms.org/docs/github-backend/
- https://decapcms.org/docs/configuration-options/
