import { MyPlugin } from '../../../main';
import { getLunarDate, getHolidayStatus, formatDate } from '../../../utils/dateUtils';
import { noteExists } from '../../../services/noteService';

export class CalendarRenderer {
    private plugin: MyPlugin;

    constructor(plugin: MyPlugin) {
        this.plugin = plugin;
    }

    /**
     * 构建日历结构
     */
    async buildCalendarStructure(container: HTMLElement, currentDate: Date, viewType: 'month' | 'year', navigationType: 'month' | 'year' = 'month') {
        if (viewType === 'month') {
            await this.buildMonthView(container, currentDate, navigationType);
        } else {
            this.buildYearView(container, currentDate, navigationType);
        }
    }

    /**
     * 构建月视图
     */
    private async buildMonthView(container: HTMLElement, currentDate: Date, navigationType: 'month' | 'year' = 'month') {
        // 日历头部
        this.buildCalendarHeader(container, currentDate, navigationType);

        // 日历表格
        const calendarTable = container.createEl("table", {cls: "calendar-table"});

        // 星期标题行
        this.buildWeekHeader(calendarTable);

        // 月份数据行
        await this.buildMonthDays(calendarTable, currentDate);
    }

    /**
     * 构建年视图
     */
    private buildYearView(container: HTMLElement, currentDate: Date, navigationType: 'month' | 'year' = 'year') {
        // 日历头部
        this.buildCalendarHeader(container, currentDate, navigationType);

        const yearViewContainer = container.createEl("div", {cls: "year-view-container"});

        // 季度循环（Q1到Q4）
        for (let quarter = 0; quarter < 4; quarter++) {
            // 创建季度和月份的行容器
            const quarterRow = yearViewContainer.createEl("div", {cls: "year-view-quarter-row"});
            
            // 季度容器（左边列）
            const quarterContainer = quarterRow.createEl("div", {cls: "month-container quarter-container"});
            
            // 季度标题
            quarterContainer.createEl("div", { 
                text: `${quarter + 1}季度`,
                cls: "month-header"
            });
            
            // 季度状态指示器
            quarterContainer.createEl("div", {cls: "month-indicators"});
            
            // 月份容器（右边行）
            const monthsContainer = quarterRow.createEl("div", {cls: "year-view-months-row"});
            
            // 每个季度包含3个月
            for (let monthInQuarter = 0; monthInQuarter < 3; monthInQuarter++) {
                // 计算当前月份索引
                const currentMonthIndex = quarter * 3 + monthInQuarter;
                
                // 月份容器
                const monthContainer = monthsContainer.createEl("div", {cls: "month-container"});
                
                // 月份标题
                monthContainer.createEl("div", { 
                    text: `${currentMonthIndex + 1}月`,
                    cls: "month-header"
                });
                
                // 月份状态指示器
                monthContainer.createEl("div", {cls: "month-indicators"});
            }
        }
    }

    /**
     * 构建日历头部
     */
    private buildCalendarHeader(container: HTMLElement, currentDate: Date, navigationType: 'month' | 'year' = 'month') {
        const header = container.createEl("div", {cls: "calendar-header"});
        
        // 单行：3等分布局，从左到右排列：今按钮、月份导航、年按钮
        const singleRow = header.createEl("div", {cls: "calendar-header-row"});
        
        // 左侧：今按钮
        singleRow.createEl("div", { 
            text: "今",
            cls: "today-label today-unselected"
        });
        
        // 中间：根据导航类型渲染不同的导航
        if (navigationType === 'month') {
            this.buildMonthNavigation(singleRow, currentDate);
        } else {
            this.buildYearNavigation(singleRow, currentDate);
        }
        
        // 右侧：年按钮
        singleRow.createEl("div", { 
            text: "年",
            cls: "today-label year-label today-unselected"
        });
    }

    /**
     * 构建年份导航
     */
    private buildYearNavigation(container: HTMLElement, currentDate: Date) {
        const yearNav = container.createEl("div", {cls: "calendar-header-block-year"});
        const yearNavBody = yearNav.createEl("div", {cls: "calendar-header-body"});

        yearNavBody.createEl("span", {text: "‹", cls: "nav-btn prev-btn"});
        
        const yearContent = yearNavBody.createEl("div", {cls: "calendar-header-content"});
        yearContent.createEl("span", { 
            text: `${currentDate.getFullYear()}年`,
        });
        
        yearNavBody.createEl("span", {text: "›", cls: "nav-btn next-btn"});
    }


    /**
     * 构建月份导航
     */
    private buildMonthNavigation(container: HTMLElement, currentDate: Date) {
        const monthNav = container.createEl("div", {cls: "calendar-header-block-month"});
        const monthNavBody = monthNav.createEl("div", {cls: "calendar-header-body"});

        monthNavBody.createEl("span", {text: "‹", cls: "nav-btn prev-btn"});
        
        const monthContent = monthNavBody.createEl("div", {cls: "calendar-header-content"});
        monthContent.createEl("span", { 
            text: `${currentDate.getMonth() + 1}月`,
        });
        
        monthNavBody.createEl("span", {text: "›", cls: "nav-btn next-btn"});
    }

    /**
     * 构建星期标题行
     */
    private buildWeekHeader(table: HTMLElement) {
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        // 周数标题
        headerRow.createEl("th", {text: "周", cls: "week-number-header"});
        
        // 星期标题，默认周一为第一天
        const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
        for (const day of weekdays) {
            headerRow.createEl("th", {text: day});
        }
    }

