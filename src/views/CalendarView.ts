import { ItemView, WorkspaceLeaf, Notice, MarkdownView, Modal, App, TFile } from 'obsidian';
import { MyPlugin } from '../main';
import { MyPluginSettings } from '../settings';
import { getLunarDate, getHolidayInfo, getHolidayStatus, getWeekNumber, getWeekInfo, getQuarter, formatDate } from '../utils/dateUtils';
import { noteExists, createOrOpenNote } from '../services/noteService';
import { extractTasks, filterTasks, updateTaskInNote, createTaskInNote, Task } from '../services/taskService';
import { CalendarRenderer, TaskListRenderer, IndicatorRenderer, EventHandler } from './calendar';

const VIEW_TYPE_CALENDAR = "jiujiu-calendar-view";

export class CalendarView extends ItemView {
    private currentDate: Date;
    private plugin: MyPlugin;
    private taskStatusFilter: 'all' | 'todo' | 'done' = 'all';
    private selectedDate: Date | null = null;
    private viewType: 'month' | 'year' = 'month';
    private lastRenderedYear: number = -1;
    private lastRenderedMonth: number = -1;
    private lastRenderedViewType: 'month' | 'year' = 'month';
    private lastRenderedRows: number = -1;
    
    // 模块化组件
    private calendarRenderer: CalendarRenderer;
    private taskListRenderer: TaskListRenderer;
    private indicatorRenderer: IndicatorRenderer;
    private eventHandler: EventHandler;

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentDate = new Date();
        this.selectedDate = new Date(); // 初始化为今天的日期
        
