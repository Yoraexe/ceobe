# WORKFLOW BEST PRACTICES
1. **Error Handling:** Always attach an Error Trigger node to catch workflow failures.
2. **Pagination:** When fetching third-party APIs inside n8n HTTP Request nodes, ensure pagination is handled to avoid silent data truncation.