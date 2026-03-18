# DOCKERFILE STANDARDS
1. **Multi-Stage Builds:** Always use multi-stage builds. Compile TypeScript in a `builder` stage, and copy only the `dist/` and `node_modules/ (production only)` to the final Alpine image.
2. **Non-Root User:** NEVER run Node.js as `root` inside the container. Use `USER node`.