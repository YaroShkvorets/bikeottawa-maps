/**
 * Reads the everyday subset of OpenStreetMap's `opening_hours` syntax (weekdays
 * and times, e.g. "Mo-Fr 07:30-18:00; Sa,Su 08:00-16:00") to say whether a place
 * is open and when that changes. Anything beyond that subset (seasons, dates,
 * sunrise, open-ended times) is not guessed at: parseHours returns null and the
 * raw text is shown on its own.
 */

/** Opening span in minutes from the start of its day; `end` passes 1440 when it runs past midnight. */
export type Span = [start: number, end: number]
/** Spans for each weekday, Monday first. */
export type Week = Span[][]

const DAY = 1440
const DAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']
const DAY_TOKEN = /^(mo|tu|we|th|fr|sa|su|ph)(?![a-z])/
const TIME_SPAN = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})(?![\d+])/

interface Group {
  /** Weekday indexes, or null for a public-holiday-only group, which is ignored. */
  days: number[] | null
  spans: Span[]
}

/** Parses one `;`-separated rule, which may hold several comma-separated groups. */
function parseRule(rule: string): Group[] | null {
  const groups: Group[] = []
  let rest = rule.trim()
  const skip = (n: number) => {
    rest = rest.slice(n).trimStart()
  }

  while (rest) {
    // Weekdays: "Mo", "Mo-Fr", "Sa,Su", "Su-We". None means every day.
    let days: number[] = []
    let holidayOnly = false
    let named = false
    for (;;) {
      const from = DAY_TOKEN.exec(rest)
      if (!from) break
      named = true
      skip(from[0].length)
      let range = [from[1]]
      if (rest.startsWith('-')) {
        const to = DAY_TOKEN.exec(rest.slice(1).trimStart())
        if (!to) return null
        skip(1)
        skip(to[0].length)
        if (from[1] === 'ph' || to[1] === 'ph') return null
        // Ranges may wrap around the week, like Su-We.
        range = []
        for (let d = DAYS.indexOf(from[1]); ; d = (d + 1) % 7) {
          range.push(DAYS[d])
          if (DAYS[d] === to[1]) break
        }
      }
      days.push(...range.filter((d) => d !== 'ph').map((d) => DAYS.indexOf(d)))
      if (range.includes('ph') && range.length === 1 && days.length === 0) holidayOnly = true
      // A comma continues the list only when another weekday follows it.
      const more = /^,\s*/.exec(rest)
      if (!more || !DAY_TOKEN.test(rest.slice(more[0].length))) break
      skip(more[0].length)
    }
    if (!named) days = [0, 1, 2, 3, 4, 5, 6]
    if (days.length > 0) holidayOnly = false

    // Times: "07:30-18:00", several separated by commas, or off/closed.
    const spans: Span[] = []
    const off = /^(off|closed)(?![a-z])/.exec(rest)
    if (off) {
      skip(off[0].length)
    } else {
      for (;;) {
        const time = TIME_SPAN.exec(rest)
        if (!time) return null
        const start = Number(time[1]) * 60 + Number(time[2])
        let end = Number(time[3]) * 60 + Number(time[4])
        if (start > DAY || end > DAY || Number(time[2]) > 59 || Number(time[4]) > 59) return null
        // An end at or before the start is on the next day; 00:00-00:00 is the whole day.
        if (end <= start) end += DAY
        spans.push([start, end])
        skip(time[0].length)
        const more = /^,\s*/.exec(rest)
        if (!more || !TIME_SPAN.test(rest.slice(more[0].length))) break
        skip(more[0].length)
      }
    }
    groups.push({ days: holidayOnly ? null : days, spans })

    if (!rest) break
    // Another group may follow after a comma; anything else is beyond this parser.
    if (!rest.startsWith(',')) return null
    skip(1)
    if (!rest) return null
  }
  return groups
}

