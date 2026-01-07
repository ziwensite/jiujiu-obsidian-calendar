import { MarkdownView } from 'obsidian';
import { MyPlugin } from '../../../main';
import { Task, updateTaskInNote, createTaskInNote } from '../../../services/taskService';
import { formatDate } from '../../../utils/dateUtils';
import { createOrOpenNote } from '../../../services/noteService';

export class EventHandler {
    private plugin: MyPlugin;

    constructor(plugin: MyPlugin) {
        this.plugin = plugin;
    }

    /**
     * 处理文件变化事件
     */
    async handleFileChange(file: any, onUpdateIndicator: (date: Date) => Promise<void>, onUpdateWeekIndicator: (date: Date) => Promise<void>, onRefreshTaskList: () => Promise<void>) {
        // 检查是否是文件且是Markdown文件
        if (!file || !('extension' in file) || file.extension !== 'md') return;
        
        // 尝试从文件路径中解析日期
        const date = this.parseDateFromFilePath(file.path);
        if (date) {
            // 如果文件对应到一个具体日期，只更新该日期的指示器
            await onUpdateIndicator(date);
            // 同时更新该日期所在周的周数指示器
            await onUpdateWeekIndicator(date);
        }
        
        // 如果文件可能影响当前选中日期的任务列表，更新任务列表
        if (this.isFileRelatedToSelectedDate(file)) {
            await onRefreshTaskList();
        }
    }

