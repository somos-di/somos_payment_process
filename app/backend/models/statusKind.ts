import { z } from 'zod';

// Serializador (pydantic-alike) do catálogo payment.status_kind: valida/desserializa
// as linhas vindas do banco antes de qualquer uso.
export const statusKindSchema = z.object({
  id_skn: z.number().int(),      // = status_step_prc
  descr_skn: z.string(),         // rótulo exibido
  key_skn: z.string().nullable(), // identificador estável p/ lógica (ex.: 'aguardando')
});
export type StatusKind = z.infer<typeof statusKindSchema>;

// Catálogo normalizado que o front consome PRONTO (sem parse do lado de lá):
//   byId  -> rótulos por código  (CONFIG.STEPS)
//   byKey -> código por chave    (CONFIG.STATUS, usado nas comparações de tela)
export interface StatusCatalog {
  byId: Record<number, string>;
  byKey: Record<string, number>;
}

export function toStatusCatalog(rows: unknown[]): StatusCatalog {
  const byId: Record<number, string> = {};
  const byKey: Record<string, number> = {};
  for (const row of rows) {
    const s = statusKindSchema.parse(row);   // desserializa + valida
    byId[s.id_skn] = s.descr_skn;
    if (s.key_skn) byKey[s.key_skn] = s.id_skn;
  }
  return { byId, byKey };
}
