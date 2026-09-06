# 10 — Branches Git : `prod` (défaut) et `dev`

Dépôt : [https://github.com/egafossojm/dubai-phone](https://github.com/egafossojm/dubai-phone)

| Branche | Rôle | CD |
| --- | --- | --- |
| **`prod`** | Branche **principale** (défaut GitHub) | merge / *Run workflow* → EC2 prod |
| **`dev`** | Intégration / recette | merge / *Run workflow* → EC2 dev |

Il n’y a **pas** de branche `main`. CD : [09-cd-github-actions.md](./09-cd-github-actions.md).

## Flux quotidien

```text
feature/*  →  PR vers dev  →  merge  →  deploy EC2 dev
dev        →  PR vers prod →  merge  →  deploy EC2 prod
```

Hotfix prod : branche depuis `prod`, PR vers `prod`, puis rebaser / merger dans `dev` pour ne pas diverger.

Clone :

```bash
git clone -b prod https://github.com/egafossojm/dubai-phone.git
# ou, pour travailler sur la recette :
git clone -b dev https://github.com/egafossojm/dubai-phone.git
```

EC2 : même URL, `-b prod` sur l’instance prod, `-b dev` sur l’instance dev.

## Bootstrap (une fois) : `main` → `prod` / `dev`

Commandes exécutées pour créer les branches, pousser le dépôt vide, faire de `prod` la branche par défaut, puis supprimer `main`.

Prérequis : commit de travail déjà fait sur `main` ; `gh` authentifié ; dépôt GitHub existant (éventuellement vide).

```bash
# 1. prod à partir de main
git branch prod
git checkout prod

# 2. dev à partir de prod
git branch dev

# 3. remote HTTPS
git remote add origin https://github.com/egafossojm/dubai-phone.git
# si origin existe déjà :
# git remote set-url origin https://github.com/egafossojm/dubai-phone.git

# 4. pousser prod puis dev (ne pas pousser main)
git push -u origin prod
git push -u origin dev

# 5. branche par défaut GitHub = prod
gh repo edit egafossojm/dubai-phone --default-branch prod

# 6. supprimer main en local (jamais poussée)
git branch -d main
```

Si `main` avait déjà été poussée :

```bash
gh repo edit egafossojm/dubai-phone --default-branch prod
git push origin --delete main
git branch -d main
```

Ne pas recréer `main`.
