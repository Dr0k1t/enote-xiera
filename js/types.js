// Tipos compartidos vía JSDoc. Para IDEs y type-checking estático.
// Importar con: /// <reference path="./types.js" />

/**
 * @typedef {Object} Note
 * @property {number} id              SERIAL de Supabase
 * @property {string} numero          '#0001'
 * @property {string} fecha           'YYYY-MM-DD'
 * @property {string} destino         uno de CONFIG.locations
 * @property {Product[]} productos
 * @property {('Nueva'|'En Proceso'|'Completada'|'Cancelada')} estatus
 * @property {string} observaciones
 * @property {(string|ImageRef)[]} imagenes
 * @property {boolean} tomada
 * @property {string|null} tomadaPor
 * @property {string|null} tomadaEn
 * @property {boolean} unreadNew
 * @property {boolean} unreadModified
 * @property {number} prioridad
 * @property {string} creadoPor
 * @property {string} creadoEn
 * @property {string|null} modificadoPor
 * @property {string|null} modificadoEn
 * @property {string} clienteNombre
 * @property {string} clienteDireccion
 * @property {string} clienteTelefono
 * @property {number} pastelCantidad
 * @property {number|null} pisos
 * @property {string} sabor
 * @property {string} kilos
 * @property {string} modelo
 * @property {string} texto
 * @property {string} colores
 * @property {string} horaEntrega
 * @property {string} horaPeriodo
 * @property {string} direccionEntrega
 * @property {number} costoPastel
 * @property {number} depositoEquipo
 * @property {number} arreglosFigura
 * @property {number} servicioDomicilio
 * @property {number} anticipo
 * @property {string} metodoPago
 */

/**
 * @typedef {'admin'|'planta'|'sucursal'|'repartidor'} Role
 */

/**
 * @typedef {Object} Session
 * @property {string} username
 * @property {Role} role
 * @property {string|null} destino
 * @property {string} email
 * @property {string|null} userId
 * @property {string} loginAt
 */

/** @typedef {{nombre:string, cantidad:string}} Product */
/** @typedef {{id:string, url:string, blob?:Blob, width?:number, height?:number, nombre?:string}} ImageRef */
