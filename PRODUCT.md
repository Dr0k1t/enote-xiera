# Product

## Register

product

## Users

Tres roles en una panadería física (Xiera, Ocotlán, Jalisco):

- **Dueño / admin**: gestiona todas las notas, acceso completo desde desktop o celular. Contexto: oficina o piso de producción.
- **Trabajadores de planta**: procesan notas y actualizan estatus. Baja alfabetización digital. Usan celular o tablet, a veces con manos ocupadas o mojadas.
- **Repartidores**: marcan entregas desde celular Android en tránsito. Interacción mínima, velocidad máxima.

Job to be done: reemplazar la nota de remisión en papel (carbón físico) con un sistema digital que no requiere aprendizaje ni capacitación técnica.

## Product Purpose

Enote convierte las notas de remisión manuales de Xiera en un flujo digital multi-usuario con trazabilidad de estatus, imágenes y sincronización offline. El éxito es cuando los trabajadores dejan de usar papel y confían en la app sin fricción.

## Brand Personality

Cálida, artesanal, confiable — como el negocio mismo. El diseño debe sentirse familiar y cercano, nunca corporativo ni frío. La interfaz es una herramienta de trabajo, no una demostración de tecnología.

## Anti-references

- **SaaS genérico** (Notion, Linear, Jira): sin blancos vacíos, sin tipografía minimalista "tech", sin ícono + título + texto repetido en grid.
- **ERP corporativo** (SAP, Excel-like): sin tablas densas sin color, sin frialdad gris, sin jerarquías de menú profundas.
- **Apps de delivery consumer** (Rappi, Uber Eats): sin colores neón, sin gamificación, sin cheerfulness forzado.

El palette vino/terracota actual ya marca la dirección correcta.

## Design Principles

1. **Legibilidad sobre densidad.** Trabajadores leen de pasada en ambientes con poca luz o distracción. Texto grande, contraste alto, información que entra a primera vista.
2. **Targets táctiles amplios.** Manos ocupadas, pantallas con salpicaduras. Nada interactivo menor de 44px de área.
3. **El estatus es lo primero.** El workflow (Nueva / En Proceso / Completada / Cancelada) debe ser imposible de ignorar. Color y jerarquía al servicio del estado de la nota.
4. **Offline sin alarmas.** La falta de conexión es normal en el contexto. La UI la comunica sin términos técnicos ni mensajes de error que asusten.
5. **Calidez funcional.** El estilo artesanal genera confianza, no decoración. Cada decisión visual debe justificarse en usabilidad, no en estética.

## Accessibility & Inclusion

- Todos los dispositivos: Android (principal), iOS, tablet, desktop.
- Touch-first: área mínima de toque 44×44 px, spacing generoso entre elementos interactivos.
- Usuarios con baja familiaridad digital: labels descriptivos, sin jerga técnica, mensajes de error en lenguaje cotidiano.
- Legibilidad práctica: contraste ≥ 4.5:1 en texto body, ≥ 3:1 en elementos UI grandes.
- Sin dependencia de color como único indicador de estado (usar color + label + ícono).