/** The weekly hours, or null when the text uses syntax this parser does not cover. */
export function parseHours(text: string): Week | null {
  const value = text.trim().toLowerCase()
  if (!value) return null
  if (value === '24/7') return DAYS.map((): Span[] => [[0, DAY]])

  const week: Week = DAYS.map(() => [])
  for (const rule of value.split(';')) {
    if (!rule.trim()) continue
    const groups = parseRule(rule)
    if (!groups) return null
    // A later rule replaces what earlier rules said about the days it names;
    // groups within one rule add to each other.
    const replaced = new Set<number>()
    for (const { days, spans } of groups) {
      for (const day of days ?? []) {
        if (!replaced.has(day)) week[day] = []
        replaced.add(day)
        week[day].push(...spans)
      }
    }
  }
  return week
}

/** A moment in the week: weekday (Monday = 0) and minutes into that day. */
export interface WeekTime {
  day: number
  minutes: number
}

export type HoursStatus =
  | { open: true; always: true }
  /** `daysAhead` is 0 for today, 1 for tomorrow, and so on. */
  | { open: true; always: false; until: WeekTime; daysAhead: number }
  | { open: false; opens: (WeekTime & { daysAhead: number }) | null }

/** Whether the place is open at `now`, and when it next closes or opens. */
export function hoursStatus(week: Week, now: WeekTime): HoursStatus {
  // Lay the spans out on one timeline, in minutes from the start of today,
  // from yesterday (for spans running past midnight) to a week ahead.
  const spans: Span[] = []
  for (let offset = -1; offset <= 7; offset++) {
    for (const [start, end] of week[(((now.day + offset) % 7) + 7) % 7]) {
      spans.push([offset * DAY + start, offset * DAY + end])
    }
  }
  spans.sort((a, b) => a[0] - b[0])
  // Join spans that touch or overlap, so "until" is when the doors really close.
  const merged: Span[] = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1])
    else merged.push([...span])
  }

  const at = (minute: number): WeekTime & { daysAhead: number } => {
    const daysAhead = Math.floor(minute / DAY)
    return { day: (now.day + daysAhead) % 7, minutes: minute - daysAhead * DAY, daysAhead }
  }
  const current = merged.find(([start, end]) => start <= now.minutes && now.minutes < end)
  if (current) {
    if (current[1] >= 7 * DAY) return { open: true, always: true }
    const { daysAhead, ...until } = at(current[1])
    return { open: true, always: false, until, daysAhead }
  }
  const next = merged.find(([start]) => start > now.minutes)
  return { open: false, opens: next ? at(next[0]) : null }
}

/** The current weekday and time of day in the given time zone. */
export function weekTimeIn(timeZone: string, date = new Date()): WeekTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    day: DAYS.indexOf(part('weekday').slice(0, 2).toLowerCase()),
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  }
}

/** Monday 1 January 2024, used to turn a weekday and time of day into a date for formatting. */
const A_MONDAY = Date.UTC(2024, 0, 1)

/**
 * The status in words: "Open until 6:00 p.m.", "Opens tomorrow at 9:00 a.m.".
 * `phrases` are templates with {time} and {day} placeholders.
 */
export function describeStatus(
  status: HoursStatus,
  locale: string,
  phrases: {
    openUntil: string
    open24: string
    opensAt: string
    opensTomorrow: string
    opensDay: string
    closed: string
  },
): string {
  const moment = ({ day, minutes }: WeekTime) => new Date(A_MONDAY + (day * DAY + minutes) * 60000)
  const time = (t: WeekTime) =>
    new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(moment(t))
  const weekday = (t: WeekTime) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(moment(t))

  if (status.open) return status.always ? phrases.open24 : phrases.openUntil.replace('{time}', time(status.until))
  if (!status.opens) return phrases.closed
  const template =
    status.opens.daysAhead === 0
      ? phrases.opensAt
      : status.opens.daysAhead === 1
        ? phrases.opensTomorrow
        : phrases.opensDay
  return template.replace('{time}', time(status.opens)).replace('{day}', weekday(status.opens))
}
