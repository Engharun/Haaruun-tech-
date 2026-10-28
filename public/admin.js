
const $ = (selector) => document.querySelector(selector);

const loginView = $('#loginView');
const dashboardView = $('#dashboardView');
const form = $('#articleForm');

let articles = [];

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

function showMessage(message, type = 'success') {
  const el = $('#formMessage');
  if (!el) return;

  el.className = type === 'error' ? 'error-form' : 'success-message';
  el.textContent = message;
}

function resetForm() {
  const articleForm = $('#articleForm');
  if (!articleForm) return;

  articleForm.reset();

  articleForm.elements.namedItem('id').value = '';
  articleForm.elements.namedItem('published').value = '1';

  $('#editorTitle').textContent = 'Create an article';
  $('#editorStatus').textContent = 'NEW ARTICLE';
  $('#deleteButton').hidden = true;
  $('#formMessage').textContent = '';
}

function editArticle(id) {
  const article = articles.find(item => item.id === Number(id));
  const articleForm = $('#articleForm');

  if (!article || !articleForm) return;

  for (const key of [
    'id', 'category', 'image_url', 'title_en', 'title_so',
    'excerpt_en', 'excerpt_so', 'body_en', 'body_so', 'published'
  ]) {
    const field = articleForm.elements.namedItem(key);
    if (field) field.value = article[key] ?? '';
  }

  $('#editorTitle').textContent = 'Edit article #' + article.id;
  $('#editorStatus').textContent = article.published
    ? 'PUBLISHED'
    : 'DRAFT / HIDDEN';
  $('#deleteButton').hidden = false;
  $('#formMessage').textContent = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

async function loadArticles() {
  articles = await api('/api/admin/articles');

  const list = $('#adminArticleList');
  if (!list) return;

  list.innerHTML = articles.length
    ? articles.map(article => `
        <div class="admin-article">
          <button type="button" data-edit="${article.id}">
            ${escapeHtml(article.title_en)}
            <small>${escapeHtml(article.category)} · ${article.published ? 'Published' : 'Draft'}</small>
          </button>
          <span class="edit-mark">↗</span>
        </div>
      `).join('')
    : '<p style="font-size:11px;color:#8794a7">No articles yet. Create your first one.</p>';
}

async function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  await loadArticles();
}

async function checkAuth() {
  try {
    const result = await api('/api/admin/me');
    if (result.authenticated) await showDashboard();
  } catch (error) {
    console.error('Authentication check failed:', error.message);
  }
}

const loginForm = $('#loginForm');

loginForm.addEventListener('submit', async event => {
  event.preventDefault();

  const submittedForm = event.currentTarget;
  const errorElement = $('#loginError');
  errorElement.textContent = '';

  const formData = new FormData(submittedForm);

  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password')
      })
    });

    submittedForm.reset();
    await showDashboard();
  } catch (error) {
    errorElement.textContent = error.message;
  }
});

$('#logoutButton').addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', {
      method: 'POST',
      body: '{}'
    });
  } catch (error) {
    console.error('Logout failed:', error);
  }

  dashboardView.hidden = true;
  loginView.hidden = false;
});

$('#newArticleButton').addEventListener('click', resetForm);
$('#clearButton').addEventListener('click', resetForm);

$('#adminArticleList').addEventListener('click', event => {
  const button = event.target.closest('[data-edit]');
  if (button) editArticle(button.dataset.edit);
});

form.addEventListener('submit', async event => {
  event.preventDefault();

  const articleForm = event.currentTarget;
  const formData = new FormData(articleForm);
  const id = formData.get('id');
  const payload = {};

  for (const key of [
    'category', 'image_url', 'title_en', 'title_so',
    'excerpt_en', 'excerpt_so', 'body_en', 'body_so'
  ]) {
    payload[key] = formData.get(key);
  }

  payload.published = formData.get('published') === '1';

  const saveButton = $('#saveButton');
  saveButton.disabled = true;

  try {
    if (id) {
      await api('/api/admin/articles/' + id, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await api('/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    await loadArticles();

    if (id) {
      editArticle(id);
      showMessage('Article updated successfully.');
    } else {
      resetForm();
      showMessage('Article created successfully.');
    }
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    saveButton.disabled = false;
  }
});

$('#deleteButton').addEventListener('click', async () => {
  const articleForm = $('#articleForm');
  const id = articleForm.elements.namedItem('id').value;

  if (!id || !confirm('Delete this article permanently?')) return;

  try {
    await api('/api/admin/articles/' + id, {
      method: 'DELETE'
    });

    await loadArticles();
    resetForm();
    showMessage('Article deleted.');
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

checkAuth();
