require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Configure a PostgreSQL connection string.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function initDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS articles (
    id BIGSERIAL PRIMARY KEY,
    title_en TEXT NOT NULL,
    title_so TEXT NOT NULL,
    excerpt_en TEXT NOT NULL,
    excerpt_so TEXT NOT NULL,
    body_en TEXT NOT NULL,
    body_so TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Technology',
    image_url TEXT DEFAULT '',
    published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM articles');
  if (rows[0].n === 0) {
    await pool.query(`INSERT INTO articles
      (title_en,title_so,excerpt_en,excerpt_so,body_en,body_so,category,image_url,published)
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,TRUE),
      ($9,$10,$11,$12,$13,$14,$15,$16,TRUE)`, [
      'Welcome to Haaruun Tech', 'Ku soo dhowow Haaruun Tech',
      'Technology, cybersecurity and AI explained clearly for curious minds.',
      'Tiknoolajiyada, amniga internetka iyo AI oo si fudud loogu sharxayo dadka xiiseeya.',
      'Haaruun Tech is a technology publication focused on practical knowledge, cybersecurity awareness, artificial intelligence and useful tutorials. Replace this starter article with your own reporting and analysis.',
      'Haaruun Tech waa madal tiknoolajiyadeed oo diiradda saarta aqoon wax-ku-ool ah, wacyigelinta amniga internetka, sirdoonka macmalka ah iyo casharro waxtar leh. Qoraalkan tijaabada ah ku beddel warbixintaada iyo falanqayntaada.',
      'Technology', '',
      'Cybersecurity starts with everyday habits', 'Amniga internetku wuxuu ka bilaabmaa caadooyinka maalinlaha ah',
      'Small steps such as using unique passwords and checking unusual links can reduce risk.',
      'Tallaabooyin yar-yar sida adeegsiga furayaal sir ah oo kala duwan iyo hubinta link-yada shakiga leh ayaa yarayn kara khatarta.',
      'Use a password manager, enable multi-factor authentication where available, install updates and verify unexpected requests through another channel. No single step guarantees complete security, but layered habits make accounts harder to compromise.',
      'Adeegso password manager, daar xaqiijinta laba-tallaabo marka ay jirto, rakib updates-ka, codsiyada lama filaanka ahna ka hubi waddo kale. Hal tallaabo ma dammaanad qaaddo amni buuxa, balse caadooyin is-biirsaday waxay adkeeyaan in akoon la jabsado.',
      'Cybersecurity', ''
    ]);
  }
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    imgSrc: ["'self'", 'data:', 'https:'], connectSrc: ["'self'"],
    objectSrc: ["'none'"], upgradeInsecureRequests: null
  }}
}));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(session({
  store: new pgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));

const clean = (value, max = 10000) => String(value ?? '').trim().slice(0, max);
const isAdmin = (req, res, next) => req.session?.admin === true ? next() : res.status(401).json({ error: 'Authentication required.' });
const categories = ['Technology', 'Cybersecurity', 'AI', 'Tutorials', 'Business'];

app.get('/api/articles', async (req, res, next) => {
  try {
    const category = clean(req.query.category, 40), q = clean(req.query.q, 100);
    const conditions = ['published = TRUE'], args = [];
    if (categories.includes(category)) { args.push(category); conditions.push(`category = $${args.length}`); }
    if (q) {
      args.push(`%${q}%`); const n = args.length;
      conditions.push(`(title_en ILIKE $${n} OR title_so ILIKE $${n} OR excerpt_en ILIKE $${n} OR excerpt_so ILIKE $${n})`);
    }
    const result = await pool.query(`SELECT * FROM articles WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT 100`, args);
    res.json(result.rows);
  } catch (e) { next(e); }
});
app.get('/api/articles/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM articles WHERE id = $1 AND published = TRUE', [Number(req.params.id)]);
    if (!result.rowCount) return res.status(404).json({ error: 'Article not found.' });
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});
app.post('/api/admin/login', (req, res) => {
  const username = clean(req.body.username, 100), password = String(req.body.password ?? '');
  const expectedUser = process.env.ADMIN_USERNAME, expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword) return res.status(500).json({ error: 'Admin credentials are not configured.' });
  const safeEqual = (a, b) => { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); };
  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPassword)) return res.status(401).json({ error: 'Incorrect username or password.' });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Could not start secure session.' });
    req.session.admin = true; res.json({ ok: true });
  });
});
app.post('/api/admin/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/admin/me', (req, res) => res.json({ authenticated: req.session?.admin === true }));
app.get('/api/admin/articles', isAdmin, async (req, res, next) => {
  try { const result = await pool.query('SELECT * FROM articles ORDER BY created_at DESC, id DESC'); res.json(result.rows); }
  catch (e) { next(e); }
});
app.post('/api/admin/articles', isAdmin, async (req, res, next) => {
  try {
    const a = normalizeArticle(req.body);
    if (!validArticle(a)) return res.status(400).json({ error: 'Complete both language versions of title, excerpt and article body.' });
    const result = await pool.query(`INSERT INTO articles
      (title_en,title_so,excerpt_en,excerpt_so,body_en,body_so,category,image_url,published)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, articleValues(a));
    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
});
app.put('/api/admin/articles/:id', isAdmin, async (req, res, next) => {
  try {
    const a = normalizeArticle(req.body);
    if (!validArticle(a)) return res.status(400).json({ error: 'Complete both language versions of title, excerpt and article body.' });
    const result = await pool.query(`UPDATE articles SET title_en=$1,title_so=$2,excerpt_en=$3,excerpt_so=$4,
      body_en=$5,body_so=$6,category=$7,image_url=$8,published=$9,updated_at=NOW() WHERE id=$10 RETURNING id`, [...articleValues(a), Number(req.params.id)]);
    if (!result.rowCount) return res.status(404).json({ error: 'Article not found.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
app.delete('/api/admin/articles/:id', isAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM articles WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!result.rowCount) return res.status(404).json({ error: 'Article not found.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
function normalizeArticle(body) {
  return {
    title_en: clean(body.title_en, 200), title_so: clean(body.title_so, 200),
    excerpt_en: clean(body.excerpt_en, 500), excerpt_so: clean(body.excerpt_so, 500),
    body_en: clean(body.body_en, 30000), body_so: clean(body.body_so, 30000),
    category: categories.includes(body.category) ? body.category : 'Technology',
    image_url: clean(body.image_url, 1000),
    published: !(body.published === false || body.published === 0 || body.published === '0')
  };
}
function validArticle(a) { return !!(a.title_en && a.title_so && a.excerpt_en && a.excerpt_so && a.body_en && a.body_so); }
function articleValues(a) { return [a.title_en,a.title_so,a.excerpt_en,a.excerpt_so,a.body_en,a.body_so,a.category,a.image_url,a.published]; }
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error. Please try again later.' }); });

initDatabase().then(() => app.listen(PORT, () => console.log(`Haaruun Tech running on port ${PORT}`)))
  .catch(err => { console.error('Database initialization failed:', err); process.exit(1); });
