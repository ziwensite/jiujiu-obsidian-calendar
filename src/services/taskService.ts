import { App } from 'obsidian';
import { taskRegex, dueDateRegex, escapeRegExp } from '../utils/regexUtils';
import { MyPluginSettings } from '../settings';

export interface Task {
    text: string;
    completed: boolean;
    filePath: string;
    dueDate?: Date;
    rawText: string;
}

// 从笔记中提取任务
export async function extractTasks(app: App, settings: MyPluginSettings): Promise<Task[]> {
    // 直接使用基本的任务提取逻辑
    return await extractBasicTasks(app);
}

// 基本的任务提取逻辑
export async function extractBasicTasks(app: App): Promise<Task[]> {
    const allFiles = app.vault.getMarkdownFiles();
    const tasks: Task[] = [];

    for (const file of allFiles) {
        try {
            const content = await app.vault.read(file);
            
            let match;
            while ((match = taskRegex.exec(content)) !== null) {
                if (match[1] && match[2]) {
                    const completed = match[1].toLowerCase() === 'x';
                    const rawText = match[2].trim();
                    const taskText = rawText.replace(dueDateRegex, '').trim();
                    
                    // 提取截止日期
                    const dateMatch = rawText.match(dueDateRegex);
                    let dueDate: Date | undefined;
                    if (dateMatch && dateMatch[1]) {
                        dueDate = new Date(dateMatch[1]);
                    }
                    
                    tasks.push({
                        text: rawText, // 显示整行内容
                        completed: completed,
                        filePath: file.path,
                        dueDate: dueDate,
                        rawText: rawText
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to read file ${file.path}:`, error);
        }
    }

    return tasks;
}

// 定义筛选规则的类型
type FilterRuleType = 'include' | 'exclude';

// 定义筛选规则
export interface FilterRule {
    type: FilterRuleType;
    value: string;
    isTag: boolean;
}

// 定义逻辑运算符类型
type LogicalOperator = 'and' | 'or';

// 定义表达式节点类型
export interface ExpressionNode {
    type: 'rule' | 'logical' | 'group';
    rule?: FilterRule;
    operator?: LogicalOperator;
    left?: ExpressionNode;
    right?: ExpressionNode;
    expressions?: ExpressionNode[];
}

// 词法分析器：将筛选字符串转换为标记
export function tokenizeFilter(filterString: string): string[] {
    // 替换括号为空格包围的括号，以便于分割
    const normalizedString = filterString.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ');
    // 分割为标记
    return normalizedString.split(/\s+/).filter(token => token.trim());
}

// 语法分析器：将标记转换为抽象语法树
function parseTokens(tokens: string[]): ExpressionNode {
    let index = 0;

    function parseExpression(): ExpressionNode {
        return parseLogicalExpression();
    }

    function parseLogicalExpression(): ExpressionNode {
        let left = parsePrimaryExpression();

        while (index < tokens.length && (tokens[index] === 'and' || tokens[index] === 'or')) {
            const operator = tokens[index] as LogicalOperator;
            index++;
            const right = parsePrimaryExpression();
            left = {
                type: 'logical',
                operator,
                left,
                right
            };
        }

        return left;
    }

    function parsePrimaryExpression(): ExpressionNode {
        if (tokens[index] === '(') {
            index++;
            const expressions: ExpressionNode[] = [];
            
            while (index < tokens.length && tokens[index] !== ')') {
                expressions.push(parseExpression());
            }
            
            if (index < tokens.length && tokens[index] === ')') {
                index++;
            }
            
            return {
                type: 'group',
                expressions
            };
        } else {
            return parseRule();
        }
    }

    function parseRule(): ExpressionNode {
        let token = tokens[index];
        let type: FilterRuleType = 'include';
        let value = token || '';
        let isTag = false;

        // 检查是否是排除规则
        if (token && token.startsWith('!')) {
            type = 'exclude';
            value = token.substring(1);
        }

        // 检查是否是标签
        if (value && value.startsWith('#')) {
            isTag = true;
            value = value.substring(1);
        }

        index++;

        return {
            type: 'rule',
            rule: {
                type,
                value: value || '',
                isTag
            }
        };
    }

    return parseExpression();
}

// 解析自定义筛选规则
export function parseCustomFilter(filterString: string): ExpressionNode | null {
    if (!filterString.trim()) {
        return null;
    }

    const tokens = tokenizeFilter(filterString);
    if (tokens.length === 0) {
        return null;
    }

    return parseTokens(tokens);
}

// 检查任务是否匹配筛选规则
export function matchFilterRule(task: Task, rule: FilterRule): boolean {
    if (rule.isTag) {
        // 检查任务文本是否包含标签
        return task.rawText.includes(`#${rule.value}`);
    } else {
        // 检查任务文件路径是否在指定路径中
        const filePath = task.filePath;
        return filePath.startsWith(rule.value + "/") || filePath === rule.value;
    }
}

// 评估表达式节点
function evaluateExpression(task: Task, node: ExpressionNode): boolean {
    switch (node.type) {
        case 'rule':
            if (node.rule) {
                const matches = matchFilterRule(task, node.rule);
                return node.rule.type === 'include' ? matches : !matches;
            }
            return true;
        
        case 'logical':
            if (node.operator && node.left && node.right) {
                const leftResult = evaluateExpression(task, node.left);
                const rightResult = evaluateExpression(task, node.right);
                
                if (node.operator === 'and') {
                    return leftResult && rightResult;
                } else { // or
                    return leftResult || rightResult;
                }
            }
            return true;
        
        case 'group':
            if (node.expressions && node.expressions.length > 0) {
                // 对于分组表达式，默认使用 OR 逻辑
                return node.expressions.some(expr => evaluateExpression(task, expr));
            }
            return true;
        
        default:
            return true;
    }
}

// 筛选任务
export function filterTasks(tasks: Task[], settings: MyPluginSettings, filterDate: Date): Task[] {
    const customFilter = settings.taskFilter.customFilter;
    const expression = parseCustomFilter(customFilter);
    
    return tasks.filter(task => {
        // 检查截止日期：只显示截止日期在filterDate及之前的任务
        if (task.dueDate) {
            // 设置日期为当天的结束时间，以便包含当天的任务
            const endOfDay = new Date(filterDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            // 只显示截止日期在点击日期及之前的任务
            if (task.dueDate > endOfDay) {
                return false;
            }
        }
        
        // 如果没有筛选规则，默认通过
        if (!expression) {
            return true;
        }
        
        // 评估表达式
        return evaluateExpression(task, expression);
    });
}

// 更新笔记中的任务状态
export async function updateTaskInNote(app: App, task: Task, completed: boolean): Promise<void> {
    try {
        // 读取笔记内容
        const file = app.vault.getAbstractFileByPath(task.filePath);
        if (file && 'stat' in file) {
            const content = await app.vault.read(file as any);
            
            // 构建任务的正则表达式，匹配原始任务行
            const taskRegex = new RegExp(`^\s*-\s*\[(.)\]\s*${escapeRegExp(task.rawText)}`, 'm');
            
            // 替换任务状态
            const newContent = content.replace(taskRegex, (match, status) => {
                return match.replace(`[${status}]`, completed ? '[x]' : '[ ]');
            });
            
            // 保存修改后的内容
            await app.vault.modify(file as any, newContent);
        }
    } catch (error) {
        console.error(`Failed to update task in note: ${task.filePath}`, error);
        throw error;
    }
}