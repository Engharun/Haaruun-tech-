# Haaruun Tech — full-stack website

Bilingual (Somali/English) technology and cybersecurity publication website with an Express backend, PostgreSQL database, persistent admin sessions, and an admin dashboard.

## Deploying

This version uses PostgreSQL so articles and admin sessions are not stored in the web service's temporary local filesystem.

1. Create a PostgreSQL database (for example, on Neon) and copy its connection string.
2. In your hosting provider, connect this GitHub repository and set these environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `SESSION_SECRET`: long random secret (32+ characters)
   - `ADMIN_USERNAME`: your chosen admin username
   - `ADMIN_PASSWORD`: a strong unique password
   - `NODE_ENV`: `production`
3. Build command: `npm install`
4. Start command: `npm start`
5. After deployment, open `/admin` to sign in.

Do not commit a real `.env` file or publish secrets in GitHub. Keep database credentials private. Confirm your database provider's current free-tier limits and backup policy.

## Run locally

Use Node.js 20+, create a `.env` file from `.env.example`, fill in real values, run `npm install`, then `npm start`.

This is a starter project; review it, change default/sample content, and test the admin workflow before promoting it as a production publication platform.
