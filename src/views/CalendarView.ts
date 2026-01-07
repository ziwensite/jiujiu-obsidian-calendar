import { ItemView, WorkspaceLeaf, Notice, MarkdownView } from 'obsidian';
import { MyPlugin } from '../main';
import { getLunarDate, getHolidayInfo, getHolidayStatus, getWeekNumber, getWeekInfo, getQuarter, formatDate } from '../utils/dateUtils';
import { noteExists, createOrOpenNote } from '../services/noteService';
import { extractTasks, filterTasks, updateTaskInNote, Task } from '../services/taskService';

const VIEW_TYPE_CALENDAR = "jiujiu-calendar-view";

export class CalendarView extends ItemView {
    private currentDate: Date;
    private plugin: MyPlugin;
    private taskStatusFilter: 'all' | 'todo' | 'done' = 'all';
    private selectedDate: Date | null = null;
    private viewType: 'month' | 'year' = 'month'; // 添加视图类型，默认为月视图

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentDate = new Date();
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
        
        // 添加文件系统事件监听，实现实时更新
        this.registerEvent(this.app.vault.on('create', async () => {
            await this.renderCalendar();
        }));
        
        this.registerEvent(this.app.vault.on('modify', async () => {
            await this.renderCalendar();
        }));
        
        this.registerEvent(this.app.vault.on('delete', async () => {
            await this.renderCalendar();
        }));
    }

    async onClose() {
        // 清理资源
    }

    private async renderCalendar() {
        const container = this.containerEl.children[1];
        if (!container) return;

        container.empty();

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
        
        // 今日按钮：根据日视图是否选中今天日期来决定样式
        const currentToday = new Date();
        const isTodaySelected = this.selectedDate && 
            this.selectedDate.toDateString() === currentToday.toDateString() &&
            this.currentDate.toDateString() === currentToday.toDateString();
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
                if (i === 5 || i === 6) {
                    dayNumber.style.color = "var(--interactive-accent)";
                }
                
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
        // 清空现有任务列表
        const taskList = container.querySelector(".task-list") as HTMLElement;
        if (taskList) {
            taskList.empty();
        }

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

        // 渲染任务列表
        filteredTasks.forEach((task, index) => {
            const taskItem = taskList.createEl("div", { cls: "task-item" });
            
            const checkbox = taskItem.createEl("input", { type: "checkbox" });
            checkbox.className = "task-checkbox";
            checkbox.checked = task.completed;
            checkbox.addEventListener("change", () => {
                this.handleTaskToggle(index, checkbox.checked);
            });
            
            const taskContent = taskItem.createEl("div", { cls: "task-content" });
            
            const taskText = taskContent.createEl("span", { text: task.text });
            taskText.className = "task-text";
            taskText.dataset.text = task.text;
            if (task.completed) {
                taskText.addClass("completed");
            }
            
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
                                    // 滚动到任务位置，使用默认参数
                                    editor.scrollIntoView({ from: startPos, to: endPos });
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
        });

        // 添加新建任务输入框
        const addTaskContainer = taskList.createEl("div", { cls: "add-task-container" });
        const input = addTaskContainer.createEl("input", { type: "text", placeholder: "添加新任务" });
        input.className = "add-task-input";
        
        const addBtn = addTaskContainer.createEl("button", { text: "添加" });
        addBtn.className = "add-task-button";
        addBtn.addEventListener("click", () => {
            this.handleAddTask(input.value, date);
            input.value = "";
        });
        
        // 回车添加任务
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                this.handleAddTask(input.value, date);
                input.value = "";
            }
        });
    }

    private async renderTaskListByDateRange(startDate: Date, endDate: Date) {
        // 清空现有任务列表
        const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
        if (!taskListContainer) return;
        const taskList = taskListContainer.querySelector(".task-list") as HTMLElement;
        if (!taskList) return;
        taskList.empty();

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

        // 渲染任务列表
        filteredTasks.forEach((task, index) => {
            const taskItem = taskList.createEl("div", { cls: "task-item" });
            
            const checkbox = taskItem.createEl("input", { type: "checkbox" });
            checkbox.className = "task-checkbox";
            checkbox.checked = task.completed;
            checkbox.addEventListener("change", () => {
                this.handleTaskToggle(index, checkbox.checked);
            });
            
            const taskContent = taskItem.createEl("div", { cls: "task-content" });
            
            const taskText = taskContent.createEl("span", { text: task.text });
            taskText.className = "task-text";
            taskText.dataset.text = task.text;
            if (task.completed) {
                taskText.addClass("completed");
            }
            
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
                                    // 滚动到任务位置，使用默认参数
                                    editor.scrollIntoView({ from: startPos, to: endPos });
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
        });

        // 添加新建任务输入框
        const addTaskContainer = taskList.createEl("div", { cls: "add-task-container" });
        const input = addTaskContainer.createEl("input", { type: "text", placeholder: "添加新任务" });
        input.className = "add-task-input";
        
        const addBtn = addTaskContainer.createEl("button", { text: "添加" });
        addBtn.className = "add-task-button";
        addBtn.addEventListener("click", () => {
            // 添加任务到默认日期（日期范围的开始）
            this.handleAddTask(input.value, startDate);
            input.value = "";
        });
        
        // 回车添加任务
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                this.handleAddTask(input.value, startDate);
                input.value = "";
            }
        });
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
                
                // 重新渲染任务列表，显示最新状态
                const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
                if (taskListContainer) {
                    await this.renderTaskList(this.selectedDate, taskListContainer);
                }
                
                // 重新渲染日历，更新小圆点
                await this.renderCalendar();
            }
        }
    }

    private handleTaskDelete(taskId: number) {
        // 处理任务删除
        new Notice(`任务 ${taskId} 已删除`);
        // 后续需要从笔记中删除
    }

    private handleAddTask(taskText: string, date: Date) {
        // 处理添加新任务
        if (taskText.trim()) {
            new Notice(`添加任务: ${taskText}`);
            // 后续需要添加到笔记中
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
    
    private async onDayClick(date: Date) {
        // 更新选中日期
        this.selectedDate = date;
        
        // 更新当前日期
        this.currentDate = date;
        
        // 重新渲染日历，以更新选中状态
        await this.renderCalendar();
        
        // 更新任务列表
        const taskListContainer = this.containerEl.querySelector(".task-list-container") as HTMLElement;
        if (taskListContainer) {
            await this.renderTaskList(date, taskListContainer);
        }
    }
}