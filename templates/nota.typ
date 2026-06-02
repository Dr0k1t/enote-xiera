// nota.typ — recibo de remisión Xiera (réplica carbón). Compilado client-side con Typst WASM.
// Todos los datos entran como strings vía `sys.inputs` (ver js/typstReceipt.js).

#let inp(key, default: "") = sys.inputs.at(key, default: default)

// ---- Paleta / fuentes (réplica del recibo HTML) ----
#let tinta   = rgb("#2b2b2b")   // texto base
#let negro   = rgb("#1a1a1a")   // líneas / títulos
#let azulHw  = rgb("#172c5c")   // manuscrita azul (valores)
#let rojoHw  = rgb("#b32626")   // pluma roja (pedido)
#let papel   = rgb("#e8e7e3")   // fondo papel carbón

#let cuerpo  = "Jost"
#let mano    = "Caveat"

// ---- Página fitida tipo nota (no carta vacía); imprime/comparte limpio ----
#set page(width: 16cm, height: auto, margin: (x: 14mm, y: 12mm), fill: papel)
#set text(font: cuerpo, size: 10pt, fill: tinta, lang: "es")

// ---- Helpers ----
#let hw(v) = text(font: mano, fill: azulHw, size: 18pt, weight: 500, baseline: 2pt)[#v]
#let hwRojo(v) = text(font: mano, fill: rojoHw, size: 22pt, weight: 500, baseline: 2pt)[#v]

#let divisor(titulo) = {
  v(3mm)
  line(length: 100%, stroke: 2pt + negro)
  if titulo != "" {
    align(center, text(size: 10pt, weight: 500, tracking: 1pt)[#titulo])
    line(length: 100%, stroke: 2pt + negro)
  }
  v(1mm)
}

#let campo(label, valor) = {
  grid(columns: (auto, 1fr), gutter: 2mm,
    text(weight: 500)[#label],
    text[#valor],
  )
  v(1.5mm)
}

#let campoHw(label, valor) = {
  grid(columns: (auto, 1fr), gutter: 2mm,
    text(weight: 500)[#label],
    hw(valor),
  )
  v(1.5mm)
}

// ---- Corazón (SVG inline, réplica del logo) ----
#let corazon = ```<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 40 80 C 25 70, 15 45, 25 30 C 35 15, 60 10, 75 25 C 85 35, 80 50, 70 50 C 60 50, 50 35, 55 25 C 60 15, 75 15, 85 25 C 95 35, 95 55, 80 70 C 65 85, 45 85, 40 80 Z" fill="none" stroke="#1a1a1a" stroke-width="1.5"/></svg>```.text

// =========================================================================
// HEADER
// =========================================================================
#align(center)[
  #grid(columns: (auto, auto), align: horizon, gutter: 2mm,
    text(size: 26pt, weight: 300, tracking: 6pt)[X I E R A],
    box(width: 9mm, image(bytes(corazon), format: "svg")),
  )
  #v(-1mm)
  #text(size: 7pt, tracking: 4pt, weight: 500)[P A L '  A L M A]
  #v(2mm)
  #text(size: 9pt)[
    \@#inp("instagram")  ·  #inp("phone")  ·  #inp("facebook")
  ]
  #v(0.5mm)
  #text(size: 9pt)[#inp("address")]
]

#v(3mm)

// META: FECHA / VENDEDOR / PEDIDO
#grid(columns: (1fr, 1fr, 1fr), align: (left, center, right),
  [#text(weight: 500)[FECHA: ] #hw(inp("fecha"))],
  [#text(weight: 500)[VENDEDOR: ] #hw(inp("vendedor"))],
  [#text(weight: 500)[PEDIDO: ] #hwRojo(inp("numero"))],
)

// =========================================================================
// CLIENTE
// =========================================================================
#divisor("DATOS DE CLIENTE")
#campo("NOMBRE:", inp("clienteNombre"))
#campo("DIRECCIÓN:", inp("clienteDireccion"))
#campo("TELÉFONO:", inp("clienteTelefono"))

// =========================================================================
// PASTEL
// =========================================================================
#divisor("DATOS DE PASTEL")
#grid(columns: (1fr, 1fr), gutter: 4mm,
  campo("PASTEL:", inp("pastelCheck")),
  campo("PISOS:", inp("pisos")),
)
#grid(columns: (1fr, 1fr), gutter: 4mm,
  campo("SABOR:", inp("sabor")),
  campo("KILOS:", inp("kilos")),
)
#grid(columns: (1fr, 1fr), gutter: 4mm,
  campo("MODELO:", inp("modelo")),
  campo("TEXTO:", inp("texto")),
)
#campo("COLORES:", inp("colores"))

// =========================================================================
// ENTREGA
// =========================================================================
#divisor("DATOS DE ENTREGA")
#grid(columns: (auto, auto, auto, auto, 1fr), align: horizon, gutter: 3mm,
  text(weight: 500)[FECHA:],
  [[DÍA] #hw(inp("dia")) #h(2mm) [MES] #hw(inp("mes")) #h(2mm) [AÑO] #hw(inp("anio"))],
  text(weight: 500)[HORA:],
  [#hw(inp("horaEntrega")) #text(size: 8pt)[#inp("horaPeriodo")]],
  [],
)
#v(1.5mm)
#campo("DIRECCIÓN:", inp("direccionEntrega"))
#campo("OBSERVACIONES:", inp("observaciones"))

// =========================================================================
// TOTALES
// =========================================================================
#v(2mm)
#line(length: 100%, stroke: 3pt + negro)
#v(2mm)

#let filaMonto(label, valor) = {
  grid(columns: (1fr, auto), align: (left, right),
    text(weight: 500)[#label],
    [( \$ #hw(valor) )],
  )
  v(1mm)
}

#filaMonto("COSTO PASTEL:", inp("costoPastel"))
#filaMonto("DEPÓSITO EQUIPO:", inp("depositoEquipo"))
#filaMonto("ARREGLOS Y FIGURA:", inp("arreglosFigura"))
#filaMonto("SERVICIO A DOMICILIO:", inp("servicioDomicilio"))
#filaMonto("TOTAL:", inp("total"))

#grid(columns: (1fr, auto, auto), align: (left, right, left), gutter: 3mm,
  text(weight: 500)[ANTICIPO:],
  [( \$ #hw(inp("anticipo")) )],
  text(size: 8pt, fill: gray)[#inp("metodoPago")],
)
#v(2mm)
#grid(columns: (1fr, auto), align: (left, right),
  text(weight: 500)[SALDO A PAGAR:],
  hw(inp("saldo")),
)
