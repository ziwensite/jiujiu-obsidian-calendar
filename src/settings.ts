import {App, Modal, PluginSettingTab, Setting, Notice, TextComponent} from "obsidian";
import { t } from './i18n';
import MyPlugin from "./main";
import { formatDate } from "./utils/dateUtils";
import { AddCaptureToConfigBox } from "./components";
import { FileSelectModal } from "./modals/FileSelectModal";
import { FolderSelectModal } from "./modals/FolderSelectModal";
import { CaptureToConfigModal } from "./views/calendar/modals/CaptureToConfigModal";
import { CommandSelectModal } from "./modals/CommandSelectModal";
import { MyPluginSettings, NoteTemplateSettings, CaptureToConfig, CustomLabel } from "./settings/types";
import { DEFAULT_SETTINGS } from "./settings/defaults";
export type { MyPluginSettings, NoteTemplateSettings, CaptureToConfig, CaptureToSettings, CustomLabel, TaskFilterSettings, TaskSettings, MoreLabelSettings, CreateFileIfItDoesntExist, FormatSettings, InsertAfterSettings, NewLineCaptureSettings, FileOpeningSettings, TaskInsertSettings } from "./settings/types";
export { DEFAULT_SETTINGS } from "./settings/defaults";

export class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    private settingsChanged: boolean = false;
    private activeTab: string = "basic";
    private saveTimeout: number | null = null;
    private contentEl: HTMLElement | null = null;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        if (!this.contentEl) {
            containerEl.empty();
            this.createTabs(containerEl);
            this.contentEl = containerEl.createEl("div", { cls: "tab-content" });
        } else {
            // 锁定当前高度防止清空时内容区坍缩闪烁
            this.contentEl.style.minHeight = this.contentEl.offsetHeight + 'px';
            this.contentEl.empty();
        }

        this.renderTabContent(this.contentEl);
        this.updateActiveTabStyles();
        
        // 渲染完成后解除高度锁定
        if (this.contentEl) {
            this.contentEl.style.minHeight = '';
        }
    }

    private scheduleSave() {
        this.settingsChanged = true;
        if (this.saveTimeout !== null) {
            window.clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = window.setTimeout(async () => {
            this.saveTimeout = null;
            if (this.settingsChanged) {
                this.settingsChanged = false;
                await this.plugin.saveSettings();
                this.plugin.updateAllViews();
            }
        }, 1000);
    }

    private createTabs(containerEl: HTMLElement): void {
        const tabsContainer = containerEl.createEl("div", { cls: "setting-tabs" });
        
        const tabs = [
            { id: "basic", name: t("基本设置") },
            { id: "capture", name: t("捕获设置") },
            { id: "notes", name: t("笔记设置") },
            { id: "custom", name: t("自定义标签") },
            { id: "about", name: t("关于插件") }
        ];

        tabs.forEach(tab => {
            const tabEl = tabsContainer.createEl("div", { 
                cls: `setting-tab ${this.activeTab === tab.id ? "active" : ""}`,
                text: tab.name
            });
            tabEl.dataset.tab = tab.id;
            
            tabEl.style.borderBottom = this.activeTab === tab.id ? "2px solid var(--interactive-accent)" : "";
            tabEl.style.color = this.activeTab === tab.id ? "var(--interactive-accent)" : "var(--text-muted)";
            tabEl.style.fontWeight = this.activeTab === tab.id ? "bold" : "normal";
            
            tabEl.addEventListener("click", () => {
                this.activeTab = tab.id;
                this.display();
            });

            // 悬停效果
            tabEl.addEventListener("mouseenter", () => {
                if (this.activeTab !== tab.id) {
                    tabEl.style.color = "var(--text-normal)";
                }
            });

            tabEl.addEventListener("mouseleave", () => {
                if (this.activeTab !== tab.id) {
                    tabEl.style.color = "var(--text-muted)";
                }
            });
        });
    }

    private updateActiveTabStyles(): void {
        const tabs = this.containerEl.querySelectorAll('.setting-tab');
        tabs.forEach(tab => {
            const el = tab as HTMLElement;
            const isActive = el.dataset.tab === this.activeTab;
            el.style.borderBottom = isActive ? "2px solid var(--interactive-accent)" : "";
            el.style.color = isActive ? "var(--interactive-accent)" : "var(--text-muted)";
            el.style.fontWeight = isActive ? "bold" : "normal";
        });
    }

    private renderTabContent(contentEl: HTMLElement): void {
        contentEl.empty();

        switch (this.activeTab) {
            case "basic":
                this.renderTaskFilterSettings(contentEl);
                break;
            case "capture":
                this.renderCaptureToSettings(contentEl);
                break;
            case "notes":
                this.renderNoteSettings(t("闪念设置"), this.plugin.settings.fleetingNote, (newSettings) => {
                    this.plugin.settings.fleetingNote = newSettings;
                    this.scheduleSave();
                }, contentEl);
                
                this.renderNoteSettings(t("日记设置"), this.plugin.settings.dailyNote, (newSettings) => {
                    this.plugin.settings.dailyNote = newSettings;
                    this.scheduleSave();
                }, contentEl);
                
                this.renderNoteSettings(t("周报设置"), this.plugin.settings.weeklyNote, (newSettings) => {
                    this.plugin.settings.weeklyNote = newSettings;
                    this.scheduleSave();
                }, contentEl);
                
                this.renderNoteSettings(t("月报设置"), this.plugin.settings.monthlyNote, (newSettings) => {
                    this.plugin.settings.monthlyNote = newSettings;
                    this.scheduleSave();
                }, contentEl);
                
                this.renderNoteSettings(t("季报设置"), this.plugin.settings.quarterlyNote, (newSettings) => {
                    this.plugin.settings.quarterlyNote = newSettings;
                    this.scheduleSave();
                }, contentEl);
                
                this.renderNoteSettings(t("年报设置"), this.plugin.settings.yearlyNote, (newSettings) => {
                    this.plugin.settings.yearlyNote = newSettings;
                    this.scheduleSave();
                }, contentEl);
                break;
            case "custom":
                this.renderMoreLabelSettings(contentEl);
                break;
            case "about":
                this.renderPluginInfo(contentEl);
                break;
        }
    }

    private renderPluginInfo(contentEl: HTMLElement): void {
        const pluginInfoSection = contentEl.createEl("div", { cls: "setting-section" });
        pluginInfoSection.createEl("h4", { text: t("插件信息") });

        new Setting(pluginInfoSection)
            .setName(t("插件名称"))
            .setDesc(this.plugin.manifest.name);

        const versionSetting = new Setting(pluginInfoSection)
            .setName(t("版本号"))
            .setDesc(this.plugin.manifest.version);

        new Setting(pluginInfoSection)
            .setName(t("描述"))
            .setDesc(t("综合性日历插件，支持农历、节假日、任务管理、笔记管理等功能"));
    }

    private renderMoreLabelSettings(contentEl: HTMLElement): void {
        const section = contentEl.createEl("div", {cls: "setting-section"});
        section.createEl("h4", {text: t("自定义标签设置")});

        const moreSettings = this.plugin.settings.moreLabelSettings;

        this.renderCustomLabelSettings(section, "LB1", moreSettings.lb1);
        this.renderCustomLabelSettings(section, "LB2", moreSettings.lb2);
    }

    private renderCustomLabelSettings(section: HTMLElement, labelName: string, labelSettings: CustomLabel): void {
        const labelSection = section.createEl("div", {cls: "setting-section"});
        labelSection.createEl("h5", {text: `${labelName}设置`});

        new Setting(labelSection)
            .setName(`启用${labelName}`)
            .setDesc(`启用或禁用日历右上角的${labelName}标签`)
            .addToggle(toggle => toggle
                .setValue(labelSettings.enabled)
                .onChange(value => {
                    labelSettings.enabled = value;
                    this.scheduleSave();
                }));

        new Setting(labelSection)
            .setName(`${labelName}名称`)
            .setDesc(`自定义${labelName}显示的文本`)
            .addText(text => text
                .setPlaceholder(`例如：${labelName}`)
                .setValue(labelSettings.labelText)
                .onChange(value => {
                    labelSettings.labelText = value;
                    this.scheduleSave();
                }));

        new Setting(labelSection)
            .setName(t("操作类型"))
            .setDesc(`选择点击${labelName}后执行的操作类型`)
            .addDropdown(dropdown => dropdown
                .addOption("systemCommand", t("系统命令"))
                .addOption("openFile", t("打开文件"))
                .setValue(labelSettings.actionType)
                .onChange(value => {
                    labelSettings.actionType = value as "systemCommand" | "openFile";
                    this.scheduleSave();
                    this.display();
                }));

        if (labelSettings.actionType === "systemCommand") {
            let commandInputTextComponent: TextComponent | null = null;
            const commandInput = new Setting(labelSection)
                .setName(t("系统命令"))
                .setDesc(t("输入要执行的Obsidian系统命令ID"))
                .addText(text => {
                    commandInputTextComponent = text;
                    text.setPlaceholder(t("例如：app:open-vault"))
                    text.setValue(labelSettings.systemCommand)
                    .onChange(value => {
                        labelSettings.systemCommand = value;
                        this.scheduleSave();
                    });
                });
            
            const selectButton = commandInput.controlEl.createEl('button', {
                cls: 'command-select-button',
                text: t('选择命令')
            });
            selectButton.addEventListener('click', () => {
                new CommandSelectModal({
                    app: this.app,
                    onCommandSelected: (commandId: string) => {
                        if (commandInputTextComponent) {
                            commandInputTextComponent.setValue(commandId);
                        }
                        labelSettings.systemCommand = commandId;
                        this.scheduleSave();
                    }
                }).open();
            });
        } else if (labelSettings.actionType === "openFile") {
            let filePathTextComponent: TextComponent | null = null;
            const filePathInput = new Setting(labelSection)
                .setName(t("文件路径"))
                .setDesc(t("输入要打开的文件路径"))
                .addText(text => {
                    filePathTextComponent = text;
                    text.setPlaceholder(t("例如：日记/2024-01-01.md"))
                    text.setValue(labelSettings.filePath)
                    .onChange(value => {
                        labelSettings.filePath = value;
                        this.scheduleSave();
                    });
                });
            
            const selectFileButton = filePathInput.controlEl.createEl('button', {
                cls: 'command-select-button',
                text: t('选择文件')
            });
            selectFileButton.addEventListener('click', () => {
                new FileSelectModal(this.app, (file) => {
                    const filePath = file.path;
                    if (filePathTextComponent) {
                        filePathTextComponent.setValue(filePath);
                    }
                    labelSettings.filePath = filePath;
                    this.scheduleSave();
                }).open();
            });
        }
    }

    private renderTaskFilterSettings(contentEl: HTMLElement): void {
        const section = contentEl.createEl("div", {cls: "setting-section"});
        section.createEl("h4", {text: t("侧边栏设置")});

        new Setting(section)
            .setName(t("自动打开侧栏"))
            .setDesc(t("插件启动时自动打开日历侧栏视图"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoOpenSidebar)
                .onChange((value) => {
                    this.plugin.settings.autoOpenSidebar = value;
                    this.scheduleSave();
                }));

        new Setting(section)
            .setName(t("侧栏位置"))
            .setDesc(t("选择日历视图显示在左侧还是右侧边栏"))
            .addDropdown(dropdown => dropdown
                .addOption("left", t("左侧边栏"))
                .addOption("right", t("右侧边栏"))
                .setValue(this.plugin.settings.sidebarPosition)
                .onChange((value) => {
                    this.plugin.settings.sidebarPosition = value as 'left' | 'right';
                    this.scheduleSave();
                    this.plugin.moveViewToSidebar();
                }));

        new Setting(section)
            .setName(t("显示农历"))
            .setDesc(t("日历视图中显示农历日期、节气、节日"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showLunarCalendar ?? true)
                .onChange((value) => {
                    this.plugin.settings.showLunarCalendar = value;
                    this.scheduleSave();
                    this.plugin.updateAllViews('full');
                }));

        const taskSection = contentEl.createEl("div", {cls: "setting-section"});
        taskSection.createEl("h4", {text: t("任务设置")});

        // 自定义筛选设置
        new Setting(taskSection)
            .setName(t("自定义筛选"))
            .setDesc(t("规则：使用路径或标签，!表示排除，and、or、()逻辑组合。例如：(A or B) and #C - 路径A或B中包含标签#C的任务"))
            .addTextArea(textArea => {
                textArea
                    .setPlaceholder(t("输入筛选规则"))
                    .setValue(this.plugin.settings.taskFilter.customFilter)
                    .onChange((value: string) => {
                        this.plugin.settings.taskFilter.customFilter = value;
                    });
                // 设置文本域属性
                textArea.inputEl.rows = 4;
                textArea.inputEl.wrap = "soft";
                textArea.inputEl.style.resize = "vertical";
                textArea.inputEl.style.maxHeight = "100px";
                textArea.inputEl.addEventListener('blur', () => {
                    this.scheduleSave();
                });
            });
        
        // 重复任务设置
        new Setting(taskSection)
            .setName(t("重复任务新任务位置"))
            .setDesc(t("设置重复任务完成后，新任务的添加位置"))
            .addDropdown(dropdown => {
                dropdown
                    .addOption("below", t("当前任务下方"))
                    .addOption("above", t("当前任务上方"))
                    .setValue(this.plugin.settings.taskSettings?.recurrenceSettings?.newTaskPosition || "below")
                    .onChange((value) => {
                        // 确保 recurrenceSettings 对象存在
                        if (!this.plugin.settings.taskSettings) {
                                this.plugin.settings.taskSettings = { enableTaskPropertyHints: false, taskClickEdit: true, captureToSettings: { enabled: false, fleetingNoteConfigId: "", recordConfigId: "", taskConfigId: "", configs: [] }, recurrenceSettings: { newTaskPosition: "below" } };
                        }
                        if (!this.plugin.settings.taskSettings.recurrenceSettings) {
                            this.plugin.settings.taskSettings.recurrenceSettings = { newTaskPosition: "below" };
                        }
                        this.plugin.settings.taskSettings.recurrenceSettings.newTaskPosition = value as "above" | "below";
                        this.scheduleSave();
                    });
            });

        // 任务属性提示
        new Setting(taskSection)
            .setName(t("任务属性提示"))
            .setDesc(t("编辑器中 emoji/日期/重复/标签 自动补全。使用 Tasks 插件时建议关闭以避免冲突"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.taskSettings?.enableTaskPropertyHints ?? false)
                .onChange((value) => {
                    if (!this.plugin.settings.taskSettings) {
                        this.plugin.settings.taskSettings = { enableTaskPropertyHints: false, taskClickEdit: true, captureToSettings: { enabled: false, fleetingNoteConfigId: "", recordConfigId: "", taskConfigId: "", configs: [] }, recurrenceSettings: { newTaskPosition: "below" } };
                    }
                    this.plugin.settings.taskSettings.enableTaskPropertyHints = value;
                    this.scheduleSave();
                }));

        // 点击任务复选框编辑
        new Setting(taskSection)
            .setName(t("点击编辑任务"))
            .setDesc(t("点击笔记中的任务复选框时，打开编辑窗口修改任务属性"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.taskSettings?.taskClickEdit ?? true)
                .onChange((value) => {
                    if (!this.plugin.settings.taskSettings) {
                        this.plugin.settings.taskSettings = { enableTaskPropertyHints: false, taskClickEdit: true, captureToSettings: { enabled: false, fleetingNoteConfigId: "", recordConfigId: "", taskConfigId: "", configs: [] }, recurrenceSettings: { newTaskPosition: "below" } };
                    }
                    this.plugin.settings.taskSettings.taskClickEdit = value;
                    this.scheduleSave();
                }));
    }

    private renderCaptureToSettings(contentEl: HTMLElement): void {
        const section = contentEl.createEl("div", {cls: "setting-section"});
        section.createEl("h4", {text: t("捕获插入设置")});

        const captureSettings = this.plugin.settings.taskSettings.captureToSettings;

        // 启用/禁用设置
        new Setting(section)
            .setName(t("启用捕获插入功能"))
            .setDesc(t("使用捕获插入功能进行任务和笔记的创建与插入"))
            .addToggle(toggle => toggle
                .setValue(captureSettings.enabled)
                .onChange((value) => {
                    this.plugin.settings.taskSettings.captureToSettings.enabled = value;
                    this.scheduleSave();
                }));

        // 闪念标签配置
        new Setting(section)
            .setName(t("闪念标签配置"))
            .setDesc(t("选择任务显示区域头部闪念标签对应的配置"))
            .addDropdown(dropdown => {
                captureSettings.configs.forEach(config => {
                    dropdown.addOption(config.id, config.name);
                });
                dropdown.setValue(captureSettings.fleetingNoteConfigId)
                    .onChange((value) => {
                        this.plugin.settings.taskSettings.captureToSettings.fleetingNoteConfigId = value;
                        this.scheduleSave();
                    });
            });

        // 记录标签配置
        new Setting(section)
            .setName(t("记录标签配置"))
            .setDesc(t("选择任务显示区域头部记录标签对应的配置"))
            .addDropdown(dropdown => {
                captureSettings.configs.forEach(config => {
                    dropdown.addOption(config.id, config.name);
                });
                dropdown.setValue(captureSettings.recordConfigId)
                    .onChange((value) => {
                        this.plugin.settings.taskSettings.captureToSettings.recordConfigId = value;
                        this.scheduleSave();
                    });
            });

        // 任务标签配置
        new Setting(section)
            .setName(t("任务标签配置"))
            .setDesc(t("选择任务显示区域头部任务标签对应的配置"))
            .addDropdown(dropdown => {
                captureSettings.configs.forEach(config => {
                    dropdown.addOption(config.id, config.name);
                });
                dropdown.setValue(captureSettings.taskConfigId)
                    .onChange((value) => {
                        this.plugin.settings.taskSettings.captureToSettings.taskConfigId = value;
                        this.scheduleSave();
                    });
            });

        // 配置列表
        const configsHeader = section.createEl("div", {cls: "setting-header"});
        configsHeader.createEl("h4", {text: t("配置列表")});

        // 拖拽排序相关变量
        let draggedElement: HTMLElement | null = null;
        let dragStartIndex: number = -1;

        // 显示现有配置
        captureSettings.configs.forEach((config, index) => {
            const configRow = section.createEl("div", {
                cls: "capture-config-row"
            });
            configRow.setAttribute("draggable", "true");
            
            // 存储配置索引
            configRow.dataset.index = index.toString();

            // 拖拽开始事件
            configRow.addEventListener("dragstart", (e) => {
                draggedElement = configRow;
                dragStartIndex = parseInt(configRow.dataset.index || "-1");
                configRow.addClass("dragging");
            });

            // 拖拽结束事件
            configRow.addEventListener("dragend", (e) => {
                draggedElement = null;
                configRow.removeClass("dragging");
                // 移除所有拖拽提示样式
                document.querySelectorAll(".capture-config-row.drag-over-top, .capture-config-row.drag-over-bottom").forEach(el => {
                    el.removeClass("drag-over-top");
                    el.removeClass("drag-over-bottom");
                });
            });

            // 拖拽经过事件
            configRow.addEventListener("dragover", (e) => {
                e.preventDefault();
                if (draggedElement === configRow) return;
                
                configRow.removeClass("drag-over-top drag-over-bottom");
                const rect = configRow.getBoundingClientRect();
                const y = e.clientY - rect.top;
                
                if (y < rect.height / 2) {
                    configRow.addClass("drag-over-top");
                } else {
                    configRow.addClass("drag-over-bottom");
                }
            });

            // 拖拽离开事件
            configRow.addEventListener("dragleave", (e) => {
                configRow.removeClass("drag-over-top drag-over-bottom");
            });

            // 拖拽放置事件
            configRow.addEventListener("drop", (e) => {
                e.preventDefault();
                configRow.removeClass("drag-over-top drag-over-bottom");
                if (draggedElement && dragStartIndex !== -1) {
                    const dragEndIndex = parseInt(configRow.dataset.index || "-1");
                    if (dragStartIndex !== dragEndIndex) {
                        // 重新排序配置
                        if (this.plugin.settings.taskSettings.captureToSettings.configs) {
                            const configs = this.plugin.settings.taskSettings.captureToSettings.configs;
                            const [draggedConfig] = configs.splice(dragStartIndex, 1);
                            if (draggedConfig) {
                                configs.splice(dragEndIndex, 0, draggedConfig);
                                this.scheduleSave();
                                // 重新渲染设置页面
                                this.display();
                            }
                        }
                    }
                }
                configRow.removeClass("drag-over-top drag-over-bottom");
            });

            // 配置名称
            const configName = configRow.createEl("div", {
                cls: "config-name"
            });
            configName.style.color = config.enabled ? "var(--text-normal)" : "var(--text-muted)";
            configName.textContent = config.name;

            // 操作按钮容器
            const buttonContainer = configRow.createEl("div", {
                cls: "config-buttons"
            });
            buttonContainer.style.display = "flex";
            buttonContainer.style.alignItems = "center";
            buttonContainer.style.gap = "8px";

            // 启用/禁用按钮（emoji 图形）
            const toggleButton = buttonContainer.createEl("button", {
                cls: "config-button"
            });
            toggleButton.style.color = config.enabled ? "var(--text-normal)" : "var(--text-muted)";
            toggleButton.textContent = config.enabled ? "⚡" : "🔴";
            toggleButton.title = config.enabled ? t("禁用配置") : t("启用配置");
            toggleButton.addEventListener("click", () => {
                if (this.plugin.settings.taskSettings.captureToSettings.configs && 
                    this.plugin.settings.taskSettings.captureToSettings.configs[index]) {
                    this.plugin.settings.taskSettings.captureToSettings.configs[index].enabled = !config.enabled;
                    this.scheduleSave();
                    // 重新渲染设置页面
                    this.display();
                }
            });

            // 配置按钮（emoji 图形）
            const settingsButton = buttonContainer.createEl("button", {
                cls: "config-button"
            });
            settingsButton.style.color = "var(--text-muted)";
            settingsButton.textContent = "⚙️";
            settingsButton.title = t("配置");
            settingsButton.addEventListener("click", () => {
                // 打开详细配置对话框
                new CaptureToConfigModal({
                    plugin: this.plugin,
                    config: config,
                    onSave: (updatedConfig) => {
                        // 更新配置
                        if (this.plugin.settings.taskSettings.captureToSettings.configs) {
                            const configIndex = this.plugin.settings.taskSettings.captureToSettings.configs.findIndex(c => c.id === updatedConfig.id);
                            if (configIndex !== -1) {
                                this.plugin.settings.taskSettings.captureToSettings.configs[configIndex] = updatedConfig;
                                this.scheduleSave();
                                // 重新渲染设置页面
                                this.display();
                            }
                        }
                    }
                }).open();
            });

            // 复制按钮（emoji 图形）
            const duplicateButton = buttonContainer.createEl("button", {
                cls: "config-button"
            });
            duplicateButton.style.color = "var(--text-muted)";
            duplicateButton.textContent = "📋";
            duplicateButton.title = t("复制");
            duplicateButton.addEventListener("click", () => {
                if (this.plugin.settings.taskSettings.captureToSettings.configs) {
                    // 创建配置副本
                    const duplicatedConfig = JSON.parse(JSON.stringify(config)) as CaptureToConfig;
                    duplicatedConfig.id = `config-${Date.now()}`;
                    duplicatedConfig.name = `${config.name} (副本)`;
                    
                    // 添加到配置列表
                    this.plugin.settings.taskSettings.captureToSettings.configs.push(duplicatedConfig);
                    this.scheduleSave();
                    // 重新渲染设置页面
                    this.display();
                }
            });

            // 恢复默认按钮（emoji 图形）
            const resetButton = buttonContainer.createEl("button", {
                cls: "config-button"
            });
            resetButton.textContent = "🔄";
            resetButton.title = t("恢复默认");
            
            // 检查是否为新建配置项（ID格式为config-${Date.now()}）
            const isNewConfig = config.id.startsWith('config-');
            const defaultConfig = DEFAULT_SETTINGS.taskSettings.captureToSettings.configs.find(defaultCfg => defaultCfg.id === config.id);
            const hasDefaultConfig = !!defaultConfig;
            
            if (isNewConfig || !hasDefaultConfig) {
                // 新建配置项或无默认配置，禁用按钮
                resetButton.disabled = true;
                resetButton.style.color = "var(--text-faint)";
                resetButton.style.cursor = "not-allowed";
                resetButton.title = t("无默认配置可恢复");;
            } else {
                // 预设配置，启用按钮
                resetButton.disabled = false;
                resetButton.style.color = "var(--text-muted)";
                resetButton.style.cursor = "pointer";
resetButton.title = t("恢复默认");
                
                resetButton.addEventListener("click", () => {
                    if (this.plugin.settings.taskSettings.captureToSettings.configs) {
                        // 替换当前配置为默认配置
                        this.plugin.settings.taskSettings.captureToSettings.configs[index] = defaultConfig!;
                        this.scheduleSave();
                        // 重新渲染设置页面
                        this.display();
                        // 显示恢复成功提示
                        new Notice(t("配置已恢复默认"));
                    }
                });
            }

            // 重命名按钮（emoji 图形）
            const renameButton = buttonContainer.createEl("button", {
                cls: "config-button"
            });
            renameButton.style.color = "var(--text-muted)";
            renameButton.textContent = "✏️";
            renameButton.title = t("重命名");
            renameButton.addEventListener("click", async () => {
                // 重命名模态框
                const newName = await new Promise<string | null>((resolve) => {
                    const modal = new Modal(this.app);
                    modal.titleEl.setText(t("重命名配置"));
                    modal.contentEl.createEl("p", {
                        text: t("请输入新的配置名称：")
                    });
                    
                    const input = modal.contentEl.createEl("input", {
                        type: "text",
                        value: config.name
                    });
                    input.style.width = "100%";
                    input.style.padding = "8px";
                    input.style.marginTop = "10px";
                    input.style.border = "1px solid var(--background-modifier-border)";
                    input.style.borderRadius = "4px";
                    
                    const buttonContainer = modal.contentEl.createEl("div");
                    buttonContainer.style.display = "flex";
                    buttonContainer.style.justifyContent = "flex-end";
                    buttonContainer.style.gap = "10px";
                    buttonContainer.style.marginTop = "20px";

                    const cancelButton = buttonContainer.createEl("button", {
                        text: t("取消"),
                        cls: "mod-button"
                    });
                    cancelButton.addEventListener("click", () => {
                        resolve(null);
                        modal.close();
                    });

                    const confirmButton = buttonContainer.createEl("button", {
                        text: t("确认"),
                        cls: "mod-cta"
                    });
                    confirmButton.addEventListener("click", () => {
                        const value = input.value.trim();
                        if (value) {
                            resolve(value);
                        }
                        modal.close();
                    });

                    // 回车键确认
                    input.addEventListener("keypress", (e: KeyboardEvent) => {
                        if (e.key === "Enter") {
                            const value = input.value.trim();
                            if (value) {
                                resolve(value);
                                modal.close();
                            }
                        }
                    });

                    modal.open();
                    // 自动聚焦输入框
                    setTimeout(() => input.focus(), 100);
                });

                if (newName) {
                    // 更新配置名称
                    if (this.plugin.settings.taskSettings.captureToSettings.configs && 
                        this.plugin.settings.taskSettings.captureToSettings.configs[index]) {
                        this.plugin.settings.taskSettings.captureToSettings.configs[index].name = newName;
                        this.scheduleSave();
                        // 重新渲染设置页面
                        this.display();
                    }
                }
            });

            // 删除按钮（emoji 图形）
            const deleteButton = buttonContainer.createEl("button", {
                cls: "config-button"
            });
            deleteButton.textContent = "🗑️";
            deleteButton.title = t("删除");
            
            // 检查是否为默认配置项
            const isDefaultConfig = DEFAULT_SETTINGS.taskSettings.captureToSettings.configs.some(defaultCfg => defaultCfg.id === config.id);
            
            if (isDefaultConfig) {
                // 默认配置项，禁用删除按钮
                deleteButton.disabled = true;
                deleteButton.style.color = "var(--text-faint)";
                deleteButton.style.cursor = "not-allowed";
                deleteButton.title = t("默认配置不可删除");;
            } else {
                // 用户自定义配置项，启用删除按钮
                deleteButton.disabled = false;
                deleteButton.style.color = "var(--text-muted)";
                deleteButton.style.cursor = "pointer";
                deleteButton.title = t("删除");
                
                deleteButton.addEventListener("click", async () => {
                    // 确认删除
                    const confirmed = await new Promise<boolean>((resolve) => {
                        const modal = new Modal(this.app);
                        modal.titleEl.setText(t("确认删除"));
                        modal.contentEl.createEl("p", {
                            text: `确定要删除配置 "${config.name}" 吗？`
                        });
                        
                        const buttonContainer = modal.contentEl.createEl("div");
                        buttonContainer.style.display = "flex";
                        buttonContainer.style.justifyContent = "flex-end";
                        buttonContainer.style.gap = "10px";
                        buttonContainer.style.marginTop = "20px";

                        const cancelButton = buttonContainer.createEl("button", {
text: t("取消"),
                            cls: "mod-button"
                        });
                        cancelButton.addEventListener("click", () => {
                            resolve(false);
                            modal.close();
                        });

                        const confirmButton = buttonContainer.createEl("button", {
                            text: t("删除"),
                            cls: "mod-danger"
                        });
                        confirmButton.addEventListener("click", () => {
                            resolve(true);
                            modal.close();
                        });

                        modal.open();
                    });

                    if (confirmed) {
                        // 从配置列表中删除
                        if (this.plugin.settings.taskSettings.captureToSettings.configs) {
                            this.plugin.settings.taskSettings.captureToSettings.configs.splice(index, 1);
                            
                            this.scheduleSave();
                            // 重新渲染设置页面
                            this.display();
                        }
                    }
                });
            }
        });

        // 添加新配置的输入框和按钮，模仿 QuickAdd 的样式
        const addConfigContainer = section.createEl("div", {
            cls: "add-config-container"
        });

        // 名称输入框
        const nameInput = addConfigContainer.createEl("input", {
            type: "text",
            placeholder: t("名称"),
            cls: "add-config-input"
        });

        // 添加按钮
        const addButton = addConfigContainer.createEl("button", {
            text: t("新建配置"),
            cls: "mod-cta add-config-button"
        });
        addButton.addEventListener("click", () => {
            const name = nameInput.value.trim();
            if (!name) {
                new Notice(t("配置名称不能为空"));
                return;
            }

            // 创建新配置
            const newConfig: CaptureToConfig = {
                id: `config-${Date.now()}`,
                name,
                description: "",
                enabled: true,
                defaultCapturePath: "",
                captureToActiveFile: false,
                hotkey: null,
                inputMethod: "single-line",
                createFileIfItDoesntExist: {
                    enabled: true,
                    createWithTemplate: false,
                    template: ""
                },
                format: {
                    enabled: true,
                    format: "- [ ] {{VALUE}}\n"
                },
                prepend: false,
                appendLink: false,
                insertAfter: {
                    enabled: false,
                    after: "",
                    insertAtEnd: false,
                    considerSubsections: false,
                    createIfNotFound: false,
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
                },
                autoAddCreatedDate: false,
                autoAddDueDate: false,
                dueDateOption: "today",
                customDueDays: 0
            };

            // 添加到配置列表
            if (this.plugin.settings.taskSettings.captureToSettings.configs) {
                this.plugin.settings.taskSettings.captureToSettings.configs.push(newConfig);
                this.scheduleSave();
                
                // 清空输入框
                nameInput.value = "";
                
                // 重新渲染设置页面
                this.display();
            }
        });

        // 回车键添加
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                addButton.click();
            }
        });

        // 模板提示
        const hintSection = section.createEl("div", { cls: "setting-section" });
        hintSection.createEl("h4", { text: t("💡 模板说明") });
        const hintDesc = hintSection.createEl("p", { cls: "setting-item-description" });
        hintDesc.innerHTML = t('捕获配置的「格式」和「模板路径」支持 <code>{{VALUE}}</code>、<code>{{DATE}}</code> 等内置变量。如果需要在模板中使用 <code>&lt;% tp.xxx %&gt;</code> 语法，需要安装 <a href="https://github.com/SilentVoid13/Templater">Templater</a> 插件，安装后自动生效，无需额外配置。');

    }

    private renderNoteSettings(
        title: string,
        settings: NoteTemplateSettings,
        onChange: (newSettings: NoteTemplateSettings) => void,
        contentEl: HTMLElement
    ) {
        const section = contentEl.createEl("div", {cls: "setting-section"});
        section.createEl("h4", {text: title});
        
        // 计算预览日期（根据不同笔记类型使用不同的日期）
        let previewDate: Date;
        switch (title) {
            case "周报设置":
                // 使用当前周的周一作为预览日期
                previewDate = new Date();
                const dayOfWeek = previewDate.getDay();
                previewDate.setDate(previewDate.getDate() + (dayOfWeek === 0 ? -6 : 1) - dayOfWeek);
                break;
            case "月报设置":
                // 使用当月1日作为预览日期
                previewDate = new Date();
                previewDate.setDate(1);
                break;
            case "季报设置":
                // 使用当季第一天作为预览日期
                previewDate = new Date();
                const currentMonth = previewDate.getMonth();
                const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
                previewDate.setMonth(quarterStartMonth);
                previewDate.setDate(1);
                break;
            case "年报设置":
                // 使用当年1月1日作为预览日期
                previewDate = new Date();
                previewDate.setMonth(0);
                previewDate.setDate(1);
                break;
            case "日记设置":
            default:
                // 使用当前日期作为预览日期
                previewDate = new Date();
                break;
        }
        
        // 预览元素引用
        let fullPathPreviewText: HTMLElement;
        
        // 当前设置引用
        let currentSettings = settings;
        
        // 更新预览函数
        const updatePreview = () => {
            if (!fullPathPreviewText) return;
            try {
                // 使用formatDate函数生成文件名预览
                const fileNamePreview = formatDate(previewDate, currentSettings.fileNameFormat);
                
                // 生成完整路径预览
                const fullPathPreview = `${currentSettings.savePath}/${fileNamePreview}.md`;
                fullPathPreviewText.textContent = fullPathPreview;
                fullPathPreviewText.style.color = "var(--text-muted)";
            } catch (error) {
                fullPathPreviewText.textContent = t("格式错误");
                fullPathPreviewText.style.color = "var(--text-error)";
            }
        };

        // 文件名格式设置
        new Setting(section)
            .setName(t("文件名格式"))
            .setDesc(`（年-YYYY、周所属年-GGGG、月-MM、日-DD、周数-WW、季-Q     例如： ${settings.fileNameFormat}）`)            
            .addText(text => text
                .setPlaceholder(t("输入格式"))
                .setValue(settings.fileNameFormat)
                .onChange((value) => {
                    const newSettings = { ...currentSettings, fileNameFormat: value };
                    currentSettings = newSettings;
                    onChange(newSettings);
                    this.scheduleSave();
                    // 更新预览
                    updatePreview();
                }));

        // 保存路径设置
        let savePathInputEl: HTMLInputElement | null = null;
        const savePathSetting = new Setting(section)
            .setName(t("保存路径"))
            .addText(text => {
                savePathInputEl = text.inputEl;
                text
                    .setValue(settings.savePath)
                    .setPlaceholder(t("例如：日记"))
                    .onChange((value) => {
                        const newSettings = { ...currentSettings, savePath: value };
                        currentSettings = newSettings;
                        onChange(newSettings);
                        this.scheduleSave();
                        // 更新预览
                        updatePreview();
                    });
            })
            .addButton(button => button
                .setButtonText(t("选择"))
                .onClick(() => {
                    new FolderSelectModal(this.app, (folder) => {
                        const newSettings = { ...currentSettings, savePath: folder.path };
                        currentSettings = newSettings;
                        onChange(newSettings);
                        this.scheduleSave();
                        // 更新输入框的值
                        if (savePathInputEl) {
                            savePathInputEl.value = folder.path;
                        }
                        // 更新预览
                        updatePreview();
                    }).open();
                }));

        // 模板路径设置
        let templatePathInputEl: HTMLInputElement | null = null;
        new Setting(section)
            .setName(t("模板路径"))
            .setDesc(t("模板文件的路径"))
            .addText(text => {
                templatePathInputEl = text.inputEl;
                text
                    .setValue(settings.templatePath)
                    .setPlaceholder(t("例如：模板/日记模板"))
                    .onChange((value) => {
                        const newSettings = { ...currentSettings, templatePath: value };
                        currentSettings = newSettings;
                        onChange(newSettings);
                        this.scheduleSave();
                    });
            })
            .addButton(button => button
                .setButtonText(t("选择"))
                .onClick(() => {
                    new FileSelectModal(this.app, (file) => {
                        const newSettings = { ...currentSettings, templatePath: file.path };
                        currentSettings = newSettings;
                        onChange(newSettings);
                        this.scheduleSave();
                        // 更新输入框的值
                        if (templatePathInputEl) {
                            templatePathInputEl.value = file.path;
                        }
                    }).open();
                }));

        // 添加完整路径预览
        const fullPathPreviewContainer = savePathSetting.descEl.createEl("div", { 
            cls: "fullPath-preview", 
            text: t("路径预览：") 
        });
        fullPathPreviewContainer.style.marginTop = "8px";
        fullPathPreviewContainer.style.color = "var(--text-muted)";
        fullPathPreviewText = fullPathPreviewContainer.createEl("span");
        
        // 初始渲染预览
        updatePreview();
        
        
    }
}
