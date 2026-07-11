import { App, TFile } from 'obsidian';
import { dueDateRegex, createdAtRegex, startDateRegex, cancelledDateRegex, completedDateRegex, plannedDateRegex, fullDayRegex, timeRangeRegex, singleTimeRegex, priorityRegex, recurrenceRegex, escapeRegExp } from '../utils/regexUtils';
import { MyPluginSettings } from '../settings';
import { formatDate } from '../utils/dateUtils';
import { generateTaskDateMarkers } from '../utils/taskUtils';
import type { IChoiceExecutor } from '../IChoiceExecutor';
import { ChoiceType } from '../types/choices/choiceType';
import type MyPlugin from '../main';

export { extractTasks, clearTaskCache, parseTaskFromLine } from './taskExtractor';
export type { Task } from '../types/task';
import type { Task } from '../types/task';

/**
 * 解析重复规则并计算下一个任务的日期
 * @param recurrenceRule 重复规则
 * @param currentDate 当前任务的日期
 * @returns 下一个任务的日期
 */
type RecurrenceHandler = (date: Date) => void;

const RECURRENCE_RULES: [string[], RecurrenceHandler][] = [
    [['every day', 'daily'], (d) => d.setDate(d.getDate() + 1)],
    [['every week', 'weekly'], (d) => d.setDate(d.getDate() + 7)],
    [['every month', 'monthly'], (d) => d.setMonth(d.getMonth() + 1)],
    [['every year', 'yearly'], (d) => d.setFullYear(d.getFullYear() + 1)],
    [['every 2 days'], (d) => d.setDate(d.getDate() + 2)],
    [['every 3 days'], (d) => d.setDate(d.getDate() + 3)],
    [['every 2 weeks', 'biweekly'], (d) => d.setDate(d.getDate() + 14)],
    [['every 2 months'], (d) => d.setMonth(d.getMonth() + 2)],
    [['every quarter', 'quarterly'], (d) => d.setMonth(d.getMonth() + 3)],
    [['every 6 months', 'semiannual'], (d) => d.setMonth(d.getMonth() + 6)],
];

