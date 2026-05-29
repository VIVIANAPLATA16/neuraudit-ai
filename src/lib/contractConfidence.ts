/**
 * Heuristic confidence that pasted text resembles Colombian public procurement / contract documents.
 * Used to gate full corruption analysis (UI + API).
 */

export const CONTRACT_CONFIDENCE_MIN = 25;

type WeightedPattern = { re: RegExp; w: number };

const PROCUREMENT_PATTERNS: WeightedPattern[] = [
  { re: /\bsecop\b/i, w: 18 },
  { re: /contrataci[oó]n(\s+directa|\s+p[úu]blica|\s+estatal)?/i, w: 16 },
  { re: /\bley\s*80\b|\bley\s*1150\b/i, w: 14 },
  { re: /\badjudicaci[oó]n|\badjudicado\b/i, w: 14 },
  { re: /\bcdp\b|certificado\s+de\s+disponibilidad/i, w: 14 },
  { re: /\brp\b|registro\s+presupuestal/i, w: 12 },
  { re: /\bobjeto(\s+del)?\s+contrato|\bobjeto\s+contractual/i, w: 14 },
  { re: /\bentidad(\s+contratante)?|nombre_entidad/i, w: 12 },
  { re: /\bproveedor\b|\bcontratista\b|\bproveedor_adjudicado\b|\boferente\b/i, w: 12 },
  { re: /\bnit\b|nit\s*[:.\s]*[\d]/i, w: 14 },
  { re: /\bvalor(\s+del)?\s+contrato|\$\s*[\d.,]+|pesos|cop\b/i, w: 12 },
  { re: /\bcontrato(\s+)?(inter)?administrativo|\bcontratos?\b/i, w: 9 },
  { re: /\bplazo|vigencia|calendario/i, w: 10 },
  { re: /\bsupervis/i, w: 10 },
  { re: /cl[aá]usula|obligaciones/i, w: 10 },
  { re: /\bpropuesta\b|\boferta\b/i, w: 10 },
  { re: /\bproceso\s+de\s+selecci[oó]n|\bmodalidad\b/i, w: 12 },
  { re: /\bmipyme\b|\bpyme\b|\bempresa\s+ofertante/i, w: 8 },
];

/**
 * Returns 0–100. Values below CONTRACT_CONFIDENCE_MIN should not receive full IA / corruption pipeline.
 */
export function detectContractConfidence(text: string): number {
  const raw = text.trim();
  if (raw.length === 0) return 0;

  const lower = raw.toLowerCase();
  let score = 0;

  for (const { re, w } of PROCUREMENT_PATTERNS) {
    if (re.test(lower)) score += w;
  }

  if (score > 0) {
    score += Math.min(18, Math.floor(lower.length / 110));
  }

  if (raw.length < 90 && score < 35) {
    score = Math.min(score, 22);
  }

  return Math.min(100, score);
}