        // 初始化模块化组件
        this.calendarRenderer = new CalendarRenderer(plugin);
        this.taskListRenderer = new TaskListRenderer(plugin);
        this.indicatorRenderer = new IndicatorRenderer(plugin);
        this.eventHandler = new EventHandler(plugin);
    }

    getViewType(): string {
        return VIEW_TYPE_CALENDAR;
    }

    getDisplayText(): string {
        return "JiuJiu Calendar";
    }

    getIcon(): string {
        return "calendar";
    }

    async onOpen() {
        await this.renderCalendar();
        
        // 视图打开时自动显示当天的任务列表
        const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
        if (taskListContainer && this.selectedDate) {
            await this.renderTaskList(this.selectedDate, taskListContainer);
        }
        
        // 添加文件系统事件监听，实现实时更新
        this.registerEvent(this.app.vault.on('create', async (file) => {
            await this.handleFileChange(file);
        }));
        
        this.registerEvent(this.app.vault.on('modify', async (file) => {
            await this.handleFileChange(file);
        }));
        
        this.registerEvent(this.app.vault.on('delete', async (file) => {
            await this.handleFileChange(file);
        }));
        
        this.registerEvent(this.app.vault.on('rename', async (file, oldPath) => {
            await this.handleFileChange(file);
        }));
    }

    async onClose() {
        // 清理资源
    }

    private async renderCalendar() {
        const container = this.containerEl.children[1] as HTMLElement;
        if (!container) return;

        const currentYear = this.currentDate.getFullYear();
        const currentMonth = this.currentDate.getMonth();

        // 计算当前月份需要显示的行数
        const firstDay = new Date(currentYear, currentMonth, 1);
        let startDay = firstDay.getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // 周一为第一天：如果第一天是周日，需要显示6天上个月的日期，否则显示startDay-1天
        const prevMonthDaysToShow = startDay === 0 ? 6 : startDay - 1;
        
        // 计算需要的行数：(上个月需要显示的天数 + 本月天数 + 7 - 1) / 7 向上取整
        const currentRows = Math.ceil((prevMonthDaysToShow + daysInMonth) / 7);

        // 检查是否需要完全重建日历结构
        // 只有当年/月/视图类型变化，或者行数变化时，才完全重建
        const needsFullRebuild = 
            this.lastRenderedYear !== currentYear || 
            this.lastRenderedMonth !== currentMonth ||
            this.lastRenderedViewType !== this.viewType ||
            this.lastRenderedRows !== currentRows;

        if (needsFullRebuild) {
            container.empty();
            await this.buildCalendarStructure(container);
            this.lastRenderedYear = currentYear;
            this.lastRenderedMonth = currentMonth;
            this.lastRenderedViewType = this.viewType;
            this.lastRenderedRows = currentRows;
        } else {
            // 行数没有变化，只更新日历内容，不整体刷新
            await this.updateCalendarContent();
        }

        this.updateDaySelection();
    }

    /**
     * 当月历行数没有变化时，只更新日历内容，不整体重建DOM
     */
    private async updateCalendarContent() {
        if (this.viewType === 'month') {
            // 更新日历头部显示
            this.updateCalendarHeader();
            
            // 更新所有日期单元格的完整内容
            await this.updateMonthCalendarContent();
        }
    }

    /**
     * 更新月视图的完整内容，包括所有日期单元格
     */
    private async updateMonthCalendarContent() {
        // 更新日历表格内容
        const tbody = this.containerEl.querySelector('.calendar-table tbody');
        if (!tbody) return;
        
        // 获取所有日期行
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        // 计算当前月份的日历数据
        const currentYear = this.currentDate.getFullYear();
        const currentMonth = this.currentDate.getMonth();
        
        const firstDay = new Date(currentYear, currentMonth, 1);
        let startDay = firstDay.getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // 周一为第一天：如果第一天是周日，需要显示6天上个月的日期，否则显示startDay-1天
        const prevMonthDaysToShow = startDay === 0 ? 6 : startDay - 1;
        
        // 计算上个月的最后一天
        const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0);
        const prevMonthDays = lastDayOfPrevMonth.getDate();
        const prevMonth = lastDayOfPrevMonth.getMonth();
        const prevMonthYear = lastDayOfPrevMonth.getFullYear();
        
        // 计算下个月的第一天
        const firstDayOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
        const nextMonth = firstDayOfNextMonth.getMonth();
        const nextMonthYear = firstDayOfNextMonth.getFullYear();
        
        // 处理上个月的剩余天数
        let prevMonthDay = prevMonthDays - prevMonthDaysToShow + 1;
        
        // 处理下个月的起始天数
        let nextMonthDay = 1;
        
        let currentDay = 1;
        
        // 获取今天的日期
        const today = new Date();
        
        // 遍历所有行，更新内容
        for (const row of rows) {
            // 获取当前行的所有单元格（第一个是周数，后面7个是日期）
            const cells = Array.from(row.querySelectorAll('td'));
            
            // 跳过周数单元格，从第2个单元格开始（索引1）
            for (let i = 1; i < cells.length; i++) {
                const cell = cells[i];
                if (cell) {
                    cell.removeClass('other-month');
                    cell.removeClass('today');
                    
                    let date: Date;
                    let isOtherMonth = false;
                    
                    if (prevMonthDay <= prevMonthDays) {
                        // 上个月的日期
                        date = new Date(prevMonthYear, prevMonth, prevMonthDay);
                        prevMonthDay++;
                        isOtherMonth = true;
                    } else if (currentDay <= daysInMonth) {
                        // 当前月的日期
                        date = new Date(currentYear, currentMonth, currentDay);
                        currentDay++;
                    } else {
                        // 下个月的日期
                        date = new Date(nextMonthYear, nextMonth, nextMonthDay);
                        nextMonthDay++;
                        isOtherMonth = true;
                    }
                    
                    if (isOtherMonth) {
                        cell.addClass('other-month');
                    }
                    
                    // 检查是否是今天
                    if (date.toDateString() === today.toDateString()) {
                        cell.addClass('today');
                    }
                    
                    // 更新日期数字
                    const dateContainer = cell.querySelector('.date-container');
                    if (dateContainer) {
                        // 清空现有内容
                        dateContainer.empty();
                        
                        // 日期数字
                        const dayNumber = dateContainer.createEl('span', {
                            text: `${date.getDate()}`,
                            cls: 'day-number'
                        });
                        
                        // 检查是否是周末
                        // 周一为第一天时，周六（i=6）和周日（i=7）为周末
                        // 但只有法定节假日才改变颜色，非法定节假日的周末保持默认颜色
                        // if (i === 6 || i === 7) {
                        //     dayNumber.style.color = 'var(--interactive-accent)';
                        // }
                        
                        // 添加法定节假日状态标记（休/班）
                        const status = getHolidayStatus(date);
                        if (status) {
                            dateContainer.createEl('span', {
                                text: status,
                                cls: `holiday-status ${status === '休' ? 'holiday' : 'workday'}`
                            });
                            // 法定节假日的阳历数字颜色改为深红
                            dayNumber.addClass("holiday-date");
                        }
                    }
                    
                    // 更新农历日期
                    const lunarDate = cell.querySelector('.lunar-date');
                    if (lunarDate) {
                        const lunarDateResult = getLunarDate(date);
                        lunarDate.textContent = lunarDateResult.text;
                        lunarDate.className = `lunar-date lunar-${lunarDateResult.type}`;
                    }
                }
            }
        }
        
        // 更新所有指示器
        await this.updateIndicators();
    }

    /**
     * 更新日历头部显示
     */
    private updateCalendarHeader() {
        // 日历头部更新已由calendarRenderer处理
        // 此方法保留以确保兼容性
    }

    private async buildCalendarStructure(container: HTMLElement) {
        // 使用 calendarRenderer 构建日历结构
        await this.calendarRenderer.buildCalendarStructure(container, this.currentDate, this.viewType);
        
        // 添加导航按钮事件监听器
        this.addNavigationEventListeners();
        
        // 添加日期和周数单元格事件监听器
        this.addCalendarCellEventListeners();
        
        // 任务列表区域
        const taskListContainer = container.createEl("div", {cls: "task-list-container"});
        
        // 任务列表标题和筛选按钮
        const taskListHeader = taskListContainer.createEl("div", {cls: "task-list-header"});
        taskListHeader.createEl("h3", {text: "任务列表"});
        
        // 筛选按钮组
        const filterButtons = taskListHeader.createEl("div", {cls: "filter-buttons"});
        
        // 待办按钮
        const todoBtn = filterButtons.createEl("button", {text: "待办"});
        todoBtn.className = `filter-btn ${this.taskStatusFilter === 'todo' ? 'active' : ''}`;
        todoBtn.addEventListener("click", async () => {
            this.taskStatusFilter = 'todo';
            // 重新渲染日历
            await this.renderCalendar();
            // 如果已经有选中的日期，重新渲染任务列表
            if (this.selectedDate) {
                const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
                if (taskListContainer) {
                    await this.renderTaskList(this.selectedDate, taskListContainer);
                }
            }
        });
        
        // 已办按钮
        const doneBtn = filterButtons.createEl("button", {text: "已办"});
        doneBtn.className = `filter-btn ${this.taskStatusFilter === 'done' ? 'active' : ''}`;
        doneBtn.addEventListener("click", async () => {
            this.taskStatusFilter = 'done';
            // 重新渲染日历
            await this.renderCalendar();
            // 如果已经有选中的日期，重新渲染任务列表
            if (this.selectedDate) {
                const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
                if (taskListContainer) {
                    await this.renderTaskList(this.selectedDate, taskListContainer);
                }
            }
        });
        
        // 所有按钮
        const allBtn = filterButtons.createEl("button", {text: "所有"});
        allBtn.className = `filter-btn ${this.taskStatusFilter === 'all' ? 'active' : ''}`;
        allBtn.addEventListener("click", async () => {
            this.taskStatusFilter = 'all';
            // 重新渲染日历
            await this.renderCalendar();
            // 如果已经有选中的日期，重新渲染任务列表
            if (this.selectedDate) {
                const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
                if (taskListContainer) {
                    await this.renderTaskList(this.selectedDate, taskListContainer);
                }
            }
        });
        
        // 新建按钮
        const newTaskBtn = filterButtons.createEl("button", {text: "新建"});
        newTaskBtn.className = "filter-btn new-task-btn";
        newTaskBtn.addEventListener("click", () => {
            if (this.selectedDate) {
                // 调用添加任务的模态对话框
                const modal = new TaskAddModal(this.app, "", this.selectedDate, this.plugin.settings, async (insertTarget, customNotePath) => {
                    try {
                        await createTaskInNote(this.app, "", this.selectedDate!, this.plugin.settings, insertTarget, customNotePath);
                        
                        // 刷新任务列表和日历
                        await this.refreshCalendar();
                        await this.refreshTaskList();
                    } catch (error) {
                        console.error(`Failed to add task:`, error);
                        new Notice(`添加任务失败`);
                    }
                });
                modal.open();
            } else {
                new Notice("请先选择日期");
            }
        });
        
        const taskList = taskListContainer.createEl("div", {cls: "task-list"});
        taskList.setText("单击日期查看任务");
    }

    /**
     * 添加导航按钮事件监听器
     */
    private addNavigationEventListeners() {
        // 年份导航按钮
        const prevYearBtn = this.containerEl.querySelector(".calendar-header-block-year .prev-btn");
        const nextYearBtn = this.containerEl.querySelector(".calendar-header-block-year .next-btn");
        const yearContent = this.containerEl.querySelector(".calendar-header-block-year .calendar-header-content");
        
        if (prevYearBtn) {
            (prevYearBtn as HTMLElement).title = "上一年";
            prevYearBtn.addEventListener("click", () => {
                this.currentDate.setFullYear(this.currentDate.getFullYear() - 1);
                this.renderCalendar();
            });
        }
        
        if (nextYearBtn) {
            (nextYearBtn as HTMLElement).title = "下一年";
            nextYearBtn.addEventListener("click", () => {
                this.currentDate.setFullYear(this.currentDate.getFullYear() + 1);
                this.renderCalendar();
            });
        }
        
        if (yearContent) {
            yearContent.addEventListener("click", async () => {
                // 显示当年所有任务
                const year = this.currentDate.getFullYear();
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31);
                await this.renderTaskListByDateRange(startDate, endDate);
            });
            yearContent.addEventListener("dblclick", async () => {
                await this.handleYearDoubleClick();
            });
        }
        
        // 季度导航按钮
        const prevQuarterBtn = this.containerEl.querySelector(".calendar-header-block-quarter .prev-btn");
        const nextQuarterBtn = this.containerEl.querySelector(".calendar-header-block-quarter .next-btn");
        const quarterContent = this.containerEl.querySelector(".calendar-header-block-quarter .calendar-header-content-quarter");
        
        if (prevQuarterBtn) {
            (prevQuarterBtn as HTMLElement).title = "上一季";
            prevQuarterBtn.addEventListener("click", () => {
                const currentQuarter = Math.floor(this.currentDate.getMonth() / 3);
                const targetMonth = currentQuarter * 3 - 3;
                this.currentDate.setMonth(targetMonth);
                this.renderCalendar();
            });
        }
        
        if (nextQuarterBtn) {
            (nextQuarterBtn as HTMLElement).title = "下一季";
            nextQuarterBtn.addEventListener("click", () => {
                const currentQuarter = Math.floor(this.currentDate.getMonth() / 3);
                const targetMonth = currentQuarter * 3 + 3;
                this.currentDate.setMonth(targetMonth);
                this.renderCalendar();
            });
        }
        
        if (quarterContent) {
            quarterContent.addEventListener("click", async () => {
                // 显示当季度所有任务
                const year = this.currentDate.getFullYear();
                const currentMonth = this.currentDate.getMonth();
                const quarter = Math.floor(currentMonth / 3);
                const quarterStartMonth = quarter * 3;
                const quarterEndMonth = quarter * 3 + 2;
                const startDate = new Date(year, quarterStartMonth, 1);
                const endDate = new Date(year, quarterEndMonth + 1, 0);
                await this.renderTaskListByDateRange(startDate, endDate);
            });
            quarterContent.addEventListener("dblclick", () => {
                this.handleQuarterDoubleClick();
            });
        }
        
        // 月份导航按钮
        const prevMonthBtn = this.containerEl.querySelector(".calendar-header-block-month .prev-btn");
        const nextMonthBtn = this.containerEl.querySelector(".calendar-header-block-month .next-btn");
        const monthContent = this.containerEl.querySelector(".calendar-header-block-month .calendar-header-content");
        
        if (prevMonthBtn) {
            (prevMonthBtn as HTMLElement).title = "上一月";
            prevMonthBtn.addEventListener("click", () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.renderCalendar();
            });
        }
        
        if (nextMonthBtn) {
            (nextMonthBtn as HTMLElement).title = "下一月";
            nextMonthBtn.addEventListener("click", () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.renderCalendar();
            });
        }
        
        if (monthContent) {
            monthContent.addEventListener("click", async () => {
                // 显示当月所有任务
                const year = this.currentDate.getFullYear();
                const month = this.currentDate.getMonth();
                const startDate = new Date(year, month, 1);
                const endDate = new Date(year, month + 1, 0);
                await this.renderTaskListByDateRange(startDate, endDate);
            });
            monthContent.addEventListener("dblclick", () => {
                this.handleMonthDoubleClick();
            });
        }
        
        // 今日和视图切换按钮
        const todayBtn = this.containerEl.querySelector(".today-label:nth-child(1)");
        const viewToggleBtn = this.containerEl.querySelector(".today-label:nth-child(2)");
        
        if (todayBtn) {
            // 今日按钮：根据是否选中今天日期来决定样式
            const currentToday = new Date();
            const isTodaySelected = this.selectedDate && 
                this.selectedDate.toDateString() === currentToday.toDateString();
            todayBtn.className = `today-label ${isTodaySelected ? 'today-selected' : 'today-unselected'}`;
            todayBtn.addEventListener("click", () => {
                // 选中今天日期，切换到月视图
                this.selectedDate = new Date();
                this.currentDate = new Date();
                this.viewType = 'month'; // 切换到月视图
                this.renderCalendar();
            });
        }
        
        if (viewToggleBtn) {
            // 视图切换按钮：月/年视图切换
            viewToggleBtn.textContent = this.viewType === 'month' ? "月" : "年";
            viewToggleBtn.className = `today-label ${this.viewType === 'year' ? 'today-selected' : 'today-unselected'}`;
            viewToggleBtn.addEventListener("click", () => {
                // 切换视图类型
                this.viewType = this.viewType === 'month' ? 'year' : 'month';
                this.renderCalendar();
            });
        }
    }

    /**
     * 添加日期和周数单元格事件监听器
     */
    private addCalendarCellEventListeners() {
        // 处理月视图的周数和日期单元格
        if (this.viewType === 'month') {
            // 周数单元格
            const weekNumberCells = this.containerEl.querySelectorAll(".week-number-cell");
            weekNumberCells.forEach((cell, index) => {
                // 计算周的开始日期
                const currentYear = this.currentDate.getFullYear();
                const currentMonth = this.currentDate.getMonth();
                const firstDay = new Date(currentYear, currentMonth, 1);
                let startDay = firstDay.getDay();
                const prevMonthDaysToShow = startDay === 0 ? 6 : startDay - 1;
                
                // 计算当前周的起始日期
                const weeksPassed = index;
                const daysPassed = weeksPassed * 7 - prevMonthDaysToShow;
                const weekStartDate = new Date(currentYear, currentMonth, 1 + daysPassed);
                
                // 调整到周一
                const dayOfWeek = weekStartDate.getDay();
                const adjustedDate = new Date(weekStartDate);
                adjustedDate.setDate(adjustedDate.getDate() + (dayOfWeek === 0 ? -6 : 1) - dayOfWeek);
                
                // 获取周数
                const weekInfo = getWeekInfo(adjustedDate);
                const weekNumber = weekInfo.week;
                
                // 周数状态指示器
                const weekIndicators = cell.querySelector(".week-indicators");
                if (weekIndicators) {
                    // 检查周报和任务
                    this.checkWeekNoteAndTasks(adjustedDate, weekNumber, weekIndicators as HTMLElement);
                }
                
                // 单击事件
                cell.addEventListener("click", async () => {
                    // 取消之前选择的日期
                    this.selectedDate = null;

                    // 更新日期单元格的选中状态
                    this.updateDaySelection();

                    // 更新周数单元格的选中状态
                    this.updateWeekSelection(cell as HTMLElement);

                    // 计算周的开始和结束日期
                    const weekStart = new Date(adjustedDate);
                    const weekEnd = new Date(adjustedDate);
                    weekEnd.setDate(weekEnd.getDate() + 6);

                    // 显示该周内的任务
                    await this.renderTaskListByDateRange(weekStart, weekEnd);
                });

                // 双击事件
                cell.addEventListener("dblclick", () => {
                    this.handleWeekDoubleClick(adjustedDate);
                });
            });
            
            // 日期单元格
            const dayCells = this.containerEl.querySelectorAll(".day-cell");
            const currentYear = this.currentDate.getFullYear();
            const currentMonth = this.currentDate.getMonth();
            const firstDay = new Date(currentYear, currentMonth, 1);
            let startDay = firstDay.getDay();
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const prevMonthDaysToShow = startDay === 0 ? 6 : startDay - 1;
            
            // 计算上个月的最后一天
            const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0);
            const prevMonthDays = lastDayOfPrevMonth.getDate();
            const prevMonth = lastDayOfPrevMonth.getMonth();
            const prevMonthYear = lastDayOfPrevMonth.getFullYear();
            
            // 计算下个月的第一天
            const firstDayOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
            const nextMonth = firstDayOfNextMonth.getMonth();
            const nextMonthYear = firstDayOfNextMonth.getFullYear();
            
            let cellIndex = 0;
            let currentDay = 1;
            let prevMonthDay = prevMonthDays - prevMonthDaysToShow + 1;
            let nextMonthDay = 1;
            
            dayCells.forEach((cell) => {
                let date: Date;
                let isOtherMonth = false;
                
                // 计算当前单元格的日期
                if (cellIndex < prevMonthDaysToShow) {
                    // 上个月的日期
                    date = new Date(prevMonthYear, prevMonth, prevMonthDay);
                    prevMonthDay++;
                    isOtherMonth = true;
                } else if (currentDay <= daysInMonth) {
                    // 当前月的日期
                    date = new Date(currentYear, currentMonth, currentDay);
                    currentDay++;
                } else {
                    // 下个月的日期
                    date = new Date(nextMonthYear, nextMonth, nextMonthDay);
                    nextMonthDay++;
                    isOtherMonth = true;
                }
                
                // 只处理当前月份的日期
                if (!isOtherMonth) {
                    // 检查是否有日记和任务，添加指示器
                    const indicatorsContainer = cell.querySelector(".day-indicators");
                    if (indicatorsContainer) {
                        this.addDayIndicators(indicatorsContainer as HTMLElement, date);
                    }
                    
                    // 检查是否是选中的日期
                    if (this.selectedDate) {
                        const isSelected = this.selectedDate.getFullYear() === date.getFullYear() &&
                                          this.selectedDate.getMonth() === date.getMonth() &&
                                          this.selectedDate.getDate() === date.getDate();
                        if (isSelected) {
                            cell.addClass("selected-day");
                        }
                    }
                    
                    // 双击事件
                    cell.addEventListener("dblclick", async () => {
                        await this.handleDayDoubleClick(date);
                    });
                    
                    // 单击事件
                    cell.addEventListener("click", () => {
                        this.onDayClick(date);
                    });
                }
                
                cellIndex++;
            });
        } else {
            // 年视图的季度和月份单元格
            const quarterHeaders = this.containerEl.querySelectorAll(".quarter-header");
            quarterHeaders.forEach((header, index) => {
                const quarter = index;
                
                // 单击事件
                header.addEventListener("click", async () => {
                    // 移除所有季度和月份的选中状态
                    document.querySelectorAll(".quarter-header").forEach(el => {
                        el.classList.remove("selected");
                    });
                    document.querySelectorAll(".month-container").forEach(el => {
                        el.classList.remove("selected");
                    });
                    document.querySelectorAll(".quarter-container").forEach(el => {
                        el.classList.remove("selected");
                    });
                    // 添加当前季度的选中状态
                    header.classList.add("selected");
                    
                    // 计算季度的开始和结束日期
                    const year = this.currentDate.getFullYear();
                    const quarterStartMonth = quarter * 3;
                    const quarterEndMonth = quarter * 3 + 2;
                    const startDate = new Date(year, quarterStartMonth, 1);
                    const endDate = new Date(year, quarterEndMonth + 1, 0);
                    
                    // 显示该季度内的任务
                    await this.renderTaskListByDateRange(startDate, endDate);
                });
                
                // 双击事件
                header.addEventListener("dblclick", async () => {
                    // 双击新建/打开季报
                    const settings = this.plugin.settings.quarterlyNote;
                    const quarterDate = new Date(this.currentDate.getFullYear(), quarter * 3, 1);
                    const fileName = formatDate(quarterDate, settings.fileNameFormat);
                    await createOrOpenNote(this.app, settings.savePath, fileName, settings.templatePath);
                });
            });
            
            const monthContainers = this.containerEl.querySelectorAll(".month-container");
            monthContainers.forEach((container, index) => {
                const quarter = Math.floor(index / 3);
                const monthInQuarter = index % 3;
                const currentMonthIndex = quarter * 3 + monthInQuarter;
                
                // 月份标题
                const monthHeader = container.querySelector(".month-header");
                
                // 单击事件
                container.addEventListener("click", async () => {
                    // 移除所有月份和季度的选中状态
                    document.querySelectorAll(".month-container").forEach(el => {
                        el.classList.remove("selected");
                    });
                    document.querySelectorAll(".quarter-container").forEach(el => {
                        el.classList.remove("selected");
                    });
                    document.querySelectorAll(".quarter-header").forEach(el => {
                        el.classList.remove("selected");
                    });
                    // 添加当前月份的选中状态
                    container.classList.add("selected");
                    
                    // 计算月份的开始和结束日期
                    const year = this.currentDate.getFullYear();
                    const month = currentMonthIndex;
                    const startDate = new Date(year, month, 1);
                    const endDate = new Date(year, month + 1, 0);
                    
                    // 显示该月份内的任务
                    await this.renderTaskListByDateRange(startDate, endDate);
                });
                
                // 双击事件
                if (monthHeader) {
                    monthHeader.addEventListener("dblclick", async () => {
                        // 双击新建/打开月报
                        const settings = this.plugin.settings.monthlyNote;
                        const monthDate = new Date(this.currentDate.getFullYear(), currentMonthIndex, 1);
                        const fileName = formatDate(monthDate, settings.fileNameFormat);
                        await createOrOpenNote(this.app, settings.savePath, fileName, settings.templatePath);
                    });
                }
                
                // 月份状态指示器
                const monthIndicators = container.querySelector(".month-indicators");
                if (monthIndicators) {
                    // 检查月报和任务
                    this.checkMonthNoteAndTasks(currentMonthIndex, monthIndicators as HTMLElement);
                }
            });
        }
    }

    /**
     * 检查月份笔记和任务
     */
    private async checkMonthNoteAndTasks(monthIndex: number, indicators: HTMLElement) {
        const monthDate = new Date(this.currentDate.getFullYear(), monthIndex, 1);
        const monthlySettings = this.plugin.settings.monthlyNote;
        const monthlyFileName = formatDate(monthDate, monthlySettings.fileNameFormat);
        const monthlyNotePath = `${monthlySettings.savePath}/${monthlyFileName}.md`;
        
        let hasMonthlyNote = false;
        let hasMonthlyTask = false;
        
        // 检查是否有月报
        if (await noteExists(this.app, monthlyNotePath)) {
            hasMonthlyNote = true;
            
            // 有月报，检查是否有任务
            try {
                const file = this.app.vault.getAbstractFileByPath(monthlyNotePath);
                if (file && 'stat' in file) {
                    const content = await this.app.vault.read(file as any);
                    
                    // 检查月报中是否有任务
                    const taskRegex = /^\s*([-\*\d]+\.?)\s*\[([ xX])\]/gm;
                    const tasks = content.match(taskRegex);
                    
                    if (tasks && tasks.length > 0) {
                        hasMonthlyTask = true;
                    }
                }
            } catch (error) {
                console.error(`Failed to read monthly note: ${monthlyNotePath}`, error);
            }
        }
        
        // 添加状态指示器
        if (hasMonthlyNote) {
            indicators.createEl("div", {cls: "indicator-dot solid-dot"});
        }
        
        if (hasMonthlyTask) {
            indicators.createEl("div", {cls: "indicator-dot hollow-dot"});
        }
    }

    /**
     * 添加日期指示器
     */
    private async addDayIndicators(indicatorsContainer: HTMLElement, date: Date) {
        // 检查是否有日记
        const dailySettings = this.plugin.settings.dailyNote;
        const dailyFileName = formatDate(date, dailySettings.fileNameFormat);
        const dailyNotePath = `${dailySettings.savePath}/${dailyFileName}.md`;

        let hasNote = false;
        let hasTask = false;

        if (await noteExists(this.app, dailyNotePath)) {
            hasNote = true;
            // 有日记，检查是否有任务
            try {
                const file = this.app.vault.getAbstractFileByPath(dailyNotePath);
                if (file && 'stat' in file) {
                    const content = await this.app.vault.read(file as any);

                    // 检查日记中是否有任务
                    const taskRegex = /^\s*([-\*\d]+\.?)\s*\[([ xX])\]/gm;
                    const tasks = content.match(taskRegex);

                    if (tasks && tasks.length > 0) {
                        hasTask = true;
                    }
                }
            } catch (error) {
                console.error(`Failed to read daily note: ${dailyNotePath}`, error);
            }
        }

        // 创建一行指示器
        const indicatorRow = indicatorsContainer.createEl("div", {cls: "indicator-row"});

        // 显示日记指示器（实心小圆点）
        if (hasNote) {
            indicatorRow.createEl("div", {cls: "indicator-dot solid-dot"});
        }

        // 显示任务指示器（空心小圆点）
        if (hasTask) {
            indicatorRow.createEl("div", {cls: "indicator-dot hollow-dot"});
        }
    }

    private async buildCalendarStructure_old(container: HTMLElement) {

        // 日历头部
        const header = container.createEl("div", {cls: "calendar-header"});
        
        // 第一行：年和季度导航
        const topRow = header.createEl("div", {cls: "calendar-header-row"});
        
        // 年份导航
        const yearNav = topRow.createEl("div", {cls: "calendar-header-block-year"});
        const yearNavBody = yearNav.createEl("div", {cls: "calendar-header-body"});
        
        const prevYearBtn = yearNavBody.createEl("span", {text: "‹", cls: "nav-btn prev-btn"});
        prevYearBtn.title = "上一年";
        prevYearBtn.addEventListener("click", () => {
            this.currentDate.setFullYear(this.currentDate.getFullYear() - 1);
            this.renderCalendar();
        });
        
        const yearContent = yearNavBody.createEl("div", {cls: "calendar-header-content"});
        yearContent.createEl("span", { 
            text: `${this.currentDate.getFullYear()}年`,
        });
        yearContent.addEventListener("click", async () => {
            // 显示当年所有任务
            const year = this.currentDate.getFullYear();
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31);
            await this.renderTaskListByDateRange(startDate, endDate);
        });
        yearContent.addEventListener("dblclick", async () => {
            await this.handleYearDoubleClick();
        });
        
        const nextYearBtn = yearNavBody.createEl("span", {text: "›", cls: "nav-btn next-btn"});
        nextYearBtn.title = "下一年";
        nextYearBtn.addEventListener("click", () => {
            this.currentDate.setFullYear(this.currentDate.getFullYear() + 1);
            this.renderCalendar();
        });
        
        // 季度导航
        const quarterNav = topRow.createEl("div", {cls: "calendar-header-block-quarter"});
        const quarterNavBody = quarterNav.createEl("div", {cls: "calendar-header-body"});
        
        const prevQuarterBtn = quarterNavBody.createEl("span", {text: "‹", cls: "nav-btn prev-btn"});
        prevQuarterBtn.title = "上一季";
        prevQuarterBtn.addEventListener("click", () => {
            const currentQuarter = Math.floor(this.currentDate.getMonth() / 3);
            const targetMonth = currentQuarter * 3 - 3;
            this.currentDate.setMonth(targetMonth);
            this.renderCalendar();
        });
        
        const quarterContent = quarterNavBody.createEl("div", {cls: "calendar-header-content-quarter"});
         quarterContent.createEl("span", { 
             text: `${getQuarter(this.currentDate)}季度`,
         });
        quarterContent.addEventListener("click", async () => {
            // 显示当季度所有任务
            const year = this.currentDate.getFullYear();
            const currentMonth = this.currentDate.getMonth();
            const quarter = Math.floor(currentMonth / 3);
            const quarterStartMonth = quarter * 3;
            const quarterEndMonth = quarter * 3 + 2;
            const startDate = new Date(year, quarterStartMonth, 1);
            const endDate = new Date(year, quarterEndMonth + 1, 0);
            await this.renderTaskListByDateRange(startDate, endDate);
        });
        quarterContent.addEventListener("dblclick", () => {
            this.handleQuarterDoubleClick();
        });
        
        const nextQuarterBtn = quarterNavBody.createEl("span", {text: "›", cls: "nav-btn next-btn"});
        nextQuarterBtn.title = "下一季";
        nextQuarterBtn.addEventListener("click", () => {
            const currentQuarter = Math.floor(this.currentDate.getMonth() / 3);
            const targetMonth = currentQuarter * 3 + 3;
            this.currentDate.setMonth(targetMonth);
            this.renderCalendar();
        });
        
        // 第二行：月和今日按钮
        const bottomRow = header.createEl("div", {cls: "calendar-header-row"});
        
        // 月份导航
        const monthNav = bottomRow.createEl("div", {cls: "calendar-header-block-month"});
        const monthNavBody = monthNav.createEl("div", {cls: "calendar-header-body"});
        
        const prevMonthBtn = monthNavBody.createEl("span", {text: "‹", cls: "nav-btn prev-btn"});
        prevMonthBtn.title = "上一月";
        prevMonthBtn.addEventListener("click", () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });
        
        const monthContent = monthNavBody.createEl("div", {cls: "calendar-header-content"});
        monthContent.createEl("span", { 
            text: `${this.currentDate.getMonth() + 1}月`,
        });
        monthContent.addEventListener("click", async () => {
            // 显示当月所有任务
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 0);
            await this.renderTaskListByDateRange(startDate, endDate);
        });
        monthContent.addEventListener("dblclick", () => {
            this.handleMonthDoubleClick();
        });
        
        const nextMonthBtn = monthNavBody.createEl("span", {text: "›", cls: "nav-btn next-btn"});
        nextMonthBtn.title = "下一月";
        nextMonthBtn.addEventListener("click", () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });
        
        // 今日和视图切换按钮
        const labelBlock = bottomRow.createEl("div", {cls: "calendar-header-block-label"});
        
        // 今日按钮：根据是否选中今天日期来决定样式
        const currentToday = new Date();
        const isTodaySelected = this.selectedDate && 
            this.selectedDate.toDateString() === currentToday.toDateString();
        const todayBtn = labelBlock.createEl("div", { 
            text: "今",
            cls: `today-label ${isTodaySelected ? 'today-selected' : 'today-unselected'}`
        });
        todayBtn.addEventListener("click", () => {
            // 选中今天日期，切换到月视图
            this.selectedDate = new Date();
            this.currentDate = new Date();
            this.viewType = 'month'; // 切换到月视图
            this.renderCalendar();
        });
        
        // 视图切换按钮：月/年视图切换
        const viewToggleBtn = labelBlock.createEl("div", { 
            text: this.viewType === 'month' ? "月" : "年",
            cls: `today-label ${this.viewType === 'year' ? 'today-selected' : 'today-unselected'}`
        });
        viewToggleBtn.addEventListener("click", () => {
            // 切换视图类型
            this.viewType = this.viewType === 'month' ? 'year' : 'month';
            this.renderCalendar();
        });

        // 根据视图类型渲染不同的日历内容
        if (this.viewType === 'month') {
            // 月视图
            // 日历表格
            const calendarTable = container.createEl("table", {cls: "calendar-table"});

            // 星期标题行
            const thead = calendarTable.createEl("thead");
            const headerRow = thead.createEl("tr");
            // 周数标题
            headerRow.createEl("th", {text: "周", cls: "week-number-header"});
            
            // 星期标题，默认周一为第一天
            const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
            for (const day of weekdays) {
                headerRow.createEl("th", {text: day});
            }

            // 月份数据行
            const tbody = calendarTable.createEl("tbody");

            // 计算月份第一天是星期几
            const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
            let startDay = firstDay.getDay();

            // 计算月份总天数
            const daysInMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0).getDate();

            // 获取今天的日期
            const today = new Date();

            // 计算上个月的最后一天
            const lastDayOfPrevMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 0);
            const prevMonthDays = lastDayOfPrevMonth.getDate();
            const prevMonth = lastDayOfPrevMonth.getMonth();
            const prevMonthYear = lastDayOfPrevMonth.getFullYear();

            // 计算下个月的第一天
            const firstDayOfNextMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
            const nextMonth = firstDayOfNextMonth.getMonth();
            const nextMonthYear = firstDayOfNextMonth.getFullYear();

            // 周一为第一天：如果第一天是周日，需要显示6天上个月的日期，否则显示startDay-1天
            let prevMonthDaysToShow = startDay === 0 ? 6 : startDay - 1;

            // 处理上个月的剩余天数
            let prevMonthDay = prevMonthDays - prevMonthDaysToShow + 1;

            // 处理下个月的起始天数
            let nextMonthDay = 1;

            let currentDay = 1;
            let weekCount = 0;

            // 计算需要的行数：(上个月需要显示的天数 + 本月天数 + 7 - 1) / 7 向上取整
            const rowsNeeded = Math.ceil((prevMonthDaysToShow + daysInMonth) / 7);

            // 生成所需的行数
            for (let row = 0; row < rowsNeeded; row++) {
                const weekRow = tbody.createEl("tr");

                // 周数单元格
                // 确定当前行的第一个有效日期
                let firstValidDate;
                if (row === 0 && prevMonthDay <= prevMonthDays) {
                    firstValidDate = new Date(prevMonthYear, prevMonth, prevMonthDay);
                } else if (currentDay <= daysInMonth) {
                    firstValidDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), currentDay);
                } else {
                    firstValidDate = new Date(nextMonthYear, nextMonth, nextMonthDay);
                }

                // 调整日期以计算正确的周数，默认周一为第一天
                const adjustedDate = new Date(firstValidDate);
                const dayOfWeek = firstValidDate.getDay();

                // 计算当前行对应的周的起始日期
                // 周一为第一天：如果是周日，需要减去6天，否则减去当前星期几减1
                adjustedDate.setDate(adjustedDate.getDate() + (dayOfWeek === 0 ? -6 : 1) - dayOfWeek);

                // 获取周数信息，严格遵循ISO周数标准
                const weekInfo = getWeekInfo(adjustedDate);
                const weekNumber = weekInfo.week;

                const weekNumberCell = weekRow.createEl("td", { 
                    cls: "week-number-cell" 
                });

                // 周数文本
                const weekNumberText = weekNumberCell.createEl("div", { 
                    text: `${weekNumber}`,
                    cls: "week-number-text"
                });

                // 周数状态指示器
                const weekIndicators = weekNumberCell.createEl("div", {cls: "week-indicators"});

                // 周数单元格单击事件 - 显示该周的任务
                weekNumberCell.addEventListener("click", async () => {
                    // 取消之前选择的日期
                    this.selectedDate = null;

                    // 更新日期单元格的选中状态
                    this.updateDaySelection();

                    // 更新周数单元格的选中状态
                    this.updateWeekSelection(weekNumberCell);

                    // 计算周的开始和结束日期
                    const weekStart = new Date(adjustedDate);
                    const weekEnd = new Date(adjustedDate);
                    weekEnd.setDate(weekEnd.getDate() + 6);

                    // 显示该周内的任务
                    await this.renderTaskListByDateRange(weekStart, weekEnd);
                });

                // 周数单元格双击事件
                weekNumberCell.addEventListener("dblclick", () => {
                    this.handleWeekDoubleClick(adjustedDate);
                });

                // 检查周报和任务
                await this.checkWeekNoteAndTasks(adjustedDate, weekNumber, weekIndicators);

                // 日期单元格
                for (let i = 0; i < 7; i++) {
                    const dayCell = weekRow.createEl("td", {cls: "day-cell"});

                    let date;
                    let isOtherMonth = false;

                    if (row === 0 && i < prevMonthDaysToShow) {
                        // 上个月的日期
                        date = new Date(prevMonthYear, prevMonth, prevMonthDay);
                        prevMonthDay++;
                        isOtherMonth = true;
                    } else if (currentDay <= daysInMonth) {
                        // 当前月的日期
                        date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), currentDay);
                        currentDay++;
                    } else {
                        // 下个月的日期
                        date = new Date(nextMonthYear, nextMonth, nextMonthDay);
                        nextMonthDay++;
                        isOtherMonth = true;
                    }

                    if (isOtherMonth) {
                        dayCell.addClass("other-month");
                    }

                    // 检查是否是今天
                    const isToday = date.toDateString() === today.toDateString();
                    if (isToday) {
                        dayCell.addClass("today");
                    }

                    // 日期容器，用于容纳日期数字和节假日状态
                    const dateContainer = dayCell.createEl("div", { cls: "date-container" });

                    // 日期数字
                    const dayNumber = dateContainer.createEl("span", { 
                        text: `${date.getDate()}`,
                        cls: "day-number"
                    });

                    // 检查是否是周末
                    // 周一为第一天时，周六（i=5）和周日（i=6）为周末
                    // 但只有法定节假日才改变颜色，非法定节假日的周末保持默认颜色
                    // if (i === 5 || i === 6) {
                    //     dayNumber.style.color = "var(--interactive-accent)";
                    // }

                    // 添加法定节假日状态标记（休/班）
                    // 由于已经预加载了节假日数据，可以直接使用同步方式检查缓存
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const fullDate = `${year}-${month}-${day}`;
                    
                    // 获取节假日状态
                    const status = getHolidayStatus(date);
                    if (status) {
                        const statusEl = dateContainer.createEl("span", { 
                            text: status,
                            cls: `holiday-status ${status === '休' ? 'holiday' : 'workday'}`
                        });
                        // 法定节假日的阳历数字颜色改为深红
                        dayNumber.addClass("holiday-date");
                    }

                    // 农历日期
                    const lunarDateResult = getLunarDate(date);
                    const lunarDate = dayCell.createEl("div", { 
                        text: lunarDateResult.text,
                        cls: `lunar-date lunar-${lunarDateResult.type}`
                    });

                    // 日期状态指示器容器
                    const indicatorsContainer = dayCell.createEl("div", {cls: "day-indicators"});

                    // 只处理当前月份的日期，添加任务指示器
                    if (!isOtherMonth) {
                        // 检查是否有日记
                        const dailySettings = this.plugin.settings.dailyNote;
                        const dailyFileName = formatDate(date, dailySettings.fileNameFormat);
                        const dailyNotePath = `${dailySettings.savePath}/${dailyFileName}.md`;

                        let hasNote = false;
                        let hasTask = false;

                        if (await noteExists(this.app, dailyNotePath)) {
                            hasNote = true;
                            // 有日记，检查是否有任务
                            try {
                                const file = this.app.vault.getAbstractFileByPath(dailyNotePath);
                                if (file && 'stat' in file) {
                                    const content = await this.app.vault.read(file as any);

                                    // 检查日记中是否有任务
                                    const taskRegex = /^\s*([-\*\d]+\.?)\s*\[([ xX])\]/gm;
                                    const tasks = content.match(taskRegex);

                                    if (tasks && tasks.length > 0) {
                                        hasTask = true;
                                    }
                                }
                            } catch (error) {
                                console.error(`Failed to read daily note: ${dailyNotePath}`, error);
                            }
                        }

                        // 创建一行指示器
                        const indicatorRow = indicatorsContainer.createEl("div", {cls: "indicator-row"});

                        // 显示日记指示器（实心小圆点）
                        if (hasNote) {
                            indicatorRow.createEl("div", {cls: "indicator-dot solid-dot"});
                        }

                        // 显示任务指示器（空心小圆点）
                        if (hasTask) {
                            indicatorRow.createEl("div", {cls: "indicator-dot hollow-dot"});
                        }

                        // 检查是否是选中的日期
                        if (this.selectedDate) {
                            const isSelected = this.selectedDate.getFullYear() === date.getFullYear() &&
                                              this.selectedDate.getMonth() === date.getMonth() &&
                                              this.selectedDate.getDate() === date.getDate();
                            if (isSelected) {
                                dayCell.addClass("selected-day");
                            }
                        }

                        // 双击事件
                        dayCell.addEventListener("dblclick", async () => {
                            await this.handleDayDoubleClick(date);
                        });

                        // 单击事件（显示任务列表）
                        dayCell.addEventListener("click", () => {
                            this.onDayClick(date);
                        });
                    }
                }

                weekCount++;
            }
        } else {
            // 年视图：按季度和月份排列
            const yearViewContainer = container.createEl("div", {cls: "year-view-container"});
            
            // 季度循环（Q1到Q4）
            for (let quarter = 0; quarter < 4; quarter++) {
                // 季度容器
                const quarterContainer = yearViewContainer.createEl("div", {cls: "quarter-container"});
                
                // 季度标题
                const quarterHeader = quarterContainer.createEl("div", { 
                    text: `${quarter + 1}季度`,
                    cls: "quarter-header"
                });
                
                // 季度标题点击事件 - 切换背景为紫色
                quarterHeader.addEventListener("click", async () => {
                    // 移除所有季度和月份的选中状态
                    document.querySelectorAll(".quarter-header").forEach(el => {
                        el.classList.remove("selected");
                    });
                    document.querySelectorAll(".month-container").forEach(el => {
                        el.classList.remove("selected");
                    });
                    document.querySelectorAll(".quarter-container").forEach(el => {
                        el.classList.remove("selected");
                    });
                    // 添加当前季度的选中状态
                    quarterHeader.classList.add("selected");
                    
                    // 计算季度的开始和结束日期
                    const year = this.currentDate.getFullYear();
                    const quarterStartMonth = quarter * 3;
                    const quarterEndMonth = quarter * 3 + 2;
                    const startDate = new Date(year, quarterStartMonth, 1);
                    const endDate = new Date(year, quarterEndMonth + 1, 0);
                    
                    // 显示该季度内的任务
                    await this.renderTaskListByDateRange(startDate, endDate);
                });
                
                // 季度双击事件
                quarterHeader.addEventListener("dblclick", async () => {
                    // 双击新建/打开季报
                    const settings = this.plugin.settings.quarterlyNote;
                    const quarterDate = new Date(this.currentDate.getFullYear(), quarter * 3, 1);
                    const fileName = formatDate(quarterDate, settings.fileNameFormat);
                    await createOrOpenNote(this.app, settings.savePath, fileName, settings.templatePath);
                });
                
                // 季度月份容器
                const quarterMonths = quarterContainer.createEl("div", {cls: "quarter-months"});
                
                // 每个季度包含3个月
                for (let month = 0; month < 3; month++) {
                    // 计算当前月份索引
                    const currentMonthIndex = quarter * 3 + month;
                    
                    // 月份容器
                    const monthContainer = quarterMonths.createEl("div", {cls: "month-container"});
                    
                    // 月份标题
                    const monthHeader = monthContainer.createEl("div", { 
                        text: `${currentMonthIndex + 1}月`,
                        cls: "month-header"
                    });
                    
                    // 月份状态指示器
                    const monthIndicators = monthContainer.createEl("div", {cls: "month-indicators"});
                    
                    // 月份单元格点击事件 - 切换背景为紫色
                    monthContainer.addEventListener("click", async () => {
                        // 移除所有月份和季度的选中状态
                        document.querySelectorAll(".month-container").forEach(el => {
                            el.classList.remove("selected");
                        });
                        document.querySelectorAll(".quarter-container").forEach(el => {
                            el.classList.remove("selected");
                        });
                        document.querySelectorAll(".quarter-header").forEach(el => {
                            el.classList.remove("selected");
                        });
                        // 添加当前月份的选中状态
                        monthContainer.classList.add("selected");
                        
                        // 计算月份的开始和结束日期
                        const year = this.currentDate.getFullYear();
                        const month = currentMonthIndex;
                        const startDate = new Date(year, month, 1);
                        const endDate = new Date(year, month + 1, 0);
                        
                        // 显示该月份内的任务
                        await this.renderTaskListByDateRange(startDate, endDate);
                    });
                    
                    // 月份双击事件
                    monthHeader.addEventListener("dblclick", async () => {
                        // 双击新建/打开月报
                        const settings = this.plugin.settings.monthlyNote;
                        const monthDate = new Date(this.currentDate.getFullYear(), currentMonthIndex, 1);
                        const fileName = formatDate(monthDate, settings.fileNameFormat);
                        await createOrOpenNote(this.app, settings.savePath, fileName, settings.templatePath);
                    });
                    
                    // 检查月报和任务
                    const monthDate = new Date(this.currentDate.getFullYear(), currentMonthIndex, 1);
                    const monthlySettings = this.plugin.settings.monthlyNote;
                    const monthlyFileName = formatDate(monthDate, monthlySettings.fileNameFormat);
                    const monthlyNotePath = `${monthlySettings.savePath}/${monthlyFileName}.md`;
                    
                    let hasMonthlyNote = false;
                    let hasMonthlyTask = false;
                    
                    // 检查是否有月报
                    if (await noteExists(this.app, monthlyNotePath)) {
                        hasMonthlyNote = true;
                        
                        // 有月报，检查是否有任务
                        try {
                            const file = this.app.vault.getAbstractFileByPath(monthlyNotePath);
                            if (file && 'stat' in file) {
                                const content = await this.app.vault.read(file as any);
                                
                                // 检查月报中是否有任务
                                const taskRegex = /^\s*([-\*\d]+\.?)\s*\[([ xX])\]/gm;
                                const tasks = content.match(taskRegex);
                                
                                if (tasks && tasks.length > 0) {
                                    hasMonthlyTask = true;
                                }
                            }
                        } catch (error) {
                            console.error(`Failed to read monthly note: ${monthlyNotePath}`, error);
                        }
                    }
                    
                    // 添加状态指示器
                    if (hasMonthlyNote) {
                        monthIndicators.createEl("div", {cls: "indicator-dot solid-dot"});
                    }
                    
                    if (hasMonthlyTask) {
                        monthIndicators.createEl("div", {cls: "indicator-dot hollow-dot"});
                    }
                }
            }
        }

        // 任务列表区域
        const taskListContainer = container.createEl("div", {cls: "task-list-container"});
        
        // 任务列表标题和筛选按钮
        const taskListHeader = taskListContainer.createEl("div", {cls: "task-list-header"});
        taskListHeader.createEl("h3", {text: "任务列表"});
        
        // 筛选按钮组
        const filterButtons = taskListHeader.createEl("div", {cls: "filter-buttons"});
        
        // 待办按钮
        const todoBtn = filterButtons.createEl("button", {text: "待办"});
        todoBtn.className = `filter-btn ${this.taskStatusFilter === 'todo' ? 'active' : ''}`;
        todoBtn.addEventListener("click", async () => {
            this.taskStatusFilter = 'todo';
            // 重新渲染日历
            await this.renderCalendar();
            // 如果已经有选中的日期，重新渲染任务列表
            if (this.selectedDate) {
                const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
                if (taskListContainer) {
                    await this.renderTaskList(this.selectedDate, taskListContainer);
                }
            }
        });
        
        // 已办按钮
        const doneBtn = filterButtons.createEl("button", {text: "已办"});
        doneBtn.className = `filter-btn ${this.taskStatusFilter === 'done' ? 'active' : ''}`;
        doneBtn.addEventListener("click", async () => {
            this.taskStatusFilter = 'done';
            // 重新渲染日历
            await this.renderCalendar();
            // 如果已经有选中的日期，重新渲染任务列表
            if (this.selectedDate) {
                const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
                if (taskListContainer) {
                    await this.renderTaskList(this.selectedDate, taskListContainer);
                }
            }
        });
        
        // 所有按钮
        const allBtn = filterButtons.createEl("button", {text: "所有"});
        allBtn.className = `filter-btn ${this.taskStatusFilter === 'all' ? 'active' : ''}`;
        allBtn.addEventListener("click", async () => {
            this.taskStatusFilter = 'all';
            // 重新渲染日历
            await this.renderCalendar();
            // 如果已经有选中的日期，重新渲染任务列表
            if (this.selectedDate) {
                const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
                if (taskListContainer) {
                    await this.renderTaskList(this.selectedDate, taskListContainer);
                }
            }
        });
        
        // 新建按钮
        const newTaskBtn = filterButtons.createEl("button", {text: "新建"});
        newTaskBtn.className = "filter-btn new-task-btn";
        newTaskBtn.addEventListener("click", () => {
            if (this.selectedDate) {
                // 调用添加任务的模态对话框
                const modal = new TaskAddModal(this.app, "", this.selectedDate, this.plugin.settings, async (insertTarget, customNotePath) => {
                    try {
                        await createTaskInNote(this.app, "", this.selectedDate!, this.plugin.settings, insertTarget, customNotePath);
                        
                        // 刷新任务列表和日历
                        await this.refreshCalendar();
                        await this.refreshTaskList();
                    } catch (error) {
                        console.error(`Failed to add task:`, error);
                        new Notice(`添加任务失败`);
                    }
                });
                modal.open();
            } else {
                new Notice("请先选择日期");
            }
        });
        
        const taskList = taskListContainer.createEl("div", {cls: "task-list"});
        taskList.setText("单击日期查看任务");
    }

    private async handleDayDoubleClick(date: Date) {
        // 双击日期新建/打开日记
        const settings = this.plugin.settings.dailyNote;
        const fileName = formatDate(date, settings.fileNameFormat);
        await createOrOpenNote(this.app, settings.savePath, fileName, settings.templatePath);
    }

    private async handleWeekDoubleClick(date: Date) {
        // 双击周数新建/打开周报
        const settings = this.plugin.settings.weeklyNote;
        const fileName = formatDate(date, settings.fileNameFormat);
        await createOrOpenNote(this.app, settings.savePath, fileName, settings.templatePath);
    }

    private async handleMonthDoubleClick() {
        // 双击月份新建/打开月报
        const settings = this.plugin.settings.monthlyNote;
        const fileName = formatDate(this.currentDate, settings.fileNameFormat);
        await createOrOpenNote(this.app, settings.savePath, fileName, settings.templatePath);
    }

    private async handleQuarterDoubleClick() {
        // 双击季度新建/打开季报
        const settings = this.plugin.settings.quarterlyNote;
        const fileName = formatDate(this.currentDate, settings.fileNameFormat);
        await createOrOpenNote(this.app, settings.savePath, fileName, settings.templatePath);
    }

    private async handleYearDoubleClick() {
        // 双击年度新建/打开年报
        const settings = this.plugin.settings.yearlyNote;
        const fileName = formatDate(this.currentDate, settings.fileNameFormat);
        await createOrOpenNote(this.app, settings.savePath, fileName, settings.templatePath);
    }

    private async renderTaskList(date: Date, container: HTMLElement) {
        // 获取任务列表容器
        let taskList = container.querySelector(".task-list") as HTMLElement;
        if (taskList) {
            // 从笔记中提取任务并应用筛选
            const allTasks = await extractTasks(this.app, this.plugin.settings);
            const filteredByDate = filterTasks(allTasks, this.plugin.settings, date);
            
            // 根据状态筛选任务
            let filteredTasks = filteredByDate;
            if (this.taskStatusFilter === 'todo') {
                filteredTasks = filteredByDate.filter(task => !task.completed);
            } else if (this.taskStatusFilter === 'done') {
                filteredTasks = filteredByDate.filter(task => task.completed);
            }

            // 更新任务列表，采用高效的方式
            this.updateTaskListItems(taskList, filteredTasks, date);
        }
    }

    /**
     * 高效更新任务列表项，只添加新任务，删除不再存在的任务，更新现有任务的状态
     */
    private updateTaskListItems(taskList: HTMLElement, tasks: Task[], date: Date) {
        // 保存当前所有任务项
        const currentTaskItems = Array.from(taskList.querySelectorAll(".task-item")) as HTMLElement[];
        const newTaskMap = new Map<string, Task>();
        
        // 生成新任务的唯一标识
        tasks.forEach(task => {
            // 使用任务文本和文件路径作为唯一标识
            const taskId = `${task.text}-${task.filePath}`;
            newTaskMap.set(taskId, task);
        });
        
        // 1. 更新或删除现有任务项
        const tasksToKeep: HTMLElement[] = [];
        
        for (const taskItem of currentTaskItems) {
            const taskTextEl = taskItem.querySelector(".task-text") as HTMLElement;
            const taskCheckbox = taskItem.querySelector(".task-checkbox") as HTMLInputElement;
            
            if (taskTextEl && taskCheckbox) {
                const taskText = taskTextEl.dataset.text || taskTextEl.textContent || "";
                const fileElement = taskItem.querySelector(".task-file");
                const filePath = fileElement ? fileElement.textContent || "" : "";
                const taskId = `${taskText}-${filePath}`;
                
                if (newTaskMap.has(taskId)) {
                    // 任务仍然存在，更新状态
                    const task = newTaskMap.get(taskId)!;
                    
                    // 更新复选框状态
                    if (taskCheckbox.checked !== task.completed) {
                        taskCheckbox.checked = task.completed;
                    }
                    
                    // 更新文本样式（完成状态）
                    if (task.completed && !taskTextEl.hasClass("completed")) {
                        taskTextEl.addClass("completed");
                    } else if (!task.completed && taskTextEl.hasClass("completed")) {
                        taskTextEl.removeClass("completed");
                    }
                    
                    // 保留此任务项
                    tasksToKeep.push(taskItem);
                    // 从新任务映射中移除，剩下的就是需要添加的新任务
                    newTaskMap.delete(taskId);
                } else {
                    // 任务不再存在，删除
                    taskItem.remove();
                }
            }
        }
        
        // 2. 添加新任务项
        let taskIndex = tasksToKeep.length;
        
        newTaskMap.forEach(task => {
            const taskItem = taskList.createEl("div", { cls: "task-item" });
            
            const checkbox = taskItem.createEl("input", { type: "checkbox" });
            checkbox.className = "task-checkbox";
            checkbox.checked = task.completed;
            checkbox.addEventListener("change", () => {
                this.handleTaskToggle(taskIndex, checkbox.checked);
            });
            
            const taskContent = taskItem.createEl("div", { cls: "task-content" });
            
            const taskText = taskContent.createEl("span", { text: task.text });
            taskText.className = "task-text";
            taskText.dataset.text = task.text;
            if (task.completed) {
                taskText.addClass("completed");
            }
            
            // 添加任务文件路径（用于唯一标识）
            const taskFile = taskItem.createEl("div", { cls: "task-file", text: task.filePath });
            taskFile.style.display = "none";
            
            // 双击任务内容打开对应笔记并选中任务
            taskContent.addEventListener("dblclick", async (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                const file = this.app.vault.getAbstractFileByPath(task.filePath);
                if (file && 'stat' in file) {
                    const leaf = this.app.workspace.getLeaf(false);
                    await leaf.openFile(file as any);
                    
                    // 尝试选中任务（如果是Markdown文件）
                    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
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
                                    // 滚动到任务位置，确保选中内容居中显示
                                    editor.scrollIntoView({ from: startPos, to: endPos }, true);
                                }
                            }
                        }
                    }
                }
            });
            
            // 点击任务文本展开/收缩
            taskContent.addEventListener("click", (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                taskText.classList.toggle("expanded");
            });
            
            taskIndex++;
        });
    }

    private async renderTaskListByDateRange(startDate: Date, endDate: Date) {
        // 获取任务列表容器
        const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
        if (!taskListContainer) return;
        const taskList = taskListContainer.querySelector(".task-list") as HTMLElement;
        if (!taskList) return;

        // 从笔记中提取任务
        const allTasks = await extractTasks(this.app, this.plugin.settings);
        
        // 过滤任务：截止日期在 startDate 和 endDate 之间
        const filteredByDateRange = allTasks.filter(task => {
            if (!task.dueDate) return false;
            return task.dueDate >= startDate && task.dueDate <= endDate;
        });
        
        // 根据状态筛选任务
        let filteredTasks = filteredByDateRange;
        if (this.taskStatusFilter === 'todo') {
            filteredTasks = filteredByDateRange.filter(task => !task.completed);
        } else if (this.taskStatusFilter === 'done') {
            filteredTasks = filteredByDateRange.filter(task => task.completed);
        }

        // 高效更新任务列表
        this.updateTaskListItems(taskList, filteredTasks, startDate);
    }

    private async handleTaskToggle(taskId: number, completed: boolean) {
        // 处理任务状态切换
        new Notice(`任务 ${taskId} 状态切换为 ${completed ? '已完成' : '未完成'}`);
        
        // 获取当前选中的日期对应的任务列表
        if (this.selectedDate) {
            const allTasks = await extractTasks(this.app, this.plugin.settings);
            const filteredByDate = filterTasks(allTasks, this.plugin.settings, this.selectedDate);
            let filteredTasks = filteredByDate;
            
            // 应用当前的状态筛选
            if (this.taskStatusFilter === 'todo') {
                filteredTasks = filteredByDate.filter(task => !task.completed);
            } else if (this.taskStatusFilter === 'done') {
                filteredTasks = filteredByDate.filter(task => task.completed);
            }
            
            const task = filteredTasks[taskId];
            if (task) {
                // 更新笔记中的任务状态
                await updateTaskInNote(this.app, task, completed);
                
                // 仅刷新任务列表，显示最新状态
                await this.refreshTaskList();
                
                // 仅刷新日历，更新小圆点
                await this.refreshCalendar();
            }
        }
    }

    private handleTaskDelete(taskId: number) {
        // 处理任务删除
        new Notice(`任务 ${taskId} 已删除`);
        // 后续需要从笔记中删除
    }

    private async handleAddTask(taskText: string, date: Date) {
        // 处理添加新任务
        if (taskText.trim()) {
            // 创建添加任务选项菜单
            const modal = new TaskAddModal(this.app, taskText, date, this.plugin.settings, async (insertTarget, customNotePath) => {
                new Notice(`添加任务: ${taskText}`);
                
                try {
                    await createTaskInNote(this.app, taskText, date, this.plugin.settings, insertTarget, customNotePath);
                    
                    // 仅刷新任务列表和日历，更新显示
                    await this.refreshCalendar();
                    await this.refreshTaskList();
                } catch (error) {
                    console.error(`Failed to add task:`, error);
                    new Notice(`添加任务失败`);
                }
            });
            modal.open();
        }
    }

    private async checkWeekNoteAndTasks(weekStartDate: Date, weekNumber: number, indicators: HTMLElement) {
        // 计算周结束日期
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        
        let hasWeeklyNote = false;
        let hasWeeklyTask = false;
        
        // 获取周报设置
        const weeklySettings = this.plugin.settings.weeklyNote;
        const weeklyFileName = formatDate(weekStartDate, weeklySettings.fileNameFormat);
        
        // 检查多种可能的周报路径
        const possiblePaths = [
            `${weeklySettings.savePath}/${weeklyFileName}.md`,
            `00-周期笔记/2-周报/${weeklyFileName}.md`,
            `00-周期笔记/2-周报/${formatDate(weekStartDate, "YYYY-wWW")}.md`,
            `00-周期笔记/2-周报/${formatDate(weekStartDate, "YYYY-WW")}.md`
        ];
        
        // 检查是否存在周报
        for (const path of possiblePaths) {
            if (await noteExists(this.app, path)) {
                hasWeeklyNote = true;
                break;
            }
        }
        
        // 检查本周内是否有截止任务
        const allTasks = await extractTasks(this.app, this.plugin.settings);
        for (const task of allTasks) {
            if (task.dueDate && task.dueDate >= weekStartDate && task.dueDate <= weekEndDate) {
                hasWeeklyTask = true;
                break;
            }
        }
        
        // 清空现有指示器
        indicators.empty();
        
        // 添加实心小圆点表示周报
        if (hasWeeklyNote) {
            indicators.createEl("div", {cls: "indicator-dot solid-dot"});
        }
        
        // 添加空心小圆点表示任务
        if (hasWeeklyTask) {
            indicators.createEl("div", {cls: "indicator-dot hollow-dot"});
        }
    }
    
    /**
     * 更新所有日期和周数的指示器，而不重建整个日历结构
     * 采用整体同步覆盖的方式，一次性更新所有内容
     */
    private async updateIndicators() {
        if (this.viewType === 'month') {
            // 使用indicatorRenderer更新指示器
            await this.indicatorRenderer.updateAllDayIndicators(this.containerEl, this.currentDate);
            await this.indicatorRenderer.updateWeekIndicators(this.containerEl, this.currentDate);
        }
        // 如果选中了日期，更新任务列表
        if (this.selectedDate) {
            await this.refreshTaskList();
        }
    }

    /**
     * 收集所有日期指示器的数据
     */
    private async collectDayIndicatorData() {
        const dayIndicatorData = new Map<string, { hasNote: boolean; hasTask: boolean }>();
        const dayCells = Array.from(this.containerEl.querySelectorAll('.day-cell:not(.other-month)'));
        
        for (const cell of dayCells) {
            const dayNumberEl = cell.querySelector('.day-number');
            if (!dayNumberEl) continue;
            
            const dayNumber = parseInt(dayNumberEl.textContent || '0');
            if (isNaN(dayNumber)) continue;
            
            // 获取当前视图的年月
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
            const date = new Date(year, month, dayNumber);
            
            // 检查是否有日记和任务
            const dailySettings = this.plugin.settings.dailyNote;
            const dailyFileName = formatDate(date, dailySettings.fileNameFormat);
            const dailyNotePath = `${dailySettings.savePath}/${dailyFileName}.md`;
            
            let hasNote = false;
            let hasTask = false;
            
            if (await noteExists(this.app, dailyNotePath)) {
                hasNote = true;
                // 有日记，检查是否有任务
                try {
                    const file = this.app.vault.getAbstractFileByPath(dailyNotePath);
                    if (file instanceof TFile) {
                        const content = await this.app.vault.read(file);
                        
                        // 检查日记中是否有任务
                        const taskRegex = /^\s*([-\*\d]+\.?)\s*\[([ xX])\]/gm;
                        const tasks = content.match(taskRegex);
                        
                        if (tasks && tasks.length > 0) {
                            hasTask = true;
                        }
                    }
                } catch (error) {
                    console.error(`Failed to read daily note: ${dailyNotePath}`, error);
                }
            }
            
            // 存储数据，使用日期字符串作为键
            dayIndicatorData.set(`${year}-${month}-${dayNumber}`, { hasNote, hasTask });
        }
        
        return dayIndicatorData;
    }

    /**
     * 收集所有周数指示器的数据
     */
    private async collectWeekIndicatorData() {
        const weekIndicatorData = new Map<string, { weekStartDate: Date; weekNumber: number }>();
        const weekCells = Array.from(this.containerEl.querySelectorAll('.week-number-cell'));
        
        for (const cell of weekCells) {
            const weekNumberEl = cell.querySelector('.week-number-text');
            if (!weekNumberEl) continue;
            
            const weekNumber = parseInt(weekNumberEl.textContent || '0');
            if (isNaN(weekNumber)) continue;
            
            // 确定当前行的第一个有效日期
            const firstDayOfMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
            const startDayOfWeek = firstDayOfMonth.getDay();
            const prevMonthDaysToShow = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
            
            // 计算当前周的起始日期
            const weekStartDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
            weekStartDate.setDate(weekStartDate.getDate() - prevMonthDaysToShow + (weekNumber - 1) * 7);
            
            // 存储数据，使用周数作为键
            weekIndicatorData.set(`${weekNumber}`, { weekStartDate, weekNumber });
        }
        
        return weekIndicatorData;
    }

    /**
     * 一次性应用所有日期指示器数据
     */
    private applyDayIndicators(dayIndicatorData: Map<string, { hasNote: boolean; hasTask: boolean }>) {
        const dayCells = Array.from(this.containerEl.querySelectorAll('.day-cell:not(.other-month)'));
        
        for (const cell of dayCells) {
            const dayNumberEl = cell.querySelector('.day-number');
            if (!dayNumberEl) continue;
            
            const dayNumber = parseInt(dayNumberEl.textContent || '0');
            if (isNaN(dayNumber)) continue;
            
            // 获取当前视图的年月
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
            const dataKey = `${year}-${month}-${dayNumber}`;
            
            const data = dayIndicatorData.get(dataKey);
            if (!data) continue;
            
            // 清空现有指示器
            const indicatorsContainer = cell.querySelector('.day-indicators');
            if (indicatorsContainer) {
                indicatorsContainer.empty();
                
                // 创建一行指示器
                const indicatorRow = indicatorsContainer.createEl('div', {cls: 'indicator-row'});
                
                // 显示日记指示器（实心小圆点）
                if (data.hasNote) {
                    indicatorRow.createEl('div', {cls: 'indicator-dot solid-dot'});
                }
                
                // 显示任务指示器（空心小圆点）
                if (data.hasTask) {
                    indicatorRow.createEl('div', {cls: 'indicator-dot hollow-dot'});
                }
            }
        }
    }

    /**
     * 一次性应用所有周数指示器数据
     */
    private async applyWeekIndicators(weekIndicatorData: Map<string, { weekStartDate: Date; weekNumber: number }>) {
        const weekCells = Array.from(this.containerEl.querySelectorAll('.week-number-cell'));
        
        // 先收集所有需要异步处理的检查
        const checkPromises: Promise<{ cell: Element; weekStartDate: Date; weekNumber: number; indicators: HTMLElement }>[] = [];
        
        for (const cell of weekCells) {
            const weekNumberEl = cell.querySelector('.week-number-text');
            if (!weekNumberEl) continue;
            
            const weekNumber = parseInt(weekNumberEl.textContent || '0');
            if (isNaN(weekNumber)) continue;
            
            const dataKey = `${weekNumber}`;
            const data = weekIndicatorData.get(dataKey);
            if (!data) continue;
            
            // 清空现有指示器
            const indicators = cell.querySelector('.week-indicators') as HTMLElement;
            if (indicators) {
                indicators.empty();
                checkPromises.push(Promise.resolve({ cell, weekStartDate: data.weekStartDate, weekNumber: data.weekNumber, indicators }));
            }
        }
        
        // 并行执行所有检查
        const checkResults = await Promise.all(checkPromises);
        
        // 一次性应用所有结果
        for (const result of checkResults) {
            await this.checkWeekNoteAndTasks(result.weekStartDate, result.weekNumber, result.indicators);
        }
    }

    /**
     * 完全刷新视图
     */
    private async refreshAll() {
        // 对于增量更新，我们只需要更新指示器和任务列表
        await this.updateIndicators();
    }

    /**
     * 仅刷新日历部分
     */
    private async refreshCalendar() {
        // 使用局部更新方式，只更新指示器
        await this.updateIndicators();
    }

    /**
     * 仅刷新任务列表
     */
    private async refreshTaskList() {
        if (this.selectedDate) {
            const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
            if (taskListContainer) {
                await this.renderTaskList(this.selectedDate, taskListContainer);
            }
        }
    }
    
    /**
     * 处理文件变化事件，只更新相关的单元格指示器
     */
    private async handleFileChange(file: any) {
        await this.eventHandler.handleFileChange(file, 
            async (date) => await this.updateSingleDayIndicator(date),
            async (date) => await this.updateSingleWeekIndicator(date),
            async () => await this.refreshTaskList()
        );
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
                // 这里需要根据实际的日期格式进行解析
                // 由于格式可能多样，我们使用一个简单的方法尝试解析
                // 实际项目中可能需要更复杂的解析逻辑
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
     * 检查文件是否与指定日期相关
     */
    private isFileRelatedToDate(file: any, date: Date): boolean {
        // 检查文件是否是该日期的日记
        const dailySettings = this.plugin.settings.dailyNote;
        const dailyFileName = formatDate(date, dailySettings.fileNameFormat);
        const dailyNotePath = `${dailySettings.savePath}/${dailyFileName}.md`;
        
        return file && file.path === dailyNotePath;
    }
    
    /**
     * 更新单个日期的指示器
     */
    private async updateSingleDayIndicator(date: Date) {
        // 使用indicatorRenderer更新单个日期的指示器
        await this.indicatorRenderer.updateSingleDayIndicator(this.containerEl, date);
    }

    /**
     * 更新单个周数的指示器
     */
    private async updateSingleWeekIndicator(date: Date) {
        // 计算该日期所在周的起始日期（周一）
        const weekStartDate = new Date(date);
        const dayOfWeek = weekStartDate.getDay();
        weekStartDate.setDate(weekStartDate.getDate() + (dayOfWeek === 0 ? -6 : 1) - dayOfWeek);
        
        // 使用indicatorRenderer更新周数指示器
        await this.indicatorRenderer.updateWeekIndicators(this.containerEl, weekStartDate);
    }
    
    /**
     * 根据日期获取对应的单元格
     */
    private getDayCellByDate(date: Date): HTMLElement | null {
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        
        // 检查当前视图是否显示该日期所在的月份
        if (this.currentDate.getFullYear() !== year || this.currentDate.getMonth() !== month) {
            return null;
        }
        
        // 查找对应日期的单元格
        const dayCells = Array.from(this.containerEl.querySelectorAll('.day-cell:not(.other-month)'));
        
        for (const cell of dayCells) {
            const dayNumberEl = cell.querySelector('.day-number');
            if (!dayNumberEl) continue;
            
            const dayNumber = parseInt(dayNumberEl.textContent || '0');
            if (dayNumber === day) {
                return cell as HTMLElement;
            }
        }
        
        return null;
    }

    private async onDayClick(date: Date) {
        // 更新选中日期
        this.selectedDate = date;
        
        // 更新当前日期
        this.currentDate = date;
        
        // 直接更新日期单元格的选中状态，避免重新渲染整个日历
        this.updateDaySelection();
        
        // 只更新任务列表
        const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
        if (taskListContainer) {
            await this.renderTaskList(date, taskListContainer);
        }
    }

    /**
     * 更新日期单元格的选中状态，避免重新渲染整个日历
     */
    private updateDaySelection() {
        // 使用indicatorRenderer更新日期选择状态
        this.indicatorRenderer.updateDaySelection(this.containerEl, this.selectedDate);
        
        // 更新"今"字按钮的样式，根据今天是否被选中
        const currentToday = new Date();
        const isTodaySelected = this.selectedDate && 
            this.selectedDate.toDateString() === currentToday.toDateString();
        
        const todayBtn = this.containerEl.querySelector(".today-label");
        if (todayBtn) {
            if (isTodaySelected) {
                todayBtn.addClass("today-selected");
                todayBtn.removeClass("today-unselected");
            } else {
                todayBtn.addClass("today-unselected");
                todayBtn.removeClass("today-selected");
            }
        }
        
        // 点击日期时取消周数的选中状态
        this.updateWeekSelection();
    }

    /**
     * 更新周数单元格的选中状态
     */
    private updateWeekSelection(selectedWeekCell?: HTMLElement) {
        // 移除所有周数单元格的选中状态
        this.containerEl.querySelectorAll(".week-number-cell").forEach((cell: any) => {
            cell.removeClass('selected-week');
        });
        
        // 如果有选中的周数单元格，添加选中状态
        if (selectedWeekCell) {
            selectedWeekCell.addClass('selected-week');
        }
    }
}

