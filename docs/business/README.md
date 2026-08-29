# Modèle fonctionnel et métier — Index

**Projet :** Dubai Phone  
**Phase :** Product / Business Modeling (`prompt_001`)  
**Statut :** Référence métier — **aucune implémentation dans cette phase**  
**Étape suivante :** `prompt_002_architecture.txt`

---

## À qui s’adresse ce dossier ?

| Audience | Documents prioritaires |
| --- | --- |
| Product / métier | `01`, `02`, `05`, `10`, `12` |
| Architectes / backend | `03`, `04`, `05`, `06`, `11` |
| Frontend / UX | `01`, `02`, `04`, `07` |
| Sécurité / QA | `07`, `08`, `09` |
| Agents IA | **Tous** — commencer par cet index |

---

## Documents

| Fichier | Contenu |
| --- | --- |
| [01-product-overview.md](./01-product-overview.md) | Vision, problèmes résolus, principes, cycle de vie |
| [02-actors-roles.md](./02-actors-roles.md) | Acteurs, rôles, capacités |
| [03-modules.md](./03-modules.md) | Modules fonctionnels |
| [04-domain-model.md](./04-domain-model.md) | Entités, relations, numérotation |
| [05-processes.md](./05-processes.md) | Processus métier (achat → vente → crédit → retour) |
| [06-states-transitions.md](./06-states-transitions.md) | États et transitions |
| [07-business-rules-catalog.md](./07-business-rules-catalog.md) | Catalogue des règles métier |
| [08-permissions-and-sensitive-ops.md](./08-permissions-and-sensitive-ops.md) | Matrice RBAC, opérations sensibles, audit |
| [09-edge-cases.md](./09-edge-cases.md) | Cas limites |
| [10-mvp-scope.md](./10-mvp-scope.md) | MVP / V1 / FUTURE / OUT OF SCOPE |
| [11-module-dependencies.md](./11-module-dependencies.md) | Dépendances entre modules |
| [12-open-questions.md](./12-open-questions.md) | Contradictions résolues et décisions métier actées |

---

## Sources de vérité utilisées

1. `.cursor/rules/project-context.md`
2. `.cursor/rules/business-rules.md`
3. `.cursor/rules/architecture.md`, `frontend.md`, `backend.md`, `database.md`, `ux.md`, `testing.md`
4. `prompt_001_model_fonctionel_metier.txt`
5. Fondation technique déjà créée (`prompt_000`) — stack Next.js, pas de modules métier

**Pas de `AGENTS.md`** dans le dépôt au moment de la rédaction.

---

## Principe important (non développeur)

Cette phase produit **uniquement des documents Markdown**.

- Aucune commande Node/npm à lancer pour valider ce travail.
- Aucune page métier, API métier, ni migration SQL n’a été ajoutée.
- Les prochaines phases (architecture, base de données) s’appuieront sur ces documents.
