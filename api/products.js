const snapshot = require('../catalog-products.json');
const PUBLIC_CATALOG_URL = 'https://lasbeltra.com.ar/api_public_catalog.php';
const IMAGE_BASE_URL = 'https://lasbeltra.com.ar/uploads/catalog/';

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function overrides() {
  try {
    const value = JSON.parse(process.env.PRODUCT_OVERRIDES_JSON || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    throw new Error('PRODUCT_OVERRIDES_JSON no es un JSON válido.');
  }
}

function imageUrl(row) {
  const image = String(row.image_url || row.image_path || row.image || '').trim();
  if (!image) return '';
  if (/^https:\/\/[^\s]+$/i.test(image)) return image;
  if (image.startsWith('/')) {
    try { return new URL(image, PUBLIC_CATALOG_URL).href; } catch { return ''; }
  }
  if (!/^[\w.-]+\.(png|jpe?g|webp|gif|avif)$/i.test(image)) return '';
  try {
    const base = process.env.PRODUCT_IMAGE_BASE_URL || IMAGE_BASE_URL;
    const url = new URL(base.endsWith('/') ? base : `${base}/`);
    return ['http:', 'https:'].includes(url.protocol) ? new URL(encodeURIComponent(image), url).href : '';
  } catch { return ''; }
}

function normalize(row, ownPrices, markup) {
  const custom = ownPrices[String(row.id)] || {};
  const baseCents = row.price_cents == null ? Math.round(number(row.price) * 100) : number(row.price_cents);
  const customPrice = custom.price == null ? null : number(custom.price, NaN);
  const priceCents = customPrice == null ? Math.round(baseCents * (1 + markup / 100)) : Math.round(customPrice * 100);
  const unit = String(custom.unit || row.unit || 'unidad').toLowerCase();
  return {
    id: String(row.id),
    name: String(row.name || '').trim(),
    category: String(row.category || 'Productos').trim(),
    image: imageUrl(row),
    unit: ['kg', 'l'].includes(unit) ? unit : 'unidad',
    price: priceCents / 100,
    available: row.available === undefined || row.available === null ? true : !['0', 'false', 'no'].includes(String(row.available).toLowerCase())
  };
}

async function fromMySQL() {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Faltan variables de MySQL: ${missing.join(', ')}`);
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: number(process.env.DB_PORT, 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 8000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
  });
  try {
    const query = process.env.DB_PRODUCTS_QUERY || 'SELECT id, name, description, image_path, unit, price_cents, currency FROM catalog_products';
    if (!/^\s*SELECT\b/i.test(query) || /;\s*\S/.test(query)) throw new Error('DB_PRODUCTS_QUERY debe ser una única consulta SELECT.');
    const [rows] = await connection.query(query);
    return rows;
  } finally {
    await connection.end();
  }
}

async function fromPublicCatalog() {
  try {
    const response = await fetch(PUBLIC_CATALOG_URL, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`El catálogo público respondió ${response.status}.`);
    const data = await response.json();
    if (data.ok !== true || !Array.isArray(data.items)) throw new Error('Respuesta inválida del catálogo público.');
    const currentIds = new Set(data.items.map((item) => Number(item.id)));
    return [...data.items, ...snapshot.filter((item) => !currentIds.has(item.id))];
  } catch (error) {
    console.warn('Se usa el respaldo local del catálogo:', error);
    return snapshot;
  }
}

async function fromWooCommerce() {
  const site = process.env.WOO_SITE_URL;
  if (!site) throw new Error('Falta WOO_SITE_URL.');
  const origin = new URL(site).origin;
  const products = [];
  for (let page = 1; page <= 10; page++) {
    const url = `${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`WooCommerce respondió ${response.status}.`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('La respuesta de WooCommerce no contiene productos.');
    products.push(...batch.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.categories?.[0]?.name || 'Otros',
      image: item.images?.[0]?.src || '',
      price: number(item.prices?.price) / Math.pow(10, number(item.prices?.currency_minor_unit, 2)),
      unit: 'unidad',
      available: item.is_in_stock
    })));
    if (batch.length < 100) break;
  }
  return products;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const source = (process.env.PRODUCT_SOURCE || 'public').toLowerCase();
    const markup = number(process.env.PRICE_MARKUP_PERCENT, 10);
    if (!['public', 'snapshot', 'mysql', 'woocommerce'].includes(source) || markup < 0) throw new Error('Configuración de catálogo inválida.');
    const rows = source === 'mysql' ? await fromMySQL() : source === 'woocommerce' ? await fromWooCommerce() : source === 'snapshot' ? snapshot : await fromPublicCatalog();
    const ownPrices = overrides();
    const products = rows.map((row) => normalize(row, ownPrices, markup))
      .filter((item) => item.name && item.price > 0 && item.available);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      products,
      storeName: process.env.STORE_NAME || 'Alndin',
      whatsappNumber: String(process.env.WHATSAPP_NUMBER || '5492613375082').replace(/\D/g, ''),
      demo: false
    });
  } catch (error) {
    console.error('No se pudo cargar el catálogo:', error);
    return res.status(500).json({ error: 'No se pudo cargar el catálogo. Revisá la configuración de productos.' });
  }
};
