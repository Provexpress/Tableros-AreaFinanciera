# Tablero Corporativo Control de Facturas

Dashboard financiero para compras, ventas, notas credito y consolidado.

## Stack

- React 18
- Vite
- Tailwind CSS
- Zustand
- Recharts
- xlsx

## Fuentes actuales

- Compras FC: API contable PBI, cacheada en `Data/_cache/compras-pbi.json`.
- Compras NC: `Data/Control Facturas.xlsx`, mientras no exista endpoint de NC de compra.
- Ventas FV: API contable PBI, cacheada en `Data/_cache/ventas-pbi.json`.
- Ventas NC y vista de notas: `Data/NOTAS CREDITO 2026.xlsx` + `Data/reporte semanal de facturacion.xlsx`.

## Actualizar datos localmente

Crear `.env.local` desde `.env.example` y completar credenciales. Luego:

```bash
npm install
npm run build:data-cache
npm run build:pbi-cache
npm run build
```

`PBI_CACHE_MIN_YEAR` controla desde que ano se publica la data API. Hoy puede quedar en `2024`; cuando se quiera publicar solo data reciente, cambiar a `2026`.

## Correr en desarrollo

```bash
npm run dev
```

Abrir:

```text
http://localhost:5173
```

## GitHub Actions / Vercel

El workflow `.github/workflows/refresh-data-cache.yml` refresca caches lunes, miercoles y viernes, o manualmente desde **Run workflow**.

Configurar estos secretos en GitHub:

- `PBI_API_BASE_URL`
- `PBI_API_USER`
- `PBI_API_PASSWORD`

Opcional:

- Variable de repositorio `PBI_CACHE_MIN_YEAR=2024` o `2026`.
