# Colaboración autorizada en Modas Jayjo POS

## Alcance y autorización

Modas Jayjo POS es un proyecto personal de
[DAREL767](https://github.com/DAREL767) y software propietario, sujeto al
aviso de [derechos reservados](LICENSE). No es una convocatoria abierta a
contribuciones ni concede una licencia de código abierto.

Antes de proponer o implementar cambios, solicita autorización al
responsable mediante su perfil de GitHub. Las condiciones de participación
y los permisos sobre cada aporte deben acordarse por escrito antes de
integrarlo. Estas instrucciones no transfieren automáticamente los derechos
de un colaborador al titular del proyecto.

El acceso concedido para colaborar se limita al alcance autorizado. No
autoriza a reutilizar, publicar ni distribuir el código o los recursos del
proyecto fuera de ese acuerdo. No incluyas materiales de terceros sin
permiso y conserva sus avisos de licencia y atribución cuando correspondan.

## Flujo de trabajo

1. Actualiza `develop` y crea una rama `feature/<ID>-<resumen>` para trabajo planificado; usa `release/*` o `hotfix/*` según el flujo descrito en [SCM.md](SCM.md).
2. Realiza commits pequeños con el formato documentado en [SCM.md](SCM.md).
3. Abre un Pull Request hacia `develop`, completa la plantilla y enlaza el HU o CR.
4. Atiende la revisión y las validaciones configuradas antes de integrar.
5. Prepara una rama `release/*` cuando una entrega esté lista para estabilizarse. Las correcciones urgentes parten de `main` en `hotfix/*`.

## Secretos y configuración

Usa variables de entorno para credenciales y claves. Mantén los valores locales en `.env`; comparte únicamente nombres de variables y valores ficticios en `.env.example`.
