import type { Memory } from '@/types'

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

export interface DayGroup {
  key: string
  label: string
  count: number
  items: Memory[]
}

export interface MonthGroup {
  key: string
  label: string
  days: DayGroup[]
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Agrupa por mês/dia desc; sem data vai para "sem-data" no fim. */
export function groupByMonthDay(filtered: Memory[]): MonthGroup[] {
  const sorted = [...filtered].sort((a, b) => {
    const ta = Date.parse(a.created || '')
    const tb = Date.parse(b.created || '')
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
    if (Number.isNaN(ta)) return 1
    if (Number.isNaN(tb)) return -1
    return tb - ta
  })
  const months: MonthGroup[] = []
  let curM: MonthGroup | null = null
  let curD: DayGroup | null = null
  for (const m of sorted) {
    const d = new Date(m.created)
    const valid = !Number.isNaN(d.getTime())
    const mKey = valid ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'sem-data'
    const dKey = valid ? `${mKey}-${String(d.getDate()).padStart(2, '0')}` : 'sem-data'
    if (!curM || curM.key !== mKey) {
      curM = { key: mKey, label: valid ? capitalize(monthFmt.format(d)) : 'Sem data', days: [] }
      months.push(curM)
      curD = null
    }
    if (!curD || curD.key !== dKey) {
      curD = { key: dKey, label: valid ? capitalize(dayFmt.format(d)) : 'Sem data', count: 0, items: [] }
      curM.days.push(curD)
    }
    curD.items.push(m)
    curD.count += 1
  }
  return months
}
