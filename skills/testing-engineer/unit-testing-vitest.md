# UNIT TESTING (VITEST)
1. **Isolation:** Functions must be tested in pure isolation. Do not connect to real databases in unit tests.
2. **Edge Cases:** Always write test assertions for the "Sad Path" (null values, empty arrays, invalid arguments). Do not just test the "Happy Path".