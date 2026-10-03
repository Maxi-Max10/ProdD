const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'u600449091_dietetics.sql'), 'utf8');
const inserts = [...sql.matchAll(/INSERT INTO `catalog_products`[^;]*?VALUES\s*([\s\S]*?);/g)];
if (!inserts.length) throw new Error('No se encontraron productos en el respaldo SQL.');

function fields(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let i = 1; i < line.length - 1; i++) {
    const character = line[i];
    if (character === "'") {
      quoted = !quoted;
    } else if (character === '\\' && quoted && i + 1 < line.length - 1) {
      value += line[++i];
    } else if (character === ',' && !quoted) {
      values.push(value.trim() === 'NULL' ? null : value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value.trim() === 'NULL' ? null : value.trim());
  return values;
}

const products = inserts.flatMap((match) => match[1].trim().split(/\r?\n/).map((line) => {
  const row = line.trim().replace(/[,;]$/, '');
  if (!row.startsWith('(') || !row.endsWith(')')) return null;
  const [id, , name, description, image_path, unit, price_cents, currency] = fields(row);
  if (!id || !name || !Number.isSafeInteger(Number(price_cents))) throw new Error(`Producto inválido: ${row}`);
  return { id: Number(id), name, description, image_path, unit, price_cents: Number(price_cents), currency };
}).filter(Boolean));

fs.writeFileSync(path.join(root, 'catalog-products.json'), `${JSON.stringify(products, null, 2)}\n`);
console.log(`Se exportaron ${products.length} productos a catalog-products.json`);
