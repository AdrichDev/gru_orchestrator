export function applyDevilsAdvocate(output: string, prompt: string): string {
  return `${output}\n\n[CRÍTICA DE DEVIL'S ADVOCATE]\n- Riesgos detectados: Posible sobreacoplamiento con proveedores externos. Dependencia de variables no definidas en el prompt original: "${prompt}".\n- Edge cases: ¿Qué pasa si el proveedor seleccionado no responde o falla en tiempo de ejecución?\n- Restricciones de arquitectura: La separación actual asume ejecución secuencial simple, no soporta paralelización real ni workflows asíncronos distribuidos en esta versión.`;
}
