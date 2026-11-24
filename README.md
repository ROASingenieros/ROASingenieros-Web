# ROAS Ingenieros — Plataforma Web y Panel de Gestión ERP

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Groq](https://img.shields.io/badge/Groq_AI-F55036?style=for-the-badge&logo=fastapi&logoColor=white)](https://groq.com/)

---

## 1. Descripción Ejecutiva

**ROAS Ingenieros Web** es una plataforma integral de gestión empresarial (ERP) y catálogo comercial público desarrollada para la empresa peruana de ingeniería eléctrica, telecomunicaciones y sistemas de puesta a tierra **ROAS Ingenieros S.A.C.** Permite gestionar de extremo a extremo el ciclo de cotizaciones, órdenes de venta, comprobantes electrónicos, despacho con guías de remisión, control reactivo de inventario y análisis con Inteligencia Artificial.

> [!WARNING]
> **AVISO DE MODO PRUEBA:** El módulo de facturación electrónica funciona en **modo prueba (entorno de simulación)** y no tiene validez tributaria ante SUNAT hasta que se complete la homologación e integración formal con un Operador de Servicios Electrónicos (OSE) o Proveedor de Servicios Electrónicos (PSE) autorizado.

La plataforma opera bajo una **arquitectura desacoplada en tres capas**:
* **Frontend:** Single Page Application (SPA) modular construida con React 19 y TypeScript.
* **Backend Serverless:** Microservicios y Edge Functions en Deno que actúan como custodios de seguridad.
* **Persistencia:** Base de datos relacional PostgreSQL en Supabase con Row Level Security (RLS), procedimientos almacenados RPC transaccionales y triggers reactivos.

---

## 2. Stack Tecnológico

| Capa | Tecnologías y Herramientas | Rol en la Plataforma |
| :--- | :--- | :--- |
| **Frontend / Cliente** | **React 19**, **TypeScript**, **Vite** | Interfaz de usuario interactiva y reactiva (Panel ERP y Catálogo Público). |
| | **Lucide React** | Paquete de iconografía corporativa y consistente. |
| | **ExcelJS**, **JSZip** | Manipulación y generación en memoria de libros de cálculo `.xlsx`. |
| | **QRCode** | Generación de códigos QR oficiales bajo normativa SUNAT. |
| **Backend / Edge Functions** | **Deno**, **TypeScript** | Entorno de ejecución serverless distribuido en el edge. |
| | **Supabase Edge Functions** | Funciones serverless para IA, creación de cuentas y verificación de red. |
| | **GoTrue Auth** | Manejo de sesiones, autenticación basada en JWT y roles. |
| **Datos y Persistencia** | **PostgreSQL (v15+)** | Motor de base de datos relacional transaccional. |
| | **Row Level Security (RLS)** | Políticas de control de acceso por fila basadas en roles. |
| | **PL/pgSQL** | Lenguaje procedimental para procedimientos RPC y triggers. |
| **Integraciones Externas** | **Groq Cloud API** | Modelos LLM de baja latencia (`openai/gpt-oss-20b`, Llama). |
| | **SUNAT / OSE / PSE** | Emisión y validación de Comprobantes de Pago Electrónicos (CPE). |
| | **WhatsApp Web API** | Notificación y canal directo de cotizaciones al cliente. |

---

## 3. Arquitectura y Patrones de Diseño (Gang of Four)

El sistema implementa rigurosamente siete patrones de diseño GoF distribuidos a lo largo de todas las capas arquitectónicas para garantizar alta cohesión, bajo acoplamiento, seguridad en profundidad y consistencia transaccional.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CAPA FRONTEND (React)                         │
│                                                                        │
│   [Patrón Factory Method]              [Patrón Strategy]               │
│   comprobantefactory.ts                ExportStrategy.ts               │
│   • BoletaElectronica                  • PdfExportStrategy             │
│   • FacturaElectronica                 • ExcelExportStrategy           │
│                                        • WhatsAppExportStrategy        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JWT / RPC
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CAPA BACKEND / EDGE FUNCTIONS (Deno)                 │
│                                                                        │
│   [Patrón Protection Proxy]            [Patrón Facade]                 │
│   usuarios/index.ts                    verificar-correo/index.ts       │
│   asistente_IA/index.ts                asistente_IA/index.ts           │
│   • Guardia JWT + RBAC                 • Orquestador de 5 subsistemas  │
│                                                                        │
│   [Patrón Adapter]                                                     │
│   asistente_IA/adapters/GroqAdapter.ts                                 │
│   • Traduce API anidada de Groq a interfaces limpias para React        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL Transaccional / Triggers
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CAPA DE PERSISTENCIA (PostgreSQL)                    │
│                   migrations/01patron_gof_persistencia.sql             │
│                                                                        │
│   [Patrón Command]                     [Patrón Observer]               │
│   Procedimientos RPC Atómicos          Triggers Reactivos              │
│   • convertir_cotizacion_a_venta       • fn_observador_auditoria       │
│   • confirmar_orden_venta              • fn_observador_stock           │
│   • anular_orden_venta (Undo)          • fn_observador_totales         │
└────────────────────────────────────────────────────────────────────────┘
```

### Matriz Detallada de Patrones de Diseño

| Patrón GoF | Tipo | Capa | Archivo Exacto | Problema Técnico que Resuelve |
| :--- | :--- | :--- | :--- | :--- |
| **Adapter** | Estructural | Backend / Edge | `backend/supabase/functions/asistente_IA/adapters/GroqAdapter.ts` | **Acoplamiento de esquemas externos:** La API de Groq devuelve respuestas complejas y anidadas (`choices[0].message.content`, metadatos de tokens y JSON incrustado en Markdown). El Adapter traduce y normaliza esta estructura hacia contratos estándar (`ResultadoFiscalEstandar` y `ResultadoTendenciasEstandar`), permitiendo que el frontend de React consuma la IA sin acoplarse al proveedor. |
| **Protection Proxy** | Estructural | Backend / Edge | `backend/supabase/functions/usuarios/index.ts`<br>`backend/supabase/functions/asistente_IA/index.ts` | **Exposición indebida de credenciales maestras:** Operaciones críticas (crear usuarios en GoTrue o usar la cuota de Groq) requieren `SUPABASE_SERVICE_ROLE_KEY`. El Protection Proxy intercepta la petición, verifica el token JWT contra Auth y comprueba el perfil activo y rol del usuario (`admin`), bloqueando con 401/403 antes de invocar la lógica privilegiada. |
| **Facade** | Estructural | Backend / Edge | `backend/supabase/functions/verificar-correo/index.ts`<br>`backend/supabase/functions/asistente_IA/index.ts` | **Complejidad de subprocesos secuenciales:** Oculta al cliente web la necesidad de coordinar múltiples subsistemas técnicos (validación RFC, dominios temporales antispam, resolución DNS MX/A en vivo, consultas de duplicados en base de datos y códigos de confirmación), exponiendo una interfaz REST simplificada de un solo paso. |
| **Factory Method** | Creacional | Frontend / Facturación | `frontend/src/externos/facturacion/comprobantefactory.ts` | **Lógica condicional dispersa y cálculos tributarios en la UI:** Desacopla a las vistas de React de evaluar manualmente si corresponde Boleta o Factura. Las clases `FacturaFactory` y `BoletaFactory` instancian sus productos concretos encapsulando automáticamente el cálculo de base imponible, desglose del **IGV (18 %)** con redondeo a 2 decimales y validaciones SUNAT (RUC 11 dígitos vs DNI 8 dígitos). |
| **Command** | Comportamiento | Persistencia / SQL | `backend/supabase/migrations/01patron_gof_persistencia.sql` | **Mutaciones parciales e inconsistencias ACID:** En lugar de ejecutar múltiples sentencias SQL desde el cliente con riesgo ante fallos de red, cada acción se encapsula en una RPC atómica con bloqueo de concurrencia (`convertir_cotizacion_a_venta`, `confirmar_orden_venta`, `anular_orden_venta` [Undo/Compensación], `crear_comprobante`). |
| **Observer** | Comportamiento | Persistencia / SQL | `backend/supabase/migrations/01patron_gof_persistencia.sql` | **Efectos colaterales acoplados:** Desacopla las mutaciones en las tablas de sus consecuencias. Triggers reactivos escuchan eventos DML (`AFTER INSERT/UPDATE/DELETE`) para: registrar auditoría histórica en JSONB (`fn_observador_auditoria`), auto-desactivar productos con stock $\le 0$ (`fn_observador_stock_y_visibilidad`) y recalcular subtotales e IGV en cabeceras ante cambios en ítems. |
| **Strategy** | Comportamiento | Frontend / Externos | `frontend/src/externos/ExportStrategy.ts` | **Múltiples formatos de salida acoplados a la vista:** Envuelve bajo el contrato común `IExportStrategy` las tres salidas existentes de cotizaciones (`PdfExportStrategy`, `ExcelExportStrategy` y `WhatsAppExportStrategy`). A través de `ExportContext`, la interfaz de usuario despacha cotizaciones polimórficamente sin alterar el código existente de Excel ni WhatsApp. |

---

## 4. Estructura de Directorios (Árbol del Proyecto)

El proyecto respeta el principio de responsabilidad única (**Single Responsibility Principle - SRP**) y la arquitectura limpia, separando estrictamente la presentación visual, la lógica de dominio y los adaptadores de infraestructura externa.

```text
ROASingenieros-Web/
├── backend/                               # LÓGICA DE BACKEND Y BASE DE DATOS
│   └── supabase/
│       ├── functions/                     # Supabase Edge Functions (Deno + TypeScript)
│       │   ├── asistente_IA/              # Edge Function: IA con Groq
│       │   │   ├── adapters/
│       │   │   │   └── GroqAdapter.ts     # [Patrón Adapter] Traductor de API Groq a React
│       │   │   └── index.ts               # [Patrones Protection Proxy y Facade]
│       │   ├── usuarios/                  # Edge Function: Cuentas y Roles
│       │   │   └── index.ts               # [Patrón Protection Proxy] Guarda de Service Role
│       │   ├── verificar-correo/          # Edge Function: Validación de Correos y DNS
│       │   │   └── index.ts               # [Patrón Facade] Orquestador de 5 subsistemas
│       │   ├── deno.d.ts                  # Declaraciones globales de tipos para Deno
│       │   └── tsconfig.json              # Configuración TypeScript del Backend
│       ├── migrations/
│       │   └── 01patron_gof_persistencia.sql # [Patrones Command y Observer] RPCs y Triggers
│       └── config.toml                    # Configuración de servicios locales de Supabase
├── frontend/                              # APLICACIÓN CLIENTE (React 19 + TypeScript)
│   ├── public/                            # Recursos estáticos y plantillas
│   │   ├── documentos/                    # Membretes corporativos para impresión/PDF
│   │   └── plantillas/                    # Plantillas Excel oficiales (cotizacion.xlsx)
│   └── src/
│       ├── datos/                         # Capa de Acceso a Datos
│       │   ├── supabase.ts                # Cliente Supabase, tipos en español y formatos
│       │   └── supabase-schema.sql        # Esquema referencial de tablas y RLS
│       ├── negocio/                       # Capa de Dominio y Reglas del Negocio
│       │   ├── empresa.ts                 # Constantes de emisor (RUC, razón social, dirección)
│       │   ├── texto.ts                   # Conversión de números a letras para SUNAT
│       │   └── validaciones.ts            # Validaciones de DNI, RUC, teléfonos y correos
│       ├── externos/                      # Capa de Adaptadores e Integraciones Externas
│       │   ├── documentos/
│       │   │   └── cotizacion-html.ts     # Renderizado HTML para impresión y PDF
│       │   ├── excel/                     # Manipulación de hojas de cálculo
│       │   │   ├── documentos.ts          # Mapeo de datos a marcas {{ }} de la plantilla
│       │   │   └── plantilla.ts           # Motor de reemplazo binario en plantillas XLSX
│       │   ├── facturacion/               # Facturación Electrónica SUNAT
│       │   │   ├── comprobantefactory.ts  # [Patrón Factory Method] Boleta y Factura
│       │   │   └── index.ts               # Mock de OSE/PSE y constructor de QR SUNAT
│       │   ├── ExportStrategy.ts          # [Patrón Strategy] Orquestador PDF, Excel y WhatsApp
│       │   ├── ia.ts                      # Cliente del panel para la Edge Function asistente
│       │   └── whatsapp.ts                # Utilitario de enlace y mensajes para WhatsApp
│       └── presentacion/                  # Capa de Vistas y Componentes UI
│           ├── gestion/                   # Panel de Administración ERP (Autenticado)
│           │   ├── componentes/           # Gráficos y tablas especializadas
│           │   ├── paginas/               # Pantallas (Cotizaciones, Comprobantes, Inventario, etc.)
│           │   ├── ui.tsx                 # Sistema de diseño y componentes atómicos
│           │   └── imprimir.ts            # Disparador de ventana de impresión / PDF
│           └── publico/                   # Catálogo Comercial Web y Cotizador Público
├── docs/                                  # DOCUMENTACIÓN TÉCNICA
│   └── DOCUMENTACION.md                   # Manual exhaustivo de arquitectura y manual de usuario
├── scripts/                               # SCRIPTS DE SOPORTE Y AUTOMATIZACIÓN
│   ├── plantilla-cotizacion.mjs           # Extractor de imágenes y membretes de plantillas
│   └── probar-plantillas.mjs              # Test de integridad de plantillas Excel
├── .env                                   # Variables de entorno públicas del cliente
├── eslint.config.js                       # Reglas de linting ECMAScript / TypeScript
├── package.json                           # Manifiesto de dependencias y scripts npm
├── tsconfig.json                          # Configuración raíz de TypeScript
└── vite.config.ts                         # Configuración del empaquetador Vite
```

---

## 5. Requisitos Previos e Instalación Paso a Paso

### Requisitos del Sistema
* **Node.js:** Versión `18.0.0` o superior (se recomienda `Node 20+ LTS`).
* **npm:** Versión `9.0.0` o superior.
* **Navegador Web:** Chrome, Edge, Firefox o Safari con soporte para ES2022.
* **Supabase CLI** *(opcional para desarrollo local de backend)*: `npx supabase`.

### Instalación Paso a Paso

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-organizacion/ROASingenieros-Web.git
   cd ROASingenieros-Web
   ```

2. **Instalar dependencias del proyecto:**
   ```bash
   npm install
   ```

3. **Configurar el archivo de variables de entorno:**
   Copie la plantilla de variables de entorno e ingrese sus claves públicas de Supabase:
   ```bash
   cp .env.example .env
   ```
   *(Abra `.env` y complete `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` sin exponer claves privadas).*

4. **Aplicar la migración de base de datos (Scripts Anexo S):**
   Ejecute el script SQL principal ubicado en `backend/supabase/migrations/01patron_gof_persistencia.sql` en el SQL Editor del panel de Supabase. Este script crea las 24 tablas, funciones RPC transaccionales (Command) y triggers reactivos (Observer), además de cargar los datos maestros de prueba (categorías, marcas, catálogo inicial de productos, empleados y clientes).

5. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible localmente en `http://localhost:5173`.

6. **Compilar para producción:**
   ```bash
   npm run build
   ```
   Genera el bundle optimizado en la carpeta `dist/`.

7. **Usuarios de prueba por rol:**
   Para ingresar al panel ERP (`http://localhost:5173/#/gestion`), utilice las cuentas de prueba configuradas en el entorno (sin contraseñas maestras expuestas en el repositorio):
   * **Gerente General (`admin`):** `gerencia@roasingenieros.com` (Control total: usuarios, compras a proveedores, costos de catálogo, reportes ejecutivos y pagos).
   * **Ingeniero Supervisor (`supervisor`):** `supervisor@roasingenieros.com` (Gestión técnica: cotizaciones, verificación de comprobantes, inventario y garantías).
   * **Secretaria (`secretaria`):** `secretaria@roasingenieros.com` (Operativa administrativa: clientes, órdenes de venta, emisión de comprobantes y guías de remisión).

---

## 6. Variables de Entorno y Seguridad

El sistema sigue estrictamente el principio de defensa en profundidad (**Defense in Depth**). Las credenciales se dividen categóricamente en dos niveles según su exposición:

### 1. Variables Públicas del Cliente (`.env` en la raíz)
Estas variables se empaquetan en el frontend mediante Vite y son visibles públicamente en el navegador. **Solo deben contener credenciales con permisos restringidos por Row Level Security (RLS)**:

```env
# URL del proyecto Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co

# Clave pública anónima (restringida automáticamente por políticas RLS en Postgres)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Variables Secretas del Servidor (Supabase Secrets)
> [!CAUTION]
> **REGLA CRÍTICA DE SEGURIDAD:**
> Las siguientes claves **NUNCA** deben incluirse en el archivo `.env`, ni subirse a Git, ni exponerse en el frontend. Si un usuario malintencionado obtuviera la `SUPABASE_SERVICE_ROLE_KEY`, podría omitir todas las políticas de RLS y tomar control total de la base de datos.

Estas variables deben configurarse **únicamente en los secretos seguros de Supabase** (a través del panel web de Supabase en *Project Settings → Edge Functions* o mediante Supabase CLI):

```bash
# Configurar clave maestra de administración (acceso con privilegios a GoTrue y Postgres)
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Configurar credenciales del proveedor de Inteligencia Artificial
npx supabase secrets set GROQ_API_KEY=gsk_...

# (Opcional) Modelo de Groq a utilizar (por defecto: openai/gpt-oss-20b)
npx supabase secrets set GROQ_MODEL=openai/gpt-oss-20b
```

---

## 7. Despliegue de Edge Functions

Para desplegar los microservicios del backend en Supabase Edge Functions con sus patrones de diseño integrados:

```bash
# Iniciar sesión en Supabase CLI
npx supabase login

# Vincular con el proyecto remoto
npx supabase link --project-ref tu-project-ref

# Desplegar Edge Functions
npx supabase functions deploy asistente_IA
npx supabase functions deploy usuarios
npx supabase functions deploy verificar-correo
```

---

## 8. Autores y Equipo de Desarrollo

Este proyecto ha sido diseñado e implementado por el equipo de ingeniería de sistemas para **ROAS Ingenieros S.A.C.**:

* **Equipo de Desarrollo:**
  `[NADIA NAHID, ESTRELLA QUIJANO]` — *[naestrellaqu@ucvvirtual.edu.pe/nn.estrellaq@gmail.com]*
  `[PIERO ALESSANDRO, SANTA VILLAVERDE]` — *[pisantavi@ucvvirtual.edu.pe/pierosanta6@gmail.com]*
  `[JHEFERSON ERICK, ROSADO BENAVIDES]` — *[correo@dominio.com]*
---

*© 2026 ROAS Ingenieros S.A.C. — Todos los derechos reservados.*
