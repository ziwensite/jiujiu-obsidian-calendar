import {App, PluginSettingTab, Setting, Notice, TFolder} from "obsidian";
import MyPlugin from "./main";
import { formatDate } from "./utils/dateUtils";

// 自定义路径自动完成组件
class PathAutocomplete {
    private container: HTMLElement;
    private inputEl: HTMLInputElement;
    private dropdownEl: HTMLElement;
    private app: App;
    private onPathChange: (path: string) => void;
    private currentPaths: string[] = [];
    
    constructor(app: App, container: HTMLElement, initialValue: string, onPathChange: (path: string) => void) {
        this.app = app;
        this.container = container;
        this.onPathChange = onPathChange;
        
        // 创建输入框
        this.inputEl = container.createEl("input", {
            type: "text",
            value: initialValue,
            placeholder: "输入路径"
        });
        this.inputEl.className = "setting-item-input";
        
        // 创建下拉列表容器
        this.dropdownEl = container.createEl("div", {
            cls: "path-autocomplete-dropdown"
        });
        this.dropdownEl.style.display = "none";
        
        // 监听输入事件
        this.inputEl.addEventListener("input", this.handleInput.bind(this));
        
        // 监听焦点事件
        this.inputEl.addEventListener("focus", this.handleFocus.bind(this));
        
        // 监听点击事件，防止冒泡
        this.inputEl.addEventListener("click", (e) => e.stopPropagation());
        
        // 监听键盘事件
        this.inputEl.addEventListener("keydown", this.handleKeyDown.bind(this));
        
        // 监听外部点击，关闭下拉列表
        document.addEventListener("click", this.handleOutsideClick.bind(this));
        
        // 初始化路径列表
        this.updatePaths();
    }
    
    // 更新路径列表
    private updatePaths() {
        const allFiles = this.app.vault.getAllLoadedFiles();
        
        // 获取所有文件和文件夹路径
        this.currentPaths = allFiles.map(file => file.path);
        
        // 添加根路径
        this.currentPaths.unshift("");
    }
    
    // 处理输入事件
    private handleInput() {
        const inputValue = this.inputEl.value;
        this.onPathChange(inputValue);
        this.filterPaths(inputValue);
    }
    
    // 处理焦点事件
    private handleFocus() {
        this.filterPaths(this.inputEl.value);
    }
    
    // 处理外部点击
    private handleOutsideClick(e: MouseEvent) {
        if (!this.container.contains(e.target as Node)) {
            this.dropdownEl.style.display = "none";
        }
    }
    
