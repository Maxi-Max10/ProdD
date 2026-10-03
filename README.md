# Alndin · Pedidos para retirar

El sitio muestra productos de [Las Beltra](https://lasbeltra.com.ar/lista_precios), sus fotos y el precio de origen aumentado un 10%. Permite armar un pedido por WhatsApp; no cobra ni guarda pedidos.

## Datos del catálogo

- Por defecto, `/api/products` consulta el [catálogo público](https://lasbeltra.com.ar/api_public_catalog.php). Esa respuesta contiene hasta 500 productos. El sitio completa los productos restantes con `catalog-products.json`, generado a partir de `u600449091_dietetics.sql` (551 productos en este respaldo).
- Las imágenes se sirven desde `https://lasbeltra.com.ar/uploads/catalog/`. El SQL solo contiene el nombre del archivo; no contiene las fotos. Un producto sin imagen muestra un marcador visual.
- El precio está en `price_cents`: `700000` significa $7.000,00. La API multiplica por `1,10` y redondea al centavo; por ejemplo, $7.000 pasa a $7.700. La base original no se modifica.
- Los productos que solo figuran en el respaldo pueden tener precios desactualizados. Para leer **todos** los productos en tiempo real, configurá `PRODUCT_SOURCE=mysql` con acceso de solo lectura a la base de Las Beltra.

## Ejecutar

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`. Los pedidos se envían al WhatsApp configurado para el local (`5492613375082`). Para cambiarlo, copiá `.env.example` como `.env.local` y editá `WHATSAPP_NUMBER` (código de país, sin `+` ni espacios). La lectura del catálogo público funciona sin credenciales.

Para usar MySQL, agregá `PRODUCT_SOURCE=mysql`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` en `.env.local` y en las variables de entorno de Vercel. La consulta predeterminada lee `id`, `name`, `description`, `image_path`, `unit`, `price_cents` y `currency` de `catalog_products`. El servidor guarda la contraseña; el navegador solo recibe productos y precios finales. Si el hosting no permite conexiones de Vercel a MySQL, mantené `PRODUCT_SOURCE=public`.

## Opciones

- `PRICE_MARKUP_PERCENT=10` cambia el aumento general.
- `PRODUCT_SOURCE=snapshot` usa solo el respaldo local, sin consultar Las Beltra.
- `PRODUCT_OVERRIDES_JSON={"18":{"price":8000,"unit":"kg"}}` reemplaza el precio final o la unidad de un producto por su ID.
- `PRODUCT_IMAGE_BASE_URL` cambia el directorio de las imágenes del respaldo.
- `npm run sync:products` vuelve a generar `catalog-products.json` después de reemplazar el SQL con un respaldo más reciente.

El sitio admite precios por unidad, kilo o litro. Los totales son estimados y se confirman por WhatsApp.
