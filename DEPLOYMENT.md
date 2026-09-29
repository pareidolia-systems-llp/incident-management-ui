# Railway deployment

This is a Vite single-page application. Build it before starting the production server:

```sh
npm ci
npm run build
npm start
```

`npm start` runs the included Node.js production server. It serves the generated `dist` directory, listens on Railway's `PORT`, and returns `dist/index.html` for non-asset paths. This allows React Router routes such as `/incidents`, `/incidents/4`, and `/incidents/new` to load directly.

## Environment variables

Set this variable on the Railway frontend service before its build runs:

```text
VITE_API_BASE_URL=https://your-deployed-backend.example
```

`VITE_API_BASE_URL` is compiled into browser JavaScript by Vite, so it is public configuration. It must eventually point to the deployed backend's HTTPS URL and must not contain secrets.

For local development, copy the documented value from `.env.example`:

```text
VITE_API_BASE_URL=http://localhost:8080
```

Do not place database credentials, OAuth secrets, client secrets, or any other credentials in `VITE_` variables or any frontend environment file.

Railway provides `PORT` automatically. Do not set it manually unless a Railway configuration specifically requires an override.

## Manual Railway steps

1. Create a Railway service from this repository.
2. Add the `VITE_API_BASE_URL` variable using the deployed backend HTTPS URL.
3. Configure the service build command as `npm ci && npm run build` if Railway does not detect it automatically.
4. Configure the start command as `npm start` if Railway does not detect it automatically.
5. Ensure the backend allows requests from the Railway frontend domain through its CORS configuration.
6. Deploy through Railway and test direct navigation to an incident URL after the service receives its public domain.
