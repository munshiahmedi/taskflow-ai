# TaskFlow AI

TaskFlow AI is a task and engagement management application. Managers and
administrators can manage engagements and tasks, assign work to active team
members, and review submitted work. The dashboard summarizes task status and
overdue counts for the signed-in user's permitted data scope.

**Live application:** [Frontend](https://taskflow-ai-frontend-mukm.onrender.com) ·
[Backend health](https://taskflow-ai-boto.onrender.com/api/health)

## Features

- JWT-based registration and login, with password hashing and active-account
  checks.
- Role-based access for `ADMIN`, `MANAGER`, and `TEAM_MEMBER`.
- Client, service type, and task template management through the backend API.
- One-time and recurring engagements that generate tasks from a template.
- Task creation, assignment, editing, deletion, and status workflow.
- Review comments when an administrator or manager requests changes.
- Task history entries for successful status transitions.
- Dashboard statistics filtered by role.
- A React interface for login, task creation and assignment, task updates, and
  dashboard statistics.
- Public registration for `TEAM_MEMBER` accounts, plus task search and status
  filtering in the task list.

## Technology and architecture

- **Client:** React, Vite, Axios.
- **Server:** Node.js, Express, `mysql2/promise`, JWT, bcrypt.
- **Database:** MySQL.

The client sends API requests through a shared Axios instance. It stores the
JWT in `sessionStorage` and attaches it as a bearer token. The Express
application mounts API routes below `/api`; route middleware authenticates
protected requests and enforces roles. Services perform database operations
through the MySQL promise pool.
Production frontend builds use
`https://taskflow-ai-boto.onrender.com/api`. During local development, Axios
sends requests to `/api` on the Vite origin, and Vite proxies them to
`VITE_API_BASE_URL` (default `http://localhost:5000/api`). This also supports
using the deployed API locally without browser CORS errors.

## Repository layout

```text
client/
  src/api/           Axios instance and API helpers
  src/components/    Authentication and task UI
  src/pages/         Authenticated task dashboard
  src/test/          Vitest setup
server/
  sql/schema.sql     MySQL tables, keys, and relationships
  src/config/        Database pool
  src/controllers/   HTTP request handlers
  src/middleware/    Authentication, role checks, rate limits, errors
  src/routes/        Express route definitions
  src/services/      Business rules and database operations
  tests/             Jest API and service tests
```

## Roles and permissions

| Role | Implemented permissions |
|---|---|
| `ADMIN` | Broad access to tasks, engagements, clients, service types, and task templates. Can create, update, and deactivate clients, service types, and templates; can create and assign tasks; can review tasks that are ready for review. |
| `MANAGER` | Can create engagements and tasks in engagements they created. Sees engagements and tasks in that scope and can assign tasks within it. Can read clients, service types, and templates but cannot modify those records. Can review ready-for-review tasks, but cannot review a task assigned to themselves. |
| `TEAM_MEMBER` | Can see tasks assigned to them and update them through the permitted work statuses. Cannot create, assign, edit, or delete tasks, manage reference data, or access other members' tasks. |

Task status transitions enforced by the service:

- Team members: `NOT_STARTED` → `IN_PROGRESS`; `IN_PROGRESS` →
  `WAITING_FOR_CLIENT` or `READY_FOR_REVIEW`; `WAITING_FOR_CLIENT` →
  `IN_PROGRESS`; `CHANGES_REQUESTED` → `IN_PROGRESS` or `READY_FOR_REVIEW`.
- Administrators and managers: `READY_FOR_REVIEW` → `COMPLETED` or
  `CHANGES_REQUESTED`. A non-blank comment is required for
  `CHANGES_REQUESTED`.

Public registration creates an active `TEAM_MEMBER` account and has no role
selection. An authenticated administrator can list users and assign roles.

## Authentication and task workflow

Registration validates the submitted name, email, and password, normalizes the
email, and stores only a bcrypt password hash. Login compares the submitted
password with that hash and returns a signed JWT with safe user fields. The
client keeps the token in `sessionStorage`, attaches it to Axios requests, and
checks the current identity through `/api/auth/me`; logout removes the local
session. Login and registration endpoints have per-IP rate limits.

Team members move assigned work through the permitted work statuses and
submit completed work for review. Managers and administrators can approve
ready-for-review tasks or request changes; a non-empty comment is required
when requesting changes. Successful status changes are recorded in
`task_history`.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (as required by the installed Vite
  8.x release) and npm.
- A running MySQL server.
- A MySQL account with access to the application database.

The repository includes separate `server` and `client` package manifests.
Install dependencies in each directory:

```powershell
cd server
npm ci

cd ..\client
npm ci
```

## MySQL database and schema

The server reads the database connection settings from environment variables.
Create a database whose name matches `DB_NAME`, for example:

```sql
CREATE DATABASE taskflow_ai;
```

The DDL is provided in [`server/sql/schema.sql`](server/sql/schema.sql). The
application does not create tables or seed data on startup. Apply this schema
to a newly created database using a trusted MySQL client before running the
API. After configuring `server/.env`, the project helper runs it with the
configured database settings:

```powershell
cd server
npm run db:schema
```

Only run this against a new, empty application database; it creates tables and
does not migrate or seed an existing database. It creates these tables:

- `users`
- `clients`
- `service_types`
- `task_templates`
- `task_template_items`
- `engagements`
- `tasks`
- `task_history`

`task_templates.service_type_id` references `service_types.id`;
`task_template_items.template_id` references `task_templates.id`;
`engagements` reference a client, service type, template, and creator;
`tasks` reference an engagement, optional template item and assignee, and
creator; `task_history` references a task and actor. User email and selected
template/engagement/task relationships have database uniqueness, lookup, and
foreign-key constraints defined in the schema.

There is no public Admin registration endpoint. To create the first Admin,
provide `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and
`INITIAL_ADMIN_PASSWORD` through a trusted environment/secret manager, then run
`npm run setup:initial-admin` from `server`. The command hashes the password,
uses a MySQL advisory lock to prevent concurrent setup, and refuses to run if
an Admin already exists. Clear the setup secrets after the command completes.
Subsequent Admin accounts can only be promoted by an authenticated Admin.

If an existing active Admin cannot log in, reset its password from an
interactive terminal in the `server` directory:

```powershell
npm run reset:admin-password -- taskflow.admin.test@example.com
```

Replace the example with the exact email stored for the Admin. The command
prompts twice without echoing the password, requires at least 12 characters
including uppercase and lowercase letters, a number, and a symbol, and updates
only the password hash for that active Admin. It cannot create an Admin or
change roles. Do not pass the password as an argument or put it in `.env`.

## Environment configuration

Create `server/.env` locally. The server startup loads this file with dotenv.
Replace placeholders with values for your own environment; do not commit real
credentials or signing secrets.

```dotenv
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=<mysql_user>
DB_PASSWORD=<mysql_password>
DB_NAME=taskflow_ai
DB_SSL=false
DB_SSL_CA=
JWT_SECRET=<long_random_secret>
JWT_EXPIRES_IN=1h
CORS_ORIGINS=http://localhost:5173
GROQ_API_KEY=<your_groq_api_key>
GROQ_MODEL=openai/gpt-oss-20b
```

`PORT` defaults to `5000`, `DB_PORT` to `3306`, and `JWT_EXPIRES_IN` to `1h`.
`DB_SSL=true` enables TLS certificate verification; `DB_SSL_CA` optionally
points to a CA file. `CORS_ORIGINS` is a comma-separated allowlist; by default
the deployed frontend is allowed, and local Vite origins are included outside
production. The database variables and `JWT_SECRET` must be configured for
normal operation. `GROQ_API_KEY` is required only for AI task-description generation.
`GROQ_MODEL` selects the Groq chat-completions model; the configured value is
`openai/gpt-oss-20b`. Check the model's availability and rate limits for your
Groq account before using it. Keep the API key on the server and never expose
it to the client.

For local client development, optionally create `client/.env` with
`VITE_API_BASE_URL=https://taskflow-ai-boto.onrender.com/api` to use the
deployed API, or set it to `http://localhost:5000/api` to use a local backend.
Vite reloads this setting when the development server starts. Production builds
continue to use the configured Render backend URL directly.

## Run locally

Start the backend from `server`:

```powershell
cd server
npm run dev
```

The development command runs `nodemon src/server.js`. To run without nodemon:

```powershell
npm start
```

Start the client in a separate terminal:

```powershell
cd client
npm run dev
```

Vite prints the local client URL in the terminal. The API listens on the
configured `PORT` (default `5000`).

## API summary

Except for registration, login, and health checks, the endpoints below require
a bearer JWT in the `Authorization` header. Protected routes also enforce the
role permissions listed above. All application routes are mounted under `/api`.

| Method | Endpoint | Access / purpose |
|---|---|---|
| `GET` | `/api/health` | Public API health check. |
| `GET` | `/api/health/db` | Database health check. |
| `POST` | `/api/auth/register` | Public registration; creates a team-member account. |
| `POST` | `/api/auth/login` | Public login; returns a JWT and safe user data. |
| `GET` | `/api/auth/me` | Authenticated user's current identity. |
| `GET` | `/api/auth/admin-test` | ADMIN-only authorization test endpoint. |
| `GET` | `/api/clients` | ADMIN and MANAGER; supports `search` and `active` query filters. |
| `GET` | `/api/clients/:id` | ADMIN and MANAGER. |
| `POST` | `/api/clients` | ADMIN. |
| `PUT` | `/api/clients/:id` | ADMIN. |
| `PATCH` | `/api/clients/:id/status` | ADMIN. |
| `GET` | `/api/service-types` | ADMIN and MANAGER; supports `search` and `active` filters. |
| `GET` | `/api/service-types/:id` | ADMIN and MANAGER. |
| `POST` | `/api/service-types` | ADMIN. |
| `PUT` | `/api/service-types/:id` | ADMIN. |
| `PATCH` | `/api/service-types/:id/status` | ADMIN. |
| `GET` | `/api/task-templates` | ADMIN and MANAGER; supports `service_type_id` and `active` filters. |
| `GET` | `/api/task-templates/:id` | ADMIN and MANAGER. |
| `POST` | `/api/task-templates` | ADMIN. |
| `PUT` | `/api/task-templates/:id` | ADMIN. |
| `PATCH` | `/api/task-templates/:id/status` | ADMIN. |
| `GET` | `/api/engagements` | ADMIN and MANAGER; managers see engagements they created. |
| `POST` | `/api/engagements` | ADMIN and MANAGER; creates an engagement and generates its template tasks. |
| `GET` | `/api/tasks` | ADMIN, MANAGER, and TEAM_MEMBER; results are scoped by role. |
| `POST` | `/api/tasks` | ADMIN and MANAGER. |
| `GET` | `/api/tasks/:id` | ADMIN, MANAGER, and the assigned TEAM_MEMBER, subject to scope checks. |
| `PATCH` | `/api/tasks/:id` | ADMIN and MANAGER, subject to task scope checks. |
| `DELETE` | `/api/tasks/:id` | ADMIN and MANAGER, subject to task scope checks. |
| `PATCH` | `/api/tasks/:id/assign` | ADMIN and MANAGER; target must be an active TEAM_MEMBER. |
| `PATCH` | `/api/tasks/:id/status` | All three roles, with allowed transitions enforced by the task service. |
| `POST` | `/api/tasks/generate-description` | ADMIN and MANAGER; accepts a task `title` and optional non-sensitive `context`, returns generated text without saving a task. |
| `GET` | `/api/dashboard` | All three roles; returns statistics for the caller's permitted task scope. |
| `GET` | `/api/users/team-members` | ADMIN and MANAGER; lists active team members with safe fields. |
| `GET` | `/api/users` | ADMIN; lists safe user profiles and roles. |
| `POST` | `/api/users` | ADMIN; creates MANAGER or TEAM_MEMBER accounts with a bcrypt-hashed password. |
| `PUT` | `/api/users/:id` | ADMIN; updates a user's name and email. |
| `PATCH` | `/api/users/:id/role` | ADMIN; assigns a valid role; cannot remove the last active Admin. |
| `PATCH` | `/api/users/:id/status` | ADMIN; activates/deactivates a user, refusing to deactivate the last active Admin. |

## Tests and quality checks

Run backend tests from the server directory:

```powershell
cd server
npm test
```

The configured command is Jest with `--runInBand`.

Run frontend component tests, lint, and production build from the client
directory:

```powershell
cd client
npm test
npm run lint
npm run build
```

GitHub Actions runs backend tests and the frontend test, lint, and build
commands on pushes to `main` and pull requests.

## Screenshots and demo

Add current screenshots to `docs/screenshots/` and link them here:

- Registration and sign-in
- Manager dashboard with task assignment and filters
- Team-member dashboard and task status workflow
- Mobile-width dashboard

**Demo video:** [Add a short walkthrough link here](#).

## Portfolio summary

**Project description:** TaskFlow AI is a full-stack task and engagement
management app with role-aware work queues, task assignment and review,
status-history tracking, and dashboard statistics. It pairs a React/Vite
client with an Express API and MySQL persistence, using JWT sessions,
bcrypt password hashing, and server-side authorization.

**Stack:** React, Vite, Axios, Node.js, Express, MySQL, JWT, bcrypt, Jest,
Vitest, and Testing Library.

**Demo recording checklist:**

1. Show registration, then sign in as a team member.
2. Show the scoped dashboard and search/status filters.
3. Demonstrate a permitted task status change and its history.
4. Sign in as a manager to show assignment and review actions.
5. Show a blocked/unauthorized action or API response without exposing
   credentials or private data.
6. Capture desktop and narrow/mobile layouts; use seeded demo data only.

**LinkedIn project description:** Built TaskFlow AI, a full-stack React and
Node.js application for role-based task and engagement management. Implemented
JWT authentication, bcrypt password hashing, MySQL-backed APIs, scoped
permissions for admins/managers/team members, task assignment and review
workflows, and dashboards with task search and filtering.

## Known limitations

- Database schema creation and seed data are not included; local setup requires
  a separately managed schema.
- The client currently provides login and task/dashboard workflows, not
  management screens for clients, service types, templates, or engagements;
  those operations are exposed through the backend API.
- Task editing and deletion are exposed by the API but do not have corresponding
  client controls. The app does not yet include a user/role administration
  screen.
- AI task-description generation is available through the backend API but is
  not yet integrated into the React task form. The endpoint sends the supplied
  title and optional context to Groq; do not include confidential client
  information or other sensitive data in either field. Generated text is
  returned for review and is not saved until a separate task-creation request
  is made.
- Public registration is available from the sign-in screen and creates a
  `TEAM_MEMBER` account; new users sign in after registration.
- Password reset, email verification, and token refresh endpoints are not
  implemented in the current API routes.
- The frontend API URL for production is currently set in the Axios
  configuration rather than injected through a Render build variable.
- JWT role and account claims are used until the token expires; an account or
  role change does not revoke already-issued tokens immediately.
- Automated responsive checks and a current demo recording have not been
  added to the repository.
