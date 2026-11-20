# Frontend development handover — 20 November 2026

Backend candidate source `43a2fffad2bc48aed9fe398405ffbef16532a994` and frontend source `9a82c721fcf96665f68a940703fdc9beb7850b18` were tested in isolation. The production deployment identity is not verified by this handover. See the backend repository document with the same name for the complete pending-task and security list.

Keep HR-only confidentiality, the five Responsible Departments, separate Reporter Department, protected assignment and membership administration, reporter-only closure, history, evidence and reporting. HR referrals are deferred in the initial release; do not activate automated mail. A locally tested generic login error provides administrator-contact guidance but is not deployed. Google Directory integration, protected onboarding, HR assignment and lifecycle, priority audit, approved SLA policy, empty Excel exports and historical incident visibility remain pending.

Use Node 24.21.0 and npm 11.19.0 with `npm ci`, `npm test`, and `npm run build`. Set a synthetic `VITE_API_BASE_URL` and feature flags deliberately. Never use production credentials or real incident data in home development. For genuine local Google login, use a separately approved non-production OAuth client and test users; callback `http://localhost:18082/login/oauth2/code/google`. No real Google OAuth acceptance or production recovery has been established. See the backend handover for synthetic database and protected grant instructions.

The candidate production-origin frontend was built with department administration, membership, assignment and HR Workspace enabled; HR referrals and broad employee management disabled. Other live flag values and Nginx compatibility remain unverified. The local candidate archive is not a deployment approval.

The shareable handover branch is a sanitized source snapshot based on remote main; older unpushed office commit ancestry is not transferred. Test-only company addresses were replaced with synthetic addresses. Original office branches remain local.

The separate branch codex/office-uat-2026-11-20 preserves a sanitized, unfinished UAT worktree. It is not merged into this release snapshot and has not been tested as an integrated release. The original worktree remains intact.
