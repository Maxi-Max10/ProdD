const state = { products: [], cart: {}, category: 'Todos', query: '', whatsappNumber: '', storeName: 'Alndin', demo: false };
const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(amount);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const measureLabel = (quantity, unit) => quantity < 1 ? `${Math.round(quantity * 1000)} ${unit === 'kg' ? 'g' : 'ml'}` : `${Number(quantity.toFixed(3))} ${unit}`;
const amountLabel = (item) => item.unit === 'unidad' ? `${item.quantity} ${item.quantity === 1 ? 'unidad' : 'unidades'}` : measureLabel(item.quantity, item.unit);

function saveCart() {
  try { localStorage.setItem('alndin-cart-v1', JSON.stringify(state.cart)); } catch { /* El carrito funciona aunque el navegador bloquee el almacenamiento. */ }
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem('alndin-cart-v1') || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) state.cart = saved;
  } catch { state.cart = {}; }
}

function renderCategories() {
  const categories = ['Todos', ...new Set(state.products.map((product) => product.category))].sort((a, b) => a === 'Todos' ? -1 : b === 'Todos' ? 1 : a.localeCompare(b, 'es'));
  $('#categories').classList.toggle('hidden', categories.length <= 2);
  $('#categories').innerHTML = categories.map((category) => `<button class="category-button ${state.category === category ? 'active' : ''}" type="button" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join('');
}

function renderProducts() {
  const query = state.query.toLocaleLowerCase('es');
  const products = state.products.filter((product) => (state.category === 'Todos' || product.category === state.category) && `${product.name} ${product.category}`.toLocaleLowerCase('es').includes(query));
  $('#catalog-total').textContent = `${state.products.length} productos para elegir`;
  $('#product-grid').innerHTML = products.length ? products.map((product, index) => {
    const isMeasured = product.unit !== 'unidad';
    const smallUnit = product.unit === 'kg' ? 'g' : 'ml';
    const tints = ['#e7e9d7', '#e8dec8', '#dce6d7', '#ece4d6', '#e2e5ce', '#e8e0d1'];
    return `<article class="product-card" data-id="${escapeHTML(product.id)}">
      <div class="product-visual" style="--tint:${tints[index % tints.length]}">${product.image ? `<img src="${escapeHTML(product.image)}" alt="" loading="lazy" />` : `<span class="product-placeholder" aria-hidden="true">✳</span>`}<span class="product-unit-pill">${product.unit === 'kg' ? 'Por peso' : product.unit === 'l' ? 'Por litro' : 'Por unidad'}</span></div>
      <div class="product-body"><span class="product-category">${escapeHTML(product.category)}</span><h3>${escapeHTML(product.name)}</h3><div class="product-price">${money(product.price)} <span>/ ${product.unit}</span></div></div>
      <div class="product-actions"><div class="amount-wrap"><input type="number" min="1" step="1" inputmode="numeric" value="${isMeasured ? 250 : 1}" aria-label="Cantidad de ${escapeHTML(product.name)}" />${isMeasured ? `<select aria-label="Unidad de medida"><option value="${smallUnit}">${smallUnit}</option><option value="${product.unit}">${product.unit}</option></select>` : '<span class="unit-text">un.</span>'}</div><button class="add-button" type="button">Agregar +</button></div></article>`;
  }).join('') : '<div class="empty-state">No encontramos productos con esa búsqueda.</div>';
}

function cartItems() {
  return Object.entries(state.cart).map(([id, quantity]) => {
    const product = state.products.find((candidate) => candidate.id === id);
    return product && Number.isFinite(Number(quantity)) && Number(quantity) > 0 ? { ...product, quantity: Number(quantity) } : null;
  }).filter(Boolean);
}

function renderCart() {
  const items = cartItems();
  const count = items.length;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  $('#cart-count').textContent = count;
  $('#drawer-count').textContent = `(${count})`;
  $('#mobile-cart-summary').textContent = count ? money(total) : '0 productos';
  $('#cart-total').textContent = money(total);
  $('#send-order').disabled = count === 0;
  $('#cart-items').innerHTML = count ? items.map((item) => `<div class="cart-row" data-id="${escapeHTML(item.id)}"><div class="cart-thumb">${item.image ? `<img src="${escapeHTML(item.image)}" alt="" />` : '✳'}</div><div class="cart-row-main"><div class="cart-row-title">${escapeHTML(item.name)}</div><div class="cart-row-meta">${escapeHTML(amountLabel(item))} · ${money(item.price)} / ${item.unit}</div><div class="cart-row-bottom"><div class="quantity-control"><button type="button" data-action="decrease" aria-label="Reducir cantidad de ${escapeHTML(item.name)}">−</button><span>${escapeHTML(amountLabel(item))}</span><button type="button" data-action="increase" aria-label="Aumentar cantidad de ${escapeHTML(item.name)}">+</button></div><strong>${money(item.price * item.quantity)}</strong></div><button class="remove-button" type="button" data-action="remove">Quitar</button></div></div>`).join('') : '<div class="cart-empty"><span aria-hidden="true">✳</span><h3>Tu carrito está vacío</h3><p>Elegí tus productos favoritos y los vas a ver acá.</p></div>';
}

function showMissingImage(event) {
  const img = event.target;
  if (!img.matches('img')) return;
  const placeholder = document.createElement('span');
  placeholder.textContent = '✳';
  if (img.closest('.product-visual')) placeholder.className = 'product-placeholder';
  img.replaceWith(placeholder);
}

function openCart() {
  $('#drawer-backdrop').classList.remove('hidden');
  $('#cart-drawer').classList.add('open');
  $('#cart-drawer').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('#close-cart').focus();
}

function closeCart() {
  $('#drawer-backdrop').classList.add('hidden');
  $('#cart-drawer').classList.remove('open');
  $('#cart-drawer').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function addProduct(card) {
  const product = state.products.find((candidate) => candidate.id === card.dataset.id);
  if (!product) return;
  const input = card.querySelector('input');
  const raw = Number(input.value);
  const weightUnit = card.querySelector('select')?.value || 'unidad';
  const quantity = product.unit !== 'unidad' ? (['g', 'ml'].includes(weightUnit) ? raw / 1000 : raw) : raw;
  if (!Number.isFinite(quantity) || quantity <= 0 || (product.unit === 'unidad' && !Number.isInteger(quantity)) || (product.unit !== 'unidad' && quantity < 0.001)) {
    input.setCustomValidity('Ingresá una cantidad válida.'); input.reportValidity(); return;
  }
  input.setCustomValidity('');
  state.cart[product.id] = Number(((Number(state.cart[product.id]) || 0) + quantity).toFixed(3));
  saveCart(); renderCart();
  const button = card.querySelector('.add-button');
  button.textContent = 'Agregado ✓';
  setTimeout(() => { if (button.isConnected) button.textContent = 'Agregar +'; }, 1400);
}

function updateQuantity(id, action) {
  const product = state.products.find((candidate) => candidate.id === id);
  if (!product) return;
  if (action === 'remove') delete state.cart[id];
  else {
    const step = product.unit === 'unidad' ? 1 : 0.25;
    const next = Number((Number(state.cart[id]) + (action === 'increase' ? step : -step)).toFixed(3));
    if (next <= 0) delete state.cart[id]; else state.cart[id] = next;
  }
  saveCart(); renderCart();
}

function sendOrder() {
  const items = cartItems();
  if (!items.length) return;
  const error = $('#order-error');
  error.classList.add('hidden');
  if (!state.whatsappNumber) {
    error.textContent = 'Falta configurar el número de WhatsApp del local.';
    error.classList.remove('hidden');
    return;
  }
  const lines = [`Hola, quiero hacer un pedido para retirar en ${state.storeName}:`, '', ...items.map((item) => `• ${item.name} — ${amountLabel(item)} — ${money(item.price * item.quantity)}`), '', `Total estimado: ${money(items.reduce((sum, item) => sum + item.price * item.quantity, 0))}`, '', '¿Me confirman disponibilidad y cuándo puedo pasar a retirarlo?'];
  window.open(`https://wa.me/${state.whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
}

async function init() {
  loadCart();
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('El catálogo no está disponible.');
    const data = await response.json();
    state.products = Array.isArray(data.products) ? data.products : [];
    state.whatsappNumber = String(data.whatsappNumber || '');
    state.storeName = String(data.storeName || 'Alndin');
    state.demo = Boolean(data.demo);
    $('#brand-name').textContent = state.storeName;
    $('#footer-name').textContent = state.storeName;
    document.title = `${state.storeName} · Pedidos`;
    $('#demo-notice').classList.toggle('hidden', !state.demo);
    renderCategories(); renderProducts(); renderCart();
  } catch {
    $('#product-grid').innerHTML = '<div class="empty-state">No pudimos cargar el catálogo. Probá de nuevo en unos minutos.</div>';
  }
}

