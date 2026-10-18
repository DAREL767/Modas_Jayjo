# Backend

## Configuración

1. Copia `.env.example` como `.env` y completa `MONGODB_URI` y `SECRET_KEY`.
2. Genera `SECRET_KEY` con un generador criptográfico. En producción usa al menos 32 caracteres y configura `APP_ENV=production`.
3. Si la base no tiene un administrador activo, define `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_FULL_NAME` e `INITIAL_ADMIN_PASSWORD`. La contraseña inicial debe tener al menos 12 caracteres. Estas variables solo se necesitan para el primer arranque sin administrador y no deben incluirse en Git.
4. Instala `requirements.txt` y ejecuta la aplicación desde `backend`.

El arranque falla con un error explícito si MongoDB no está disponible o si falta la configuración necesaria para crear el primer administrador. No hay credenciales de administrador predeterminadas. El bootstrap no cambia credenciales cuando ya existe un administrador activo.

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

## Pruebas

Consulta [`tests/README.md`](tests/README.md) para comandos unitarios y de integración segura con MongoDB.
