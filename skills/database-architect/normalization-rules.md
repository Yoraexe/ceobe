# NORMALIZATION
1. **Third Normal Form (3NF):** Always strive for 3NF. Do not duplicate data unless there is a proven, measured performance bottleneck that requires denormalization.
2. **UUIDs:** Always use UUIDv4 or ULID for primary keys exposed to the client to prevent sequential ID guessing. Let the database generate them if possible (e.g., `gen_random_uuid()`).