// 添加任务的模态对话框
class TaskAddModal extends Modal {
    private taskText: string;
    private date: Date;
    private settings: MyPluginSettings;
    private onSubmit: (insertTarget: "daily" | "note" | "current", customNotePath?: string) => Promise<void>;
    
    constructor(app: App, taskText: string, date: Date, settings: MyPluginSettings, onSubmit: (insertTarget: "daily" | "note" | "current", customNotePath?: string) => Promise<void>) {
        super(app);
        this.taskText = taskText;
        this.date = date;
        this.settings = settings;
        this.onSubmit = onSubmit;
    }
    
    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl("h2", { text: "添加任务" });
        
        // 简单选项部分
        const simpleOptions = contentEl.createEl("div", { cls: "modal-simple-options" });
        simpleOptions.createEl("h3", { text: "快速添加" });
        
        // 选项1：日记
        const option1 = simpleOptions.createEl("button", { 
            text: "日记：插入到当天日记", 
            cls: "modal-option-btn"
        });
        option1.addEventListener("click", async () => {
            await this.onSubmit("daily");
            this.close();
        });
        
        // 选项2：默认笔记
        const option2 = simpleOptions.createEl("button", { 
            text: "笔记：插入到默认笔记", 
            cls: "modal-option-btn"
        });
        option2.addEventListener("click", async () => {
            await this.onSubmit("note");
            this.close();
        });
        
        // 选项3：当前笔记
        const option3 = simpleOptions.createEl("button", { 
            text: "当前：插入到已打开笔记", 
            cls: "modal-option-btn"
        });
        option3.addEventListener("click", async () => {
            await this.onSubmit("current");
            this.close();
        });
        
        // 详细设置部分
        const detailedOptions = contentEl.createEl("div", { cls: "modal-detailed-options" });
        detailedOptions.createEl("h3", { text: "详细设置" });
        
        // 详细设置按钮
        const detailedBtn = detailedOptions.createEl("button", { 
            text: "详细：自定义任务属性", 
            cls: "modal-option-btn modal-detailed-btn"
        });
        detailedBtn.addEventListener("click", () => {
            // 这里可以实现更复杂的详细设置对话框
            // 目前简化处理，直接使用默认设置
            new Notice("详细设置功能开发中");
            this.close();
        });
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}