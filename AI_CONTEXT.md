# AI_CONTEXT.md - Splitwise Clone

**Last Updated**: June 6, 2026  
**Project**: Splitwise-style expense splitting app  
**Status**: Functional local app, prepared for Render + Vercel deployment

---

## Product Goal

Build a minimal but functional expense-splitting app where registered users can:

- Create groups with other registered users
- Add expenses with multiple payers and borrower splits
- See balances and settlement recommendations
- Submit proof after paying a settlement
- Approve or deny incoming payment proofs
- Chat inside groups
- Delete groups only after all payments are settled

---

## Tech Stack

- **Frontend**: React 18, Axios
- **Backend**: Node.js, Express
- **Database**: Supabase PostgreSQL
- **Auth**: Email/password with JWT stored in `localStorage`
- **Deployment Target**:
  - Backend: Render
  - Frontend: Vercel or Netlify
  - Database: Supabase

---

## Current App Behavior

### Authentication

- Users can register with email, password, and optional name.
- Users can login and receive a JWT.
- JWT and user data are saved in `localStorage`.
- On `Ctrl+R` / browser refresh, `App.jsx` restores the saved user and keeps the user logged in.
- Logout clears `token`, `user`, and returns to login.

### Groups

- Users can create groups.
- Minimum group size is **2 people total**: creator + 1 registered member email.
- Member emails must already belong to registered users.
- Group cards show member previews.
- Group detail page shows members and supports adding more registered members.
- Only the group creator can delete a group.
- A group cannot be deleted if there is any pending/unsettled balance.
- Approved settlement proofs count as paid when deciding whether deletion is allowed.

### Expenses

- Expense creation supports **multiple payers**.
- Every member appears in the payer list with default amount `0`.
- Borrowers are split equally by default across all group members.
- Custom split mode allows manual borrower amounts.
- Total paid must match total borrowed.
- Backend validates paid/borrowed totals before saving.
- Group expense view shows:
  - Group members
  - Current balances
  - Settle-up recommendations
  - Expense history

### Balances And Settlements

- Balance formula:
  - `net = amount_paid - amount_owed + approved_settlement_payments`
- Positive balance means the user should receive money.
- Negative balance means the user should pay money.
- Settlement recommendations minimize payments by matching debtors to creditors.
- Dashboard shows settlements involving the current user:
  - What the user has to pay
  - What others have to pay the user

### Settlement Proof Workflow

- If a user owes someone, dashboard shows an `Add Proof` option.
- Proof can be transaction ID, note, or link text.
- Proof is sent to the receiver.
- Receiver sees `Approve` and `Deny` buttons.
- If approved:
  - Payment counts as settled.
  - Dashboard settlement amount updates.
  - Group balances and settle-up view update.
  - Delete-group guard treats the approved amount as paid.
- If denied:
  - Denied status is shown.
  - Payer can submit updated proof.
- Pending proofs show pending status until reviewed.

### Group Chat

- Each group has a group chat section.
- Members can send messages.
- Messages are saved in `group_messages`.
- Chat polls every 5 seconds.

### Refresh / Sync Behavior

This app currently uses polling, not true real-time sockets.

- Dashboard groups and settlements refresh every 7 seconds.
- Group chat refreshes every 5 seconds.
- Group approved settlement proofs refresh every 6 seconds.
- Selected group is preserved in `localStorage` using `selectedGroupId`, so polling or browser refresh should not kick the user out of the group view.

For true simultaneous updates, Supabase Realtime subscriptions would be the next improvement.

---

## Database Schema

Defined in `schema.sql`.

Tables:

- `users`
- `groups`
- `group_members`
- `expenses`
- `expense_payers`
- `expense_splits`
- `group_messages`
- `settlement_proofs`

Important:

- Run the full `schema.sql` in Supabase SQL Editor.
- If chat fails with `Could not find table public.group_messages`, the SQL has not been applied.
- If proof workflow fails with missing `settlement_proofs`, run the latest schema.

---

## Backend

### Directory

```text
backend/
  server.js
  config/supabase.js
  middleware/auth.js
  routes/auth.js
  routes/groups.js
  routes/expenses.js
  routes/settlements.js
```

### Main Endpoints

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`

Groups:

- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/:groupId`
- `DELETE /api/groups/:groupId`
- `POST /api/groups/:groupId/members`
- `GET /api/groups/:groupId/messages`
- `POST /api/groups/:groupId/messages`

Expenses:

- `GET /api/expenses/group/:groupId`
- `POST /api/expenses`

Settlements:

- `GET /api/settlements`
- `GET /api/settlements/group/:groupId/proofs`
- `POST /api/settlements/proofs`
- `PATCH /api/settlements/proofs/:proofId`

### Backend Environment Variables

Use `backend/.env.example`.

Required:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
FRONTEND_URL=
NODE_ENV=production
```

Optional multi-origin CORS:

```text
FRONTEND_URLS=https://app.vercel.app,https://custom-domain.com
```

Do not include trailing slash or `/api` in `FRONTEND_URL`.

---

## Frontend

### Directory

```text
frontend/
  src/App.jsx
  src/components/Login.jsx
  src/components/Register.jsx
  src/components/Dashboard.jsx
  src/components/Expenses.jsx
  src/components/GroupChat.jsx
  src/styles/Auth.css
  src/styles/Dashboard.css
  src/styles/Expenses.css
  src/styles/GroupChat.css
```

### Frontend Environment Variable

Use `frontend/.env.example`.

Required:

```text
REACT_APP_API_URL=https://splitter-1-mr2p.onrender.com/api
```

For local dev:

```text
REACT_APP_API_URL=http://localhost:5000/api
```

React env variables are baked at build time, so after changing Vercel env vars, redeploy the frontend.

---

Recommended flow:

1. Push repo to GitHub.
2. Run `schema.sql` in Supabase.
3. Deploy backend on Render from `backend`.
4. Set backend env vars on Render.
5. Deploy frontend on Vercel from `frontend`.
6. Set `REACT_APP_API_URL` in Vercel.
7. Set `FRONTEND_URL` or `FRONTEND_URLS` in Render.
8. Redeploy both services.

Common CORS fix:

- Render `FRONTEND_URL` must exactly match the browser origin.
- Example: `https://splitter.vercel.app`
- Not: `https://splitter.vercel.app/`
- Not: `https://splitter.vercel.app/api`

---

## Known Limitations / Future Improvements

- Updates are polling-based, not true real-time.
- Supabase Realtime should be added for instant chat/settlement/expense updates.
- Proof upload is currently text/link/transaction note, not file upload.
- No email notifications.
- No edit/delete expense flow yet.
- No formal test suite yet.
- CORS depends on correct Render `FRONTEND_URL` / `FRONTEND_URLS`.

---

## Verification Commands

Frontend:

```powershell
cd frontend
npm.cmd run build
```

Backend syntax checks:

```powershell
node --check backend\server.js
node --check backend\routes\groups.js
node --check backend\routes\expenses.js
node --check backend\routes\settlements.js
```

Local run:

```powershell
cd backend
npm.cmd start
```

```powershell
cd frontend
npm.cmd start
```
