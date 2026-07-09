import { ZODIAC } from './zodiacMap'

/** 数字 → 生肖映射（1-49） */
const NUM_ZODIAC: Record<number, string> = {
  1: '马', 2: '蛇', 3: '龙', 4: '兔', 5: '虎', 6: '牛',
  7: '鼠', 8: '猪', 9: '狗', 10: '鸡', 11: '猴', 12: '羊',
  13: '马', 14: '蛇', 15: '龙', 16: '兔', 17: '虎', 18: '牛',
  19: '鼠', 20: '猪', 21: '狗', 22: '鸡', 23: '猴', 24: '羊',
  25: '马', 26: '蛇', 27: '龙', 28: '兔', 29: '虎', 30: '牛',
  31: '鼠', 32: '猪', 33: '狗', 34: '鸡', 35: '猴', 36: '羊',
  37: '马', 38: '蛇', 39: '龙', 40: '兔', 41: '虎', 42: '牛',
  43: '鼠', 44: '猪', 45: '狗', 46: '鸡', 47: '猴', 48: '羊',
  49: '马',
}

/**
 * 判断一组开奖号码中，哪些投注中奖。
 *
 * @param drawnNumbers  开奖号码数组，长度为 7：前 6 个普通号 + 最后 1 个特殊号
 * @param amounts       投注数据：betTypeKey → num → amount（amount > 0 视为有效下注）
 * @returns             中奖结果：betTypeKey → Set<中奖的 num key>
 *
 * 开奖规则：
 * - 特码 (specialNumber)：num === 特殊号（第 7 个号码）
 * - 连肖 (lianXiao*)：位图编码的生肖组合，所有生肖都出现在开奖号码转换的生肖中即中奖
 * - 平特 (flatSpecial)：item ID 1-12 为生肖，13-22 为尾数，出现在开奖号码中即中奖
 * - 平码 (flatNumber)：num 出现在 7 个开奖号码中任一即中奖
 */
export function checkWinnings(
  drawnNumbers: number[],
  amounts: Record<string, Record<number, number>>,
): Record<string, Set<number>> {
  if (drawnNumbers.length !== 7) return {}

  const specialNum = drawnNumbers[6]
  const allNums = new Set(drawnNumbers)

  // 所有开奖号码（含特殊号）转换为生肖集合
  const drawnZodiacs = new Set(drawnNumbers.map(n => NUM_ZODIAC[n]))

  // 所有开奖号码（含特殊号）转换为尾数集合（如 10 → "0", 1 → "1"）
  const drawnTails = new Set(drawnNumbers.map(n => String(n % 10)))

  const winners: Record<string, Set<number>> = {}

  for (const [betType, numAmounts] of Object.entries(amounts)) {
    const winSet = new Set<number>()

    for (const numStr of Object.keys(numAmounts)) {
      const num = Number(numStr)
      const amount = numAmounts[num]
      if (!amount || amount === 0) continue

      let isWin = false

      if (betType === 'specialNumber') {
        // 特码：开中特殊号算中奖
        isWin = num === specialNum
      } else if (betType.startsWith('lianXiao')) {
        // 连肖：位图解码为生肖列表，全部出现在开奖号码生肖中即中奖
        const zodiacs = decodeZodiacBits(num)
        isWin = zodiacs.length > 0 && zodiacs.every(z => drawnZodiacs.has(z))
      } else if (betType === 'flatSpecial') {
        // 平特：item ID 1-12 为生肖，13-22 为尾数
        if (num >= 1 && num <= 12) {
          isWin = drawnZodiacs.has(ZODIAC[num - 1])
        } else if (num >= 13 && num <= 22) {
          const tailDigit = String(num - 13)
          isWin = drawnTails.has(tailDigit)
        }
      } else if (betType === 'flatNumber') {
        // 平码：号码出现在普通号或特殊号中即中奖
        isWin = allNums.has(num)
      }

      if (isWin) winSet.add(num)
    }

    if (winSet.size > 0) winners[betType] = winSet
  }

  return winners
}

/** 将连肖位图解码为生肖字符串数组 */
function decodeZodiacBits(bits: number): string[] {
  const zodiacs: string[] = []
  for (let i = 0; i < ZODIAC.length; i++) {
    if (bits & (1 << i)) zodiacs.push(ZODIAC[i])
  }
  return zodiacs
}
