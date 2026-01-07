// 辅助函数：转义正则表达式中的特殊字符
export function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// 支持tasks插件的多种任务格式
export const taskRegex = /^\s*-\s*\[(.)\]\s*(.+)$/gm;

// 支持多种日期格式，包括tasks插件的格式
// 匹配：@YYYY-MM-DD, #YYYY-MM-DD, 📅 YYYY-MM-DD, 📅YYYY-MM-DD, due: YYYY-MM-DD, due:YYYY-MM-DD
export const dueDateRegex = /(?:[@#]|due:\s?|📅\s?)(\d{4}-\d{2}-\d{2})/i;