    // 处理键盘事件
    private handleKeyDown(e: KeyboardEvent) {
        const items = this.dropdownEl.querySelectorAll(".path-item");
        const activeItem = this.dropdownEl.querySelector(".path-item.active") as HTMLElement;
        let activeIndex = Array.from(items).indexOf(activeItem);
        
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                if (activeIndex < items.length - 1) {
                    activeItem?.classList.remove("active");
                    (items[activeIndex + 1] as HTMLElement).classList.add("active");
                } else if (items.length > 0) {
                    activeItem?.classList.remove("active");
                    (items[0] as HTMLElement).classList.add("active");
                }
                break;
            case "ArrowUp":
                e.preventDefault();
                if (activeIndex > 0) {
                    activeItem?.classList.remove("active");
                    (items[activeIndex - 1] as HTMLElement).classList.add("active");
                } else if (items.length > 0) {
                    activeItem?.classList.remove("active");
                    (items[items.length - 1] as HTMLElement).classList.add("active");
                }
                break;
            case "Enter":
                e.preventDefault();
                if (activeItem) {
                    this.selectPath(activeItem.dataset.path || "");
                }
                break;
            case "Escape":
                this.dropdownEl.style.display = "none";
                break;
        }
    }
    
    // 过滤路径
    private filterPaths(inputValue: string) {
        this.dropdownEl.empty();
        
        if (!inputValue) {
            this.dropdownEl.style.display = "none";
            return;
        }
        
        // 过滤匹配的路径
        const matchedPaths = this.currentPaths.filter(path => 
            path.toLowerCase().includes(inputValue.toLowerCase())
        ).slice(0, 10); // 限制显示10个结果
        
        if (matchedPaths.length === 0) {
            this.dropdownEl.style.display = "none";
            return;
        }
        
        // 创建下拉列表项
        matchedPaths.forEach(path => {
            const itemEl = this.dropdownEl.createEl("div", {
                cls: "path-item",
                text: path || "(根目录)"
            });
            itemEl.dataset.path = path;
            
            // 判断是否为文件夹
            const file = this.app.vault.getAbstractFileByPath(path);
            const isFolder = file instanceof TFolder;
            
            // 添加文件/文件夹图标
            const iconSpan = itemEl.createEl("span", {
                cls: `path-item-icon ${isFolder ? "folder" : "file"}`
            });
            iconSpan.textContent = isFolder ? "📁" : "📄";
            iconSpan.style.marginRight = "8px";
            iconSpan.style.width = "16px";
            iconSpan.style.textAlign = "center";
            
            // 高亮匹配的部分
            const matchIndex = path.toLowerCase().indexOf(inputValue.toLowerCase());
            if (matchIndex !== -1) {
                // 清空现有内容，重新构建
                itemEl.empty();
                
                // 重新添加图标
                const newIconSpan = itemEl.createEl("span", {
                    cls: `path-item-icon ${isFolder ? "folder" : "file"}`
                });
                newIconSpan.textContent = isFolder ? "📁" : "📄";
                newIconSpan.style.marginRight = "8px";
                newIconSpan.style.width = "16px";
                newIconSpan.style.textAlign = "center";
                
                // 添加高亮文本
                itemEl.createEl("span", { text: path.slice(0, matchIndex) });
                itemEl.createEl("strong", { 
                    text: path.slice(matchIndex, matchIndex + inputValue.length)
                });
                itemEl.createEl("span", { text: path.slice(matchIndex + inputValue.length) });
            }
            
            // 监听鼠标点击
            itemEl.addEventListener("mousedown", () => {
                this.selectPath(path);
            });
            
            // 监听鼠标悬停
            itemEl.addEventListener("mouseenter", () => {
                this.dropdownEl.querySelectorAll(".path-item").forEach(el => 
                    el.classList.remove("active")
                );
                itemEl.classList.add("active");
            });
        });
        
        // 显示第一个结果为激活状态
        if (matchedPaths.length > 0) {
            (this.dropdownEl.firstChild as HTMLElement).classList.add("active");
        }
        
        this.dropdownEl.style.display = "block";
    }
    
    // 选择路径
    private selectPath(path: string) {
        this.inputEl.value = path;
        this.onPathChange(path);
        this.dropdownEl.style.display = "none";
    }
    
    // 获取当前值
    getValue(): string {
        return this.inputEl.value;
    }
    
    // 设置值
    setValue(value: string) {
        this.inputEl.value = value;
    }
    
    // 销毁组件
    destroy() {
        document.removeEventListener("click", this.handleOutsideClick.bind(this));
    }
}

export interface NoteTemplateSettings {
    savePath: string;
    templatePath: string;
    fileNameFormat: string;
}

export interface TaskInsertSettings {
    insertSection: string;
    insertPosition: "first" | "last";
}

export interface TaskSettings {
    // 任务默认属性
    includeCreationDate: boolean;
    includeDueDate: boolean;
    defaultPriority: string;
    defaultStatus: string;
    
    // 任务插入位置设置 - 日记
    dailyInsertSettings: TaskInsertSettings;
    
    // 任务插入位置设置 - 默认笔记
    noteInsertSettings: TaskInsertSettings;
    defaultNotePath: string;
}

export interface TaskFilterSettings {
    customFilter: string;
}

