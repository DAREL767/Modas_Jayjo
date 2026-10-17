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
