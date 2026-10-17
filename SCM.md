# Gestión de configuración del software (SCM)

## Propósito

Este documento define cómo se versiona y revisa Modas Jayjo POS. GitHub es la fuente del historial compartido; el código funcional se integra en `develop` y las versiones estables se publican desde `main`.

## Ramas

Se usan cinco tipos de rama:

| Rama | Uso | Rama de origen | Destino |
| --- | --- | --- | --- |
| `main` | Versiones estables entregables | `release/*` o `hotfix/*` | — |
| `develop` | Integración y validación de cambios | `main` al iniciar el flujo | `release/*` |
| `feature/*` | Una funcionalidad, historia de usuario o cambio | `develop` | `develop` |
| `release/*` | Estabilizar una versión y actualizar su documentación | `develop` | `main` y `develop` |
| `hotfix/*` | Corregir un defecto urgente de producción | `main` | `main` y `develop` |

Los nombres de rama identifican el cambio, no el rol de una persona o chat. Formato recomendado: `<tipo>/<ID>-<resumen-corto>`, por ejemplo `feature/HU-012-control-stock` o `feature/CR-004-validar-email`. Los cinco tipos de rama son los de la tabla anterior; `fix` se reserva para el tipo de commit. Para una rama de estabilización: `release/v1.0.0`; para una corrección urgente: `hotfix/CR-021-error-cierre-caja`.

Los cambios normales nacen en `develop`. Una `release/*` se crea cuando el alcance de una entrega está definido; durante su estabilización solo recibe correcciones y documentación de esa versión. Al integrarla, `main` recibe una etiqueta de versión y los cambios de estabilización regresan a `develop`. Un `hotfix/*` parte de `main` y su corrección también se integra en `develop`.

## Commits

Se sigue Conventional Commits en español o inglés, manteniendo un mensaje claro y conciso:

```text
<tipo>(<alcance>): <descripción> (<ID>)
```

Ejemplos:

```text
feat(inventory): registrar prendas por talla y color (HU-012)
fix(auth): rechazar cuentas no autorizadas (CR-004)
docs(scm): documentar flujo de ramas (CR-001)
refactor(database): aislar acceso a MongoDB (CR-008)
test(sales): cubrir cálculo del total (HU-019)
chore(ci): agregar validación de formato (CR-011)
```

Tipos principales: `feat`, `fix`, `docs`, `test`, `refactor`, `chore` y `perf`. Usa `!` y una nota `BREAKING CHANGE:` en el cuerpo solo cuando el cambio rompa compatibilidad. Cada commit debe describir una unidad coherente de trabajo.

## Pull requests e integración

- No se integra trabajo directamente a `main`; las integraciones se hacen mediante Pull Request.
- Las funcionalidades y correcciones ordinarias se integran a `develop` mediante Pull Request.
- El Pull Request debe enlazar su historia de usuario o solicitud de cambio, explicar el alcance y registrar cómo se verificó.
- Antes de integrar, se revisa el diff, se resuelven los comentarios y se confirma que la validación automatizada configurada para el proyecto pase.
- Los cambios de autenticación, autorización, datos y cierre de caja requieren revisión cuidadosa de sus efectos y permisos.
- No se suben secretos, credenciales, bases de datos locales ni archivos del entorno virtual.

## Versiones y trazabilidad

Las entregas estables usan SemVer (`MAJOR.MINOR.PATCH`): `MAJOR` para cambios incompatibles, `MINOR` para funcionalidad compatible y `PATCH` para correcciones compatibles. Cada entrega estable se etiqueta en Git y se registra en `CHANGELOG.md` cuando se establezca el primer alcance de release.

Las historias de usuario, solicitudes de cambio, decisiones técnicas y evidencia de validación deben quedar enlazadas desde el Pull Request o los documentos del proyecto. Los chats de trabajo pueden organizarse por especialidad, pero la rama y el historial pertenecen al cambio integrado.

## Estructura del repositorio

El repositorio raíz será la fuente Git única del producto. La carpeta `backend` no debe mantenerse como repositorio Git anidado ni como gitlink/submódulo sin configuración explícita. La consolidación del historial existente debe preservar el código y sus cambios locales antes de retirar el repositorio anidado.
