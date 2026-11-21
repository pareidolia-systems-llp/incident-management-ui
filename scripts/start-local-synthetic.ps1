# Local development only. The backend's CORS allowlist expects localhost:5173.
$ErrorActionPreference='Stop'
$oldApi=[Environment]::GetEnvironmentVariable('VITE_API_BASE_URL','Process')
try {
    $env:VITE_API_BASE_URL='http://localhost:18082'
    Push-Location (Split-Path $PSScriptRoot -Parent)
    try {
        & npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
        if ($LASTEXITCODE -ne 0) { throw "Vite failed with exit code $LASTEXITCODE." }
    } finally { Pop-Location }
} finally { [Environment]::SetEnvironmentVariable('VITE_API_BASE_URL',$oldApi,'Process') }
