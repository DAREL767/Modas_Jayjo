# Changelog

Los cambios relevantes de Modas Jayjo POS se documentan siguiendo
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Las entregas usan
versionado semántico y se identifican mediante etiquetas Git.

## [Unreleased]

## [1.0.0] - 2026-11-22

Primera entrega estable del sistema POS del negocio, consolidada desde
`develop` mediante `release/v1.0.0` (CR-048). El solicitante verificó el
despliegue y el uso en móvil y PC antes de autorizar esta entrega.

### Añadido

- Backend modular con FastAPI y persistencia asíncrona en MongoDB, puertos,
  repositorios, validación de datos y transacciones para operaciones POS.
- Autenticación con Google vinculada a cuentas locales autorizadas, JWT,
  permisos de vendedor/administrador y protección de credenciales.
- Gestión de personal: creación, edición, desactivación, reactivación y
  revocación de sesiones ante cambios críticos (CR-030, CR-034).
- Inventario por SKU, talla y color, precios, costos restringidos a
  administración, ajustes de stock e historial de movimientos.
- Búsqueda por nombre, categoría y variantes, prioridad del SKU exacto,
  lector físico y escaneo por cámara en ventas e inventario (CR-030, CR-034).
- Flujo responsivo de selección de prendas, carrito, descuentos en pesos
  por unidad o global, cobro y comprobante persistente hasta cierre manual
  (CR-025, CR-036, CR-038).
- Billetes acumulables de 2, 5, 10, 20, 50 y 100 mil pesos, pago exacto y
  cálculo del cambio (CR-038).
- Apertura, cierre e historial de caja, arqueo con diferencias y consulta
  de ventas asociadas a cada cierre (CR-042).
- Solicitudes por defectos en inventario y cambios del cliente vinculados
  a líneas de la venta original. Aprobación administrativa con movimientos
  transaccionales de stock y cobros/devoluciones en caja (CR-040, CR-042).
- Paneles de operación y administración, métricas reales del día de Bogotá
  y acceso al inventario filtrado por alertas (CR-032, CR-044).
- Pruebas unitarias de backend y frontend, integración con una base temporal
  de Atlas y validaciones automatizadas en GitHub Actions.
- Avisos de derechos reservados, documentación principal y colaboración
  autorizada para este proyecto personal y propietario (CR-046).

### Mejorado

- Reanudación del flujo de ventas cuando se requiere abrir caja,
  conservando el carrito y los permisos administrativos (CR-030).
- Registro de prendas separado del catálogo, fotografía opcional mostrada
  en el carrito y eliminación lógica diferenciada de desactivación,
  preservando las referencias históricas (CR-036, CR-038).
- Acceso a cambios desde inventario y selección directa de variantes o
  prendas vendidas, con búsqueda del historial de ventas (CR-042).
- Consultas cada 10 segundos mientras las pantallas están visibles, sin
  WebSockets, con cancelación, prevención de solapamientos y conservación
  de borradores. Los cambios de precio o disponibilidad requieren revisar
  el carrito antes de cobrar (CR-044).
- Versión del frontend alineada con la API en `1.0.0` y comprobaciones de CI
  extendidas a `main` y `release/*` para futuras entregas (CR-048).

### Consideraciones de la entrega

- La cámara necesita HTTPS y permiso del dispositivo; interpreta códigos
  gráficos, no texto mediante OCR. Etiquetas difíciles pueden requerir
  búsqueda manual o lector físico.
- Las transacciones requieren MongoDB compatible, como Atlas o un replica
  set. La configuración y los secretos se suministran por entorno.
- El comprobante de venta es un resumen de la operación; esta entrega no
  incorpora integración de facturación electrónica fiscal.

[Unreleased]: https://github.com/DAREL767/Modas_Jayjo/compare/v1.0.0...develop
[1.0.0]: https://github.com/DAREL767/Modas_Jayjo/tree/v1.0.0
