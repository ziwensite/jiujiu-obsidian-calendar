import { MyPlugin } from '../../../main';
import { Task } from '../../../services/taskService';

export class TaskListRenderer {
    private plugin: MyPlugin;

    constructor(plugin: MyPlugin) {
        this.plugin = plugin;
    }

    /**
     * 渲染任务列表
     */
    renderTaskList(container: HTMLElement, tasks: Task[], taskStatusFilter: 'all' | 'todo' | 'done', onTaskToggle: (index: number, completed: boolean) => void, onTaskDoubleClick: (task: Task) => void) {
        // 清空现有任务列表
        const taskList = container.querySelector(".task-list") as HTMLElement;
        if (!taskList) return;
        
        taskList.empty();

        // 根据状态筛选任务
        let filteredTasks = tasks;
        if (taskStatusFilter === 'todo') {
            filteredTasks = tasks.filter(task => !task.completed);
        } else if (taskStatusFilter === 'done') {
            filteredTasks = tasks.filter(task => task.completed);
        }

        // 渲染任务列表
        filteredTasks.forEach((task, index) => {
            this.renderTaskItem(taskList, task, index, onTaskToggle, onTaskDoubleClick);
        });

        // 添加新建任务输入框
        this.renderAddTaskInput(taskList);
    }

    /**
     * 渲染单个任务项
     */
    private renderTaskItem(container: HTMLElement, task: Task, index: number, onTaskToggle: (index: number, completed: boolean) => void, onTaskDoubleClick: (task: Task) => void) {
        const taskItem = container.createEl("div", { cls: "task-item" });
        
        const checkbox = taskItem.createEl("input", { type: "checkbox" });
        checkbox.className = "task-checkbox";
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", () => {
            onTaskToggle(index, checkbox.checked);
        });
        
        const taskContent = taskItem.createEl("div", { cls: "task-content" });
        
        const taskText = taskContent.createEl("span", { text: task.text });
        taskText.className = "task-text";
        taskText.dataset.text = task.text;
        if (task.completed) {
            taskText.addClass("completed");
        }
        
        // 双击任务内容打开对应笔记并选中任务
        taskContent.addEventListener("dblclick", (e: Event) => {
            e.stopPropagation(); // 阻止事件冒泡
            onTaskDoubleClick(task);
        });
        
        // 点击任务文本展开/收缩
        taskContent.addEventListener("click", (e: Event) => {
            e.stopPropagation(); // 阻止事件冒泡
            taskText.classList.toggle("expanded");
        });
    }

    /**
     * 渲染添加任务输入框
     */
    private renderAddTaskInput(container: HTMLElement) {
        const addTaskContainer = container.createEl("div", { cls: "add-task-container" });
        const input = addTaskContainer.createEl("input", { type: "text", placeholder: "添加新任务" });
        input.className = "add-task-input";
        
        const addBtn = addTaskContainer.createEl("button", { text: "添加" });
        addBtn.className = "add-task-button";
    }

    /**
     * 渲染任务列表头部
     */
    renderTaskListHeader(container: HTMLElement, taskStatusFilter: 'all' | 'todo' | 'done', onFilterChange: (filter: 'all' | 'todo' | 'done') => void) {
        const taskListHeader = container.createEl("div", {cls: "task-list-header"});
        taskListHeader.createEl("h3", {text: "任务列表"});
        
        // 筛选按钮组
        const filterButtons = taskListHeader.createEl("div", {cls: "filter-buttons"});
        
        // 待办按钮
        const todoBtn = filterButtons.createEl("button", {text: "待办"});
        todoBtn.className = `filter-btn ${taskStatusFilter === 'todo' ? 'active' : ''}`;
        todoBtn.addEventListener("click", () => {
            onFilterChange('todo');
        });
        
        // 已办按钮
        const doneBtn = filterButtons.createEl("button", {text: "已办"});
        doneBtn.className = `filter-btn ${taskStatusFilter === 'done' ? 'active' : ''}`;
        doneBtn.addEventListener("click", () => {
            onFilterChange('done');
        });
        
        // 所有按钮
        const allBtn = filterButtons.createEl("button", {text: "所有"});
        allBtn.className = `filter-btn ${taskStatusFilter === 'all' ? 'active' : ''}`;
        allBtn.addEventListener("click", () => {
            onFilterChange('all');
        });
    }
}
