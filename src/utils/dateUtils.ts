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
        .replace('Q', String(Math.floor((d.month() + 3) / 3)));
    
    // 使用dayjs的format方法处理其他占位符
    result = d.format(result);
    
    return result;
}