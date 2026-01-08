// 导入lunar-typescript库
import { Lunar, Solar, HolidayUtil } from 'lunar-typescript';

// 导入dayjs库及其插件
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import weekday from 'dayjs/plugin/weekday';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// 扩展dayjs功能
dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(weekday);
dayjs.extend(customParseFormat);

// 农历月份名称
const lunarMonthNames = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];

// 农历日期名称
const lunarDayNames = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

// 定义阴历日期类型
export type LunarDateType = 'festival' | 'solarTerm' | 'month' | 'day';

// 定义阴历日期结果
export interface LunarDateResult {
    text: string;
    type: LunarDateType;
}

// 计算农历日期
export function getLunarDate(date: Date): LunarDateResult {
    const solar = Solar.fromDate(date);
    const lunar = solar.getLunar();
    
    // 阴历信息显示优先级：节日 > 节气 > 月份 > 日期
    
    // 1. 检查是否有节日（包括法定节假日、国际节日和传统节日）
    let festivals = [...lunar.getFestivals(), ...solar.getFestivals()];
    // 去重
    festivals = [...new Set(festivals)];
    
    if (festivals && festivals.length > 0 && festivals[0]) {
        return {
            text: festivals[0].substring(0, 3), // 最多显示3个字符
            type: 'festival'
        };
    }
    
    // 2. 检查是否有法定节假日名称（只在当天显示）
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const holiday = HolidayUtil.getHoliday(dateStr);
    if (holiday) {
        const holidayName = holiday.getName();
        const target = holiday.getTarget();
        // 只有当日期是节假日的第一天（target 等于当前日期）时才显示节日名称
        if (holidayName && holidayName !== '休' && holidayName !== '班' && target === dateStr) {
            return {
                text: holidayName.substring(0, 3), // 最多显示3个字符
                type: 'festival'
            };
        }
    }
    
    // 3. 检查是否有节气
    const jieQi = lunar.getJieQi();
    if (jieQi) {
        return {
            text: jieQi.substring(0, 3), // 最多显示3个字符
            type: 'solarTerm'
        };
    }
    
    // 4. 检查是否是初一
    if (lunar.getDay() === 1) {
        // 显示农历月份
        const month = lunar.getMonth();
        return {
            text: lunarMonthNames[month] || '',
            type: 'month'
        };
    }
    
    // 5. 显示农历日期
    const dayNum = lunar.getDay();
    return {
        text: lunarDayNames[dayNum] || '',
        type: 'day'
    };
}

// 获取节假日信息（传统节日、法定节假日、国际节日和24节气）
export function getHolidayInfo(date: Date): string {
    const solar = Solar.fromDate(date);
    const lunar = solar.getLunar();
    
    // 1. 合并所有节日信息
    let festivals = [...lunar.getFestivals(), ...solar.getFestivals()];
    
    // 2. 去重
    festivals = [...new Set(festivals)];
    
    // 3. 优先返回主要节日
    if (festivals && festivals.length > 0 && festivals[0]) {
        return festivals[0];
    }
    
    // 4. 检查是否有法定节假日名称（只在当天显示）
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const holiday = HolidayUtil.getHoliday(dateStr);
    if (holiday) {
        const holidayName = holiday.getName();
        const target = holiday.getTarget();
        // 只有当日期是节假日的第一天（target 等于当前日期）时才显示节日名称
        if (holidayName && holidayName !== '休' && holidayName !== '班' && target === dateStr) {
            return holidayName;
        }
    }
    
    return "";
}

// 获取法定节假日状态
export function getHolidayStatus(date: Date): string {
    // 将Date对象转换为YYYY-MM-DD格式的字符串
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const holiday = HolidayUtil.getHoliday(dateStr);
    
    if (holiday) {
        if (holiday.isWork()) {
            // 周六周日改为工作日，显示"班"
            return "班";
        } else {
            // 休息，显示"休"
            return "休";
        }
    }
    
    return "";
}

// 默认使用 ISO 8601 标准：周一为第一天，包含该年第一个周四的周为第1周
export function getWeekInfo(
  date: Date
): { week: number; year: number } {
  const d = dayjs(date);

  // ISO 8601: 周一为第一天，包含该年第一个周四的周为第1周
  return {
    week: d.isoWeek(),
    year: d.isoWeekYear(),
  };
}

