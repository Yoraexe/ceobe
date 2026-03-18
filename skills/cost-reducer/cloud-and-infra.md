# CLOUD & INFRASTRUCTURE COST SAVINGS
1. **Right-Sizing:** Never default to large instances. Start small (e.g., t3.micro/nano) and scale based on metrics.
2. **Spot Instances:** Use pre-emptible/spot instances for background workers or stateless tasks.
3. **Data Transfer:** Avoid cross-zone data transfer. Keep DB and App in the same AZ. Use Cloudflare to cache egress.