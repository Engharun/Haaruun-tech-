
app.post('/api/admin/login', (req, res) => {
  const username = clean(req.body.username, 100);
  const password = String(req.body.password ?? '');

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return res.status(500).json({
      error: 'Admin credentials are not configured.'
    });
  }

  const safeEqual = (a, b) => {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  };

  if (
    !safeEqual(username, expectedUser) ||
    !safeEqual(password, expectedPassword)
  ) {
    return res.status(401).json({
      error: 'Incorrect username or password.'
    });
  }

  req.session.regenerate(err => {
    if (err) {
      console.error('Session regeneration failed:', err);
      return res.status(500).json({
        error: 'Could not start secure session.'
      });
    }

    req.session.admin = true;

    req.session.save(saveError => {
      if (saveError) {
        console.error('Session save failed:', saveError);
        return res.status(500).json({
          error: 'Could not save admin session.'
        });
      }

      res.json({ ok: true });
    });
  });
});
