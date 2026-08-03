# Déploiement Kubernetes (usage interne)

Ce dossier contient tout le nécessaire pour publier l'application sur un cluster Kubernetes interne.

## Prérequis

- Un cluster Kubernetes avec :
  - un **Ingress Controller** (ingress-nginx recommandé),
  - **cert-manager** pour le HTTPS,
  - un **registre d'images** accessible au cluster (Harbor, Nexus, ECR…),
  - `kubectl` configuré.

## ⚠️ HTTPS obligatoire

Le scan caméra (code-barres / QR) et l'installation PWA **ne fonctionnent qu'en HTTPS** (les navigateurs
bloquent l'accès à la caméra hors contexte sécurisé, `getUserMedia`). Utilisez :
- un nom de domaine public + Let's Encrypt, **ou**
- un nom de domaine interne (`prodtrack.corp.local`) avec un **issuer cert-manager interne**
  (CA d'entreprise / self-signed) et distribuez le certificat CA aux téléphones de l'atelier.

## 1. Générer les secrets

```bash
# Mot de passe PostgreSQL
openssl rand -hex 24
# Secret JWT
openssl rand -hex 32
```

Complétez `k8s/secret.yaml` avec ces valeurs, puis appliquez :

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
```

> ⚠️ `k8s/secret.yaml` contient des mots de passe **en clair** dans le dépôt.
> Pour la production, préférez Sealed Secrets, External Secrets ou Vault.

## 2. Construire et pousser l'image

```bash
docker build -t registry.example.com/production-tracker:latest .
docker push registry.example.com/production-tracker:latest
```

Remplacez `registry.example.com` par votre registre, puis mettez à jour la référence d'image
dans `k8s/backend.yaml` et `k8s/db-init-job.yaml`.

Si le registre est privé :

```bash
kubectl -n production-tracker create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=<user> \
  --docker-password=<pass>
```

## 3. Déployer la base de données

```bash
kubectl apply -f k8s/postgres.yaml
kubectl -n production-tracker rollout status statefulset/postgres
```

## 4. Initialiser le schéma + données de démo

```bash
kubectl apply -f k8s/db-init-job.yaml
kubectl -n production-tracker wait --for=condition=complete job/db-init --timeout=120s
kubectl -n production-tracker logs job/db-init
```

## 5. Déployer l'application

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/backend.yaml
kubectl -n production-tracker rollout status deployment/production-tracker
```

## 6. Exposer en HTTPS

Ajustez le nom de domaine dans `k8s/ingress.yaml`, puis :

```bash
kubectl apply -f k8s/ingress.yaml
```

L'application est alors accessible sur `https://<votre-domaine>`.

## Vérification

```bash
kubectl -n production-tracker get pods,svc,ingress
curl -k https://prodtrack.example.com/api/health   # → {"status":"ok","db":"connected"}
```

Comptes de démo (créés par le seed) :
`admin@example.com` / `admin123` · `manager@example.com` / `manager123` · `operator@example.com` / `operator123`

## Maintenance

### Mettre à jour l'application

```bash
docker build -t registry.example.com/production-tracker:newtag .
docker push registry.example.com/production-tracker:newtag
# mettez à jour la tag d'image dans backend.yaml puis :
kubectl apply -f k8s/backend.yaml
```

### Modifier le schéma de base de données

Après un changement de schéma, relancez un Job d'init (le seed est idempotent) :

```bash
kubectl -n production-tracker delete job db-init
kubectl apply -f k8s/db-init-job.yaml
```

### Sauvegardes

- **Base** : `kubectl -n production-tracker exec statefulset/postgres -- pg_dump -U postgres production_tracker > backup.sql` (planifiez une tâche régulière).
- **Photos / documents** (`/app/uploads`, PVC `uploads-data`) : sauvegardez le PVC (snapshot ou copie).

## Limitations connues

- **1 seul réplica recommandé** : les photos/documents sont stockés en local sur le PVC `uploads-data`.
  Pour passer à plusieurs réplicas, utilisez `STORAGE_DRIVER=cloudinary` (déjà supporté) ou un volume partagé (NFS/ReadWriteMany).
- Le scan caméra exige un navigateur récent et HTTPS.
