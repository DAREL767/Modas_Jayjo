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

## Flujos operativos (CR-030)

### Edición de cuentas y cámara (CR-034)

Administración puede editar nombre, usuario, correo y contraseña desde Personal. Una contraseña vacía conserva la actual. Cambiar credenciales, rol o estado invalida las sesiones existentes en backend; un cambio solo de nombre no lo hace. El cliente vuelve al login ante una sesión invalidada y verifica la sesión al recuperar el foco y cada minuto. Cambiar credenciales propias cierra sesión inmediatamente. Cambiar el correo desvincula Google: para volver a entrar se requiere el nuevo correo autorizado y vincularlo con las credenciales locales.

«Escanear código» abre una cámara superpuesta en ventas; muestra el SKU leído para confirmar la variante antes de agregar. Inventario permite escanear para buscar o completar el SKU de una prenda nueva. El lector se carga solo al abrir el escáner, prioriza la cámara trasera y admite cambiar de cámara. Al leer, cancelar, salir de la página o cambiar de pestaña libera la cámara. Se mantienen la escritura manual y el lector físico.

La cámara requiere permiso y HTTPS (localhost funciona en el mismo dispositivo; una IP local por HTTP no). El video se procesa localmente con ZXing, no se graba ni se transmite. Lee códigos gráficos, no realiza OCR de números de serie impresos sin código. El contenido debe cumplir el formato de SKU del backend: 2–40 letras, números, puntos, guiones o guiones bajos.

El usuario confirmó el funcionamiento móvil de CR-034. La mejora del enfoque y de la lectura de etiquetas difíciles queda para un cambio posterior. La comprobación automatizada en Edge usa una cámara virtual con Code 128.

- Personal permite desactivar y reactivar cuentas desde administración usando la misma identidad e historial. Las listas de personal e inventario recorren todas las páginas de la API (100 registros por solicitud).
- Ventas busca por nombre, categoría, talla y color combinando términos en cualquier orden y sin distinguir tildes o mayúsculas. Un SKU exacto tiene prioridad. Las sugerencias se reducen al agregar términos.
- El código de barras o número de serie debe estar registrado en el campo SKU de la variante. Se admiten lectores que escriben el código y envían Enter, además de la cámara. Enter agrega únicamente una coincidencia exacta de SKU y nunca supera el stock. Después de agregar, el campo queda vacío y enfocado para el siguiente escaneo.
- Al entrar a ventas sin caja abierta se muestra la apertura dentro del mismo flujo. Administración abre y regresa automáticamente al catálogo; vendedores solicitan la apertura a administración y pulsan «Actualizar estado» para continuar. Si caja se cierra durante el cobro, se conserva el carrito y se vuelve a solicitar apertura.

## Contrato y autorización

### Descuentos y registro separado (CR-036)

Cada variante del carrito empieza con descuento $0 por unidad. El botón de descuento permite fijar un importe entero en COP hasta el precio unitario; se aplica a todas las unidades de esa variante. Si se retira la variante por completo, su descuento se elimina. Si no hay descuentos por prenda, antes de pasar al cobro se confirma un descuento global o $0. No se combinan ambos tipos. Cambiar cantidades o descuentos invalida la clave de reintento pendiente y obliga a confirmar de nuevo el descuento global cuando corresponda.

El backend conserva precio original, descuento por unidad, subtotal, descuento global/total y total neto. Stock se descuenta por cantidades; caja y cambio usan el total neto. El resumen del carrito, cobro y confirmación muestra los importes. Se retiró la ilustración simulada del escáner; la cámara sigue superpuesta.

El registro de prendas se abre con «Agregar prenda» y conserva el estilo y campos existentes. «Volver al inventario» regresa sin perder el borrador; al guardar se limpia la búsqueda y se vuelve al catálogo actualizado. Las fotografías de prendas de los mockups siguen pendientes de campo y almacenamiento; no se añaden en este cambio.

El lector multiformato actual incluye EAN/UPC, Code 39/93/128, ITF, Codabar, QR, Data Matrix, Aztec y PDF417. Puede recuperar referencias alfanuméricas codificadas, siempre que su contenido cumpla el SKU admitido; no lee texto impreso sin codificación gráfica ni acepta URLs QR como SKU.

### Dashboards por rol (CR-032)

El inicio de operación ofrece ventas e inventario a ambos roles. Administración tiene un selector de áreas en la cabecera para consultar su dashboard de gestión; el vendedor no ve ese selector. Volver al inicio conserva el área de origen, y salir de la sesión reinicia la navegación.

Gestión y Finanzas abre por ahora el inventario existente, donde administración gestiona precios y costos. Caja y Personal conservan sus módulos actuales. Métricas del día y Reportes de Novedades muestran «Próximamente», sin cifras ficticias ni navegación a pantallas inexistentes. La separación futura en pasos secuenciales queda fuera de este cambio.

Los recursos gráficos entregados se importan desde `src/assets/icons/` y `src/assets/logos/`; el logo se utiliza también en el inicio de sesión.

La interfaz consume rutas bajo `/api`: autenticación Google y `/me`, inventario, ventas, caja y usuarios. El backend valida permisos en cada solicitud; la visibilidad de módulos en la interfaz solo mejora la navegación y no sustituye la autorización del servidor.

El vendor puede consultar existencias y registrar ventas. El admin también administra prendas, usuarios y cierres de caja. El costo unitario solo se presenta para admin cuando la API lo devuelve.

La primera entrega requiere que el backend incluya las rutas POS (inventario, ventas y caja) del PR #20. La UI no crea sesiones de caja automáticamente ni simula una venta si la API rechaza la operación.
