# ProdTrack — Suivi de production

Application web mobile (PWA) de **gestion de production et suivi de poids** avec **gestion d'anomalies**.
Conçue pour un usage sur smartphone Android en atelier : grands boutons, contraste élevé, saisie rapide au pavé numérique.

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18, Tailwind CSS 4, Vite, react-router-dom, lucide-react |
| Backend | Node.js, Express 4 |
| Base de données | PostgreSQL 16, Drizzle ORM |
| Stockage images | Local (dossier `backend/uploads`), extensible Cloudinary |
| PWA | Manifest + Service Worker (installable, hors-ligne) |

## Rôles & permissions (RBAC)

| Rôle | Droits |
|---|---|
| **Opérateur** | Saisie et modification de **ses** lots / relevés de poids / anomalies |
| **Manager** | Consultation globale, validation / rejet des anomalies, exports CSV |
| **Administrateur** | Tout le précédent + interface d'administration de la base et gestion des comptes |

## Démarrage rapide

Prérequis : Node.js ≥ 18.11, Docker (ou une instance PostgreSQL).

```bash
# 1. Dépendances
npm install

# 2. Base de données (PostgreSQL via Docker)
docker compose up -d

# 3. Création des tables
npm run db:push

# 4. Données de démonstration
npm run db:seed

# 5. Développement (API :3001 + frontend :5173 avec proxy)
npm run dev
```

Ouvrez http://localhost:5173 (ou http://localhost:3001 en production).

### Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | `admin@example.com` | `admin123` |
| Manager | `manager@example.com` | `manager123` |
| Opérateur | `operator@example.com` | `operator123` |

### Mode production

```bash
npm run build      # génère frontend/dist
npm start          # le backend sert l'API + le frontend compilé + /uploads
```

### Environnement

Copiez `backend/.env.example` vers `backend/.env` et ajustez `DATABASE_URL`, `JWT_SECRET`, etc.
Le stockage des images peut passer sur **Cloudinary** en définissant `STORAGE_DRIVER=cloudinary`
plus les variables `CLOUDINARY_*`.

## Fonctionnalités

- **Ordres de production (OP) & lots** : création de lot (OP + n° de lot), reprise d'un lot existant, horodatage automatique, association à l'opérateur connecté, recherche dynamique (OP, lot, date, statut).
- **Relevés de poids** : pavé numérique plein écran adapté aux gants, statistiques (total, moyenne, min/max), suppression d'un relevé.
- **Anomalies** : bouton d'alerte accessible en permanence sur la fiche lot, type, gravité (Faible → Critique), description, photos (prise de vue caméra ou import), validation / rejet par le manager avec commentaire.
- **Statuts de lot** : En cours, Terminé, En anomalie (badges colorés + pastilles).
- **Dashboard Manager/Admin** : indicateurs globaux, statut des lots, dernières anomalies, exports CSV.
- **Administration** : visionneuse directe des tables (OP, Lots, Poids, Anomalies, Photos, Utilisateurs, Exports) avec filtre et suppression en cascade, gestion complète des comptes (création, modification, changement de rôle, mot de passe).
- **Exports CSV** (UTF-8, compatibles Excel) : lots, anomalies, OP, relevés de poids — journalisés.
- **PWA** : installable sur Android, service worker avec cache de l'interface.

## Structure du projet

```
production-tracker/
├─ docker-compose.yml        # PostgreSQL 16
├─ backend/
│  ├─ drizzle.config.js
│  └─ src/
│     ├─ index.js            # Express, static frontend, routes
│     ├─ config.js
│     ├─ db/                 # schéma Drizzle, client, seed
│     ├─ middleware/         # auth JWT, RBAC, gestion d'erreurs
│     ├─ routes/             # auth, ops, lots, anomalies, admin, export
│     └─ utils/storage.js    # multer (local / Cloudinary)
└─ frontend/
   ├─ public/                # manifest, service worker, icônes
   └─ src/
      ├─ api.js, context/    # client API + auth
      ├─ components/         # Layout, Numpad, PhotoGallery, badges…
      └─ pages/              # Login, Home, LotForm, LotDetail,
                             # AnomalyForm, Search, Dashboard, Anomalies, Admin
```

## API — endpoints principaux

```
POST /api/auth/login                 Connexion → JWT
GET  /api/auth/me                    Profil connecté
POST /api/auth/register              Création de compte (admin)
GET/POST /api/ops                    Liste / création d'OP
GET/POST /api/lots                   Recherche / création de lot
GET/PATCH/DELETE /api/lots/:id       Détail / statut / suppression
POST/DELETE /api/lots/:id/weights    Ajout / suppression d'un relevé
POST /api/lots/:id/anomalies         Déclaration + photos (multipart)
GET/PATCH/DELETE /api/anomalies      Liste / validation / suppression
GET  /api/admin/stats                Indicateurs (manager+)
GET  /api/admin/records?table=…      Visionneuse BDD (admin)
POST/PATCH/DELETE /api/admin/users   Comptes (admin)
GET  /api/export/:entity.csv         Exports CSV (manager+)
```

## Notes de sécurité

- Mots de passe hachés (bcrypt), JWT signé, protections RBAC côté serveur sur chaque route.
- Toutes les requêtes SQL sont paramétrées.
- Limite de taille et type des images (uniquement images, 10 Mo max par fichier, 10 fichiers par anomalie).
- Changez `JWT_SECRET` en production.
