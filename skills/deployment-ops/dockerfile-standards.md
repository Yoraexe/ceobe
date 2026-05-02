# Dockerfile Standards (Deployment Ops)

## 1. Layer Caching Best Practices
Always copy dependency files BEFORE source code to maximize Docker layer caching:

```dockerfile
# ✅ Good: Dependencies cached, source rebuild is fast
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# ❌ Bad: Every source change invalidates the npm ci cache
COPY . .
RUN npm ci
```

## 2. Multi-Stage for Go
```dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/server /server
USER nobody:nobody
EXPOSE 8080
CMD ["/server"]
```

## 3. Multi-Stage for Python
```dockerfile
FROM python:3.13-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
COPY . .

FROM python:3.13-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY --from=builder /app .
ENV PATH=/root/.local/bin:$PATH
USER nobody
EXPOSE 8000
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000"]
```

## 4. .dockerignore
Always include a `.dockerignore` to prevent secrets and bloat from entering the image:

```
node_modules
.git
.env
*.md
dist
coverage
.ceobe
```