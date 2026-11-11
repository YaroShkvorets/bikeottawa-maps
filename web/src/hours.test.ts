import { describe, expect, it } from 'vitest'
import { describeStatus, hoursStatus, parseHours, weekTimeIn } from './hours'

const MO = 0
const TU = 1
const FR = 4
const SA = 5
const SU = 6
const at = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return { day, minutes: h * 60 + m }
}

describe('parseHours', () => {
  it('reads weekday ranges, lists and several rules', () => {
    const week = parseHours('Mo-Fr 07:30-18:00; Sa,Su 08:00-16:00')
    expect(week?.[MO]).toEqual([[450, 1080]])
    expect(week?.[FR]).toEqual([[450, 1080]])
    expect(week?.[SA]).toEqual([[480, 960]])
    expect(week?.[SU]).toEqual([[480, 960]])
  })

  it('treats hours without weekdays as every day, and a later rule as replacing that day', () => {
    const week = parseHours('06:00-15:00; Su 07:00-15:00')
    expect(week?.[MO]).toEqual([[360, 900]])
    expect(week?.[SU]).toEqual([[420, 900]])
  })

  it('reads comma-separated groups, wrapping ranges and hours past midnight', () => {
    const week = parseHours('Su-Th 11:00-02:00, Fr,Sa 11:00-04:00')
    expect(week?.[SU]).toEqual([[660, 1560]])
    expect(week?.[TU]).toEqual([[660, 1560]])
    expect(week?.[FR]).toEqual([[660, 1680]])
    expect(parseHours('We, Sa 10:00-16:00')?.[SA]).toEqual([[600, 960]])
    expect(parseHours('We, Sa 10:00-16:00')?.[MO]).toEqual([])
  })

  it('reads split days, closed days, 24/7 and whole-day spans', () => {
    expect(parseHours('Mo 10:00-12:00,14:00-16:00')?.[MO]).toEqual([
      [600, 720],
      [840, 960],
    ])
    expect(parseHours('Mo-Sa 09:00-17:00; Su off')?.[SU]).toEqual([])
    expect(parseHours('24/7')?.every((day) => day[0][0] === 0 && day[0][1] === 1440)).toBe(true)
    expect(parseHours('Fr,Sa 00:00-00:00')?.[FR]).toEqual([[0, 1440]])
    expect(parseHours('Th 07:00-24:00')?.[3]).toEqual([[420, 1440]])
  })

  it('ignores public-holiday rules but keeps the rest', () => {
    const week = parseHours('Mo-Fr 09:00-17:00; PH off')
    expect(week?.[MO]).toEqual([[540, 1020]])
    expect(parseHours('Mo-Fr,PH 09:00-17:00')?.[FR]).toEqual([[540, 1020]])
  })

  it('gives up on anything it does not fully understand', () => {
    for (const text of [
      'Jun 18-Oct 29: Fr 12:00-18:00',
      'Mo-Sa 07:00-17:00; Su 07:00-16:00; Jan 01-02,Dec 25-26 off',
      'Mo-Su 17:00+',
      'Mo-Sa 11:30-18:00+',
      'sunrise-sunset',
      'Mo-Fr 09:00-17:00 "by appointment"',
      'Mo-Fr 9am-5pm',
      'Mo-Fr 25:00-26:00',
      '',
    ]) {
      expect(parseHours(text), text).toBeNull()
    }
  })
})

