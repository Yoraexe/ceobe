# E2E TESTING (PLAYWRIGHT)
1. **Data Seeding:** Reset the database to a known state before E2E suites run. Do not rely on data leftover from previous tests.
2. **Resilience:** Use proper locators (`getByRole`, `getByText`) instead of brittle CSS selectors or XPaths.