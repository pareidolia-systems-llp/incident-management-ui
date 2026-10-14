# React + Vite

## Local frontend observability

Grafana Faro is opt-in and development-only. Copy `.env.development.example` to
`.env.development.local` (already ignored by Git), then restart `npm run dev`:

```dotenv
VITE_FARO_ENABLED=true
VITE_FARO_COLLECTOR_URL=http://127.0.0.1:12347/collect
```

Disable it by setting `VITE_FARO_ENABLED=false` or removing the flag, then restart
Vite and reload the browser. Production builds do not load or initialize Faro,
even if the enable flag is set. No credentials belong in these variables: all
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
the receiver; keep this receiver local and do not enable connection metadata.

### Alloy receiver needed next

Grafana at `http://127.0.0.1:3000` is the UI, not the collector. The existing backend
Alloy must expose `POST http://127.0.0.1:12347/collect` and handle CORS preflights.
Connection refusal is expected until that receiver exists. This repository does
not configure or start Alloy, Loki, or another observability stack.

The backend owner can add the following to the **existing** Alloy configuration,
replacing `existing` with its actual Loki writer component name:

```alloy
faro.receiver "frontend_dev" {
  log_format = "json"
  extra_log_labels = { service_name = "incident-management-ui" }
  server {
    listen_address = "127.0.0.1"
    listen_port = 12347
    cors_allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    include_metadata = false
  }
  sourcemaps {
    download = false
  }
  output {
    logs = [loki.write.existing.receiver]
  }
}
```

For containerized Alloy, listen on `0.0.0.0` **inside the container** and publish
only `127.0.0.1:12347:12347` on the host. Permit both exact development origins
above, with no wildcard or changes to the application's auth/API CORS. Faro sends
JSON using `Content-Type: application/json`; the receiver must accept OPTIONS and
POST. No API key or Grafana Cloud configuration is needed for this local setup.
Forward receiver logs to the existing Loki pipeline; no trace receiver is needed.
See the official [Alloy faro.receiver reference](https://grafana.com/docs/alloy/latest/reference/components/faro/faro.receiver/)
and [React Router v7 integration](https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/frontend-observability/instrument/faro-react/v7-no-data-router/).

### Validation and manual checks

Run `npm test` (Node utility tests and Vitest frontend tests), `npm run lint`, and
`npm run build`. Observability tests mock SDK initialization and verify gating,
failure isolation, safe payloads and the official error-boundary fallback.

In a browser, test with the flag off and on: Google sign-in, logout, navigation,
Help/sidebar, incident creation, screenshot attachments, evidence updates, roles,
and reporting. With Alloy stopped, confirm the portal still works. Once Alloy is
configured, inspect `/collect` payloads in DevTools for the exclusions above and
confirm telemetry in Loki through Grafana. Use synthetic data only. A synthetic
`console.error('faro smoke test')`, uncaught `setTimeout(() => { throw new Error('faro smoke test') })`,
and `Promise.reject(new Error('faro smoke test'))` can verify the three error paths;
expect redacted messages in Loki. Navigate between routes to check templates, and
interact/leave the page to allow Web Vitals to emit. Check both local origins.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