describe('hoursStatus', () => {
  const shop = parseHours('Mo-Fr 07:30-18:00; Sa 08:00-16:00') as NonNullable<ReturnType<typeof parseHours>>
  const pub = parseHours('Su-Th 11:00-02:00, Fr,Sa 11:00-04:00') as NonNullable<ReturnType<typeof parseHours>>

  it('says until when an open place stays open', () => {
    expect(hoursStatus(shop, at(MO, '09:00'))).toEqual({
      open: true,
      always: false,
      until: at(MO, '18:00'),
      daysAhead: 0,
    })
  })

  it('follows hours past midnight, from either side of it', () => {
    expect(hoursStatus(pub, at(TU, '23:30'))).toEqual({
      open: true,
      always: false,
      until: at(2, '02:00'),
      daysAhead: 1,
    })
    expect(hoursStatus(pub, at(TU, '01:00'))).toEqual({
      open: true,
      always: false,
      until: at(TU, '02:00'),
      daysAhead: 0,
    })
    expect(hoursStatus(pub, at(TU, '03:00'))).toEqual({ open: false, opens: { ...at(TU, '11:00'), daysAhead: 0 } })
  })

  it('says when a closed place opens next: today, tomorrow or later', () => {
    expect(hoursStatus(shop, at(MO, '06:00'))).toEqual({ open: false, opens: { ...at(MO, '07:30'), daysAhead: 0 } })
    expect(hoursStatus(shop, at(MO, '19:00'))).toEqual({ open: false, opens: { ...at(TU, '07:30'), daysAhead: 1 } })
    expect(hoursStatus(shop, at(SA, '17:00'))).toEqual({ open: false, opens: { ...at(MO, '07:30'), daysAhead: 2 } })
  })

  it('joins hours that run on across midnight', () => {
    const allNight = parseHours('Fr 18:00-24:00; Sa 00:00-03:00') as NonNullable<ReturnType<typeof parseHours>>
    expect(hoursStatus(allNight, at(FR, '20:00'))).toEqual({
      open: true,
      always: false,
      until: at(SA, '03:00'),
      daysAhead: 1,
    })
  })

  it('knows always open and never open', () => {
    expect(hoursStatus(parseHours('24/7') as NonNullable<ReturnType<typeof parseHours>>, at(SU, '03:00'))).toEqual({
      open: true,
      always: true,
    })
    expect(hoursStatus(parseHours('Mo-Su off') as NonNullable<ReturnType<typeof parseHours>>, at(MO, '12:00'))).toEqual(
      { open: false, opens: null },
    )
  })
})

describe('weekTimeIn', () => {
  it('gives the weekday and time of day in the place, not the viewer', () => {
    // 2026-11-11 03:30 UTC is Tuesday 22:30 in Ottawa.
    expect(weekTimeIn('America/Toronto', new Date('2026-11-11T03:30:00Z'))).toEqual({ day: 1, minutes: 22 * 60 + 30 })
    expect(weekTimeIn('UTC', new Date('2026-11-11T03:30:00Z'))).toEqual({ day: 2, minutes: 3 * 60 + 30 })
  })
})

describe('describeStatus', () => {
  const phrases = {
    openUntil: 'Open until {time}',
    open24: 'Open 24 hours',
    opensAt: 'Opens at {time}',
    opensTomorrow: 'Opens tomorrow at {time}',
    opensDay: 'Opens {day} at {time}',
    closed: 'Closed',
  }
  const shop = parseHours('Mo-Fr 07:30-18:00; Sa 08:00-16:00') as NonNullable<ReturnType<typeof parseHours>>
  const say = (day: number, hhmm: string) => describeStatus(hoursStatus(shop, at(day, hhmm)), 'en-CA', phrases)

  it('puts the status in words with local time formatting', () => {
    expect(say(MO, '09:00')).toMatch(/^Open until 6:00\s?p\.?m\.?$/i)
    expect(say(MO, '06:00')).toMatch(/^Opens at 7:30\s?a\.?m\.?$/i)
    expect(say(MO, '19:00')).toMatch(/^Opens tomorrow at 7:30\s?a\.?m\.?$/i)
    expect(say(SA, '17:00')).toMatch(/^Opens Monday at 7:30\s?a\.?m\.?$/i)
  })

  it('covers always open and never open', () => {
    expect(describeStatus({ open: true, always: true }, 'en-CA', phrases)).toBe('Open 24 hours')
    expect(describeStatus({ open: false, opens: null }, 'en-CA', phrases)).toBe('Closed')
  })
})
