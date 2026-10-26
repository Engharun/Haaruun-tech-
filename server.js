require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'haaruun-tech.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en TEXT NOT NULL,
  title_so TEXT NOT NULL,
  excerpt_en TEXT NOT NULL,
  excerpt_so TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_so TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Technology',
  image_url TEXT DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const count = db.prepare('SELECT COUNT(*) AS n FROM articles').get().n;
if (!count) {
  const insert = db.prepare(`INSERT INTO articles
    (title_en,title_so,excerpt_en,excerpt_so,body_en,body_so,category,image_url,published)
    VALUES (?,?,?,?,?,?,?,?,1)`);
  insert.run(
    'Welcome to Haaruun Tech',
    'Ku soo dhowow Haaruun Tech',
    'Technology, cybersecurity and AI explained clearly for curious minds.',
    'Tiknoolajiyada, amniga internetka iyo AI oo si fudud loogu sharxayo dadka xiiseeya.',
    'Haaruun Tech is a technology publication focused on practical knowledge, cybersecurity awareness, artificial intelligence and useful tutorials. Replace this starter article with your own reporting and analysis.',
    'Haaruun Tech waa madal tiknoolajiyadeed oo diiradda saarta aqoon wax-ku-ool ah, wacyigelinta amniga internetka, sirdoonka macmalka ah iyo casharro waxtar leh. Qoraalkan tijaabada ah ku beddel warbixintaada iyo falanqayntaada.',
    'Technology', '', 1
  );
  insert.run(
    'Cybersecurity starts with everyday habits',
    'Amniga internetku wuxuu ka bilaabmaa caadooyinka maalinlaha ah',
    'Small steps such as using unique passwords and checking unusual links can reduce risk.',
    'Tallaabooyin yar-yar sida adeegsiga furayaal sir ah oo kala duwan iyo hubinta link-yada shakiga leh ayaa yarayn kara khatarta.',
    'Use a password manager, enable multi-factor authentication where available, install updates and verify unexpected requests through another channel. No single step guarantees complete security, but layered habits make accounts harder to compromise.',
    'Adeegso password manager, daar xaqiijinta laba-tallaabo marka ay jirto, rakib updates-ka, codsiyada lama filaanka ahna ka hubi waddo kale. Hal tallaabo ma dammaanad qaaddo amni buuxa, balse caadooyin is-biirsaday waxay adkeeyaan in akoon la jabsado.',
    'Cybersecurity', '', 1
  );
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null
    }
  }
}));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: DATA_DIR }),
  secret: process.env.SESSION_SECRET || 'unsafe-development-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const clean = (value, max = 10000) => String(value ?? '').trim().slice(0, max);
const isAdmin = (req, res, next) => {
  if (req.session && req.session.admin === true) return next();
  return res.status(401).json({ error: 'Authentication required.' });
};
const categories = ['Technology', 'Cybersecurity', 'AI', 'Tutorials', 'Business'];

app.get('/api/articles', (req, res) => {
  const category = clean(req.query.category, 40);
  const q = clean(req.query.q, 100);
  let sql = 'SELECT * FROM articles WHERE published = 1';
  const args = [];
  if (categories.includes(category)) { sql += ' AND category = ?'; args.push(category); }
  if (q) {
    sql += ` AND (title_en LIKE ? OR title_so LIKE ? OR excerpt_en LIKE ? OR excerpt_so LIKE ?)`;
    const like = `%${q}%`; args.push(like, like, like, like);
  }
  sql += ' ORDER BY datetime(created_at) DESC, id DESC LIMIT 100';
  res.json(db.prepare(sql).all(...args));
});

app.get('/api/articles/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM articles WHERE id = ? AND published = 1').get(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Article not found.' });
  res.json(item);
});

app.post('/api/admin/login', (req, res) => {
  const username = clean(req.body.username, 100);
  const password = String(req.body.password ?? '');
  const expectedUser = process.env.ADMIN_USERNAME || 'haaruunadmin';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'ChangeThisPasswordBeforeDeployment!';
  const okUser = username.length === expectedUser.length &&
    crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser));
  const okPass = password.length === expectedPassword.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPassword));
  if (!okUser || !okPass) return res.status(401).json({ error: 'Incorrect username or password.' });
  req.session.admin = true;
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Could not start secure session.' });
    req.session.admin = true;
    res.json({ ok: true });
  });
});
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get('/api/admin/me', (req, res) => res.json({ authenticated: req.session?.admin === true }));

app.get('/api/admin/articles', isAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM articles ORDER BY datetime(created_at) DESC, id DESC').all());
});
app.post('/api/admin/articles', isAdmin, (req, res) => {
  const a = normalizeArticle(req.body);
  if (!a.title_en || !a.title_so || !a.body_en || !a.body_so || !a.excerpt_en || !a.excerpt_so)
    return res.status(400).json({ error: 'Complete both language versions of title, excerpt and article body.' });
  const result = db.prepare(`INSERT INTO articles
    (title_en,title_so,excerpt_en,excerpt_so,body_en,body_so,category,image_url,published)
    VALUES (@title_en,@title_so,@excerpt_en,@excerpt_so,@body_en,@body_so,@category,@image_url,@published)`).run(a);
  res.status(201).json(db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid));
});
app.put('/api/admin/articles/:id', isAdmin, (req, res) => {
  const a = normalizeArticle(req.body);
  if (!a.title_en || !a.title_so || !a.body_en || !a.body_so || !a.excerpt_en || !a.excerpt_so)
    return res.status(400).json({ error: 'Complete both language versions of title, excerpt and article body.' });
  const result = db.prepare(`UPDATE articles SET title_en=@title_en,title_so=@title_so,
    excerpt_en=@excerpt_en,excerpt_so=@excerpt_so,body_en=@body_en,body_so=@body_so,
    category=@category,image_url=@image_url,published=@published,updated_at=CURRENT_TIMESTAMP WHERE id=@id`)
    .run({ ...a, id: Number(req.params.id) });
  if (!result.changes) return res.status(404).json({ error: 'Article not found.' });
  res.json({ ok: true });
});
app.delete('/api/admin/articles/:id', isAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM articles WHERE id = ?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Article not found.' });
  res.json({ ok: true });
});

function normalizeArticle(body) {
  return {
    title_en: clean(body.title_en, 200), title_so: clean(body.title_so, 200),
    excerpt_en: clean(body.excerpt_en, 500), excerpt_so: clean(body.excerpt_so, 500),
    body_en: clean(body.body_en, 30000), body_so: clean(body.body_so, 30000),
    category: categories.includes(body.category) ? body.category : 'Technology',
    image_url: clean(body.image_url, 1000),
    published: body.published === false || body.published === 0 || body.published === '0' ? 0 : 1
  };
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Haaruun Tech running at http://localhost:${PORT}`));
