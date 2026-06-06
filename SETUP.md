# Splitwise 3-Day Build - Setup Guide

## Prerequisites
- Node.js 16+ installed
- npm installed
- Supabase account (free tier at https://supabase.com)

---

## STEP 1: Create Supabase Project

1. Go to https://supabase.com and sign up
2. Create a new project
3. Copy these credentials to `backend/.env`:
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_ANON_KEY` (Anon Public Key)
   - `SUPABASE_SERVICE_ROLE_KEY` (Service Role Key - keep secret!)

Example `backend/.env`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=your_random_jwt_secret_key_here_make_it_long
PORT=5000
NODE_ENV=development
```

---

## STEP 2: Set Up Database Schema

In Supabase SQL Editor, run all queries from `schema.sql` file:

```bash
# Copy the entire schema.sql and paste into Supabase SQL Editor
```

This creates:
- users table
- groups table
- group_members table
- expenses table
- expense_payers table
- expense_splits table

---

## STEP 3: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (in new terminal)
cd frontend
npm install
```

---

## STEP 4: Start Backend

```bash
cd backend
npm run dev  # or `npm start`
```

Expected output:
```
Backend running on http://localhost:5000
```

---

## STEP 5: Start Frontend

```bash
cd frontend
npm start
```

Browser automatically opens to `http://localhost:3000`

---

## STEP 6: Test Auth Flow

1. **Register**: Create a new account
2. **Login**: Log in with the account
3. **Dashboard**: Should see "Your Groups" section (empty initially)

---

## Troubleshooting

### Backend won't start
- Check `SUPABASE_URL` and keys are correct in `.env`
- Ensure port 5000 is not in use: `lsof -i :5000`

### Frontend shows "Failed to load groups"
- Check backend is running on port 5000
- Check CORS is enabled (already configured in server.js)
- Open browser DevTools → Network tab to see API calls

### Database connection error
- Verify Supabase credentials
- Check SQL tables were created

---

## Next Phase

Once auth works:
1. Build **Groups** feature
2. Build **Expenses** feature
3. Implement **Balance Calculation**

See AI_CONTEXT.md for detailed requirements.
