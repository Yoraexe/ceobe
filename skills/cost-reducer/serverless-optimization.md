# SERVERLESS OPTIMIZATION (Lambda/Cloudflare Workers)
1. **Cold Starts:** Keep dependencies absolutely minimal. Do not import heavy libraries like full `lodash` or `aws-sdk` if you only need one function.
2. **Execution Time:** You are billed by the millisecond. Await DB calls concurrently using `Promise.all()` whenever possible.