# Guía de uso — Enote para Xiera

> **¿Qué es Enote?**
> Es la aplicación de Xiera para registrar y dar seguimiento a las notas de remisión. Reemplaza el papel y te permite saber en todo momento qué pedidos están en proceso, quién los recibió y cómo están.

---

## Cómo entrar a la aplicación

1. Abre tu celular o computadora y escribe en el navegador:

   👉 **xiera.site**

2. Te va a aparecer una pantalla para iniciar sesión. Escribe tu correo y contraseña.
   2.1 En iOS darle en compartir, luego en agregar a inicio y tener activada la opción "abrir como app web" 
   2.2 En Android compartir puede decir instalar  o agregar acceso directo a inicio o agregar a inicio, cualquiera es correcta
   
3. Presiona **Entrar**.

> Si no recuerdas tu contraseña, avísale al administrador. Él puede ayudarte a recuperarla.

---

## La pantalla principal

Cuando entras, ves todas las notas registradas. Cada "tarjeta" es una nota. Desde aquí puedes:

- 🔍 **Buscar** una nota por nombre de producto o número
- 📅 **Filtrar por semana** — para ver solo las notas de ciertos días
- ➕ **Crear una nota nueva** (si tu perfil lo permite)
- 👆 **Tocar cualquier tarjeta** para ver el detalle completo

En la parte de arriba también hay:

- **Tu nombre** y el botón para cerrar sesión
- **⟳ (flecha circular)** — para actualizar la lista
- Si aparece **⟳ 2** (con un número), significa que tienes notas guardadas sin internet que aún no se enviaron

---

## Cómo crear una nota nueva

1. Presiona el botón **+ Nueva nota** (esquina superior)

2. Llena los datos:
   - **Fecha** — el día de la nota
   - **Destino** — a qué planta o sucursal va el pedido
   - **Productos** — escribe cada producto y su cantidad. Puedes agregar varios.
   - **Observaciones** — cualquier nota extra (opcional)
   - **Fotos** — puedes adjuntar hasta 3 fotos del pedido (opcional)

3. Presiona **Guardar**.

La nota queda registrada con un número de folio (por ejemplo `#0042`).

---

## Los estados de una nota

Cada nota tiene un color y texto que indica en qué etapa está:

| Estado | Significado |
|--------|-------------|
| 🟡 **Nueva** | Recién creada, aún no la vio planta |
| 🔵 **En Proceso** | Planta ya la vio y está trabajando en ella |
| 🟢 **Completada** | El pedido está listo o fue entregado |
| ⛔ **Cancelada** | Se canceló el pedido |

> Cuando el encargado de planta abre una nota **Nueva**, el sistema la cambia automáticamente a **En Proceso**.

---

## Ver el detalle de una nota

Toca cualquier tarjeta para abrirla. Ahí verás:

- Todos los productos del pedido
- Quién la creó y cuándo
- El historial de cambios
- Las fotos (si tiene)
- Botones para editar, imprimir o eliminar (según tu perfil)

---

## Imprimir o compartir el recibo

Dentro del detalle de una nota, presiona el botón **Imprimir / PDF**.

- Si estás en el celular, te dará la opción de **compartir por WhatsApp** u otras apps.
- Si estás en computadora, descargará el PDF directamente.

El recibo tiene el logo de Xiera y toda la información del pedido.

---

## Vista del repartidor

Si tienes perfil de **repartidor**, al entrar verás una lista de notas asignadas.

- Cada nota tiene un interruptor **Tomada / No tomada**
- Actívalo cuando ya recogiste o entregaste ese pedido

---

## Cambiar el estatus de una nota

Si tienes permiso de editar:

1. Abre el detalle de la nota
2. Toca **Cambiar estatus**
3. Elige el nuevo estado
4. Si la nota ya estaba en proceso, el sistema te mostrará un aviso con los cambios para que confirmes

---

## Sin internet — ¿qué pasa?

La aplicación **funciona aunque no haya internet**. Si creas una nota sin conexión:

- Se guarda en tu teléfono/computadora automáticamente
- Aparece en la lista con el texto **"Sin folio"** y un borde punteado
- Cuando regrese el internet, se envía sola al servidor y recibe su número de folio

El número que ves en la barra (ejemplo: **⟳ 2**) te dice cuántas notas están esperando enviarse.

> No cierres la aplicación ni el navegador mientras tengas notas pendientes — espera a que desaparezca el número.

---

## Preguntas frecuentes

**¿Se perdió mi nota?**
No se pierde. Si no tienes internet, está guardada en tu dispositivo (aparece con "Sin folio"). Cuando vuelva la conexión, se sincroniza sola.

**La aplicación no carga**
Intenta cerrar y volver a abrir el navegador. Si el problema sigue, recarga la página con el botón ⟳ del navegador (no el de la app).

**¿Olvidé mi contraseña?**
Avísale al administrador del sistema para que te la resetee desde el panel de Supabase.

**¿Puedo usar la app en varios dispositivos?**
Sí. La información se sincroniza entre todos los dispositivos que tengan conexión.

**¿Se puede instalar en el celular?**
Sí. Cuando abres xiera.site, el navegador te puede ofrecer "Agregar a la pantalla de inicio". Acepta esa opción y la app queda como ícono en tu celular, igual que cualquier otra aplicación.

**¿Qué pasa si dos personas editan la misma nota al mismo tiempo?**
El sistema detecta el conflicto y te avisa. Te mostrará la versión del servidor y la tuya para que elijas cuál conservar.

---

## Contacto y soporte

Si tienes problemas con la aplicación, contacta al desarrollador del sistema o al administrador de Xiera.
