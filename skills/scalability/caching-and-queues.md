# CACHING & QUEUES
1. **Redis:** Use Redis for heavily read, infrequently updated data. Always set a TTL (Time-To-Live).
2. **Message Queues:** Offload slow operations (email, PDF generation) to RabbitMQ or SQS. Never block the main HTTP thread.