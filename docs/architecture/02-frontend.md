# 02 — Architecture frontend

## 1. Rôle du frontend

Interface **interne** (personnel magasin), en français, desktop-first ; POS optimisé clavier / tablette.

Le frontend :

- affiche et collecte des données ;
- applique des contrôles UX (champs requis, plafonds de remise **affichés**) ;
- **ne décide pas** seul de la validité financière, stock ou permissions.

---

## 2. Organisation UI

| Zone | Contenu |
| --- | --- |
| `src/app/(app)/...` | Écrans authentifiés (dashboard, listes, formulaires) |
| `src/app/(pos)/pos` | Surface POS dédiée (layout minimal, vitesse) |
| `src/app/api/...` | Route handlers (côté serveur Next) |
| `src/components/ui` | Design system (shadcn) |
| `src/components/shared` | Loading / erreur / vide |
| `src/components/layout` | Shell, navigation |

Navigation principale (selon permissions) : alignée sur `docs/business` et UX rules  
(Tableau de bord, Ventes, Produits, Stock, Achats, Fournisseurs, Clients, Crédits, Retours, Rapports, Administration).

---

## 3. Patterns frontend

| Besoin | Approche |
| --- | --- |
| Données serveur | Server Components + fetch vers services / API internes |
| Mutations | Server Actions **ou** `POST/PATCH` API routes — un style unique sera fixé à l’implémentation auth ; **recommandation :** API routes JSON pour POS/offline (plus simples à rejouer) |
| Formulaires | React Hook Form + schéma Zod partagé (même forme côté client et serveur) |
| État local POS | State React + persistance offline (voir `07`) |
| Permissions UI | Masquer / désactiver actions ; **toujours** revalider côté serveur |

---

## 4. Séparation présentation / métier

```text
Page / Component
  → appelle un client API ou une Server Action fine
    → Application Service (serveur)
      → Domain rules
```

Interdit dans un composant React :

- calculer le solde crédit « officiel » ;
- décré menter le stock ;
- autoriser une remise au-delà du plafond sans contrôle serveur.

Autorisé :

- total panier **indicatif** ;
- formatage FCFA ;
- messages d’erreur utilisateur.

---

## 5. États UX obligatoires

| État | Exemple |
| --- | --- |
| Loading | Finalisation vente |
| Error | Message FR actionnable |
| Empty | « Aucun produit » + action |
| Offline | Bandeau En ligne / Hors ligne / Sync / Échec |

Fondation déjà présente : `loading.tsx`, `error.tsx`, `LoadingState`, `ErrorState`, `EmptyState`.

---

## 6. PWA

- Manifest + service worker (déjà configurés).
- Page `/offline` pour documents hors cache.
- Le SW **ne remplace pas** IndexedDB / file de sync POS.