// 获取周数（保持向后兼容）
export function getWeekNumber(date: Date): number {
    return getWeekInfo(date).week;
}

// 获取季度
export function getQuarter(date: Date): number {
    // 使用dayjs计算季度
    return Math.floor((dayjs(date).month() + 3) / 3);
}

// 日期格式化函数
export function formatDate(date: Date, format: string): string {
    // 使用dayjs格式化日期
    const d = dayjs(date);
    
    // 获取周数和周年份
    const weekInfo = getWeekInfo(date);
    const week = String(weekInfo.week).padStart(2, '0');
    const weekYear = weekInfo.year;
    
    // 处理周数和周年份
    let result = format
        // 替换周年份
        .replace('GGGG', String(weekYear))
        // 替换周数（两位数）
        .replace('WW', week)
        // 替换季度
        .replace('Q', String(getQuarter(date)));
    
    // 使用dayjs的format方法处理其他占位符
    result = d.format(result);
    
    return result;
}

/**
 * 获取月份的第一天是星期几
 * @param date 日期
 * @returns 星期几（0-6，0表示周日）
 */
export function getFirstDayOfMonth(date: Date): number {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return firstDay.getDay();
}

/**
 * 获取月份的总天数
 * @param date 日期
 * @returns 月份总天数
 */
export function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * 计算需要显示的上个月天数
 * @param firstDayOfMonth 月份第一天是星期几
 * @returns 需要显示的上个月天数
 */
export function getPrevMonthDaysToShow(firstDayOfMonth: number): number {
    // 周一为第一天：如果第一天是周日，需要显示6天上个月的日期，否则显示startDay-1天
    return firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
}

/**
 * 计算日历需要显示的行数
 * @param prevMonthDaysToShow 需要显示的上个月天数
 * @param daysInMonth 本月总天数
 * @returns 需要的行数
 */
export function getCalendarRows(prevMonthDaysToShow: number, daysInMonth: number): number {
    // 计算需要的行数：(上个月需要显示的天数 + 本月天数 + 7 - 1) / 7 向上取整
    return Math.ceil((prevMonthDaysToShow + daysInMonth) / 7);
}

/**
 * 计算指定单元格对应的日期
 * @param rowIndex 行索引
 * @param dayIndex 列索引
 * @param currentDate 当前日期
 * @returns 单元格对应的日期和是否为其他月份
 */
export function getCellDate(rowIndex: number, dayIndex: number, currentDate: Date): { date: Date; isOtherMonth: boolean } {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // 计算月份第一天是星期几
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    
    // 计算需要显示的上个月天数
    const prevMonthDaysToShow = getPrevMonthDaysToShow(firstDayOfMonth);
    
    // 计算本月总天数
    const daysInMonth = getDaysInMonth(currentDate);
    
    // 计算当前单元格在所有单元格中的位置
    const totalCells = rowIndex * 7 + dayIndex;
    
    let date: Date;
    let isOtherMonth = false;
    
    if (totalCells < prevMonthDaysToShow) {
        // 上个月的日期
        const prevMonth = currentMonth - 1;
        const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonthDays = getDaysInMonth(new Date(prevMonthYear, prevMonth));
        const day = prevMonthDays - prevMonthDaysToShow + totalCells + 1;
        date = new Date(prevMonthYear, prevMonth, day);
        isOtherMonth = true;
    } else if (totalCells < prevMonthDaysToShow + daysInMonth) {
        // 当前月的日期
        const day = totalCells - prevMonthDaysToShow + 1;
        date = new Date(currentYear, currentMonth, day);
    } else {
        // 下个月的日期
        const nextMonth = currentMonth + 1;
        const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const day = totalCells - prevMonthDaysToShow - daysInMonth + 1;
        date = new Date(nextMonthYear, nextMonth, day);
        isOtherMonth = true;
    }
    
    return { date, isOtherMonth };
}

/**
 * 计算日历月份数据
 * @param currentDate 当前日期
 * @returns 日历月份数据
 */