    /**
     * 构建月份数据行
     */
    private async buildMonthDays(table: HTMLElement, currentDate: Date) {
        const tbody = table.createEl("tbody");
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        // 计算月份第一天是星期几
        const firstDay = new Date(currentYear, currentMonth, 1);
        let startDay = firstDay.getDay();
        
        // 计算月份总天数
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // 周一为第一天：如果第一天是周日，需要显示6天上个月的日期，否则显示startDay-1天
        const prevMonthDaysToShow = startDay === 0 ? 6 : startDay - 1;
        
        // 计算需要的行数：(上个月需要显示的天数 + 本月天数 + 7 - 1) / 7 向上取整
        const rowsNeeded = Math.ceil((prevMonthDaysToShow + daysInMonth) / 7);

        // 生成所需的行数
        for (let row = 0; row < rowsNeeded; row++) {
            await this.buildWeekRow(tbody, row, currentYear, currentMonth, daysInMonth, prevMonthDaysToShow);
        }
    }

    /**
     * 构建周行
     */
    private async buildWeekRow(tbody: HTMLElement, rowIndex: number, currentYear: number, currentMonth: number, daysInMonth: number, prevMonthDaysToShow: number) {
        const weekRow = tbody.createEl("tr");

        // 周数单元格
        this.buildWeekNumberCell(weekRow, rowIndex, currentYear, currentMonth, prevMonthDaysToShow);

        // 日期单元格
        for (let i = 0; i < 7; i++) {
            await this.buildDayCell(weekRow, rowIndex, i, currentYear, currentMonth, daysInMonth, prevMonthDaysToShow);
        }
    }

    /**
     * 构建周数单元格
     */
    private buildWeekNumberCell(row: HTMLElement, rowIndex: number, currentYear: number, currentMonth: number, prevMonthDaysToShow: number) {
        const weekNumberCell = row.createEl("td", { cls: "week-number-cell" });
        
        // 周数文本
        const weekNumberText = weekNumberCell.createEl("div", { 
            text: `${rowIndex + 1}`,
            cls: "week-number-text"
        });
        
        // 周数状态指示器
        weekNumberCell.createEl("div", {cls: "week-indicators"});
    }

    /**
     * 构建日期单元格
     */
    private async buildDayCell(row: HTMLElement, rowIndex: number, dayIndex: number, currentYear: number, currentMonth: number, daysInMonth: number, prevMonthDaysToShow: number) {
        const dayCell = row.createEl("td", {cls: "day-cell"});

        // 计算当前日期
        const totalCells = rowIndex * 7 + dayIndex;
        let date: Date;
        let isOtherMonth = false;

        if (totalCells < prevMonthDaysToShow) {
            // 上个月的日期
            const prevMonth = currentMonth - 1;
            const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            const prevMonthDays = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
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

        if (isOtherMonth) {
            dayCell.addClass("other-month");
        }

        // 日期容器
        const dateContainer = dayCell.createEl("div", { cls: "date-container" });
        
        // 日期数字
        const dayNumber = dateContainer.createEl("span", { 
            text: `${date.getDate()}`,
            cls: "day-number"
        });

        // 添加法定节假日状态标记
        const status = getHolidayStatus(date);
        if (status) {
            dateContainer.createEl("span", { 
                text: status,
                cls: `holiday-status ${status === '休' ? 'holiday' : 'workday'}`
            });
            // 根据状态设置不同的颜色
            if (status === '休') {
                // 法定节假日的阳历数字颜色改为深红
                dayNumber.addClass("holiday-date");
            } else if (status === '班') {
                // 调休的阳历数字颜色与班背景色一致
                dayNumber.addClass("workday-date");
            }
        }

        // 农历日期
        const lunarDateResult = getLunarDate(date);
        dayCell.createEl("div", { 
            text: lunarDateResult.text,
            cls: `lunar-date lunar-${lunarDateResult.type}`
        });

        // 日期状态指示器容器
        dayCell.createEl("div", {cls: "day-indicators"});

        // 只处理当前月份的日期，添加任务指示器
        if (!isOtherMonth) {
            // 检查是否有日记
            const dailySettings = this.plugin.settings.dailyNote;
            const dailyFileName = formatDate(date, dailySettings.fileNameFormat);
            const dailyNotePath = `${dailySettings.savePath}/${dailyFileName}.md`;

            if (await noteExists(this.plugin.app, dailyNotePath)) {
                // 有日记，后续会通过updateIndicators更新指示器
            }
        }
    }

    /**
     * 更新月视图的完整内容
     */
    async updateMonthCalendarContent(container: HTMLElement, currentDate: Date) {
        // 更新日历头部显示
        this.updateCalendarHeader(container, currentDate);
        
        // 更新日历表格内容
        const tbody = container.querySelector('.calendar-table tbody');
        if (!tbody) return;
        
        // 获取所有日期行
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        // 计算当前月份的日历数据
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        
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
                            // 根据状态设置不同的颜色
                            if (status === '休') {
                                // 法定节假日的阳历数字颜色改为深红
                                dayNumber.addClass("holiday-date");
                            } else if (status === '班') {
                                // 调休的阳历数字颜色与班背景色一致
                                dayNumber.addClass("workday-date");
                            }
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
    }

    /**
     * 更新日历头部显示
     */
    private updateCalendarHeader(container: HTMLElement, currentDate: Date) {
        // 更新年份显示
        const yearContent = container.querySelector('.calendar-header-block-year .calendar-header-content');
        if (yearContent) {
            const yearSpan = yearContent.querySelector('span');
            if (yearSpan) {
                yearSpan.textContent = `${currentDate.getFullYear()}年`;
            }
        }
        
        
        // 更新月份显示
        const monthContent = container.querySelector('.calendar-header-block-month .calendar-header-content');
        if (monthContent) {
            const monthSpan = monthContent.querySelector('span');
            if (monthSpan) {
                monthSpan.textContent = `${currentDate.getMonth() + 1}月`;
            }
        }
    }
}
