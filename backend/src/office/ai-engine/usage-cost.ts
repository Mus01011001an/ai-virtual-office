/** Estimasi biaya USD per token (kasar, untuk tab Performance). */
export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const m = (model || '').toLowerCase();
  let p = 0.0000025;
  let c = 0.00001;
  if (m.includes('mini') || m.includes('flash') || m.includes('haiku')) { p = 0.00000015; c = 0.0000006; }
  else if (m.includes('deepseek')) { p = 0.00000014; c = 0.00000028; }
  else if (m.includes('sonnet')) { p = 0.000003; c = 0.000015; }
  else if (m.includes('opus')) { p = 0.000015; c = 0.000075; }
  return promptTokens * p + completionTokens * c;
}
