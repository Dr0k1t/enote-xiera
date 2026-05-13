description: Generar plan detallado con OpenCode y ejecutarlo en Claude Code
allowedTools: Bash, Read, Glob

# Comando: /plan-with-opencode

Este comando invoca a OpenCode como arquitecto para generar un plan de implementación detallado, luego lo cuestiona y lo ejecuta en Claude Code.

## Flujo de ejecución:

### Paso 1: Recolectar contexto del proyecto
- Lee el archivo CLAUDE.md del proyecto si existe
- Lee .claude/AGENTS.md si existe
- Obtiene la lista de archivos del proyecto

### Paso 2: Invocar a OpenCode para planificar
Ejecuta el siguiente comando:
```
Bash: node "C:\Users\extre\Documentos\integracion\scripts\invoke-opencode-plan.js" "TU_DESCRIPCION_AQUI"
```

Reemplaza "TU_DESCRIPCION_AQUI" con la tarea que necesitas planificar.

### Paso 3: Leer el plan generado
- Busca el archivo de plan generado (tendrá formato plan-YYYYMMDD-HHMMSS.md)
- Lee el contenido del plan

### Paso 4: CUESTIONAR el plan (OBLIGATORIO)
Antes de ejecutar cualquier paso, cuestiona el plan:
- ¿Los paths de archivos son correctos?
- ¿Las dependencias entre pasos son lógicas?
- ¿Hay riesgos no mencionados?
- ¿Qué podría salir mal en cada paso?

Presenta tus preguntas al usuario.

### Paso 5: Obtener aprobación
- Muestra el plan formateado al usuario
- Pregunta: "¿Aprobamos este plan? Responde 'si' para ejecutar o 'no' para cancelar"

### Paso 6: Ejecutar con verificación paso a paso
Si el usuario aprueba:
- Ejecuta cada paso del plan de forma secuencial
- Después de cada paso, verifica el resultado
- Reporta el progreso al usuario

## Notas importantes:
- Este comando solo debe ejecutarse con permisos de Plan activo (Shift+Tab dos veces)
- SIEMPRE cuestiona el plan antes de ejecutarlo
- Si detectas errores o inconsistencias, detén y reporta
- Los planes se guardan en C:\Users\extre\Documentos\integracion\planes\