export interface MyPluginSettings {
    dailyNote: NoteTemplateSettings;
    weeklyNote: NoteTemplateSettings;
    monthlyNote: NoteTemplateSettings;
    quarterlyNote: NoteTemplateSettings;
    yearlyNote: NoteTemplateSettings;
    taskFilter: TaskFilterSettings;
    taskSettings: TaskSettings;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    dailyNote: {
        savePath: "日记",
        templatePath: "模板/日记模板",
        fileNameFormat: "YYYY-MM-DD"
    },
    weeklyNote: {
        savePath: "周报",
        templatePath: "模板/周报模板",
        fileNameFormat: "GGGG-WW"
    },
    monthlyNote: {
        savePath: "月报",
        templatePath: "模板/月报模板",
        fileNameFormat: "YYYY-MM"
    },
    quarterlyNote: {
        savePath: "季报",
        templatePath: "模板/季报模板",
        fileNameFormat: "YYYY-Q[Q]"
    },
    yearlyNote: {
        savePath: "年报",
        templatePath: "模板/年报模板",
        fileNameFormat: "YYYY"
    },
    taskFilter: {
        customFilter: ""
    },
    taskSettings: {
        includeCreationDate: true,
        includeDueDate: true,
        defaultPriority: "Medium",
        defaultStatus: "",
        dailyInsertSettings: {
            insertSection: "## 任务",
            insertPosition: "last"
        },
        noteInsertSettings: {
            insertSection: "## 任务",
            insertPosition: "last"
        },
        defaultNotePath: ""
    }
}