    /**
     * 处理任务双击事件
     */
    async handleTaskDoubleClick(task: Task) {
        const file = this.plugin.app.vault.getAbstractFileByPath(task.filePath);
        if (file && 'stat' in file) {
            const leaf = this.plugin.app.workspace.getLeaf(false);
            await leaf.openFile(file as any);
            
            // 尝试选中任务（如果是Markdown文件）
            const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                const editor = activeView.editor;
                const content = editor.getValue();
                const taskIndex = content.indexOf(task.text);
                if (taskIndex !== -1) {
                    const line = content.substring(0, taskIndex).split('\n').length - 1;
                    const lines = content.split('\n');
                    const lineContent = lines[line];
                    if (lineContent) {
                        const taskStart = lineContent.indexOf(task.text);
                        if (taskStart !== -1) {
                            const taskEnd = taskStart + task.text.length;
                            const startPos = { line, ch: taskStart };
                            const endPos = { line, ch: taskEnd };
                            editor.setSelection(startPos, endPos);
                            // 滚动到任务位置
                            editor.scrollIntoView({ from: startPos, to: endPos });
                        }
                    }
                }
            }
        }
    }

    /**
     * 处理日期点击事件
     */
    handleDayClick(date: Date, onUpdateSelection: () => void, onUpdateTaskList: (date: Date) => Promise<void>) {
        // 更新选中状态
        onUpdateSelection();
        
        // 更新任务列表
        onUpdateTaskList(date);
    }

    /**
     * 处理任务状态切换事件
     */
    async handleTaskToggle(task: Task, completed: boolean, onRefreshTaskList: () => Promise<void>) {
        try {
            // 更新笔记中的任务状态
            await updateTaskInNote(this.plugin.app, task, completed);
            
            // 重新渲染任务列表，显示最新状态
            await onRefreshTaskList();
        } catch (error) {
            console.error('Failed to update task:', error);
        }
    }

    /**
     * 处理添加任务事件
     */
    async handleAddTask(taskText: string, date: Date, onRefreshTaskList: () => Promise<void>) {
        if (taskText.trim()) {
            try {
                // 添加任务到笔记
                await createTaskInNote(this.plugin.app, taskText, date, this.plugin.settings, 'daily');
                
                // 重新渲染任务列表
                await onRefreshTaskList();
            } catch (error) {
                console.error('Failed to add task:', error);
            }
        }
    }

    /**
     * 从文件路径中解析日期
     */
    private parseDateFromFilePath(filePath: string): Date | null {
        const dailySettings = this.plugin.settings.dailyNote;
        const savePath = dailySettings.savePath;
        
        // 检查文件是否在日记保存路径中
        if (!filePath.startsWith(savePath)) return null;
        
        // 提取文件名（不含扩展名）
        const fileName = filePath.substring(savePath.length + 1, filePath.length - 3);
        
        // 尝试使用日记的日期格式解析日期
        try {
            const dateRegex = /(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})/;
            const match = fileName.match(dateRegex);
            if (match && match[1] && match[2] && match[3]) {
                const year = parseInt(match[1]);
                const month = parseInt(match[2]) - 1; // 月份从0开始
                const day = parseInt(match[3]);
                return new Date(year, month, day);
            }
        } catch (error) {
            console.error('Failed to parse date from file path:', error);
        }
        
        return null;
    }

    /**
     * 检查文件是否与选中日期相关
     */
    private isFileRelatedToSelectedDate(file: any): boolean {
        // 这里需要根据实际的选中日期逻辑进行实现
        // 暂时返回true，后续可以根据具体需求修改
        return true;
    }

    /**
     * 处理导航按钮点击事件
     */
    handleNavigationClick(direction: 'prev' | 'next', unit: 'year' | 'month' | 'quarter', currentDate: Date, onUpdateDate: (newDate: Date) => void) {
        const newDate = new Date(currentDate);
        
        switch (unit) {
            case 'year':
                newDate.setFullYear(newDate.getFullYear() + (direction === 'prev' ? -1 : 1));
                break;
            case 'month':
                newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
                break;
            case 'quarter':
                newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -3 : 3));
                break;
        }
        
        onUpdateDate(newDate);
    }

    /**
     * 处理视图切换事件
     */
    handleViewToggle(currentViewType: 'month' | 'year', onUpdateViewType: (newViewType: 'month' | 'year') => void) {
        const newViewType = currentViewType === 'month' ? 'year' : 'month';
        onUpdateViewType(newViewType);
    }

    /**
     * 处理今日按钮点击事件
     */
    handleTodayClick(onUpdateDate: (newDate: Date) => void) {
        const today = new Date();
        onUpdateDate(today);
    }

    /**
     * 处理日期双击事件
     */
    async handleDayDoubleClick(date: Date) {
        // 双击日期新建/打开日记
        const settings = this.plugin.settings.dailyNote;
        const fileName = formatDate(date, settings.fileNameFormat);
        await createOrOpenNote(this.plugin.app, settings.savePath, fileName, settings.templatePath);
    }

    /**
     * 处理周数双击事件
     */
    async handleWeekDoubleClick(date: Date) {
        // 双击周数新建/打开周报
        const settings = this.plugin.settings.weeklyNote;
        const fileName = formatDate(date, settings.fileNameFormat);
        await createOrOpenNote(this.plugin.app, settings.savePath, fileName, settings.templatePath);
    }

    /**
     * 处理月份双击事件
     */
    async handleMonthDoubleClick(date: Date) {
        // 双击月份新建/打开月报
        const settings = this.plugin.settings.monthlyNote;
        const fileName = formatDate(date, settings.fileNameFormat);
        await createOrOpenNote(this.plugin.app, settings.savePath, fileName, settings.templatePath);
    }

    /**
     * 处理季度双击事件
     */
    async handleQuarterDoubleClick(date: Date) {
        // 双击季度新建/打开季报
        const settings = this.plugin.settings.quarterlyNote;
        const fileName = formatDate(date, settings.fileNameFormat);
        await createOrOpenNote(this.plugin.app, settings.savePath, fileName, settings.templatePath);
    }

    /**
     * 处理年份双击事件
     */
    async handleYearDoubleClick(date: Date) {
        // 双击年度新建/打开年报
        const settings = this.plugin.settings.yearlyNote;
        const fileName = formatDate(date, settings.fileNameFormat);
        await createOrOpenNote(this.plugin.app, settings.savePath, fileName, settings.templatePath);
    }
}
