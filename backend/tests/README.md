# Pruebas del backend

Desde `backend/`, instala las dependencias y ejecuta las pruebas unitarias:

```powershell
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pytest
```

Las pruebas unitarias usan repositorios simulados y no se conectan a MongoDB.
La prueba de integración queda omitida salvo que se configure una base desechable
mediante `MONGODB_TEST_URI` y `MONGODB_TEST_DATABASE`. La base temporal que crea
la prueba lleva un sufijo aleatorio y se elimina al terminar.

No apuntes esas variables a la base de datos de la tienda. `MONGODB_TEST_DATABASE`
debe ser distinta de `DATABASE_NAME`. Ejecuta la integración con:

```powershell
$env:MONGODB_TEST_URI = "<URI de MongoDB para pruebas>"
$env:MONGODB_TEST_DATABASE = "modas_jayjo_test"
python -m pytest -m integration
```

Para ejecutar unitarias y la integración cuando esté configurada:

```powershell
python -m pytest
```
