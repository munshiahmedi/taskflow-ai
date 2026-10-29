# TaskFlow AI

TaskFlow AI is a task and engagement management application. Managers and
administrators can manage engagements and tasks, assign work to active team
members, and review submitted work. The dashboard summarizes task status and
overdue counts for the signed-in user's permitted data scope.

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

## Technology and architecture

- **Client:** React, Vite, Axios.
- **Server:** Node.js, Express, `mysql2/promise`, JWT, bcrypt.
- **Database:** MySQL.

The client sends API requests through a shared Axios instance. It stores the
JWT in `sessionStorage` and attaches it as a bearer token. The Express
application mounts API routes below `/api`; route middleware authenticates
protected requests and enforces roles. Services perform database operations
through the MySQL promise pool.

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

Public registration creates an active `TEAM_MEMBER` account. It does not allow
the caller to select an administrative role.

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

**Schema setup is not automated in this repository.** No SQL schema, migration,
or schema-creation script is included, and the application does not create its
tables on startup. Before running the API, apply the project's compatible
MySQL schema using your database administration process. The application code
uses these tables:

- `users`
- `clients`
- `service_types`
- `task_templates`
- `task_template_items`
- `engagements`
- `tasks`
- `task_history`

The schema must include the columns and relationships used by the server
queries, including user roles and account activity, task assignment/status,
engagement ownership, and template items. The exact DDL, indexes, constraints,
and seed data need to be supplied or confirmed separately; they cannot be
derived safely from this repository alone.

The API has no general seed command or public ADMIN-creation flow. Public
registration assigns `TEAM_MEMBER`; provision any initial administrator
account through a trusted, secure database administration procedure.

## Environment configuration

Create `server/.env` locally. The server startup loads this file with dotenv.
Replace placeholders with values for your own environment; do not commit real
credentials or signing secrets.

```dotenv
PORT=5000
DB_HOST=localhost
DB_USER=<mysql_user>
DB_PASSWORD=<mysql_password>
DB_NAME=taskflow_ai
JWT_SECRET=<long_random_secret>
JWT_EXPIRES_IN=1h
GROQ_API_KEY=<your_groq_api_key>
GROQ_MODEL=openai/gpt-oss-20b
```

`PORT` defaults to `5000` if omitted. `JWT_EXPIRES_IN` is optional and defaults
to `1h`. The database variables and `JWT_SECRET` must be configured for normal
operation. `GROQ_API_KEY` is required only for AI task-description generation.
`GROQ_MODEL` selects the Groq chat-completions model; the configured value is
`openai/gpt-oss-20b`. Check the model's availability and rate limits for your
Groq account before using it. Keep the API key on the server and never expose
it to the client.

The client currently has no API URL environment variable. Its Axios instance
uses the fixed base URL `http://localhost:5000/api`; run the backend on that
address for the current client configuration.

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

## Tests and quality checks

Run backend tests from the server directory:

```powershell
cd server
npm test
```

The configured command is Jest with `--runInBand`.

Run client lint and production build from the client directory:

```powershell
cd client
npm run lint
npm run build
```

There is no frontend automated test command configured in `client/package.json`.

## Known limitations

- Database schema creation and seed data are not included; local setup requires
  a separately managed schema.
- The client currently provides login and task/dashboard workflows, not
  management screens for clients, service types, templates, or engagements;
  those operations are exposed through the backend API.
- AI task-description generation is available through the backend API but is
  not yet integrated into the React task form. The endpoint sends the supplied
  title and optional context to Groq; do not include confidential client
  information or other sensitive data in either field. Generated text is
  returned for review and is not saved until a separate task-creation request
  is made.
- There is no client registration screen, although the registration API route
  exists.
- Password reset, email verification, and token refresh endpoints are not
  implemented in the current API routes.
- The frontend API base URL is hard-coded to the local backend address.
- Automated frontend component tests are not configured.
