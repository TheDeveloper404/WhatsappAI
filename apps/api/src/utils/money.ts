// Formatare sumă pentru mesaje către client. Banii sunt stocați ca integer (subunitate);
// împărțim la 100 și afișăm fără zecimale când suma e întreagă (45000 → „450"), altfel cu
// două zecimale (45050 → „450.50"). Eticheta monedei se atașează separat la apelator.
export function formatAmount(bani: number): string {
  const value = bani / 100
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
