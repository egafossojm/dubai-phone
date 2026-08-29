# 08 — Gestion des erreurs et validation

## 1. Validation

| Couche | Outil | Rôle |
| --- | --- | --- |
| Client | Zod (+ RHF) | UX rapide |
| Serveur | **Même schéma Zod** (ou dérivé) | Sécurité — obligatoire |
| Domaine | Policies / invariants | Règles métier |
| DB | Contraintes | Dernier filet (unicité IMEI, FK) |

Principe : **ne jamais** faire confiance à la validation frontend seule.

---

## 2. Classification des erreurs

Alignée sur `AppError` existant :

| Type | Exemple utilisateur |
| --- | --- |
| Validation | « Le téléphone est invalide » |
| Authentication | « Session expirée » |
| Authorization | « Action non autorisée » |
| NotFound | « Produit introuvable » |
| Conflict | « Cet IMEI existe déjà » |
| BusinessRule | « Remise supérieure au plafond autorisé » |
| NotImplemented | « Cette opération n'est pas encore disponible » |
| Infrastructure | « Service temporairement indisponible » |

---

## 3. Mapping HTTP

Voir tableau dans `03-backend.md`.  
Les handlers convertissent `AppError` → JSON d’erreur standard.

---

## 4. Idempotence vs erreur

| Situation | Comportement |
| --- | --- |
| Retry avec même clé, succès déjà enregistré | `200` + même ressource (pas d’erreur) |
| Retry avec même clé, payload différent | `409 CONFLICT` |
| Règle métier | `422` + code stable |

---

## 5. Messages

- Français, actionnables  
- Pas de détail SQL / stack  
- Logs serveur conservent le détail technique
