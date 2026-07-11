import {App, Plugin, WorkspaceLeaf, Notice, MarkdownView} from 'obsidian';
import {DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab} from "./settings";
import {CalendarView} from "./views/CalendarView";
import { CalendarViewController } from './core/CalendarViewController';
import { CalendarDataManager } from './core/CalendarDataManager';
import { TaskSuggester } from './suggest/TaskSuggester';
import { registerTaskCommands } from './commands/taskCommands';
import { TaskEditModal } from './modals/TaskEditModal';
import { parseTaskFromLine, updateTaskInNote } from './services/taskService';
import type { Task } from './services/taskService';
import { loadEn } from './i18n';
import { en } from './i18n/en';

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const targetVal = target[key];
        const sourceVal = source[key];
        if (
            sourceVal !== undefined &&
            targetVal !== null &&
            typeof targetVal === 'object' &&
            !Array.isArray(targetVal) &&
            typeof sourceVal === 'object' &&
            !Array.isArray(sourceVal)
        ) {
            result[key] = deepMerge(targetVal, sourceVal);
        } else if (sourceVal !== undefined) {
            result[key] = sourceVal;
        }
    }
    return result;
}

export class MyPlugin extends Plugin {
    settings: MyPluginSettings = DEFAULT_SETTINGS;
    calendarViewController: CalendarViewController;
    calendarDataManager: CalendarDataManager;

async onload() {
        try {
            await this.loadSettings();

            // 初始化 i18n
            loadEn(en);

            // 从磁盘覆盖 Obsidian 缓存的 manifest（重载插件时缓存不会自动刷新）
            try {
                const manifestPath = this.app.vault.configDir + '/plugins/' + this.manifest.id + '/manifest.json';
                const content = await this.app.vault.adapter.read(manifestPath);
                Object.assign(this.manifest, JSON.parse(content));
            } catch {
                // 读取失败则使用缓存值
            }

            // 初始化日历数据管理器
            this.calendarDataManager = new CalendarDataManager(this);
            
            // 初始化日历视图控制器
            this.calendarViewController = new CalendarViewController(this);

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
            
            // 注册编辑器自动补全
            this.registerEditorSuggest(new TaskSuggester(this.app, this));
            registerTaskCommands(this);

            this.registerDomEvent(document, 'click', async (evt: MouseEvent) => {
                const target = evt.target as HTMLElement;

                if (target.closest('.jiujiu-calendar-view')) return;

                const checkbox = target.closest('input[type="checkbox"]');
                if (!checkbox) return;

                const taskItem = target.closest('li[data-line], .cm-line');
                if (!taskItem) return;

                if (!(this.settings.taskSettings?.taskClickEdit ?? true)) return;

                evt.preventDefault();
                evt.stopPropagation();

                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!activeView || !activeView.file) return;
                const file = activeView.file;

                if (taskItem.matches('li[data-line]')) {
                    const domRaw = (taskItem.textContent || '').replace(/\s+/g, ' ').trim();

                    const allTasks = await this.calendarDataManager.getTasks(false);
                    const fileTasks = allTasks.filter(t => t.filePath === file.path);

                    let matchedTask = fileTasks.find(t =>
                        (t.rawText || '').replace(/\s+/g, ' ').trim() === domRaw
                    );

                    if (!matchedTask) {
                        const refreshedTasks = await this.calendarDataManager.getTasks(true);
                        const refreshedFileTasks = refreshedTasks.filter(t => t.filePath === file.path);
                        matchedTask = refreshedFileTasks.find(t =>
                            (t.rawText || '').replace(/\s+/g, ' ').trim() === domRaw
                        );
                    }

                    if (!matchedTask) {
                        const cleanForMatch = (text: string) =>
                            text
                                .replace(/[📅🛫➕⏳✅❌🔁⏰🔺⏫🔼🔽⏬️][^📅🛫➕⏳✅❌🔁⏰🔺⏫🔼🔽⏬️\s]*/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                        const domClean = cleanForMatch(domRaw);

                        const fallbackAllTasks = await this.calendarDataManager.getTasks(false);
                        const fallbackFileTasks = fallbackAllTasks.filter(t => t.filePath === file.path);
                        matchedTask = fallbackFileTasks.find(t =>
                            cleanForMatch(t.rawText || t.text || '') === domClean
                        );
                    }

                    if (!matchedTask) return;

                    const modal = new TaskEditModal({
                        app: this.app,
                        task: matchedTask,
                        onSubmit: async (updatedTask: Task) => {
                            await updateTaskInNote(this.app, updatedTask, updatedTask.completed, this.settings);
                            await this.calendarDataManager.refreshTasks();
                            this.updateAllViews('tasks');
                        }
                    });
                    modal.open();
                } else {
                    const editor = activeView.editor;
                    if (!editor) return;

                    const cmView = (editor as any).cm as any;
                    if (!cmView || typeof cmView.posAtDOM !== 'function') return;

                    const docOffset = cmView.posAtDOM(checkbox, 0, 1);
                    if (docOffset === undefined || docOffset === null) return;

                    const editorPos = (editor as any).offsetToPos(docOffset);
                    const lineNumber = editorPos.line;
                    const line = (editor as any).getLine(lineNumber);

                    const task = parseTaskFromLine(line, file.path, lineNumber);
                    if (!task) return;

                    const modal = new TaskEditModal({
                        app: this.app,
                        task,
                        onSubmit: async (updatedTask: Task) => {
                            await updateTaskInNote(this.app, updatedTask, updatedTask.completed, this.settings);
                            await this.calendarDataManager.refreshTasks();
                            this.updateAllViews('tasks');
                        }
                    });
                    modal.open();
                }
            }, true);

            // 一次性注册捕获插入快捷键命令
            this.registerCaptureToHotkeys();
            
            // 插件启用时自动打开默认视图
            if (this.settings.autoOpenSidebar) {
                if (this.app.workspace.layoutReady || this.app.workspace.containerEl.children.length > 1) {
                    this.activateView();
                } else {
                    const layoutHandler = () => {
                        this.app.workspace.off('layout-change', layoutHandler);
                        this.activateView();
                    };
                    this.registerEvent(this.app.workspace.on('layout-change', layoutHandler));
                }
            }
        } catch (error) {
            console.error("[JiuJiu Calendar] Plugin load error:", error);
            new Notice(`JiuJiu Calendar plugin failed to load: ${(error as Error).message}`);
        }
    }

