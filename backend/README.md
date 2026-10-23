# Backend

## Configuración

1. Copia `.env.example` como `.env` y completa `MONGODB_URI` y `SECRET_KEY`.
   - Si el resolver del equipo no puede resolver los registros SRV de Atlas, configura `MONGODB_DNS_NAMESERVERS=8.8.8.8,8.8.4.4`. Esto solo corrige la consulta DNS; Atlas también debe permitir la IP pública de salida del equipo.
2. Genera `SECRET_KEY` con un generador criptográfico. En producción usa al menos 32 caracteres y configura `APP_ENV=production`.
3. Si la base no tiene un administrador activo, define `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_FULL_NAME` e `INITIAL_ADMIN_PASSWORD`. La contraseña inicial debe tener al menos 12 caracteres. Estas variables solo se necesitan para el primer arranque sin administrador y no deben incluirse en Git.
4. Instala `requirements.txt` y ejecuta la aplicación desde `backend`.

El arranque falla con un error explícito si MongoDB no está disponible o si falta la configuración necesaria para crear el primer administrador. No hay credenciales de administrador predeterminadas. El bootstrap no cambia credenciales cuando ya existe un administrador activo.

### Acceso con Google

Configura `GOOGLE_CLIENT_IDS` con el client ID OAuth de la aplicación web responsiva. Puede contener varios IDs separados por comas si posteriormente se agregan otros clientes. Si no se define, el endpoint `POST /api/auth/google` responde que el proveedor no está configurado. El backend verifica el ID token de Google y solo admite correos verificados.

Configura `CORS_ORIGINS` como una lista separada por comas de orígenes completos, sin rutas ni comodines. En desarrollo se permite `http://localhost:5173` para Vite. En producción define únicamente el origen HTTPS desplegado.

No existe auto-registro: la primera vinculación requiere un usuario activo creado por el administrador, su username y la contraseña que ya tiene asignada; además, el correo local debe coincidir con el correo verificado de Google. Después de vincular el identificador estable `sub`, los siguientes inicios requieren solo la credencial Google. El rol se conserva desde la base local y la API devuelve el JWT de la aplicación. Nunca se acepta el rol enviado por el cliente o por Google.

### Compatibilidad de roles existentes

En el primer arranque se convierten los roles históricos `vendedor` y `cajero` a `vendor`. La identidad exacta del administrador sembrado por la versión anterior (`admin` / `admin@modasjayjo.com`) se desactiva y degrada a `vendor`; configura un username y email nuevos para crear el administrador seguro. La operación es idempotente y conserva el registro para referencias históricas. Después de esta normalización los únicos roles nuevos y válidos son `admin` y `vendor`.

## Estructura

- `app/api`: composición de dependencias HTTP y autorización por roles.
- `app/modules`: módulos funcionales y casos de uso, independientes de FastAPI y del driver.
- `app/infrastructure/mongodb/client.py`: ciclo de vida del cliente.
- `app/infrastructure/mongodb/database.py`: acceso a la base configurada.
- `app/infrastructure/mongodb/collections.py`: acceso a colecciones compartidas.
- `app/infrastructure/mongodb/repositories`: adaptadores CRUD por entidad.
- `app/infrastructure/mongodb/indexes`: índices requeridos por persistencia.
- `app/infrastructure/mongodb/maintenance`: mantenimiento y compatibilidad de datos existentes.
- `app/core`: configuración común validada.
- `app/security`: hashing de contraseñas y tokens.

Las rutas dependen de casos de uso; los casos de uso dependen de puertos; solo infraestructura implementa persistencia.
La conexión asíncrona se administra con `AsyncMongoClient` de PyMongo y vive durante el ciclo de vida de FastAPI.

## Base POS (inventario, ventas y caja)

La API POS inicial está organizada por módulos (`inventory`, `sales` y `cash_register`). Los endpoints requieren un JWT válido. Admin y vendor pueden consultar inventario activo, consultar la caja actual y registrar ventas. Solo admin puede crear/editar/desactivar prendas, ajustar existencias y abrir o cerrar caja. Los vendedores no reciben el costo interno de las prendas.

- `GET /api/inventory/` y `GET /api/inventory/{product_id}` consultan prendas. Admin puede incluir inactivas con `active_only=false`.
- `POST /api/inventory/` crea una variante por talla/color con SKU único. Si inicia con existencias, el alta y el movimiento inicial se guardan juntos.
- `PATCH /api/inventory/{product_id}` actualiza datos o desactiva la variante con `is_active=false`; no se borran registros referenciados por ventas.
- `POST /api/inventory/{product_id}/stock-adjustments` registra el ajuste y su motivo en el libro de movimientos.
- `GET /api/cash-register/current`, `POST /api/cash-register/open` y `POST /api/cash-register/close` manejan una única sesión abierta. El cierre compara efectivo, tarjeta y transferencia esperados y contados, con su diferencia.
- `POST /api/sales/` requiere `Idempotency-Key` y una sesión abierta. El backend calcula precios y total, guarda una copia de los datos vendidos, registra movimiento de stock y suma el método de pago a caja en una transacción MongoDB. Reintentar la misma clave y carga devuelve la venta ya creada; reutilizarla con otra carga o usuario produce conflicto.

Las ventas y sus movimientos son históricos; actualizar precio o nombre de una prenda no altera los datos de ventas anteriores. La aplicación requiere un MongoDB compatible con transacciones (por ejemplo, Atlas o un replica set local). La integración web será una SPA responsiva con React, Vite y TailwindCSS; se usará TypeScript para mantener contratos explícitos entre la UI y esta API.

## Pruebas

Consulta [`tests/README.md`](tests/README.md) para comandos unitarios y de integración segura con MongoDB.
