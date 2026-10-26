const $ = (s) => document.querySelector(s);
const loginView = $('#loginView');
const dashboardView = $('#dashboardView');
const form = $('#articleForm');
let articles = [];

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function showMessage(message, type = 'success') {
  const el = $('#formMessage');
  el.className = type === 'error' ? 'error-form' : 'success-message';
  el.textContent = message;
}
function resetForm() {
  form.reset();
  form.elements.id.value = '';
  form.elements.published.value = '1';
  $('#editorTitle').textContent = 'Create an article';
  $('#editorStatus').textContent = 'NEW ARTICLE';
  $('#deleteButton').hidden = true;
  $('#formMessage').textContent = '';
}
function editArticle(id) {
  const a = articles.find(item => item.id === Number(id));
  if (!a) return;
  for (const key of ['id','category','image_url','title_en','title_so','excerpt_en','excerpt_so','body_en','body_so','published']) {
    form.elements[key].value = a[key] ?? '';
  }
  $('#editorTitle').textContent = 'Edit article #' + a.id;
  $('#editorStatus').textContent = a.published ? 'PUBLISHED' : 'DRAFT / HIDDEN';
  $('#deleteButton').hidden = false;
  $('#formMessage').textContent = '';
  window.scrollTo({top:0,behavior:'smooth'});
}
async function loadArticles() {
  articles = await api('/api/admin/articles');
  $('#adminArticleList').innerHTML = articles.length ? articles.map(a => `
    <div class="admin-article"><button type="button" data-edit="${a.id}">${escapeHtml(a.title_en)}<small>${escapeHtml(a.category)} · ${a.published ? 'Published' : 'Draft'}</small></button><span class="edit-mark">↗</span></div>
  `).join('') : '<p style="font-size:11px;color:#8794a7">No articles yet. Create your first one.</p>';
}
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function showDashboard() {
  loginView.hidden = true; dashboardView.hidden = false;
  await loadArticles();
}
async function checkAuth() {
  try {
    const me = await api('/api/admin/me');
    if (me.authenticated) await showDashboard();
  } catch {}
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#loginError').textContent = '';
  const fd = new FormData(e.currentTarget);
  try {
    await api('/api/admin/login', {method:'POST', body:JSON.stringify({username:fd.get('username'),password:fd.get('password')})});
    e.currentTarget.reset(); await showDashboard();
  } catch (err) { $('#loginError').textContent = err.message; }
});
$('#logoutButton').addEventListener('click', async () => {
  try { await api('/api/admin/logout', {method:'POST',body:'{}'}); } catch {}
  dashboardView.hidden = true; loginView.hidden = false;
});
$('#newArticleButton').addEventListener('click', resetForm);
$('#clearButton').addEventListener('click', resetForm);
$('#adminArticleList').addEventListener('click', e => {
  const button = e.target.closest('[data-edit]');
  if (button) editArticle(button.dataset.edit);
});
form.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(form);
  const id = fd.get('id');
  const payload = {};
  for (const key of ['category','image_url','title_en','title_so','excerpt_en','excerpt_so','body_en','body_so']) payload[key] = fd.get(key);
  payload.published = fd.get('published') === '1';
  $('#saveButton').disabled = true;
  try {
    if (id) await api('/api/admin/articles/' + id, {method:'PUT',body:JSON.stringify(payload)});
    else await api('/api/admin/articles', {method:'POST',body:JSON.stringify(payload)});
    showMessage(id ? 'Article updated successfully.' : 'Article created successfully.');
    await loadArticles();
    if (!id) resetForm();
    else editArticle(id);
  } catch (err) { showMessage(err.message, 'error'); }
  finally { $('#saveButton').disabled = false; }
});
$('#deleteButton').addEventListener('click', async () => {
  const id = form.elements.id.value;
  if (!id || !confirm('Delete this article permanently?')) return;
  try {
    await api('/api/admin/articles/' + id, {method:'DELETE'});
    resetForm(); await loadArticles(); showMessage('Article deleted.');
  } catch (err) { showMessage(err.message, 'error'); }
});
checkAuth();