export class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    private settingsChanged: boolean = false;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();
        containerEl.createEl("h2", {text: "99日历设置"});

        // 添加保存按钮
        const saveButton = containerEl.createEl("button", {
            text: "保存设置",
            cls: "mod-cta save-button"
        });
        saveButton.style.marginBottom = "20px";
        saveButton.addEventListener("click", async () => {
            await this.saveSettings();
        });

        this.renderNoteSettings("日记设置", this.plugin.settings.dailyNote, (newSettings) => {
            this.plugin.settings.dailyNote = newSettings;
            this.settingsChanged = true;
        });

        this.renderNoteSettings("周报设置", this.plugin.settings.weeklyNote, (newSettings) => {
            this.plugin.settings.weeklyNote = newSettings;
            this.settingsChanged = true;
        });

        this.renderNoteSettings("月报设置", this.plugin.settings.monthlyNote, (newSettings) => {
            this.plugin.settings.monthlyNote = newSettings;
            this.settingsChanged = true;
        });

        this.renderNoteSettings("季报设置", this.plugin.settings.quarterlyNote, (newSettings) => {
            this.plugin.settings.quarterlyNote = newSettings;
            this.settingsChanged = true;
        });

        this.renderNoteSettings("年报设置", this.plugin.settings.yearlyNote, (newSettings) => {
            this.plugin.settings.yearlyNote = newSettings;
            this.settingsChanged = true;
        });

        // 渲染任务显示筛选设置
        this.renderTaskFilterSettings();
        
        // 渲染任务创建设置
        this.renderTaskSettings();
        
        // 监听设置页面关闭事件
        this.registerEvents();
    }

    private registerEvents() {
        // 监听设置页面容器的移除事件，当设置页面关闭时触发
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && this.containerEl.parentElement === null) {
                    // 设置页面已关闭，检查是否需要保存设置
                    if (this.settingsChanged) {
                        this.saveSettings().then(() => {
                            this.settingsChanged = false;
                        });
                    }
                    observer.disconnect();
                }
            });
        });

        observer.observe(this.containerEl.parentElement || document.body, {
            childList: true,
            subtree: true
        });
    }

    private async saveSettings() {
        await this.plugin.saveSettings();
        // 保存设置后刷新视图
        this.plugin.updateAllViews();
        new Notice("设置已保存并刷新视图");
    }

    private renderTaskFilterSettings(): void {
        const section = this.containerEl.createEl("div", {cls: "setting-section"});
        section.createEl("h3", {text: "任务列表设置"});

        // 自定义筛选设置
        new Setting(section)
            .setName("自定义筛选")
            .setDesc("规则：使用路径或标签，!表示排除，and、or、()逻辑组合。例如：(A or B) and #C - 路径A或B中包含标签#C的任务")
            .addTextArea(textArea => {
                textArea
                    .setPlaceholder("输入筛选规则")
                    .setValue(this.plugin.settings.taskFilter.customFilter)
                    .onChange((value: string) => {
                        this.plugin.settings.taskFilter.customFilter = value;
                        this.settingsChanged = true;
                    });
                // 设置文本域属性
                textArea.inputEl.rows = 4;
                textArea.inputEl.wrap = "soft";
                textArea.inputEl.style.resize = "vertical";
                textArea.inputEl.style.maxHeight = "100px";
            });
    }

    private renderTaskSettings(): void {
        const section = this.containerEl.createEl("div", {cls: "setting-section"});
        section.createEl("h3", {text: "任务创建设置"});

        // 任务默认属性设置
        const taskPropertiesHeader = section.createEl("div", {cls: "setting-header"});
        taskPropertiesHeader.createEl("h4", {text: "任务默认属性"});

        // 包含创建日期
        new Setting(section)
            .setName("包含创建日期")
            .setDesc("在任务中自动添加创建日期")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.taskSettings.includeCreationDate)
                .onChange((value) => {
                    this.plugin.settings.taskSettings.includeCreationDate = value;
                    this.settingsChanged = true;
                }));

        // 包含截止日期
        new Setting(section)
            .setName("包含截止日期")
            .setDesc("在任务中自动添加截止日期")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.taskSettings.includeDueDate)
                .onChange((value) => {
                    this.plugin.settings.taskSettings.includeDueDate = value;
                    this.settingsChanged = true;
                }));

        // 默认优先级
        new Setting(section)
            .setName("默认优先级")
            .setDesc("新建任务的默认优先级（High/Medium/Low或空）")
            .addText(text => text
                .setPlaceholder("High/Medium/Low")
                .setValue(this.plugin.settings.taskSettings.defaultPriority)
                .onChange((value) => {
                    this.plugin.settings.taskSettings.defaultPriority = value;
                    this.settingsChanged = true;
                }));

        // 默认状态
        new Setting(section)
            .setName("默认状态")
            .setDesc("新建任务的默认状态（可留空）")
            .addText(text => text
                .setPlaceholder("例如：todo/in-progress")
                .setValue(this.plugin.settings.taskSettings.defaultStatus)
                .onChange((value) => {
                    this.plugin.settings.taskSettings.defaultStatus = value;
                    this.settingsChanged = true;
                }));

        // 日记插入设置
        const dailyInsertHeader = section.createEl("div", {cls: "setting-header"});
        dailyInsertHeader.createEl("h4", {text: "日记插入设置"});

        // 日记插入章节
        new Setting(section)
            .setName("日记插入章节")
            .setDesc("任务要插入到日记中的章节标题（如：## 任务）")
            .addText(text => text
                .setPlaceholder("## 任务")
                .setValue(this.plugin.settings.taskSettings.dailyInsertSettings.insertSection)
                .onChange((value) => {
                    this.plugin.settings.taskSettings.dailyInsertSettings.insertSection = value;
                    this.settingsChanged = true;
                }));

        // 日记插入位置
        new Setting(section)
            .setName("日记插入位置")
            .setDesc("在日记章节中的插入位置")
            .addDropdown(dropdown => dropdown
                .addOption("first", "章节首行")
                .addOption("last", "章节末尾")
                .setValue(this.plugin.settings.taskSettings.dailyInsertSettings.insertPosition)
                .onChange((value) => {
                    this.plugin.settings.taskSettings.dailyInsertSettings.insertPosition = value as "first" | "last";
                    this.settingsChanged = true;
                }));

        // 默认笔记插入设置
        const noteInsertHeader = section.createEl("div", {cls: "setting-header"});
        noteInsertHeader.createEl("h4", {text: "默认笔记插入设置"});

        // 默认笔记路径
        new Setting(section)
            .setName("默认笔记路径")
            .setDesc("任务要插入的默认笔记路径")
            .addTextArea(textArea => {
                // 创建自定义路径自动完成组件
                const container = textArea.inputEl.parentElement;
                if (container) {
                    // 移除默认的textarea
                    textArea.inputEl.remove();
                    
                    // 创建路径自动完成组件
                    new PathAutocomplete(
                        this.app,
                        container,
                        this.plugin.settings.taskSettings.defaultNotePath,
                        (value) => {
                            this.plugin.settings.taskSettings.defaultNotePath = value;
                            this.settingsChanged = true;
                        }
                    );
                }
            });

        // 笔记插入章节
        new Setting(section)
            .setName("笔记插入章节")
            .setDesc("任务要插入到默认笔记中的章节标题（如：## 任务）")
            .addText(text => text
                .setPlaceholder("## 任务")
                .setValue(this.plugin.settings.taskSettings.noteInsertSettings.insertSection)
                .onChange((value) => {
                    this.plugin.settings.taskSettings.noteInsertSettings.insertSection = value;
                    this.settingsChanged = true;
                }));

        // 笔记插入位置
        new Setting(section)
            .setName("笔记插入位置")
            .setDesc("在默认笔记章节中的插入位置")
            .addDropdown(dropdown => dropdown
                .addOption("first", "章节首行")
                .addOption("last", "章节末尾")
                .setValue(this.plugin.settings.taskSettings.noteInsertSettings.insertPosition)
                .onChange((value) => {
                    this.plugin.settings.taskSettings.noteInsertSettings.insertPosition = value as "first" | "last";
                    this.settingsChanged = true;
                }));
    }

    private renderNoteSettings(
        title: string,
        settings: NoteTemplateSettings,
        onChange: (newSettings: NoteTemplateSettings) => void
    ) {
        const section = this.containerEl.createEl("div", {cls: "setting-section"});
        section.createEl("h3", {text: title});
        
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
                fullPathPreviewText.textContent = "格式错误";
                fullPathPreviewText.style.color = "var(--text-error)";
            }
        };

        // 文件名格式设置
        new Setting(section)
            .setName("文件名格式")
            .setDesc(`（年-YYYY、周所属年-GGGG、月-MM、日-DD、周数-WW、季-Q     例如： ${settings.fileNameFormat}）`)            
            .addText(text => text
                .setPlaceholder("输入格式")
                .setValue(settings.fileNameFormat)
                .onChange((value) => {
                    const newSettings = { ...settings, fileNameFormat: value };
                    currentSettings = newSettings;
                    onChange(newSettings);
                    this.settingsChanged = true;
                    // 更新预览
                    updatePreview();
                }));

        // 保存路径设置
        const savePathSetting = new Setting(section)
            .setName("保存路径")
            .addTextArea(textArea => {
                // 创建自定义路径自动完成组件
                const container = textArea.inputEl.parentElement;
                if (container) {
                    // 移除默认的textarea
                    textArea.inputEl.remove();
                    
                    // 创建路径自动完成组件
                    new PathAutocomplete(
                        this.app,
                        container,
                        settings.savePath,
                        (value) => {
                            const newSettings = { ...settings, savePath: value };
                            currentSettings = newSettings;
                            onChange(newSettings);
                            this.settingsChanged = true;
                            // 更新预览
                            updatePreview();
                        }
                    );
                }
            });

        // 模板路径设置
        new Setting(section)
            .setName("模板路径")
            .setDesc("模板文件的路径")
            .addTextArea(textArea => {
                // 创建自定义路径自动完成组件
                const container = textArea.inputEl.parentElement;
                if (container) {
                    // 移除默认的textarea
                    textArea.inputEl.remove();
                    
                    // 创建路径自动完成组件
                    new PathAutocomplete(
                        this.app,
                        container,
                        settings.templatePath,
                        (value) => {
                            const newSettings = { ...settings, templatePath: value };
                            currentSettings = newSettings;
                            onChange(newSettings);
                            this.settingsChanged = true;
                        }
                    );
                }
            });

        // 添加完整路径预览
        const fullPathPreviewContainer = savePathSetting.descEl.createEl("div", { 
            cls: "fullPath-preview", 
            text: "路径预览：" 
        });
        fullPathPreviewContainer.style.marginTop = "8px";
        fullPathPreviewContainer.style.color = "var(--text-muted)";
        fullPathPreviewText = fullPathPreviewContainer.createEl("span");
        
        // 初始渲染预览
        updatePreview();
        
        
    }
}
