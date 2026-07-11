import { Modal, App, Notice, Setting, TextComponent, ToggleComponent } from 'obsidian';
import { MyPlugin } from '../../../main';
import { CaptureToConfig } from '../../../settings';
import { FileSelectModal } from '../../../modals/FileSelectModal';
import { t } from '../../../i18n';

interface CaptureToConfigModalOptions {
    plugin: MyPlugin;
    config: CaptureToConfig;
    onSave: (config: CaptureToConfig) => void;
}

export class CaptureToConfigModal extends Modal {
    private plugin: MyPlugin;
    private config: CaptureToConfig;
    private onSave: (config: CaptureToConfig) => void;

    constructor(options: CaptureToConfigModalOptions) {
        super(options.plugin.app);
        this.plugin = options.plugin;
        this.config = JSON.parse(JSON.stringify(options.config)); // Deep copy
        this.onSave = options.onSave;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.classList.add('capture-to-config-modal');
        contentEl.style.maxWidth = '700px';
        contentEl.style.margin = '0 auto';

        // Clear existing content
        contentEl.empty();

        // Header
        const header = contentEl.createEl('div', { cls: 'capture-to-config-header' });
        header.createEl('h3', { text: `${this.config.name}` });

        // Content
        const content = contentEl.createEl('div', { cls: 'capture-to-config-content' });

        // Location Section
        content.createEl('h4', { text: t('文件') });
        this.addLocationSettings(content);

        // Position Section
        content.createEl('h4', { text: t('插入位置') });
        this.addPositionSettings(content);

        // Linking Section
        content.createEl('h4', { text: t('链接') });
        this.addLinkingSettings(content);

        // Content Section
        content.createEl('h4', { text: t('内容') });   
        this.addInputMethodSettings(content);
        // 输入框选择
        this.addContentSettings(content);

        // Behavior Section
        content.createEl('h4', { text: t('行为') });
        this.addBehaviorSettings(content);

    }

    onClose() {
        const { contentEl } = this;
        // 关闭窗口时自动保存配置
        this.onSave(this.config);
        contentEl.empty();
    }

    private addLocationSettings(container: HTMLElement) {
        // Capture to active file
        new Setting(container)
            .setName(t('插入当前活动文件'))
            .setDesc(t('将内容插入到当前活动的文件中'))
            .addToggle(toggle => toggle
                .setValue(this.config.captureToActiveFile)
                .onChange(value => {
                    this.config.captureToActiveFile = value;
                    // 重新渲染设置
                    this.onOpen();
                }));

        if (!this.config.captureToActiveFile) {
            // Default capture path
            let defaultCapturePathInputEl: HTMLInputElement | null = null;
            new Setting(container)
                .setName(t('默认插入文件路径'))
                .setDesc(t('选择文件或使用格式化路径（例如：{{date}}-notes.md）'))
                .addText(text => {
                    defaultCapturePathInputEl = text.inputEl;
                    text
                        .setValue(this.config.defaultCapturePath)
                        .setPlaceholder(t('例如：{{日记}}'))
                        .onChange(value => {
                            this.config.defaultCapturePath = value;
                        });
                })
                .addButton(button => button
                    .setButtonText(t('选择'))
                    .onClick(() => {
                        new FileSelectModal(this.app, (file) => {
                            this.config.defaultCapturePath = file.path;
                            // 更新输入框值
                            if (defaultCapturePathInputEl) {
                                defaultCapturePathInputEl.value = file.path;
                            }
                        }).open();
                    }));
            // Create file if it doesn't exist
            new Setting(container)
                .setName(t('如果文件不存在则创建'))
                .addToggle(toggle => toggle
                    .setValue(this.config.createFileIfItDoesntExist.enabled)
                    .onChange(value => {
                        this.config.createFileIfItDoesntExist.enabled = value;
                        // 重新渲染设置
                        this.onOpen();
                    }));

            if (this.config.createFileIfItDoesntExist.enabled) {
                // Create with template
                new Setting(container)
                    .setName(t('使用模板创建'))
                    .setDesc(t('使用指定的模板创建文件'))
                    .addToggle(toggle => toggle
                        .setValue(this.config.createFileIfItDoesntExist.createWithTemplate)
                        .onChange(value => {
                            this.config.createFileIfItDoesntExist.createWithTemplate = value;
                            // 重新渲染设置
                            this.onOpen();
                        }));

                if (this.config.createFileIfItDoesntExist.createWithTemplate) {
                    // Template path
                    let templatePathInputEl: HTMLInputElement | null = null;
                    new Setting(container)
                        .setName(t('模板路径'))
                        .setDesc(t('选择要使用的模板文件'))
                        .addText(text => {
                            templatePathInputEl = text.inputEl;
                            text
                                .setValue(this.config.createFileIfItDoesntExist.template)
                                .setPlaceholder(t('例如：模板/日记模板'))
                                .onChange(value => {
                                    this.config.createFileIfItDoesntExist.template = value;
                                });
                        })
                        .addButton(button => button
                            .setButtonText(t('选择'))
                            .onClick(() => {
                                new FileSelectModal(this.app, (file) => {
                                    this.config.createFileIfItDoesntExist.template = file.path;
                                    // 更新输入框值
                                    if (templatePathInputEl) {
                                        templatePathInputEl.value = file.path;
                                    }
                                }).open();
                            }));
                }
            }
        }
    }

