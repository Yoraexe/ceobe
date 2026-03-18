# API Specification Documentation
**Project:** [Nama Project]
**Base URL:** `https://api.domain.com/v1`
**Auth Method:** [e.g., Bearer Token / JWT]

---

## 1. Global Standards
### 1.1 Standard Headers
- `Content-Type: application/json`
- `Authorization: Bearer <token>`
- `X-Request-ID: <uuid>` (Untuk traceability/logging)

### 1.2 Common Query Parameters (List Endpoints)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `sort`: Field name (prefix `-` for descending, e.g., `-created_at`)
- `search`: Keyword for global search

---

## 2. Endpoints

### 2.1 [Resource Name] - [Action]
**Endpoint:** `METHOD /path`
**Description:** Apa yang dilakukan endpoint ini.

**Request:**
- **Headers:** [Custom headers if any]
- **Body (JSON):**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `username` | String | Yes | Unique identifier |
| `email` | String (Email) | Yes | Valid email format |

**Response:**
- **Success (200 OK / 201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "created_at": "timestamp"
  },
  "message": "Resource created successfully"
}
```

- **Success - List/Pagination (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "created_at": "timestamp"
    }
  ],
  "meta": {
    "total_items": 100,
    "total_pages": 10,
    "current_page": 1,
    "limit": 10
  },
  "message": "Resource list retrieved successfully"
}
```

- **Error (400 / 401 / 404 / 422 / 500):**
```json
{
  "success": false,
  "error_code": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": [
    {
      "field": "email",
      "issue": "Format email tidak valid"
    }
  ]
}
```