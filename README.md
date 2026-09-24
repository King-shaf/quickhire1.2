<<<<<<< HEAD
# QuickHire - AI-Powered Candidate Ranking Platform

QuickHire is an end-to-end recruitment platform that ingests CVs via OCR/NLP, stores structured candidate data, and uses semantic (pgvector) + skill-based ranking to match candidates to job descriptions. Includes an AI chatbot, full audit trail, multi-company tenancy, and Supabase Auth integration.

---

## 🛠 Prerequisites

| Tool             | Version  | Install                                                      |
| ---------------- | -------- | ------------------------------------------------------------ |
| **Python**       | 3.10+    | https://www.python.org/downloads/                           |
| **Node.js & npm**| 18+      | https://nodejs.org/                                         |
| **Redis**        | 6+       | Required for CV analysis workers. For Windows: [tporadowski/redis](https://github.com/tporadowski/redis/releases) |
| **Supabase**     | (Cloud)  | (Optional) The Django backend runs fully on SQLite for local demo-mode. Supabase SQL migrations live in `database/migrations/`. |

---

## 🔑 API Keys Configuration

Before running the application, you need to configure your API keys. Look for specific placeholders in the codebase where applicable (e.g. `'your-gemini-api-key-here'`).

### 1. Setting up Environment Variables (Recommended)
The best way to configure your API keys is by using `.env` files.

**Backend (`backend/.env`):**
Create or edit `backend/.env` and add your Gemini API key:
```
GEMINI_API_KEY=your-actual-gemini-api-key
```

**Frontend (`frontend/.env`):**
If you are using Supabase Auth, edit `frontend/.env` to include your Supabase keys:
```
REACT_APP_SUPABASE_ANON_KEY=your-actual-supabase-anon-key
VITE_SUPABASE_ANON_KEY=your-actual-supabase-anon-key
```

### 2. Replacing Placeholders in Code (Optional Fallbacks)
If environment variables are not loaded properly, you can replace the placeholders directly in the code:
- **Frontend Supabase Key:** Search for `'your-supabase-anon-key-here'` in `frontend/test-supabase.js`
- **Frontend Gemini Key:** Search for `'your-gemini-api-key-here'` in `frontend/src/services/supabaseService.js` and `frontend/src/services/chatbotService.js`

---

## 🚀 Step-by-Step Execution (PowerShell / VS Code)

### 0. Enable Script Execution (once per shell)
If you see *"running scripts is disabled on this system"*:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

---

### 1. Backend (Django REST API + SQLite, Terminal 1)

```powershell
cd backend

# --- Create + activate venv (first time only)
python -m venv venv
.\venv\Scripts\Activate.ps1

# --- Install dependencies (first time only)
pip install -r requirements.txt

# --- Run DB migrations
python manage.py migrate

# --- Seed demo data (first time only, or after DB reset)
python seed_demo.py

# --- Start Django dev server
python manage.py runserver 8000
```

Backend is live at **http://localhost:8000**
- Django REST API root: http://localhost:8000/api/
- Django Admin:        http://localhost:8000/admin/

> **Unlocking accounts (if you ever lock yourself out):**
> ```powershell
> cd backend
> .\venv\Scripts\Activate.ps1
> python manage.py unlock_user --list-locked          # see all locked users
> python manage.py unlock_user admin@quickhire.ai     # unlock a single user by email / username / UUID
> python manage.py unlock_user --all                   # unlock every user
> ```
> (Admin users can also call `POST /api/auth/unlock/<user_id>/` via the API.)

---

### 2. Frontend (React, Terminal 2)

```powershell
cd frontend

# --- Install dependencies (first time only)
npm install

# --- Start Vite / React dev server
npm start
```

Frontend is live at **http://localhost:3000**

---

### 2.5 🔁 Dual Authentication Modes (Frontend)

The frontend **automatically selects the auth backend** based on your environment variables — you never need to edit source code.

| Mode | Env variable | Backend | Best for |
| ---- | ------------ | ------- | -------- |
| **DJANGO (default)** | `REACT_APP_USE_SUPABASE_AUTH=false` *(default)* or unset | Local Django JWT (SQLite demo DB on port 8000) | Local demoing with the 5 seeded accounts from `seed_demo.py` |
| **SUPABASE** | `REACT_APP_USE_SUPABASE_AUTH=true` | Supabase Auth + RLS against a real Supabase Postgres instance | Production / shared team deployments |

Create `frontend/.env` (optional — defaults below are ready for local demo):
```
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_USE_SUPABASE_AUTH=false
# REACT_APP_SUPABASE_URL=      # (only needed in Supabase mode)
# REACT_APP_SUPABASE_ANON_KEY= # (only needed in Supabase mode)
```

**How the Login page selects auth mode (visible in the Login page left-panel badge):**
- **DJANGO mode**: Calls `POST http://localhost:8000/api/auth/login/` with email **or** username + password; returns JWT `access` / `refresh` tokens + a user object. All 5 seeded demo accounts work out of the box.
- **SUPABASE mode**: Imports `supabaseClient.js` lazily and calls `signInWithPassword({ email, password })`; afterwards reads the profile from `public.users` via `from('users').select('*').eq(id, uid)`.

---

### 3. AI Task Worker (Celery, Terminal 3 — optional for CV OCR/NLP)

```powershell
cd backend
.\venv\Scripts\Activate.ps1

# On Windows, Celery requires the solo/threads pool:
celery -A quickhire worker --loglevel=info -P solo
```

> Without Redis/Celery running, CVs still upload but the OCR/NLP embedding pipeline is skipped (`CELERY_TASK_ALWAYS_EAGER=True` in `settings.py` runs tasks synchronously for local dev).

---

## 🔑 Demo Login Credentials

**Password for ALL demo accounts:** `QuickHire@2026`

| Role        | Username          | Email                      | Company (Tenant)         | Access                                                              |
| ----------- | ----------------- | -------------------------- | ------------------------ | ------------------------------------------------------------------- |
| **admin**   | `admin`           | `admin@quickhire.ai`       | — (cross-tenant)         | Django Admin, system config, audit logs, all companies/users       |
| recruiter   | `sarah_recruiter` | `sarah@acme.corp`          | ACME Corporation (Tech)  | Upload CVs, create jobs, view ACME rankings & chatbot              |
| recruiter   | `mike_recruiter`  | `mike@acme.corp`           | ACME Corporation (Tech)  | Same as Sarah — great for testing shared-tenant visibility         |
| **company** | `linda_company`   | `linda.hr@globex.com`      | Globex Industries (Fin)  | Company-level dashboard + Globex jobs/candidates                   |
| recruiter   | `david_recruiter` | `david.talent@initech.io`  | Initech Solutions (Hlth) | Healthcare tenant — test RLS isolation from ACME/Globex            |

Try signing in as `sarah_recruiter` → upload a CV → create a job → view the ranked candidate list. Then sign in as `admin` to see cross-tenant reporting and user management.

> **🚨 Clearing the "Account temporarily locked (300s)" message shown on the Login page:**
> The React frontend maintains its **own** browser-side lockout counter in `localStorage` under the key `qh_login_attempts` (5 wrong guesses = 5 minute cool-down). To reset it **immediately**:
> 1. Open the Login page
> 2. Click the **Reset attempts (N/5)** button that appears to the right of "Remember me" after any failed login, **OR**
> 3. In Chrome DevTools (F12) → Application → Local Storage → `http://localhost:3000` → delete the key `qh_login_attempts`.

**Back-end lockout** (separate counter in Django SQLite, kicks in after 5 failed API logins):
```powershell
cd backend ; python manage.py unlock_user --all
```

---

## 🧱 Demo Data Snapshot (seeded via `seed_demo.py`)

| Tenant              | Recruiters | Candidates | Jobs                                        | Ranking Results |
| ------------------- | ---------- | ---------- | ------------------------------------------- | --------------- |
| ACME Corporation    | 2          | 4          | Senior Backend Python, Frontend React, ML Engineer | 6              |
| Globex Industries   | 1          | 2          | Senior Java Fintech, Full Stack Engineer    | 3               |
| Initech Solutions   | 1          | 2          | Healthcare Data Engineer                    | 3               |
| *(Cross-tenant)*    | 1 admin    | 8 total    | 6 total                                     | 12 total        |

---

## 🗄 Database & Schema

### Local Dev (default)
- SQLite: `backend/db.sqlite3` (auto-created by `migrate`)

### Production / Supabase (PostgreSQL + pgvector)
1. Create a Supabase project.
2. In the **SQL Editor**, run the files in `database/migrations/` **in order**:
   - `002_fix_schema_cache_and_company_id.sql`  ← consolidated, idempotent full schema
3. Update `backend/.env` to point Django at Supabase Postgres:
   ```
   DATABASE_URL=postgres://user:pass@host:port/dbname
   ```
4. Update `frontend/.env` with your Supabase URL & anon key:
   ```
   REACT_APP_SUPABASE_URL=...
   REACT_APP_SUPABASE_ANON_KEY=...
   ```

### Key Schema Fix (from the original issue)
The Supabase PostgREST error **"Could not find the 'company_id' column of 'users' in the schema cache"** is caused by:
1. `company_id` missing from the table or the auto-created user-profile trigger
2. A stale PostgREST schema cache

The consolidated migration `002_fix_schema_cache_and_company_id.sql` fixes both:
- Ensures `company_id` exists on `users`, `candidates`, `job_descriptions`
- Rewrites `public.handle_new_user()` to pull `company_id`, `first_name`, `last_name` from `raw_user_meta_data`
- Fires `NOTIFY pgrst, 'reload schema'` at the top AND bottom of the script

---

## 💡 Troubleshooting

| Error                                               | Fix                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| *"Execution_Policies"*                              | `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process`                               |
| *"Couldn't import Django"*                          | Activate venv, or run: `.\venv\Scripts\python.exe manage.py runserver 8000`                      |
| *"column not in schema cache"* (Supabase)           | Run `NOTIFY pgrst, 'reload schema'` in Supabase SQL editor (or restart pooler)                   |
| CV OCR/NLP pipeline never runs                      | Ensure Redis runs (`redis-cli ping` → `PONG`) and Celery worker is started (step 3 above)        |
| M2M-through migration error on `Candidate.skills`   | Use the fresh `0001_initial.py` generated after deleting old migrations — never alter M2M through in a follow-up migration |

---

## 📁 Project Structure

```
quickhire/
├── backend/
│   ├── models/              # DB models: Company, User, Candidate, JobDescription, Ranking, Skill, AuditLog, ...
│   ├── api/                 # Django REST Framework views + serializers
│   ├── authentication/      # JWT auth endpoints
│   ├── ai/                  # OCR, NLP, embeddings (pgvector), ranking engine
│   ├── chatbot/             # LLM chatbot actions
│   ├── tasks/               # Celery async tasks (CV processing pipeline)
│   ├── quickhire/           # Django settings, urls, Celery app
│   ├── seed_demo.py         # Run this to bootstrap demo logins + data
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── services/        # supabaseService.js, supabaseClient.js, api.js
│   │   ├── pages/           # Login, Dashboard, Upload CV, Ranking, Admin, Chatbot, ...
│   │   ├── components/      # Sidebars, Navbars, Widgets
│   │   └── context/         # UserContext (auth state)
│   └── package.json
└── database/
    └── migrations/          # Supabase SQL migrations (run in SQL Editor)
```

---

## 🔒 Security & RLS Notes

- **Row Level Security**: The Supabase SQL migration enables RLS on every public table and ships tenant-scoped policies. Users only see candidates/jobs in their `company_id` (or everything for `admin`).
- **Sessions**: Django session timeout = 30 minutes; JWT access tokens = 60 minutes; refresh tokens = 1 day.
- **Passwords**: Demo accounts use `QuickHire@2026` — change these (or re-run `seed_demo.py`) before exposing the app to a network.
=======
# quickhire1.2
the updated version of quickhire
>>>>>>> c36912e1351b78a5068ab85b17ed1e903b3ecb51