export function getCalendarMonthData(currentDate: Date): {
    currentYear: number;
    currentMonth: number;
    firstDayOfMonth: number;
    daysInMonth: number;
    prevMonthDaysToShow: number;
    rowsNeeded: number;
    lastDayOfPrevMonth: Date;
    firstDayOfNextMonth: Date;
} {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // 计算月份第一天是星期几
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    
    // 计算本月总天数
    const daysInMonth = getDaysInMonth(currentDate);
    
    // 计算需要显示的上个月天数
    const prevMonthDaysToShow = getPrevMonthDaysToShow(firstDayOfMonth);
    
    // 计算需要的行数
    const rowsNeeded = getCalendarRows(prevMonthDaysToShow, daysInMonth);
    
    // 计算上个月的最后一天
    const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0);
    
    // 计算下个月的第一天
    const firstDayOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    
    return {
        currentYear,
        currentMonth,
        firstDayOfMonth,
        daysInMonth,
        prevMonthDaysToShow,
        rowsNeeded,
        lastDayOfPrevMonth,
        firstDayOfNextMonth
    };
}

/**
 * 获取当前月份的所有日期数据
 * @param currentDate 当前日期
 * @returns 日期数据数组
 */
export function getMonthDates(currentDate: Date): Array<Array<{ date: Date; isOtherMonth: boolean }>> {
    const data = getCalendarMonthData(currentDate);
    const dates: Array<Array<{ date: Date; isOtherMonth: boolean }>> = [];
    
    for (let row = 0; row < data.rowsNeeded; row++) {
        const rowDates: Array<{ date: Date; isOtherMonth: boolean }> = [];
        for (let day = 0; day < 7; day++) {
            const { date, isOtherMonth } = getCellDate(row, day, currentDate);
            rowDates.push({ date, isOtherMonth });
        }
        dates.push(rowDates);
    }
    
    return dates;
}

/**
 * 检查日期是否为今天
 * @param date 要检查的日期
 * @returns 是否为今天
 */
export function isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

/**
 * 检查日期是否为周末
 * @param date 要检查的日期
 * @returns 是否为周末
 */
export function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}

/**
 * 计算给定日期所在行的所有日期
 * @param date 日期
 * @returns 该行的所有日期
 */
export function getWeekDates(date: Date): Date[] {
    const dayOfWeek = date.getDay();
    // 计算本周一的日期
    const monday = new Date(date);
    monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    // 生成本周的所有日期
    const weekDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(monday);
        currentDate.setDate(monday.getDate() + i);
        weekDates.push(currentDate);
    }
    
    return weekDates;
}

/**
 * 获取上个月的日期
 * @param date 当前日期
 * @returns 上个月的日期
 */
export function getPrevMonthDate(date: Date): Date {
    const prevMonth = date.getMonth() - 1;
    const prevMonthYear = date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear();
    return new Date(prevMonthYear, prevMonth, date.getDate());
}

/**
 * 获取下个月的日期
 * @param date 当前日期
 * @returns 下个月的日期
 */
export function getNextMonthDate(date: Date): Date {
    const nextMonth = date.getMonth() + 1;
    const nextMonthYear = date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear();
    return new Date(nextMonthYear, nextMonth, date.getDate());
}

/**
 * 获取上一年的日期
 * @param date 当前日期
 * @returns 上一年的日期
 */
export function getPrevYearDate(date: Date): Date {
    return new Date(date.getFullYear() - 1, date.getMonth(), date.getDate());
}

/**
 * 获取下一年的日期
 * @param date 当前日期
 * @returns 下一年的日期
 */
export function getNextYearDate(date: Date): Date {
    return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
}

/**
 * 获取当前日期所在季度的开始日期
 * @param date 当前日期
 * @returns 季度开始日期
 */
export function getQuarterStartDate(date: Date): Date {
    const quarter = getQuarter(date);
    const startMonth = (quarter - 1) * 3;
    return new Date(date.getFullYear(), startMonth, 1);
}

/**
 * 获取当前日期所在季度的结束日期
 * @param date 当前日期
 * @returns 季度结束日期
 */
export function getQuarterEndDate(date: Date): Date {
    const quarter = getQuarter(date);
    const endMonth = quarter * 3;
    return new Date(date.getFullYear(), endMonth, 0);
}