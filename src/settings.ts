import {App, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "./main";
import { formatDate } from "./utils/dateUtils";

export interface NoteTemplateSettings {
    savePath: string;
    templatePath: string;
    fileNameFormat: string;
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
    }
}

export class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();
        containerEl.createEl("h2", {text: "99日历设置"});

        this.renderNoteSettings("日记设置", this.plugin.settings.dailyNote, (newSettings) => {
            this.plugin.settings.dailyNote = newSettings;
        });

        this.renderNoteSettings("周报设置", this.plugin.settings.weeklyNote, (newSettings) => {
            this.plugin.settings.weeklyNote = newSettings;
        });

        this.renderNoteSettings("月报设置", this.plugin.settings.monthlyNote, (newSettings) => {
            this.plugin.settings.monthlyNote = newSettings;
        });

        this.renderNoteSettings("季报设置", this.plugin.settings.quarterlyNote, (newSettings) => {
            this.plugin.settings.quarterlyNote = newSettings;
        });

        this.renderNoteSettings("年报设置", this.plugin.settings.yearlyNote, (newSettings) => {
            this.plugin.settings.yearlyNote = newSettings;
        });

        // 渲染任务显示筛选设置
        this.renderTaskFilterSettings();
        
        
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
                    .onChange(async (value: string) => {
                        this.plugin.settings.taskFilter.customFilter = value;
                        await this.plugin.saveSettings();
                        // 通知所有视图更新
                        this.plugin.updateAllViews();
                    });
                // 设置文本域属性
                textArea.inputEl.rows = 4;
                textArea.inputEl.wrap = "soft";
                textArea.inputEl.style.resize = "vertical";
                textArea.inputEl.style.maxHeight = "100px";
            });
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
                .onChange(async (value) => {
                    const newSettings = { ...settings, fileNameFormat: value };
                    currentSettings = newSettings;
                    onChange(newSettings);
                    await this.plugin.saveSettings();
                    // 更新预览
                    updatePreview();
                    // 通知所有视图更新
                    this.plugin.updateAllViews();
                }));

        // 保存路径设置
        const savePathSetting = new Setting(section)
            .setName("保存路径")
            .addText(text => text
                .setPlaceholder("输入路径")
                .setValue(settings.savePath)
                .onChange(async (value) => {
                    const newSettings = { ...settings, savePath: value };
                    currentSettings = newSettings;
                    onChange(newSettings);
                    await this.plugin.saveSettings();
                    // 更新预览
                    updatePreview();
                    // 通知所有视图更新
                    this.plugin.updateAllViews();
                }));

        // 模板路径设置
        new Setting(section)
            .setName("模板路径")
            .setDesc("模板文件的路径")
            .addText(text => text
                .setPlaceholder("输入模板路径")
                .setValue(settings.templatePath)
                .onChange(async (value) => {
                    const newSettings = { ...settings, templatePath: value };
                    currentSettings = newSettings;
                    onChange(newSettings);
                    await this.plugin.saveSettings();
                    // 通知所有视图更新
                    this.plugin.updateAllViews();
                }));

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
