// ============================================================================
// Datos del emisor: una sola fuente para documentos (PDF y Excel).
// Cuando el RUC/dirección cambien, se cambian aquí.
// ============================================================================
export const EMPRESA = {
  nombre: "ROAS INGENIEROS E.I.R.L.",
  razon_social: "ROAS Ingenieros E.I.R.L.",
  ruc: "20615028488",
  direccion: "Ate, Lima, Perú",
  ciudad: "LIMA",
  // Datos de pago que lleva la cotización (los mismos del formato en papel).
  forma_pago: "Contado",
  cuenta_interbank: "2003007827316",
  cuenta_interbancaria: "003-200-003007827316-33",
} as const;
