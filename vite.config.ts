import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// La app React vive en frontend/ (ver "Mapa de carpetas" en docs/DOCUMENTACION.md);
// el backend de Supabase, en backend/. El .env y el dist/ siguen en la raíz.
export default defineConfig({
  root: fileURLToPath(new URL("./frontend", import.meta.url)),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    allowedHosts: true,
  },
  plugins: [react()],
});
