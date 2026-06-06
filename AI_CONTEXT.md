# AI_CONTEXT.md - Splitwise 3-Day Build

**Last Updated**: June 5, 2026  
**Project**: Splitwise Clone - 3-day internship assignment

---

## PRODUCT GOALS

- **Vision**: Build a minimal but functional expense-splitting app where friends can log expenses and see who owes whom.
- **Scope**: 3-day build targeting core workflows only.
- **Success Metric**: Users can register, login, join groups, add expenses, and see balances/settlements.

---

## TECHNOLOGY STACK

- **Frontend**: React (JavaScript)
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Email/password (register → login flow)
- **Deployment**: Localhost (for now)
- **Auth Flow**: 
  - User registers with email/password
  - User logs in, receives auth token
  - Frontend authenticated endpoints fetch user's groups/expenses on dashboard
  - Auth token included in all subsequent API calls

---

## MVP FEATURES (In Scope)

- [ ] User registration (email/password)
- [ ] User login
- [ ] Dashboard (loads after login)
- [ ] View user's groups
- [ ] View group expenses
- [ ] View balances within groups
- [ ] Add expense to group
- [ ] Calculate who owes whom

---

## OUT OF SCOPE (3-day constraint)

- Email/SMS notifications
- Multiple currencies
- Recurring expenses
- Payments integration
- Mobile app
- Analytics/reports
- User profile management (beyond email)
- Recurring expenses
- Email verification

---

## DATA MODEL - CORE ENTITIES

### Users
- `id` (UUID, primary key)
- `email` (string, unique)
- `password_hash` (string)
- `name` (string, optional)
- `created_at` (timestamp)

### Groups
- `id` (UUID, primary key)
- `name` (string)
- `created_by` (UUID, FK to Users)
- `created_at` (timestamp)

### GroupMembers (join table)
- `id` (UUID, primary key)
- `group_id` (UUID, FK to Groups)
- `user_id` (UUID, FK to Users)
- `joined_at` (timestamp)

### Expenses
- `id` (UUID, primary key)
- `group_id` (UUID, FK to Groups)
- `description` (string)
- `total_amount` (decimal)
- `created_at` (timestamp)

### ExpensePayers (tracks who paid)
- `id` (UUID, primary key)
- `expense_id` (UUID, FK to Expenses)
- `user_id` (UUID, FK to Users) - who paid
- `amount_paid` (decimal)

### ExpenseSplits (tracks who owes)
- `id` (UUID, primary key)
- `expense_id` (UUID, FK to Expenses)
- `user_id` (UUID, FK to Users) - who owes
- `amount_owed` (decimal)

---

## AUTHENTICATION FLOW

1. User visits `/register`
2. Enters email + password → backend creates user in `users` table
3. Password hashed before storage
4. User redirected to `/login`
5. User enters email + password → backend verifies, returns JWT token
6. Frontend stores token (localStorage)
7. Frontend redirects to `/dashboard`
8. Dashboard fetches user's groups with authenticated header
9. All API calls include Authorization header with token

---

## GROUP & EXPENSE LOGIC (DECIDED)

### Group Membership
- Users start with **NO groups** when they register
- Users can **CREATE new groups** or be **ADDED to existing groups**
- Minimum group size: **3 people**

### Expense Splits
- **Default**: Split equally among group members
- **Customizable**: Individual amounts can be altered per person
- Example: $100 expense → default is $33.33 each → can change to $20, $30, $50 if needed

### Multiple Payers (CASE 2 - App Handles Net Settlement)
- **Single expense** = multiple payers + multiple owers
- Example: Dinner $100 for 4 people (Alice, Bob, Charlie, David)
  - At restaurant: Alice pays $40, Bob pays $60
  - App splits $25 to each of 4 people
  - Net calculation:
    - Alice paid $40, owes $25 → Alice is owed $15
    - Bob paid $60, owes $25 → Bob is owed $35
    - Charlie owes $25 → Charlie owes $25
    - David owes $25 → David owes $25
  - Final settlements: Charlie pays Alice $15, David pays Alice $10 + Bob $15, etc.

### Data Model Impact
- **ExpensePayers** (new table): tracks who paid and how much
  - `expense_id`, `user_id`, `amount_paid`
