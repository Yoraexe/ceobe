# GITHUB ACTIONS
1. **Caching:** Always set up dependency caching (`actions/setup-node`) to speed up CI pipelines.
2. **Secrets:** Pass production secrets strictly via `${{ secrets.VAR_NAME }}`. Never echo secrets in bash commands.