# React + Vite

## Frontend observability

Grafana Faro is opt-in in every environment. Copy `.env.development.example` to
`.env.development.local` (already ignored by Git), then restart `npm run dev`:

```dotenv
VITE_FARO_ENABLED=true
VITE_FARO_ENVIRONMENT=dev
VITE_FARO_COLLECTOR_URL=http://127.0.0.1:12347/collect
```

Disable it by setting `VITE_FARO_ENABLED=false` or removing the flag, then restart
Vite and reload the browser (rebuild for production). Only the exact string `true`
enables Faro; missing, empty, false, or malformed flags disable it in every mode.
`VITE_FARO_ENVIRONMENT` sets application metadata independently of Vite mode;
missing or empty values retain the historical `dev` fallback. Use `dev` locally
and `prod` in production. No credentials belong in these variables: all
`VITE_*` values are public. The application version comes from `package.json`.

The official `@grafana/faro-react` integration captures uncaught JavaScript errors,
unhandled promise rejections, React component/render failures, console errors,
route changes, and standard Web Vitals (CLS, FCP, INP, LCP, TTFB). A rendering
failure shows a generic reload fallback when Faro is active. Initialization and
collector delivery failures do not prevent ordinary portal use. No API client or
authentication behavior is changed.

Privacy takes precedence over full diagnostic detail. The supported `beforeSend`
hook rebuilds only allowed telemetry fields: error category, known local source
filename and line/column, console-error severity, route templates, numeric Web
Vitals, timestamps, and application metadata. Raw exception messages, function
names, console arguments, arbitrary context and unknown event types are withheld.
Queries, fragments, incident IDs, unknown paths, user/session metadata, DOM
selectors and Web Vitals resource attribution are excluded. Errors still appear
normally in the local browser console; inspect that console for full diagnostics.
Identical redacted errors may be deduplicated by Faro.

No Session Replay, screenshots, attachments, form contents, incident descriptions,
evidence references, remarks, names/emails, OAuth/Google tokens, authorization/CSRF
headers, session cookies, or request/response bodies are deliberately collected.
There is no HTTP tracing, resource timing, click instrumentation, user metadata,
or session tracking. Telemetry fetches omit credentials and the referrer. Existing
application code had no console statements exporting incident payloads; keep it
that way. Do not add raw API/error-object logging or broaden the filter without a
privacy review. Browser networking necessarily exposes connection information to
the receiver; avoid enabling receiver connection metadata.

### Production configuration

Use `.env.production.example` as the public Faro configuration reference. Vite
embeds these values at build time; changing them requires a rebuild. Build with:

```dotenv
VITE_API_BASE_URL=https://incident.pareidolia.in
VITE_FARO_ENABLED=true
VITE_FARO_ENVIRONMENT=prod
VITE_FARO_COLLECTOR_URL=https://incident.pareidolia.in/faro/collect
```

Then run `npm run build` with those environment variables set. The production
endpoint is already proxied by Nginx to the native Alloy Faro receiver. Local
development continues using `http://127.0.0.1:12347/collect`. No collector URL is
hard-coded in application source; a missing or invalid collector disables
initialization safely. SDK initialization failures are contained, and collector
requests are handled asynchronously by the SDK, independently of portal API calls.
This repository does not configure production Nginx, Alloy, or other infrastructure.

### Validation and manual checks

Run `npm test` (Node utility tests and Vitest frontend tests), `npm run lint`, and
`npm run build`. Observability tests mock SDK initialization and verify gating,
failure isolation, safe payloads and the official error-boundary fallback.

In a browser, test with the flag off and on: Google sign-in, logout, navigation,
Help/sidebar, incident creation, screenshot attachments, evidence updates, roles,
and reporting. With Alloy stopped, confirm the portal still works. Once Alloy is
available, inspect `/collect` (development) or `/faro/collect` (production) payloads in DevTools for the exclusions above and
confirm telemetry in Loki through Grafana. Use synthetic data only. A synthetic
`console.error('faro smoke test')`, uncaught `setTimeout(() => { throw new Error('faro smoke test') })`,
and `Promise.reject(new Error('faro smoke test'))` can verify the three error paths;
expect redacted messages in Loki. Navigate between routes to check templates, and
interact/leave the page to allow Web Vitals to emit. Check both local origins and the production build. Also simulate a collector HTTP error and offline networking; verify portal operations remain usable where the backend is reachable.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