- **ExpenseSplits**: tracks who owes and how much
  - `expense_id`, `user_id`, `amount_owed`

### Dashboard Layout
- **Section 1**: User's Groups (list all groups user is member of, showing group name + balance)
- **Section 2**: Pending Settlements (list of unsettled debts showing whether it's a group-level settlement or individual settlement)

---

## BUILD PLAN (Finalized)

### Phase 1: Project Setup & Authentication ✅ IN PROGRESS
1. Initialize project structure (backend + frontend) ✅
2. Set up Supabase connection + schema (NEXT)
3. Build backend: auth endpoints (register, login, token verification) ✅ 
4. Build frontend: login/register pages, dashboard skeleton ✅
5. Connect frontend to backend auth (NEXT)

### Phase 2: Groups & Expenses
6. Build groups endpoints + UI
7. Build expenses endpoints + UI
8. Implement balance calculation logic

### Phase 3: Testing & Deployment
9. Test full flow locally
10. Prepare deployment

---

## BACKEND ARCHITECTURE

**Tech**: Node.js + Express  
**Auth**: JWT tokens (7-day expiry)  
**Password**: bcrypt hashing

### Directory Structure
```
backend/
├── server.js (main entry point)
├── package.json
├── .env.example
├── config/
│   └── supabase.js (Supabase client)
├── middleware/
│   └── auth.js (JWT verification)
└── routes/
    ├── auth.js (register, login)
    ├── groups.js (create, get groups)
    └── expenses.js (add, get expenses)
```

### API Endpoints
- `POST /api/auth/register` - Create user account
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/groups` - Get user's groups (auth required)
- `POST /api/groups` - Create new group (auth required)
- `GET /api/expenses/group/:groupId` - Get expenses (auth required)
- `POST /api/expenses` - Add expense (auth required)

---

## FRONTEND ARCHITECTURE

**Tech**: React 18 + React Router + Axios

### Directory Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── Dashboard.jsx
│   ├── styles/
│   │   ├── Auth.css
│   │   └── Dashboard.css
│   ├── App.jsx
│   ├── index.js
│   └── index.css
├── public/
│   └── index.html
└── package.json
```

### Auth Flow
1. User visits app (defaults to login)
2. User can register or login
3. On success, token stored in localStorage
4. Redirected to Dashboard
5. Dashboard fetches groups with Authorization header
6. User can logout (clears token & localStorage)

---

## NEXT STEPS - SUPABASE SETUP

You must:
1. Create Supabase project (free tier at supabase.com)
2. Run SQL migrations to create tables
3. Copy credentials to backend/.env
4. Install dependencies and test

---

## BUILD STATUS (JUNE 6, 2026 - FINAL UPDATE)

### ✅ COMPLETED  
- [x] Initialize project structure (backend + frontend)
- [x] Set up Supabase connection + schema  
- [x] Build backend: auth endpoints (register, login, JWT)
- [x] Build frontend: login/register pages, dashboard
- [x] Connect frontend to backend auth - **WORKING**
- [x] Both servers running locally on ports 5000 (backend) & 3000 (frontend)
- [x] End-to-end auth flow tested - **USER REGISTRATION & LOGIN WORKING**
- [x] Group creation backend endpoints (POST, GET list, GET specific)
- [x] Group management UI with group creation form
- [x] Group detail view with navigation
- [x] Expense form UI with **Case 2 logic** implemented:
  - [x] "Who Paid?" section (multiple payers)
  - [x] "How to Split?" section (equal or custom)
  - [x] Backend expense endpoints ready for Case 2
- [x] Expense display component structure

### 🔄 NEXT STEPS (Not completed in 3-day sprint)
- [ ] Fix group members loading (minor 404 issue)
- [ ] Test end-to-end expense creation with Case 2 logic
- [ ] Build balance calculation logic
- [ ] Build settlement recommendations
- [ ] Add edit/delete expense functionality
- [ ] Add tests & full error handling

### CURRENT STATUS  
- **Backend**: ✅ Running on `localhost:5000`
- **Frontend**: ✅ Running on `localhost:3000`  
- **Database**: ✅ Connected & schema ready
- **Auth**: ✅ Registration & login working
- **Groups**: ✅ Creation & listing working
- **Expenses**: ⚠️ UI ready, backend endpoints ready (needs member loading fix)

