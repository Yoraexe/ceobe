# Skill: Golang REST API Design

## 1. Metadata
- **Name:** `golang-rest-api`
- **Origin:** `Astesia Core`
- **Description:** Patterns for building high-performance, concurrent REST APIs in Go. Enforces standard layout, dependency injection, and interface-driven design.

## 2. When to Use
Invoke this skill when:
- The Engineering Layer decides on Go (Golang) as the backend runtime.
- High concurrency, strict static typing, and minimal memory footprint are required.

## 3. Practical Guidance

### Project Structure (Standard Go Layout)
```
/
├── cmd/
│   └── api/
│       └── main.go             # Application entrypoint
├── internal/                   # Private application code
│   ├── app/                    # App initialization (wiring DI)
│   ├── config/                 # Environment configurations
│   ├── domain/                 # Domain entities and interfaces (Core)
│   │   └── user.go             # type User struct, UserRepository interface, etc.
│   ├── handler/                # HTTP Handlers (Controller layer)
│   │   └── user_handler.go
│   ├── service/                # Business logic
│   │   └── user_service.go
│   └── repository/             # Data access (Postgres/sqlc/gorm)
│       └── user_postgres.go
├── pkg/                        # Public libraries (can be imported by others)
│   └── logger/
├── go.mod
└── go.sum
```

### Domain-Driven Interfaces (Internal/Domain)
Define interfaces in the domain package to avoid circular dependencies and make testing easy.

```go
// internal/domain/user.go
package domain

import "context"

type User struct {
    ID    int64  `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

type UserRepository interface {
    GetByID(ctx context.Context, id int64) (*User, error)
    Create(ctx context.Context, user *User) error
}

type UserService interface {
    GetUser(ctx context.Context, id int64) (*User, error)
    RegisterUser(ctx context.Context, user *User) error
}
```

### Dependency Injection (Service & Handler)
Always inject dependencies via constructors.

```go
// internal/service/user_service.go
package service

import (
    "context"
    "yourapp/internal/domain"
)

type userService struct {
    repo domain.UserRepository
}

func NewUserService(r domain.UserRepository) domain.UserService {
    return &userService{repo: r}
}

func (s *userService) GetUser(ctx context.Context, id int64) (*domain.User, error) {
    // Business logic here
    return s.repo.GetByID(ctx, id)
}
```

```go
// internal/handler/user_handler.go
package handler

import (
    "net/http"
    "strconv"
    "yourapp/internal/domain"
    // assuming using standard lib or chi/fiber
)

type UserHandler struct {
    service domain.UserService
}

func NewUserHandler(s domain.UserService) *UserHandler {
    return &UserHandler{service: s}
}

func (h *UserHandler) Get(w http.ResponseWriter, r *http.Request) {
    // 1. Parse request
    idStr := r.URL.Query().Get("id")
    id, _ := strconv.ParseInt(idStr, 10, 64)

    // 2. Call service
    user, err := h.service.GetUser(r.Context(), id)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    // 3. Return response (JSON encoding omitted for brevity)
}
```

### Wiring it up (main.go)
```go
// cmd/api/main.go
package main

import (
    "log"
    "net/http"
    "yourapp/internal/handler"
    "yourapp/internal/repository"
    "yourapp/internal/service"
)

func main() {
    // 1. Init DB connection
    db := initDB() 
    
    // 2. Wire dependencies (Dependency Injection)
    userRepo := repository.NewUserPostgres(db)
    userSvc := service.NewUserService(userRepo)
    userHandler := handler.NewUserHandler(userSvc)

    // 3. Setup router
    mux := http.NewServeMux()
    mux.HandleFunc("/users", userHandler.Get)

    // 4. Start server
    log.Println("Server starting on :8080")
    http.ListenAndServe(":8080", mux)
}
```

## 4. Tested Examples
(See above for full slice from Domain to Handler and Main wiring)