function calculateNextRecurrenceDate(recurrenceRule: string, currentDate: Date): Date {
    const nextDate = new Date(currentDate);
    const ruleLower = recurrenceRule.toLowerCase();

    for (const [keywords, handler] of RECURRENCE_RULES) {
        if (keywords.some(k => ruleLower.includes(k))) {
            handler(nextDate);
            return nextDate;
        }
    }

    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
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
export function evaluateExpression(task: Task, node: ExpressionNode): boolean {
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
    
    // 生成当天日记的路径
    const dailySettings = settings.dailyNote;
    const dailyFileName = formatDate(filterDate, dailySettings.fileNameFormat);
    const dailyNotePath = `${dailySettings.savePath}/${dailyFileName}.md`;
    
    return tasks.filter(task => {
        let isTaskForToday = false;
        
        // 检查1: 有截止日期且截止日期是当天的任务
        if (task.dueDate) {
            // 设置当天的开始时间
            const startOfDay = new Date(filterDate);
            startOfDay.setHours(0, 0, 0, 0);
            
            // 设置当天的结束时间
            const endOfDay = new Date(filterDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            // 只显示截止日期在当天范围内的任务
            if (task.dueDate >= startOfDay && task.dueDate <= endOfDay) {
                isTaskForToday = true;
            }
        }
        
        // 检查2: 没有截止日期但在当天笔记中的任务
        if (!isTaskForToday && !task.dueDate) {
            // 比较任务的文件路径与当天日记的路径
            if (task.filePath === dailyNotePath) {
                isTaskForToday = true;
            }
        }
        
        // 如果任务不符合当天任务的条件，直接过滤掉
        if (!isTaskForToday) {
            return false;
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
export async function updateTaskInNote(app: App, task: Task, completed: boolean, settings?: any): Promise<void> {
    try {

        // 读取笔记内容
        const file = app.vault.getAbstractFileByPath(task.filePath);
        if (file instanceof TFile) {

            const content = await app.vault.read(file);

            
            // 按行分割内容
            const lines = content.split('\n');

            
            // 检查任务是否有行号信息
            if (task.line !== undefined && task.line >= 0 && task.line < lines.length) {

                
                // 构建更新后的任务行
                let checkbox;
                if (completed) {
                    checkbox = '[x]';
                } else if (task.status === '-') {
                    checkbox = '[-]';
                } else if (task.status === '/') {
                    checkbox = '[/]';
                } else {
                    checkbox = '[ ]';
                }
                let updatedTaskText = task.text;
                
                // 添加日期标记（包括完成日期和取消日期）
                updatedTaskText += generateTaskDateMarkers(task);
                
                // 保持原始的缩进
                const originalLine = lines[task.line];
                const indentMatch = originalLine?.match(/^(\s*)/);
                const indent = indentMatch ? indentMatch[1] : '';

                
                const updatedLine = `${indent}- ${checkbox} ${updatedTaskText}`;

                
                // 替换任务行
                lines[task.line] = updatedLine;
                const newContent = lines.join('\n');
                
                // 检查内容是否有变化
                if (content !== newContent) {
                    // 保存修改后的内容
                    await app.vault.modify(file, newContent);
                } else {
    
                }
                
                // 处理重复任务
                if (completed && task.recurrenceRule) {
                    // 计算下一个任务的日期
                    // 使用原任务的 dueDate 作为基准，如果原任务没有 dueDate，则使用当前日期
                    const currentDate = task.dueDate || new Date();
                    
                    // 对于所有重复规则，使用 calculateNextRecurrenceDate 函数计算
                    const nextDate = calculateNextRecurrenceDate(task.recurrenceRule, currentDate);
                    
                    // 当前系统日期，用于新任务的创建日期
                    const currentSystemDate = new Date();
                    
                    // 创建新的任务对象
                    // 计算计划日期和开始日期的下一个值
                    let nextStartDate: Date | undefined;
                    if (task.startDate) {
                        nextStartDate = calculateNextRecurrenceDate(task.recurrenceRule, task.startDate);
                    }
                    
                    let nextPlannedDate: Date | undefined;
                    if (task.plannedDate) {
                        nextPlannedDate = calculateNextRecurrenceDate(task.recurrenceRule, task.plannedDate);
                    }
                    
                    const newTask: Task = {
                        text: task.text,
                        completed: false,
                        status: ' ',
                        priority: task.priority,
                        recurrenceRule: task.recurrenceRule, // 确保重复规则正确传递给新任务
                        filePath: task.filePath,
                        dueDate: nextDate,
                        createdAt: task.createdAt ? currentSystemDate : undefined, // 只有原任务有创建日期时才添加
                        startDate: nextStartDate,
                        plannedDate: nextPlannedDate,
                        cancelledDate: undefined,
                        completedDate: undefined,
                        rawText: task.text,
                        fullDay: task.fullDay,
                        timeRange: task.timeRange,
                        line: task.line + 1, // 新任务添加到当前任务的下一行
                        lineCount: 1
                    };
                    
                    // 生成新任务的文本
                    let newTaskText = newTask.text;
                    newTaskText += generateTaskDateMarkers(newTask);
                    
                    // 保持与原任务相同的缩进
                    const newTaskLine = `${indent}- [ ] ${newTaskText}`;
                    
                    // 将新任务添加到文件中
                    // 重新读取文件内容以获取最新状态
                    const updatedContent = await app.vault.read(file);
                    const updatedLines = updatedContent.split('\n');
                    
                    // 根据设置决定新任务的添加位置
                    let insertPosition = task.line + 1; // 默认在当前任务的下一行
                    
                    // 根据插件设置来调整插入位置
                    if (settings && settings.taskSettings && settings.taskSettings.recurrenceSettings) {
                        const positionSetting = settings.taskSettings.recurrenceSettings.newTaskPosition;
                        if (positionSetting === 'above') {
                            insertPosition = task.line; // 在当前任务的上一行插入
                        }
                    }
                    
                    // 在决定的位置插入新任务
                    updatedLines.splice(insertPosition, 0, newTaskLine);
                    const finalContent = updatedLines.join('\n');
                    
                    // 保存带有新任务的内容
                    await app.vault.modify(file, finalContent);

                }
            } else {
                // 如果没有行号信息，尝试使用正则表达式匹配
                const taskRegex = new RegExp(`^\s*-\s*\[(.)\]\s*(${escapeRegExp(task.rawText)})`, 'm');
                
                // 检查是否匹配到任务
                const match = content.match(taskRegex);
                
                if (match) {
                    // 替换任务状态和完成日期
                    const newContent = content.replace(taskRegex, (match, status, taskText) => {

                        let checkbox;
                        if (completed) {
                            checkbox = '[x]';
                        } else if (task.status === '-') {
                            checkbox = '[-]';
                        } else if (task.status === '/') {
                            checkbox = '[/]';
                        } else {
                            checkbox = '[ ]';
                        }
                        let updatedTaskText = task.text;
                        
                        // 添加日期标记
                        updatedTaskText += generateTaskDateMarkers(task);
                        
                        // 根据Tasks插件格式，处理完成日期和取消日期
                        if (completed) {
                            const today = formatDate(new Date(), "YYYY-MM-DD");
                            updatedTaskText += ` ✅ ${today}`;
                            updatedTaskText = updatedTaskText.replace(/\s*❌\s*\d{4}-\d{2}-\d{2}/g, '').trim();
                        } else if (task.cancelledDate) {
                            updatedTaskText = updatedTaskText.replace(/\s*❌\s*\d{4}-\d{2}-\d{2}/g, '').trim();
                            updatedTaskText = updatedTaskText.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/g, '').trim();
                            const cancelledDateStr = formatDate(task.cancelledDate, "YYYY-MM-DD");
                            updatedTaskText += ` ❌ ${cancelledDateStr}`;
                        } else {
                            // 如果任务未完成也未取消，确保移除完成日期和取消日期标记
                            updatedTaskText = updatedTaskText.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/g, '').trim();
                            updatedTaskText = updatedTaskText.replace(/\s*❌\s*\d{4}-\d{2}-\d{2}/g, '').trim();
                        }
                        
                        // 保持原始的缩进
                        const indentMatch = match.match(/^(\s*)/);
                        const indent = indentMatch ? indentMatch[1] : '';
                        const result = `${indent}- ${checkbox} ${updatedTaskText}`;
                        return result;
                    });
                    
                    // 检查内容是否有变化
                    if (content !== newContent) {
                        // 保存修改后的内容
                        await app.vault.modify(file, newContent);
                    } else {

                    }
                } else {

                }
            }
        } else {

        }
    } catch (error) {
        console.error('[TaskService] Failed to update task in note:', error);
        throw error;
    }
}

// 在笔记中创建任务
export async function createTaskInNote(
    app: App,
    plugin: MyPlugin,
    taskText: string, 
    date: Date, 
    settings: MyPluginSettings,
    insertTarget: "daily" | "note" | "current",
    customNotePath?: string,
    configId?: string
): Promise<void> {
    try {
        // 使用 capture to 功能
        const { CaptureChoiceEngine } = await import('../engine/CaptureChoiceEngine');

        // 创建 choice executor
        const choiceExecutor: IChoiceExecutor = {
                variables: new Map(),
            };
            
            // 获取 capture to 设置，确保taskSettings和captureToSettings存在
            const taskSettings = settings.taskSettings || { captureToSettings: { enabled: false, configs: [] } };
            const captureSettings = taskSettings.captureToSettings || { enabled: false, configs: [] };
            
            // 选择配置
            let selectedConfigId: string;
            if (configId) {
                selectedConfigId = configId;
            } else if (insertTarget === "daily") {
                // 对于每日笔记，使用默认配置
                selectedConfigId = captureSettings.taskConfigId;
            } else if (insertTarget === "note") {
                // 对于普通笔记，使用默认配置
                selectedConfigId = captureSettings.taskConfigId;
            } else {
                // 对于当前笔记，使用默认配置
                selectedConfigId = captureSettings.taskConfigId;
            }
            
            const selectedConfig = captureSettings.configs.find(config => config.id === selectedConfigId && config.enabled);
            
            // 如果没有找到启用的配置，使用第一个启用的配置
            let configToUse = selectedConfig || captureSettings.configs.find(config => config.enabled) || captureSettings.configs[0];
            
            // 如果没有配置，使用默认配置
        if (!configToUse) {
            configToUse = {
                id: "default",
                name: "默认配置",
                description: "默认的 Capture To 配置",
                enabled: true,
                defaultCapturePath: "{{日记}}",
                captureToActiveFile: false,
                hotkey: null,
                inputMethod: "single-line",
                createFileIfItDoesntExist: {
                    enabled: true,
                    createWithTemplate: true,
                    template: "{{日记模板}}"
                },
                format: {
                    enabled: true,
                    format: "{{VALUE}}\n"
                },
                autoAddCreatedDate: true,
                autoAddDueDate: false,
                dueDateOption: "today",
                customDueDays: 1,
                prepend: false,
                appendLink: false,
                insertAfter: {
                    enabled: true,
                    after: "## 日常记录",
                    insertAtEnd: true,
                    considerSubsections: false,
                    createIfNotFound: true,
                    createIfNotFoundLocation: "bottom"
                },
                newLineCapture: {
                    enabled: false,
                    direction: "below"
                },
                openFile: false,
                fileOpening: {
                    location: "tab",
                    direction: "vertical",
                    mode: "default",
                    focus: true
                }
            };
        }
            
            // 构建 capture choice
            let captureToPath = "";
            if (customNotePath) {
                captureToPath = customNotePath;
            } else if (insertTarget === "daily") {
                captureToPath = "{{日记}}";
            } else {
                captureToPath = configToUse.defaultCapturePath;
            }
            
            // 生成 Tasks 格式的任务文本
            let finalTaskText: string;
            // 所有配置都使用Tasks插件格式
            // 导入 TaskTextBuilder
            const { TaskTextBuilder } = await import('./tasksFormatBuilder');
            
            // 解析现有的任务文本，保留其中的属性
            const taskBuilder = TaskTextBuilder.parse(taskText);
            
            // 检查任务文本中是否已经包含创建日期
            const hasCreatedDate = /\s*(\+|➕)\s*(\d{4}-\d{2}-\d{2})\s*/.test(taskText);
            // 只有当任务文本中没有创建日期，且配置允许自动添加时，才添加创建日期
            if (configToUse.autoAddCreatedDate && !hasCreatedDate) {
                taskBuilder.setCreatedDate(date);
            }
            
            // 检查任务文本中是否已经包含截止日期
            const hasDueDate = /\s*(📅|due:)\s*(\d{4}-\d{2}-\d{2})\s*/.test(taskText);
            // 只有当任务文本中没有截止日期，且配置允许自动添加时，才添加截止日期
            if (configToUse.autoAddDueDate && !hasDueDate) {
                // 计算截止日期的辅助函数
                const calculateDueDate = (baseDate: Date, option: string, customDays: number): Date => {
                    const result = new Date(baseDate);
                    
                    switch (option) {
                        case "today":
                            return result;
                        case "custom":
                            result.setDate(result.getDate() + customDays);
                            return result;
                        case "weekend":
                            // 计算本周末（周六）
                            const dayOfWeek = result.getDay();
                            const daysToSaturday = 6 - dayOfWeek;
                            result.setDate(result.getDate() + daysToSaturday);
                            return result;
                        case "monthEnd":
                            // 计算本月底
                            result.setMonth(result.getMonth() + 1, 0);
                            return result;
                        case "yearEnd":
                            // 计算本年底
                            result.setMonth(11, 31);
                            return result;
                        default:
                            return result;
                    }
                };
                
                const dueDate = calculateDueDate(
                    date,
                    configToUse.dueDateOption,
                    configToUse.customDueDays
                );
                taskBuilder.setDueDate(dueDate);
            }
            
            finalTaskText = taskBuilder.build();
            
            const captureChoice = {
                name: "Create Task",
                id: "create-task",
                type: ChoiceType.Capture,
                command: false,
                captureTo: captureToPath,
                captureToActiveFile: insertTarget === "current" || configToUse.captureToActiveFile,
                createFileIfItDoesntExist: {
                    enabled: configToUse.createFileIfItDoesntExist.enabled,
                    createWithTemplate: configToUse.createFileIfItDoesntExist.createWithTemplate,
                    template: configToUse.createFileIfItDoesntExist.template,
                },
                format: {
                    enabled: configToUse.format.enabled,
                    format: configToUse.format.format,
                },
                prepend: configToUse.prepend,
                appendLink: configToUse.appendLink,
                insertAfter: {
                    enabled: configToUse.insertAfter.enabled,
                    after: configToUse.insertAfter.after,
                    insertAtEnd: configToUse.insertAfter.insertAtEnd,
                    considerSubsections: configToUse.insertAfter.considerSubsections,
                    createIfNotFound: configToUse.insertAfter.createIfNotFound,
                    createIfNotFoundLocation: configToUse.insertAfter.createIfNotFoundLocation,
                },
                newLineCapture: {
                    enabled: configToUse.newLineCapture.enabled,
                    direction: configToUse.newLineCapture.direction,
                },
                openFile: configToUse.openFile,
                fileOpening: {
                    location: configToUse.fileOpening.location,
                    direction: configToUse.fileOpening.direction,
                    mode: configToUse.fileOpening.mode,
                    focus: configToUse.fileOpening.focus,
                },
                inputMethod: configToUse.inputMethod,
                autoAddCreatedDate: configToUse.autoAddCreatedDate,
                autoAddDueDate: configToUse.autoAddDueDate,
                dueDateOption: configToUse.dueDateOption,
                customDueDays: configToUse.customDueDays
            };
            
            // 创建并运行 CaptureChoiceEngine
            const engine = new CaptureChoiceEngine(app, plugin, captureChoice, choiceExecutor);
            engine.setCaptureValue(finalTaskText);
            await engine.run();
        } catch (error) {
        console.error(`Failed to create task in note:`, error);
        throw error;
    }
}