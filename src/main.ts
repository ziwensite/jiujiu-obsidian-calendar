import {App, Plugin, WorkspaceLeaf} from 'obsidian';
import {DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab} from "./settings";
import {CalendarView} from "./views/CalendarView";

export class MyPlugin extends Plugin {
    settings: MyPluginSettings;

    async onload() {
        await this.loadSettings();

        // 注册视图
        this.registerView(
            "jiujiu-calendar-view",
            (leaf) => new CalendarView(leaf, this)
        );

        // 添加侧边栏按钮
        this.addRibbonIcon('calendar', 'JiuJiu Calendar', (evt: MouseEvent) => {
            this.activateView();
        });

        // 添加命令来切换视图
        this.addCommand({
            id: "open-calendar-view",
            name: "Open Calendar View",
            callback: () => this.activateView(),
        });

        // 加载设置页
        this.addSettingTab(new SampleSettingTab(this.app, this));
        
        // 插件启用时自动打开默认视图
        this.activateView();
    }

    onunload() {
        this.app.workspace.detachLeavesOfType("jiujiu-calendar-view");
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType("jiujiu-calendar-view");

        if (leaves.length > 0 && leaves[0]) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: "jiujiu-calendar-view",
                    active: true,
                });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async loadSettings() {
        const savedSettings = await this.loadData() as Partial<MyPluginSettings>;
        
        // 深度合并设置，确保嵌套对象也能正确合并
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...savedSettings,
            // 确保taskSettings包含所有必需的嵌套属性
            taskSettings: {
                ...DEFAULT_SETTINGS.taskSettings,
                ...savedSettings.taskSettings,
                // 确保dailyInsertSettings存在
                dailyInsertSettings: {
                    ...DEFAULT_SETTINGS.taskSettings.dailyInsertSettings,
                    ...savedSettings.taskSettings?.dailyInsertSettings
                },
                // 确保noteInsertSettings存在
                noteInsertSettings: {
                    ...DEFAULT_SETTINGS.taskSettings.noteInsertSettings,
                    ...savedSettings.taskSettings?.noteInsertSettings
                }
            }
        };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * 更新所有日历视图
     * @param refreshType 刷新类型：'full'表示完全刷新，'tasks'表示仅刷新任务列表，'calendar'表示仅刷新日历部分
     */
    updateAllViews(refreshType: 'full' | 'tasks' | 'calendar' = 'full') {
        // 获取所有日历视图
        const leaves = this.app.workspace.getLeavesOfType("jiujiu-calendar-view");
        
        // 遍历所有视图并根据刷新类型调用相应方法
        leaves.forEach(leaf => {
            const view = leaf.view as any;
            if (view) {
                if (refreshType === 'full' && typeof view.renderCalendar === 'function') {
                    view.renderCalendar();
                } else if (refreshType === 'tasks' && typeof view.refreshTaskList === 'function') {
                    view.refreshTaskList();
                } else if (refreshType === 'calendar' && typeof view.refreshCalendar === 'function') {
                    view.refreshCalendar();
                }
            }
        });
    }
}

export default MyPlugin;