    private addPositionSettings(container: HTMLElement) {
        // Insert position dropdown
        new Setting(container)
.setName(t('插入位置'))
                .setDesc(t('选择内容的插入位置'))
                .addDropdown(dropdown => {
                    dropdown.addOption('top', t('顶部'));
                    dropdown.addOption('bottom', t('底部'));
                    dropdown.addOption('after', t('章节后'));
                
                // Determine current position
                let currentPosition = 'top';
                if (this.config.prepend) {
                    currentPosition = 'bottom';
                } else if (this.config.insertAfter.enabled) {
                    currentPosition = 'after';
                }
                
                dropdown.setValue(currentPosition)
                    .onChange(value => {
                        // Reset all position settings
                        this.config.prepend = false;
                        this.config.insertAfter.enabled = false;
                        
                        // Set selected position
                        if (value === 'bottom') {
                            this.config.prepend = true;
                        } else if (value === 'after') {
                            this.config.insertAfter.enabled = true;
                        }
                        // 重新渲染设置
                        this.onOpen();
                    });
            });

        // Settings for "after" position
        if (this.config.insertAfter.enabled) {
            // After
            new Setting(container)
                .setName(t('章节文本'))
                .setDesc(t('在匹配此文本的章节后插入内容（例如：## 章节标题）'))
                .addText(text => text
                    .setValue(this.config.insertAfter.after)
                    .onChange(value => {
                        this.config.insertAfter.after = value;
                    }));

            // Insert at end
            new Setting(container)
                .setName(t('在章节末尾插入'))
                .setDesc(t('在匹配的章节末尾插入内容'))
                .addToggle(toggle => toggle
                    .setValue(this.config.insertAfter.insertAtEnd)
                    .onChange(value => {
                        this.config.insertAfter.insertAtEnd = value;
                    }));

            // Consider subsections
            new Setting(container)
                .setName(t('考虑子章节'))
                .setDesc(t('也考虑匹配章节的子章节'))
                .addToggle(toggle => toggle
                    .setValue(this.config.insertAfter.considerSubsections)
                    .onChange(value => {
                        this.config.insertAfter.considerSubsections = value;
                    }));

            // 如果未找到则创建
            new Setting(container)
                .setName(t('如果未找到则创建'))
                .setDesc(t('如果未找到匹配的文本，则创建它'))
                .addToggle(toggle => toggle
                    .setValue(this.config.insertAfter.createIfNotFound)
                    .onChange(value => {
                        this.config.insertAfter.createIfNotFound = value;
                        // 重新渲染设置
                        this.onOpen();
                    }));

            if (this.config.insertAfter.createIfNotFound) {
                // 创建位置
                new Setting(container)
                    .setName(t('创建位置'))
                    .setDesc(t('如果未找到匹配的文本，在哪里创建它'))
                    .addDropdown(dropdown => dropdown
                        .addOption('top', t('顶部'))
                        .addOption('bottom', t('底部'))
                        .setValue(this.config.insertAfter.createIfNotFoundLocation)
                        .onChange(value => {
                            this.config.insertAfter.createIfNotFoundLocation = value as 'top' | 'bottom';
                        }));
            }
        }

        // New line capture settings
        if (this.config.captureToActiveFile) {
            new Setting(container)
                .setName(t('新行插入'))
                .addToggle(toggle => toggle
                    .setValue(this.config.newLineCapture.enabled)
                    .onChange(value => {
                        this.config.newLineCapture.enabled = value;
                        // 重新渲染设置
                        this.onOpen();
                    }));

            if (this.config.newLineCapture.enabled) {
                new Setting(container)
                    .setName(t('新行方向'))
                    .setDesc(t('在光标上方还是下方添加新行'))
                    .addDropdown(dropdown => dropdown
                        .addOption('above', t('上方'))
                        .addOption('below', t('下方'))
                        .setValue(this.config.newLineCapture.direction)
                        .onChange(value => {
                            this.config.newLineCapture.direction = value as 'above' | 'below';
                        }));
            }
        }
    }

