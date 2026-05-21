# Tablero Corporativo Control de Facturas

Dashboard financiero para compras, ventas, notas crédito y consolidado.

## Stack

- React 18
- Vite
- Tailwind CSS
- Zustand
- Recharts
- xlsx

## Fuentes actuales

- Compras FC: API contable PBI, cacheada en `Data/_cache/compras-pbi.json`.
- Compras NC: cache local `Data/_cache/control-facturas.json`, generado desde Control Facturas mientras no exista endpoint de NC de compra.
- Ventas FV: API contable PBI, cacheada en `Data/_cache/ventas-pbi.json`.
- Ventas NC y vista de notas: cache local `Data/_cache/notas-credito.json`, generado desde NOTAS CREDITO 2026 y reporte semanal.
- Acuses de ventas: cache local `Data/_cache/ventas-acuses.json`, generado desde los Excel de acuses descargados de SharePoint.

La app desplegada y local lee los JSON de `Data/_cache`. Los Excel crudos no se versionan: GitHub Actions los descarga temporalmente desde SharePoint antes de reconstruir los caches.

## Actualizar datos localmente

Crear `.env.local` desde `.env.example` y completar credenciales. Luego:

```bash
npm install
npm run download:ms-files
npm run build:data-cache
npm run build:pbi-cache
npm run build
```

`PBI_CACHE_MIN_YEAR` controla desde qué año se publica la data API. Hoy puede quedar en `2024`; cuando se quiera publicar solo data reciente, cambiar a `2026`.

Si solo vas a probar visuales con los datos ya publicados en el repo:

```bash
npm install
npm run dev
```

## Correr en desarrollo

```bash
npm run dev
```

Abrir:

```text
http://localhost:5173
```

## GitHub Actions / Vercel

El workflow `.github/workflows/refresh-data-cache.yml` refresca caches de lunes a viernes a las 8:17 a.m., 1:17 p.m. y 3:17 p.m. hora Colombia, o manualmente desde **Run workflow**.

Configurar estos secretos en GitHub:

- `PBI_API_BASE_URL`
- `PBI_API_USER`
- `PBI_API_PASSWORD`
- `MS_TENANT_ID`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`

Opcional:

- Variable de repositorio `PBI_CACHE_MIN_YEAR=2024` o `2026`.
- Variables `MS_GRAPH_*` si cambia la ruta de SharePoint.

## Acceso Microsoft 365

La app puede pedir inicio de sesión con Microsoft 365 y permitir solo correos definidos en variables de entorno:

- `VITE_AUTH_ENABLED=true`
- `VITE_MS_CLIENT_ID`
- `VITE_MS_TENANT_ID`
- `VITE_AUTH_ALLOWED_EMAILS=correo1@provexpress.com,correo2@provexpress.com`

En Microsoft Entra ID, registrar estos Redirect URI como aplicación SPA:

- `https://tableros-area-financiera.vercel.app`
- `http://localhost:5173`

Este control protege la interfaz del tablero. Para blindar también los JSON públicos de cache, esos archivos deben servirse detrás de una función o middleware con sesión.
