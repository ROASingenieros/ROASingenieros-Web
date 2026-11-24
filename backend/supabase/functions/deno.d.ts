/**
 * Declaraciones globales de tipos para el entorno Deno en Supabase Edge Functions.
 * Proporciona soporte completo a VS Code para reconocer Deno, Deno.serve, Deno.env,
 * Deno.resolveDns y los imports con prefijo 'npm:@supabase/supabase-js@2'.
 */

declare namespace Deno {
  export interface DnsRecordMx {
    exchange: string;
    preference: number;
  }

  export function serve(
    handler: (req: Request) => Promise<Response> | Response
  ): void;

  export namespace env {
    export function get(key: string): string | undefined;
  }

  export function resolveDns(
    query: string,
    recordType: 'MX' | 'A' | 'AAAA' | string,
    options?: { nameServer?: { ipAddr: string; port?: number } }
  ): Promise<DnsRecordMx[] | string[] | unknown[]>;
}

declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}


