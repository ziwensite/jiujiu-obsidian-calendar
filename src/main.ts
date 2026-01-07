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
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * 更新所有日历视图
     */
    updateAllViews() {
        // 获取所有日历视图
        const leaves = this.app.workspace.getLeavesOfType("jiujiu-calendar-view");
        
        // 遍历所有视图并调用renderCalendar方法更新
        leaves.forEach(leaf => {
            const view = leaf.view as any;
            if (view && typeof view.renderCalendar === 'function') {
                view.renderCalendar();
            }
        });
    }
}

export default MyPlugin;