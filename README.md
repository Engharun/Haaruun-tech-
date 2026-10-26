# Haaruun Tech — Full-stack website starter

A bilingual (English / Somali) technology and cybersecurity publication site with:
- Responsive public homepage
- Technology, Cybersecurity, AI, Tutorials and Blog sections
- Article search and category filtering
- Express backend API
- SQLite database
- Admin login and article CRUD dashboard
- Password hashing and session-based authentication
- Basic security headers and input validation

## Requirements
- Node.js 20+
- npm

## Run locally
1. Copy `.env.example` to `.env` and change `SESSION_SECRET` and `ADMIN_PASSWORD`.
2. Install packages: `npm install`
3. Start: `npm start`
4. Open `http://localhost:3000`
5. Admin dashboard: `http://localhost:3000/admin`

Default admin username/password are configured in `.env.example`; change them before use.

## Important before public deployment
- Set strong unique secrets and admin credentials.
- Use HTTPS at your hosting provider.
- Configure backups for `data/haaruun-tech.db`.
- Add your real logo, contact details, social links, privacy policy and terms.
- Configure SMTP or a contact form provider if you need email delivery.
- This starter is a functional foundation, not a claim that a live domain has already been purchased or deployed.
