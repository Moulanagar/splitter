# Deploy Splitwise App

This app has two deploy targets:

- Backend: Express API in `backend`
- Frontend: React app in `frontend`

## 1. Supabase

Run the full `schema.sql` in the Supabase SQL editor before deploying.

Make sure these newer tables exist:

- `group_messages`
- `settlement_proofs`

## 2. Backend on Render

Create a new Render Web Service from this repo.

Settings:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

Environment variables:

```text
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
FRONTEND_URL=https://your-frontend-domain
NODE_ENV=production
```

After deploy, copy the backend URL. It will look like:

```text
https://your-backend.onrender.com
```

## 3. Frontend on Vercel or Netlify

Create a frontend project from this repo.

Settings:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Publish Directory: `build`

Environment variable:

```text
REACT_APP_API_URL=https://your-backend.onrender.com/api
```

After frontend deploy, copy the frontend URL and set it as `FRONTEND_URL` in the backend service.

Then redeploy/restart the backend.

## 4. Final Test

Open the frontend URL in two browser sessions:

- Normal browser window as User A
- Incognito or another browser as User B

Test:

- Login/register
- Create group
- Add expense
- Submit settlement proof
- Approve proof
- Group chat
- Delete group only after settlement is complete
