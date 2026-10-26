let currentLanguage = 'en';
let currentCategory = 'All';
let allArticles = [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const titleFor = a => currentLanguage === 'so' ? a.title_so : a.title_en;
const excerptFor = a => currentLanguage === 'so' ? a.excerpt_so : a.excerpt_en;
const bodyFor = a => currentLanguage === 'so' ? a.body_so : a.body_en;
const categoryClass = c => String(c || '').toLowerCase().replace(/[^a-z]/g, '');
const dateFor = value => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(currentLanguage === 'so' ? 'so-SO' : 'en-US', {year:'numeric',month:'short',day:'numeric'});
};

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll('[data-en][data-so]').forEach(el => {
    el.innerHTML = el.dataset[currentLanguage];
  });
  const search = document.getElementById('searchInput');
  search.placeholder = currentLanguage === 'so' ? 'Raadi qoraallo...' : 'Search articles...';
  renderArticles();
}
function setCategory(category) {
  currentCategory = category;
  document.querySelectorAll('[data-category]').forEach(el => el.classList.toggle('active', el.dataset.category === category));
  renderArticles();
}
function visibleArticles() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  return allArticles.filter(a => {
    const catOk = currentCategory === 'All' || a.category === currentCategory;
    const text = [a.title_en,a.title_so,a.excerpt_en,a.excerpt_so,a.category].join(' ').toLowerCase();
    return catOk && (!q || text.includes(q));
  });
}
function renderArticles() {
  const grid = document.getElementById('articleGrid');
  if (!grid) return;
  const items = visibleArticles();
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">${currentLanguage === 'so' ? 'Qoraallo lama helin. Isku day qayb ama eray kale.' : 'No articles found. Try another topic or search term.'}</div>`;
    return;
  }
  grid.innerHTML = items.map((a, index) => {
    const visual = a.image_url
      ? `<img src="${esc(a.image_url)}" alt="" loading="lazy" onerror="this.remove()">`
      : `<span class="visual-code">${index % 2 === 0 ? '01 1010 01<br>SECURE / BY DESIGN<br>0101 1001' : '&lt; learn / protect &gt;<br>0x${(a.id*913).toString(16).toUpperCase()}<br>01001 10110'}</span>`;
    return `<article class="article-card">
      <div class="article-visual ${esc(categoryClass(a.category))}">${visual}<span class="article-category">${esc(a.category)}</span></div>
      <div class="article-content"><div class="article-meta"><span>HAARUUN TECH</span><span>${esc(dateFor(a.created_at))}</span></div>
      <h3>${esc(titleFor(a))}</h3><p>${esc(excerptFor(a))}</p>
      <button class="read-link" data-read="${a.id}"><span>${currentLanguage === 'so' ? 'Akhri maqaalka' : 'Read article'}</span><span>↗</span></button></div>
    </article>`;
  }).join('');
}
async function loadArticles() {
  const grid = document.getElementById('articleGrid');
  grid.innerHTML = `<div class="loading"><span class="loader"></span><span>${currentLanguage === 'so' ? 'Qoraallada ayaa la soo rarayaa...' : 'Loading the latest stories...'}</span></div>`;
  try {
    const response = await fetch('/api/articles');
    if (!response.ok) throw new Error('Could not load articles');
    allArticles = await response.json();
    renderArticles();
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">${currentLanguage === 'so' ? 'Qoraallada lama soo rari karin. Hubi in server-ku shaqaynayo.' : 'Stories could not load. Please check that the server is running.'}</div>`;
  }
}
function openArticle(id) {
  const a = allArticles.find(x => x.id === Number(id));
  if (!a) return;
  document.getElementById('modalCategory').textContent = a.category;
  document.getElementById('modalTitle').textContent = titleFor(a);
  document.getElementById('modalDate').textContent = dateFor(a.created_at);
  document.getElementById('modalBody').textContent = bodyFor(a);
  const modal = document.getElementById('articleModal');
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  const modal = document.getElementById('articleModal');
  modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  const category = e.target.closest('[data-category]');
  if (category) setCategory(category.dataset.category);
  const read = e.target.closest('[data-read]');
  if (read) openArticle(read.dataset.read);
  if (e.target.dataset.close === '1') closeModal();
});
document.getElementById('modalClose').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.getElementById('languageToggle').addEventListener('click', () => {
  currentLanguage = currentLanguage === 'en' ? 'so' : 'en';
  document.getElementById('languageToggle').textContent = currentLanguage === 'en' ? 'SO / EN' : 'EN / SO';
  applyLanguage();
});
document.getElementById('searchInput').addEventListener('input', renderArticles);
document.getElementById('searchButton').addEventListener('click', renderArticles);
document.getElementById('refreshButton').addEventListener('click', loadArticles);
document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('mainNav').classList.toggle('open'));
document.querySelectorAll('#mainNav a').forEach(a => a.addEventListener('click', () => document.getElementById('mainNav').classList.remove('open')));
document.getElementById('year').textContent = new Date().getFullYear();
loadArticles();