    private addLinkingSettings(container: HTMLElement) {
        // Append link
        new Setting(container)
            .setName(t('附加链接'))
            .setDesc(t('在当前文件中附加到捕获文件的链接'))
            .addToggle(toggle => toggle
                .setValue(this.config.appendLink)
                .onChange(value => {
                    this.config.appendLink = value;
                }));
    }

    private addContentSettings(container: HTMLElement) {
        // Format enabled
        const formatEnabledSetting = new Setting(container)
            .setName(t('启用格式'))
            .addToggle(toggle => toggle
                .setValue(this.config.format.enabled)
                .onChange(value => {
                    this.config.format.enabled = value;
                }));
        
        // 自动添加创建日期
        const createdDateSetting = new Setting(container)
            .setName(t('自动添加创建日期'))
            .setDesc(t('自动为捕获的内容添加创建日期'))
            .addToggle(toggle => toggle
                .setValue(this.config.autoAddCreatedDate)
                .onChange(value => {
                    this.config.autoAddCreatedDate = value;
                }));
        
        // 自动添加截止日期
        const dueDateSetting = new Setting(container)
            .setName(t('自动添加截止日期'))
            .setDesc(t('自动为捕获的内容添加截止日期'))
            .addToggle(toggle => toggle
                .setValue(this.config.autoAddDueDate)
                .onChange(value => {
                    this.config.autoAddDueDate = value;
                    // 重新渲染设置
                    this.onOpen();
                }));
        
        // 截止日期选项
        if (this.config.autoAddDueDate) {
            new Setting(container)
                .setName(t('截止日期计算方式'))
                .setDesc(t('选择自动添加截止日期的计算方式'))
                .addDropdown(dropdown => {
                    dropdown.addOption("today", t("当天"));
                    dropdown.addOption("custom", t("自定义天数"));
                    dropdown.addOption("weekend", t("本周末"));
                    dropdown.addOption("monthEnd", t("本月底"));
                    dropdown.addOption("yearEnd", t("本年底"));
                    dropdown.setValue(this.config.dueDateOption)
                        .onChange(value => {
                            this.config.dueDateOption = value as "today" | "custom" | "weekend" | "monthEnd" | "yearEnd";
                            // 重新渲染设置
                            this.onOpen();
                        });
                });
            
            // 自定义天数输入框，只有当选择自定义天数时才显示
            if (this.config.dueDateOption === "custom") {
                new Setting(container)
                    .setName(t('自定义天数'))
                    .setDesc(t('设置自定义截止日期的天数'))
                    .addText(text => text
                        .setPlaceholder(t("输入天数"))
                        .setValue(this.config.customDueDays.toString())
                        .onChange((value) => {
                            const days = parseInt(value);
                            if (!isNaN(days)) {
                                this.config.customDueDays = days;
                            }
                        }));
            }
        }
        
        // Format
        new Setting(container)
            .setName(t('捕获格式'))
            .setDesc(t('内容的格式，支持 {{VALUE}} 等变量'));
        
        // 预览区域
        const previewSection = container.createEl('div', {
            cls: 'capture-format-preview'
        });
        previewSection.style.marginBottom = '16px';
        previewSection.style.width = '100%';
        
        const previewHeader = previewSection.createEl('div', {
            cls: 'preview-header'
        });
        previewHeader.style.fontSize = '14px';
        previewHeader.style.fontWeight = 'bold';
        previewHeader.style.marginBottom = '8px';
        previewHeader.textContent = t('预览效果：');
        
        const previewEl = previewSection.createEl('div', {
            cls: 'preview-content'
        });
        previewEl.style.padding = '12px';
        previewEl.style.border = '1px solid var(--background-modifier-border)';
        previewEl.style.borderRadius = '4px';
        previewEl.style.backgroundColor = 'var(--background-secondary)';
        previewEl.style.fontFamily = 'var(--font-editor)';
        previewEl.style.fontSize = '14px';
        previewEl.style.whiteSpace = 'pre-wrap';
        
        // 单独一行的文本区域，方便输入较多内容
        const formatSetting = container.createEl('div', {
            cls: 'capture-format-setting'
        });
        formatSetting.style.marginBottom = '16px';
        formatSetting.style.width = '100%';
        
        // 确保 format 对象和 format.format 有默认值
        if (!this.config.format) {
            this.config.format = {
                enabled: true,
                format: "{{VALUE}}\n"
            };
        } else if (!this.config.format.format) {
            this.config.format.format = "{{VALUE}}\n";
        }
        
        const textArea = formatSetting.createEl('textarea', {
            placeholder: t('输入捕获格式，例如：{{VALUE}}')
        });
        
        // 显式设置值，确保默认内容显示出来
        textArea.value = this.config.format.format;
        textArea.style.width = '100%';
        textArea.style.minHeight = '120px';
        textArea.style.padding = '8px';
        textArea.style.border = '1px solid var(--background-modifier-border)';
        textArea.style.borderRadius = '4px';
        textArea.style.fontFamily = 'var(--font-editor)';
        textArea.style.fontSize = '14px';
        
        // 变量参考面板
        this.renderVariableReference(formatSetting, textArea);
        
        // 初始化预览
        this.updatePreview(textArea, previewEl);
        
        textArea.addEventListener('input', () => {
            this.config.format.format = textArea.value;
            this.updatePreview(textArea, previewEl);
        });

        
    }

