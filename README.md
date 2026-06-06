# Splitwise - 3-Day Build

A minimal Splitwise clone built in 2 days with Node.js, React, and Supabase.

## Features

- ✅ User Registration & Login (Email/Password)
- ✅ Dashboard with user groups
- 🚧 Create & Join Groups
- 🚧 Add Expenses with multiple payers
- 🚧 View Balances & Settlements
- 🚧 Calculate who owes whom

## Tech Stack

- **Frontend**: React 18, Axios
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Auth**: JWT Tokens, bcrypt

## Quick Start

See [SETUP.md](SETUP.md) for detailed setup instructions.

```bash
# 1. Set up Supabase and copy credentials to backend/.env
# 2. Run schema.sql in Supabase SQL Editor
# 3. Install dependencies
cd backend && npm install
cd frontend && npm install

# 4. Start backend (terminal 1)
cd backend && npm run dev

# 5. Start frontend (terminal 2)
cd frontend && npm start
```

## Project Structure

```
project/
├── backend/                 # Express API
│   ├── routes/             # Auth, Groups, Expenses
│   ├── middleware/         # JWT verification
│   ├── config/            # Supabase client
│   └── server.js          # Main entry point
├── frontend/               # React app
│   ├── src/
│   │   ├── components/    # Auth, Dashboard
│   │   └── styles/        # CSS
│   └── public/
├── schema.sql             # Database schema
├── AI_CONTEXT.md          # Full requirements
└── SETUP.md              # Setup guide
```

## Documentation

- [AI_CONTEXT.md](AI_CONTEXT.md) - Complete product requirements & architecture
- [SETUP.md](SETUP.md) - Step-by-step setup guide
- [schema.sql](schema.sql) - Database schema

## Next Steps

1. Set up Supabase
2. Run the setup
3. Test auth flow
4. Build groups feature
5. Build expenses feature
6. Implement balance calculations

See [AI_CONTEXT.md](AI_CONTEXT.md) for detailed specs.
>>>>>>> 642fa27 (Prepare app for deployment)
