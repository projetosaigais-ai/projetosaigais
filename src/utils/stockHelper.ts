/**
 * Retorna a data atual formatada como 'YYYY-MM-DD' no fuso horário 'America/Sao_Paulo'.
 */
export function getTodayStrSP(): string {
  const d = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const year = parts.find(p => p.type === 'year')?.value || '2026';
    return `${year}-${month}-${day}`;
  } catch (e) {
    const dSP = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const yyyy = dSP.getFullYear();
    const mm = String(dSP.getMonth() + 1).padStart(2, '0');
    const dd = String(dSP.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

/**
 * Calcula a quantidade de medicamento a decrementar e o total de dias passados.
 */
export function calculateStockDecrement(
  vezesAoDia: number | undefined,
  startDateStr: string,
  endDateStr: string
): { totalDecrement: number; updatedDays: number } {
  // Se for uso eventual ou não configurado, nada é decrementado automaticamente
  if (!vezesAoDia || vezesAoDia === 6) {
    return { totalDecrement: 0, updatedDays: 0 };
  }

  const d1 = new Date(startDateStr + "T00:00:00");
  const d2 = new Date(endDateStr + "T00:00:00");
  const diffTime = d2.getTime() - d1.getTime();
  const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysPassed <= 0) {
    return { totalDecrement: 0, updatedDays: 0 };
  }

  let totalDecrement = 0;
  const tempDate = new Date(startDateStr + "T00:00:00");

  // Percorre dia a dia para processar as regras
  for (let i = 1; i <= daysPassed; i++) {
    tempDate.setDate(tempDate.getDate() + 1);

    if (vezesAoDia >= 1 && vezesAoDia <= 4) {
      totalDecrement += vezesAoDia;
    } else if (vezesAoDia === 5) {
      // 1x no mês = verifica se ontem (d-1) foi o último dia do mês.
      // Se hoje (tempDate) é dia 1, significa que o mês virou e decrementamos 1 dose.
      if (tempDate.getDate() === 1) {
        totalDecrement += 1;
      }
    }
  }

  return { totalDecrement, updatedDays: daysPassed };
}