    private renderVariableReference(container: HTMLElement, textArea: HTMLTextAreaElement) {
        const details = container.createEl('details');
        details.createEl('summary', { text: t('📖 可用变量') });
        details.style.marginBottom = '8px';
        details.style.cursor = 'pointer';

        const variables = [
            { var: '{{VALUE}}', desc: t('选中的文本或手动输入的内容'), example: t('写周报') },
            { var: '{{TITLE}}', desc: t('目标文件名'), example: '2026-06-15' },
            { var: '{{DATE}}', desc: t('默认 YYYY-MM-DD'), example: '2026-06-15' },
            { var: '{{DATE:MM-DD}}', desc: t('月-日'), example: '06-15' },
            { var: '{{DATE:YYYY年MM月DD日}}', desc: t('年月日'), example: t('2026年06月15日') },
            { var: '{{DATE:YYYY-MM-DD HH:mm}}', desc: t('日期+时间'), example: '2026-06-15 14:30' },
            { var: '{{DATE:dddd}}', desc: t('星期'), example: t('星期一') },
            { var: '{{DATE:Q}}', desc: t('季度'), example: '2' },
            { var: '{{DATE:WW}}', desc: t('ISO周数'), example: '25' },
        ];

        for (const v of variables) {
            const row = details.createEl('div', { cls: 'variable-ref-row' });
            const codeEl = row.createEl('code', { text: v.var });
            row.createSpan({ text: `  ${v.desc}  ` });
            const exampleEl = row.createSpan({ text: `(${t('例')}: ${v.example})`, cls: 'variable-ref-example' });
            const btn = row.createEl('button', { text: t('插入'), cls: 'variable-insert-btn' });
            btn.addEventListener('click', () => {
                const start = textArea.selectionStart;
                const end = textArea.selectionEnd;
                const before = textArea.value.substring(0, start);
                const after = textArea.value.substring(end);
                textArea.value = before + v.var + after;
                const newCursor = start + v.var.length;
                textArea.selectionStart = textArea.selectionEnd = newCursor;
                textArea.focus();
                textArea.dispatchEvent(new Event('input'));
            });
        }
    }

