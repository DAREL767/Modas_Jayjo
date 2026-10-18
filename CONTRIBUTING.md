# Contribuir a Modas Jayjo POS

## Flujo de trabajo

1. Actualiza `develop` y crea una rama `feature/<ID>-<resumen>` para trabajo planificado; usa `release/*` o `hotfix/*` según el flujo descrito en [SCM.md](SCM.md).
2. Realiza commits pequeños con el formato documentado en [SCM.md](SCM.md).
3. Abre un Pull Request hacia `develop`, completa la plantilla y enlaza el HU o CR.
4. Atiende la revisión y las validaciones configuradas antes de integrar.
5. Prepara una rama `release/*` cuando una entrega esté lista para estabilizarse. Las correcciones urgentes parten de `main` en `hotfix/*`.

## Secretos y configuración

Usa variables de entorno para credenciales y claves. Mantén los valores locales en `.env`; comparte únicamente nombres de variables y valores ficticios en `.env.example`.
