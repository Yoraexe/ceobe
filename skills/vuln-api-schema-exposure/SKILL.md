---
name: vuln-api-schema-exposure
description: "API schema exposure testing — OpenAPI/Swagger discovery, GraphQL introspection, WSDL exposure, gRPC reflection, API documentation endpoints. Triggers: 'api schema', 'swagger exposed', 'openapi exposure', 'graphql introspection', 'api docs exposed', 'api specification', 'wsdl exposure', 'api endpoint discovery'."
---

# API Schema Exposure Testing

Discover exposed API specifications that reveal hidden endpoints and internal architecture.

---

## Phase 1: REST API Schema Discovery

```bash
TARGET="https://TARGET"

# OpenAPI / Swagger:
SWAGGER_ENDPOINTS=(
  "/swagger.json" "/swagger.yaml"
  "/openapi.json" "/openapi.yaml"
  "/api/swagger.json" "/api/openapi.json"
  "/api-docs" "/api-docs/swagger.json"
  "/v1/swagger.json" "/v2/swagger.json" "/v3/api-docs"
  "/swagger-ui.html" "/swagger-ui/" "/swagger"
  "/docs" "/api/docs" "/redoc" "/rapidoc"
  "/.well-known/openapi.yaml"
)

for EP in "${SWAGGER_ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET$EP")
  [ "$STATUS" != "404" ] && echo "FOUND ($STATUS): $TARGET$EP"
done | tee output/schema_endpoints.txt

# Parse discovered schema for endpoints:
SCHEMA_URL=$(head -1 output/schema_endpoints.txt | awk '{print $2}')
if [ -n "$SCHEMA_URL" ]; then
  curl -s "$SCHEMA_URL" | jq '.paths | keys' | tee output/api_endpoints_from_schema.txt
  curl -s "$SCHEMA_URL" | jq '.components.securitySchemes' | tee output/api_auth_methods.txt
fi
```

---

## Phase 2: GraphQL Schema

```bash
TARGET="https://TARGET"

# GraphQL introspection (enabled by default in many frameworks):
curl -s -X POST "$TARGET/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { name } mutationType { name } types { name kind } } }"}' | \
  jq '.data.__schema' | tee output/graphql_schema.txt

# Full schema dump:
curl -s -X POST "$TARGET/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name fields { name type { name kind ofType { name kind } } args { name type { name } } } } } }"}' | \
  jq '.data.__schema.types[] | select(.name | startswith("__") | not) | {name, fields: [.fields[]? | .name]}' | \
  tee output/graphql_full_schema.txt

# Extract all mutations (state-changing operations):
cat output/graphql_full_schema.txt | grep -A5 "Mutation"
```

---

## Phase 3: WSDL & SOAP

```bash
TARGET="https://TARGET"

# WSDL discovery:
WSDL_PATHS=("/service.wsdl" "/api.wsdl" "/ws?wsdl" "/service?wsdl" "/soap?wsdl" "/rpc?wsdl")
for EP in "${WSDL_PATHS[@]}"; do
  curl -s "$TARGET$EP" | grep -q "wsdl\|definitions" && echo "WSDL: $TARGET$EP"
done

# Parse WSDL for operations:
WSDL_URL="$TARGET/service?wsdl"
curl -s "$WSDL_URL" | grep -oE '<operation name="[^"]*"' | sed 's/<operation name="//;s/"//' | tee output/soap_operations.txt
```

---

## Output

Save to `output/`:
- `schema_endpoints.txt` — discovered schema URLs
- `api_endpoints_from_schema.txt` — all API paths from schema
- `graphql_schema.txt` — GraphQL type system
- `graphql_full_schema.txt` — full GraphQL schema with fields

## Next Phase

→ `vuln-api-testing` to test discovered endpoints
→ `proto-graphql` for GraphQL-specific exploitation