    /**
     * 更新预览效果
     */
    private updatePreview(textArea: HTMLTextAreaElement, previewEl: HTMLElement) {
        const format = textArea.value || "{{VALUE}}\n";
        const previewText = format
            .replace(/\{\{TASK_TEXT\}\}/g, t("示例任务内容"))
            .replace(/\{\{DATE\}\}/g, new Date().toLocaleString());
        
        previewEl.textContent = previewText;
    }

    private addBehaviorSettings(container: HTMLElement) {
        // Open file
        if (!this.config.captureToActiveFile) {
            new Setting(container)
                .setName(t('打开文件'))
                .setDesc(t('捕获后打开文件'))
                .addToggle(toggle => toggle
                    .setValue(this.config.openFile)
                    .onChange(value => {
                        this.config.openFile = value;
                        // 重新渲染设置
                        this.onOpen();
                    }));

            if (this.config.openFile) {
                // File opening settings
                new Setting(container)
                    .setName(t('文件打开位置'))
                    .addDropdown(dropdown => dropdown
                        .addOption('reuse', t('重用当前标签'))
                        .addOption('tab', t('新标签'))
                        .addOption('split', t('拆分'))
                        .addOption('window', t('新窗口'))
                        .addOption('left-sidebar', t('左侧边栏'))
                        .addOption('right-sidebar', t('右侧边栏'))
                        .setValue(this.config.fileOpening.location)
                        .onChange(value => {
                            this.config.fileOpening.location = value as any;
                        }));

                new Setting(container)
                    .setName(t('拆分方向'))
                    .addDropdown(dropdown => dropdown
                        .addOption('vertical', t('垂直'))
                        .addOption('horizontal', t('水平'))
                        .setValue(this.config.fileOpening.direction)
                        .onChange(value => {
                            this.config.fileOpening.direction = value as 'vertical' | 'horizontal';
                        }));

                new Setting(container)
                    .setName(t('打开模式'))
                    .addDropdown(dropdown => dropdown
                        .addOption('preview', t('预览'))
                        .addOption('source', t('源码'))
                        .addOption('live', t('实时'))
                        .addOption('live-preview', t('实时预览'))
                        .addOption('default', t('默认'))
                        .setValue(this.config.fileOpening.mode)
                        .onChange(value => {
                            this.config.fileOpening.mode = value as any;
                        }));

                new Setting(container)
                    .setName(t('获取焦点'))
                    .addToggle(toggle => toggle
                        .setValue(this.config.fileOpening.focus)
                        .onChange(value => {
                            this.config.fileOpening.focus = value;
                        }));
            }
        }
    }



    private addInputMethodSettings(container: HTMLElement) {
        // Input Method
        new Setting(container)
            .setName(t('输入方式'))
            .setDesc(t('选择触发此配置时的输入方式'))
            .addDropdown(dropdown => {
                dropdown.addOption('single-line', t('单行输入'))
                    .addOption('multi-line', t('多行输入'))
                    .addOption('none', t('不输入'))
                    .setValue(this.config.inputMethod || 'single-line')
                    .onChange(value => {
                        this.config.inputMethod = value as "single-line" | "multi-line" | "none";
                    });
            });
    }
}