    onunload() {
        this.app.workspace.detachLeavesOfType("jiujiu-calendar-view");
    }

    async activateView() {
        try {
            const { workspace } = this.app;
            if (!workspace) return;

            let leaf: WorkspaceLeaf | null = null;
            const leaves = workspace.getLeavesOfType("jiujiu-calendar-view");

            if (leaves.length > 0 && leaves[0]) {
                leaf = leaves[0];
            } else {
                try {
                    if (this.settings.sidebarPosition === 'left') {
                        leaf = workspace.getLeftLeaf(false);
                    } else {
                        leaf = workspace.getRightLeaf(false);
                    }
                } catch (e) {
                    leaf = null;
                }
                if (!leaf) {
                    try {
                        leaf = workspace.getLeaf('tab');
                    } catch (e) {
                        leaf = null;
                    }
                }
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
        } catch (error) {
            console.error("[JiuJiu Calendar] Failed to activate view:", error);
        }
    }

    async moveViewToSidebar() {
        const existingLeaves = this.app.workspace.getLeavesOfType("jiujiu-calendar-view");
        if (existingLeaves.length === 0) {
            await this.activateView();
            return;
        }
        const targetLeaf = this.settings.sidebarPosition === 'left'
            ? this.app.workspace.getLeftLeaf(false)
            : this.app.workspace.getRightLeaf(false);
        if (!targetLeaf) return;
        this.app.workspace.detachLeavesOfType("jiujiu-calendar-view");
        await targetLeaf.setViewState({
            type: "jiujiu-calendar-view",
            active: true,
        });
        this.app.workspace.revealLeaf(targetLeaf);
    }

    async loadSettings() {
        try {
            const savedSettings = await this.loadData() as Partial<MyPluginSettings>;

            const safeSavedSettings = savedSettings || {};

            this.settings = deepMerge(DEFAULT_SETTINGS as any, safeSavedSettings as any) as MyPluginSettings;

            if (!savedSettings) {
                await this.saveSettings();
            }
        } catch (error) {
            console.error("[JiuJiu Calendar] Error loading settings:", error);
            this.settings = DEFAULT_SETTINGS;
            await this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * 更新所有日历视图
     * @param refreshType 刷新类型：'full'表示完全刷新，'tasks'表示仅刷新任务列表，'calendar'表示仅刷新日历部分
     */
    updateAllViews(refreshType: 'full' | 'tasks' | 'calendar' = 'full') {
        // 使用中央控制器管理刷新请求
        if (refreshType === 'full') {
            // 完全刷新使用防抖机制
            this.calendarViewController.requestFlush();
        } else if (refreshType === 'tasks') {
            // 任务列表刷新单独处理
            this.calendarViewController.requestRefreshTaskList();
        } else if (refreshType === 'calendar') {
            // 日历部分刷新使用防抖机制
            this.calendarViewController.requestFlush();
        }
    }

    /**
     * 注册捕获插入配置的快捷键
     */
    private registerCaptureToHotkeys() {
        if (!this.settings.taskSettings.captureToSettings.configs) {
            return;
        }

        // 遍历所有捕获插入配置
        this.settings.taskSettings.captureToSettings.configs.forEach(config => {
            if (config.enabled) {
                // 为每个配置注册一个命令，即使没有设置快捷键
                // 这样命令会在系统设置中显示，用户可以在那里设置快捷键
                if (config.hotkey) {
                    // 有快捷键配置
                    this.addCommand({
                        id: `capture-to-${config.id}`,
                        name: `Capture to ${config.name}`,
                        hotkeys: [{
                            modifiers: config.hotkey.modifiers as any,
                            key: config.hotkey.key
                        }],
                        callback: () => this.executeCaptureToConfig(config)
                    });
                } else {
                    // 无快捷键配置，但仍注册命令
                    this.addCommand({
                        id: `capture-to-${config.id}`,
                        name: `Capture to ${config.name}`,
                        callback: () => this.executeCaptureToConfig(config)
                    });
                }
            }
        });
    }

    /**
     * 执行捕获插入配置
     * @param config 捕获插入配置
     */
    public async executeCaptureToConfig(config: any) {
        try {
            
            
            // 检查配置是否有效
            if (!config || !config.id) {
    
                new Notice('Error executing capture: Invalid config');
                return;
            }
            
            // 创建一个简单的 IChoiceExecutor 实例
            const choiceExecutor = {
                variables: new Map()
            };

            // 将 CaptureToConfig 转换为 ICaptureChoice
            const captureChoice = {
                id: config.id,
                name: config.name,
                type: "capture" as any,
                command: false,
                captureTo: config.defaultCapturePath,
                captureToActiveFile: config.captureToActiveFile,
                createFileIfItDoesntExist: config.createFileIfItDoesntExist,
                format: {
                    enabled: config.format.enabled,
                    format: config.format.format.includes("{{VALUE}}") 
                        ? config.format.format 
                        : config.format.format + " {{VALUE}}"
                },
                prepend: config.prepend,
                appendLink: config.appendLink,
                insertAfter: config.insertAfter,
                newLineCapture: config.newLineCapture,
                openFile: config.openFile,
                fileOpening: config.fileOpening,
                inputMethod: config.inputMethod,
                autoAddCreatedDate: config.autoAddCreatedDate,
                autoAddDueDate: config.autoAddDueDate,
                dueDateOption: config.dueDateOption,
                customDueDays: config.customDueDays,
                _targetDate: config._targetDate || new Date()
            };
            


            // 创建 CaptureChoiceEngine 实例并执行捕获操作
            let CaptureChoiceEngine;
            try {
                const module = await import('./engine/CaptureChoiceEngine');
                CaptureChoiceEngine = module.CaptureChoiceEngine;
            } catch (importError) {
                new Notice('Error executing capture: Failed to load CaptureChoiceEngine');
                return;
            }
            
            if (!CaptureChoiceEngine) {
                new Notice('Error executing capture: CaptureChoiceEngine not found');
                return;
            }
            
            const engine = new CaptureChoiceEngine(this.app, this, captureChoice, choiceExecutor);
            await engine.run();
        } catch (error) {
            new Notice(`Error executing capture: ${(error as Error).message}`);
        }
    }
}

export default MyPlugin;