# Local synthetic Phase 2 preview

From `incident-management-ui`, run `npm install` if dependencies are missing, then:

```powershell
npm run phase2:preview
```

Open **http://127.0.0.1:5174/phase2-preview.html**. This dedicated development server binds only to loopback. Stop it with Ctrl+C. The normal Vite application and its default-off feature flag are unchanged.

The page uses the existing incident-details component with fictional data. Changes exist only in the browser tab; refresh resets them. Use only synthetic text and files. Investigation, resolution, reporter validation, closure, work notes and screenshot selection are simulated; no backend authorization is represented by this demonstration.

All Axios calls use an in-memory adapter; unknown routes fail locally. The preview skips real login and telemetry, blocks `/api` and OAuth routes at the Vite server, and serves a CSP restricting browser connections to the preview origin. The isolated config refuses builds; the normal production build does not include this entry.
