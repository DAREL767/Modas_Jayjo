# Cliente web Modas Jayjo POS

Aplicación responsive en React, TypeScript, Vite y Tailwind CSS para consumir la API del inventario y el punto de venta.

## Desarrollo local

1. Instala Node.js 22 y ejecuta `npm ci` dentro de `frontend/`.
2. Copia `.env.example` como `.env`.
3. Configura `VITE_API_BASE_URL` con el origen del backend y `VITE_GOOGLE_CLIENT_ID` con el client ID web público de Google.
4. Inicia el servidor con `npm run dev`.

Si el client ID de Google está vacío, la app presenta el estado de configuración pendiente. El token de sesión del backend vive solo en memoria; al recargar la página el usuario debe autenticarse otra vez.

## Comprobaciones

```sh
npm run typecheck
npm test
npm run build
```

El workflow de GitHub ejecuta estos pasos en cada pull request que cambie `frontend/`.

## Contrato y autorización

La interfaz consume rutas bajo `/api`: autenticación Google y `/me`, inventario, ventas, caja y usuarios. El backend valida permisos en cada solicitud; la visibilidad de módulos en la interfaz solo mejora la navegación y no sustituye la autorización del servidor.

El vendor puede consultar existencias y registrar ventas. El admin también administra prendas, usuarios y cierres de caja. El costo unitario solo se presenta para admin cuando la API lo devuelve.

La primera entrega requiere que el backend incluya las rutas POS (inventario, ventas y caja) del PR #20. La UI no crea sesiones de caja automáticamente ni simula una venta si la API rechaza la operación.