$('#search').addEventListener('input', (event) => { state.query = event.target.value.trim(); renderProducts(); });
$('#categories').addEventListener('click', (event) => { const button = event.target.closest('[data-category]'); if (!button) return; state.category = button.dataset.category; renderCategories(); renderProducts(); });
$('#product-grid').addEventListener('click', (event) => { const button = event.target.closest('.add-button'); if (button) addProduct(button.closest('.product-card')); });
$('#product-grid').addEventListener('error', showMissingImage, true);
$('#cart-items').addEventListener('error', showMissingImage, true);
$('#product-grid').addEventListener('change', (event) => { if (event.target.matches('select')) { const card = event.target.closest('.product-card'); const input = card.querySelector('input'); input.value = ['kg', 'l'].includes(event.target.value) ? '1' : '250'; } });
$('#cart-items').addEventListener('click', (event) => { const button = event.target.closest('[data-action]'); if (button) updateQuantity(button.closest('.cart-row').dataset.id, button.dataset.action); });
$('#header-cart').addEventListener('click', openCart);
$('#mobile-cart').addEventListener('click', openCart);
$('#close-cart').addEventListener('click', closeCart);
$('#drawer-backdrop').addEventListener('click', closeCart);
$('#send-order').addEventListener('click', sendOrder);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCart(); });
init();
