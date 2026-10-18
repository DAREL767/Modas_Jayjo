# Pruebas del backend

Desde `backend/`, instala las dependencias y ejecuta las pruebas:

```powershell
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pytest
```

Las pruebas unitarias usan repositorios simulados y no se conectan a MongoDB.
La configuración de pruebas se carga desde `backend/.env`; también puedes definir
`MONGODB_TEST_URI` y `MONGODB_TEST_DATABASE` en el entorno del proceso. Si ambas
variables están configuradas, pytest ejecuta la prueba de integración.

La integración crea una base temporal aleatoria (con nombre compatible con el
límite de Atlas), ejecuta CRUD y elimina únicamente esa base temporal al terminar.
`MONGODB_TEST_DATABASE` debe ser distinta de `DATABASE_NAME`; usa una URI y un
usuario de MongoDB con permisos para crear y eliminar bases temporales. Nunca
configures las variables de prueba para apuntar a los datos de la tienda.

Para ejecutar solo la integración:

```powershell
python -m pytest -m integration
```

## CRUD de usuarios

El router `/api/users` requiere rol administrador y expone:

- `POST /api/users/`: crea usuario; normaliza username/email y guarda únicamente el hash de la contraseña.
- `GET /api/users/`: lista con `skip`, `limit` (máximo 100) y filtro opcional `is_active`.
- `GET /api/users/{user_id}`: consulta por ObjectId.
- `PATCH /api/users/{user_id}`: actualiza solo los campos enviados; permite cambiar contraseña.
- `DELETE /api/users/{user_id}`: desactiva la cuenta (`is_active=false`) para preservar referencias históricas.

La aplicación asegura índices únicos de MongoDB para username y email al iniciar. Si la colección ya contiene duplicados, la creación del índice detendrá el arranque; deben detectarse y resolverse antes de desplegar esta versión.
