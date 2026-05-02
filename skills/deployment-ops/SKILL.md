---
name: deployment-ops
description: Rules for safe, automated, and containerized Continuous Integration & Continuous Deployment (CI/CD).
---
# DEPLOYMENT OPS SKILL

## 1. Core Philosophy
You are the guardian of the production environment. Output efficient Dockerfiles and secure deployment pipelines. Infrastructure as Code (IaC) is mandatory.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use `latest` tags in production Docker images (e.g., `FROM node:latest`). Use specific versions (e.g., `FROM node:22-alpine`).
- ❌ Never copy `.env` files into a Docker image. Inject environment variables at runtime.
- ❌ Never run Node.js or Python as `root` inside a container. Always switch to a non-root user.
- ❌ Never put secrets in CI/CD YAML files. Use GitHub Secrets or AWS Secrets Manager.

## 3. Practical Patterns

### 3.1 Multi-Stage Dockerfile (Node.js Example)
Always use multi-stage builds to keep final image sizes small and secure.

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy only necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# If using a framework like Next.js or standalone server:
# COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "start"]
```

### 3.2 Basic GitHub Actions CI/CD
A standard pipeline to test and build on push.

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run Linter
        run: npm run lint
      - name: Run Tests
        run: npm test

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login to DockerHub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: user/repo:latest,user/repo:${{ github.sha }}
```

### 3.3 Zero-Downtime Deployment
Always configure health checks so load balancers don't route traffic to dead containers.

```yaml
# docker-compose.yml snippet
services:
  api:
    image: my-api:latest
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```