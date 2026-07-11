import { MarkdownView, Notice, type TFile } from "obsidian";
import type { App } from "obsidian";
import type { IChoiceExecutor } from "../IChoiceExecutor";
import type ICaptureChoice from "../types/choices/ICaptureChoice";
import { templaterParseTemplate } from "../utilityObsidian";
import type MyPlugin from "../main";
import { PromptModal } from "../modals/PromptModal";
import { formatDate } from "../utils/dateUtils";
import { t } from '../i18n';

function localDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export class CaptureChoiceFormatter {
	private app: App;
	private plugin: MyPlugin;
	private choiceExecutor: IChoiceExecutor;
	private choice: ICaptureChoice | null = null;
	private file: TFile | null = null;
	private fileContent = "";
	private sourcePath: string | null = null;
	private useSelectionAsCaptureValue = true;
	private templaterProcessed = false;
	private title: string = "";
	private inputMethod: 'single-line' | 'multi-line' | 'none' = 'single-line';
	private captureValue: string | null = null;

	constructor(app: App, plugin: MyPlugin, choiceExecutor: IChoiceExecutor) {
		this.app = app;
		this.plugin = plugin;
		this.choiceExecutor = choiceExecutor;
	}

	public setInputMethod(method: 'single-line' | 'multi-line' | 'none') {
		this.inputMethod = method;
	}

	public setDestinationFile(file: TFile): void {
		this.file = file;
		this.sourcePath = file.path;
	}

	public setDestinationSourcePath(path: string): void {
		this.sourcePath = path;
		this.file = null;
	}

	public setUseSelectionAsCaptureValue(value: boolean): void {
		this.useSelectionAsCaptureValue = value;
	}

	public setTitle(title: string): void {
		this.title = title;
	}

	public setChoice(choice: ICaptureChoice | null): void {
		this.choice = choice;
	}

	public setCaptureValue(value: string): void {
		this.captureValue = value;
	}

	public async formatContentOnly(input: string): Promise<string> {
		let formatted = input;
		// Replace {{VALUE}} with selected text or user input
		let taskText = "";
		if (formatted.includes("{{VALUE}}")) {
			const selectedText = await this.getSelectedText();
			taskText = selectedText.trim() || "";

			// 计算自动添加的日期字符串（放在 {{VALUE}} 替换之前，确保日期紧跟在内容后）
			let dateString = "";
			if (this.choice && taskText) {
				// 自动添加创建日期
				if (this.choice.autoAddCreatedDate) {
					const createdDate = localDateStr(new Date());
					dateString += ` ➕ ${createdDate}`;
				}

				// 自动添加截止日期
				if (this.choice.autoAddDueDate) {
					let dueDate = new Date();
					switch (this.choice.dueDateOption) {
						case "today":
							// 使用当前日期
							break;
						case "custom":
							// 自定义天数
							dueDate.setDate(dueDate.getDate() + (this.choice.customDueDays || 1));
							break;
						case "weekend":
							// 本周末（周六）
							const dayOfWeek = dueDate.getDay();
							const daysToWeekend = dayOfWeek === 0 ? 6 : 6 - dayOfWeek;
							dueDate.setDate(dueDate.getDate() + daysToWeekend);
							break;
						case "monthEnd":
							// 本月底
							dueDate.setMonth(dueDate.getMonth() + 1, 0);
							break;
						case "yearEnd":
							// 本年底
							dueDate = new Date(dueDate.getFullYear(), 11, 31);
							break;
					}
					const dueDateStr = localDateStr(dueDate);
					dateString += ` 📅 ${dueDateStr}`;
				}
			}

			formatted = formatted.replace(/\{\{VALUE\}\}/g, taskText + dateString);
		}
		// Replace {{TITLE}} with file title
		if (formatted.includes("{{TITLE}}")) {
			formatted = formatted.replace(/\{\{TITLE\}\}/g, this.title);
		}
		
		// Replace {{DATE}} with target date
		// Support both {{DATE}} and {{DATE:format}} formats
		const targetDate = (this.choice as any)?._targetDate || new Date();
		const dateRegex = /\{\{DATE(?::([^}]+))?\}\}/gi;
		formatted = formatted.replace(dateRegex, (match, format) => {
			if (format) {
				// Handle custom format
				try {
					return formatDate(targetDate, format);
				} catch (error) {
					// Fallback to ISO date if format is invalid
					return localDateStr(targetDate);
				}
			} else {
				// Default format: YYYY-MM-DD
				return localDateStr(targetDate);
			}
		});

		return formatted;
	}

	public async formatContentWithFile(
		input: string,
		choice: ICaptureChoice,
		fileContent: string,
		file: TFile,
	): Promise<string> {
		this.choice = choice;
		this.file = file;
		this.fileContent = fileContent;

		let formatted = input;
		
		// Run templater if needed
		if (!this.templaterProcessed && this.file) {
			const templaterFormatted = await templaterParseTemplate(
				this.app,
				formatted,
				this.file,
			);
			if (templaterFormatted) {
				formatted = templaterFormatted;
			}
			this.templaterProcessed = true;
		}

		const formattedContentIsEmpty = formatted.trim() === "";
		if (formattedContentIsEmpty) return this.fileContent;

		if (choice.prepend) {
			return `${this.fileContent}\n${formatted}`;
		}

		if (choice.insertAfter.enabled) {
			return await this.insertAfterHandler(formatted);
		}

		const frontmatterEndPosition = this.getFrontmatterEndPosition(this.file, this.fileContent);
		if (frontmatterEndPosition === null || frontmatterEndPosition < 0) {
			return `${formatted}${this.fileContent}`;
		}

		return this.insertTextAfterPositionInBody(
			formatted,
			this.fileContent,
			frontmatterEndPosition,
		);
	}

	public async formatFileName(fileName: string, choiceName: string): Promise<string> {
		// 获取目标日期，如果没有则使用当前日期
		const targetDate = (this.choice as any)?._targetDate || new Date();
		
		// Replace {{DATE}} or {{date}} with target date
		if (fileName.includes("{{DATE}}") || fileName.includes("{{date}}")) {
			const date = targetDate.toISOString().split("T")[0];
			fileName = fileName.replace(/\{\{DATE\}\}/gi, date || '');
		}
		// Replace {{CHOICE_NAME}} with choice name
		if (fileName.includes("{{CHOICE_NAME}}")) {
			fileName = fileName.replace(/\{\{CHOICE_NAME\}\}/g, choiceName);
		}
		
		// 替换 {{日记}} 为 ${dailyNote.savePath}/${dailyFileName}.md
		const dailySettings = this.plugin.settings.dailyNote;
		if (dailySettings) {
			// 使用目标日期
			const dailyFileName = formatDate(targetDate, dailySettings.fileNameFormat);
			const dailyNotePath = `${dailySettings.savePath}/${dailyFileName}.md`;
			fileName = fileName.replace(/\{\{日记\}\}/g, dailyNotePath);
			
			// 替换 {{日记模板}} 为 ${dailySettings.templatePath}
			fileName = fileName.replace(/\{\{日记模板\}\}/g, dailySettings.templatePath);
		}
		
		// 替换 {{周报}} 为 ${weeklyNote.savePath}/${weeklyFileName}.md
		const weeklySettings = this.plugin.settings.weeklyNote;
		if (weeklySettings) {
			// 使用目标日期
			const weeklyFileName = formatDate(targetDate, weeklySettings.fileNameFormat);
			const weeklyNotePath = `${weeklySettings.savePath}/${weeklyFileName}.md`;
			fileName = fileName.replace(/\{\{周报\}\}/g, weeklyNotePath);
			
			// 替换 {{周报模板}} 为 ${weeklySettings.templatePath}
			fileName = fileName.replace(/\{\{周报模板\}\}/g, weeklySettings.templatePath);
		}
		
		// 替换 {{月报}} 为 ${monthlyNote.savePath}/${monthlyFileName}.md
		const monthlySettings = this.plugin.settings.monthlyNote;
		if (monthlySettings) {
			// 使用目标日期
			const monthlyFileName = formatDate(targetDate, monthlySettings.fileNameFormat);
			const monthlyNotePath = `${monthlySettings.savePath}/${monthlyFileName}.md`;
			fileName = fileName.replace(/\{\{月报\}\}/g, monthlyNotePath);
			
			// 替换 {{月报模板}} 为 ${monthlySettings.templatePath}
			fileName = fileName.replace(/\{\{月报模板\}\}/g, monthlySettings.templatePath);
		}
		
		// 替换 {{季报}} 为 ${quarterlyNote.savePath}/${quarterlyFileName}.md
		const quarterlySettings = this.plugin.settings.quarterlyNote;
		if (quarterlySettings) {
			// 使用目标日期
			const quarterlyFileName = formatDate(targetDate, quarterlySettings.fileNameFormat);
			const quarterlyNotePath = `${quarterlySettings.savePath}/${quarterlyFileName}.md`;
			fileName = fileName.replace(/\{\{季报\}\}/g, quarterlyNotePath);
			
			// 替换 {{季报模板}} 为 ${quarterlySettings.templatePath}
			fileName = fileName.replace(/\{\{季报模板\}\}/g, quarterlySettings.templatePath);
		}
		
		// 替换 {{年报}} 为 ${yearlyNote.savePath}/${yearlyFileName}.md
		const yearlySettings = this.plugin.settings.yearlyNote;
		if (yearlySettings) {
			// 使用目标日期
			const yearlyFileName = formatDate(targetDate, yearlySettings.fileNameFormat);
			const yearlyNotePath = `${yearlySettings.savePath}/${yearlyFileName}.md`;
			fileName = fileName.replace(/\{\{年报\}\}/g, yearlyNotePath);
			
			// 替换 {{年报模板}} 为 ${yearlySettings.templatePath}
			fileName = fileName.replace(/\{\{年报模板\}\}/g, yearlySettings.templatePath);
		}
		
		// 替换 {{闪念}} 为 ${fleetingNote.savePath}/${fleetingNoteFileName}.md
		const fleetingNoteSettings = this.plugin.settings.fleetingNote;
		if (fleetingNoteSettings) {
			// 使用目标日期
			const fleetingNoteFileName = formatDate(targetDate, fleetingNoteSettings.fileNameFormat);
			const fleetingNotePath = `${fleetingNoteSettings.savePath}/${fleetingNoteFileName}.md`;
			fileName = fileName.replace(/\{\{闪念\}\}/g, fleetingNotePath);
			
			// 替换 {{闪念模板}} 为 ${fleetingNoteSettings.templatePath}
			fileName = fileName.replace(/\{\{闪念模板\}\}/g, fleetingNoteSettings.templatePath);
		}
		
		// 检查是否有未解析的路径变量
		const unresolved = fileName.match(/\{\{[^}]+\}\}/g);
		if (unresolved) {
			new Notice(`未解析的模板变量: ${unresolved.join(', ')}，请检查设置`, 5000);
		}
		
		return fileName;
	}



	private async getSelectedText(): Promise<string> {
		if (this.captureValue !== null) {
			return this.captureValue;
		}

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		let selection = "";
		if (activeView) {
			const editor = activeView.editor;
			selection = editor.getSelection();
		}

		if (selection.trim()) {
			return selection;
		}

		// 如果输入方式为"none"，直接返回空字符串
		if (this.inputMethod === 'none') {
			return "";
		}

		// No selection, show prompt modal based on input method
		return new Promise<string>((resolve) => {
			const modal = new PromptModal({
				app: this.app,
				title: this.choice?.name || t('输入内容'),
				placeholder: t('输入内容'),
				inputMethod: this.inputMethod as 'single-line' | 'multi-line',
				onSubmit: (value) => {
					resolve(value);
				}
			});
			modal.open();
		});
	}

	private getFrontmatterEndPosition(file: TFile, fallbackContent?: string): number | null {
		const fileCache = this.app.metadataCache.getFileCache(file);

		if (fileCache?.frontmatterPosition) {
			return fileCache.frontmatterPosition.end.line;
		}

		if (fallbackContent) {
			const inferred = this.inferFrontmatterEndLineFromContent(fallbackContent);
			if (inferred !== null) {
				return inferred;
			}
		}

		return -1;
	}

	private inferFrontmatterEndLineFromContent(content: string): number | null {
		const lines = content.split(/\r?\n/);
		let frontmatterEndLine = -1;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]?.trim();
			if (line === "---" && frontmatterEndLine === -1) {
				frontmatterEndLine = i;
			} else if (line === "---" && frontmatterEndLine !== -1) {
				return i;
			}
		}

		return null;
	}

	private insertTextAfterPositionInBody(
		text: string,
		body: string,
		pos: number,
	): string {
		if (pos === -1) {
			return `${text}\n${body}`;
		}

		const splitContent = body.split("\n");
		const pre = splitContent.slice(0, pos + 1).join("\n");
		const post = splitContent.slice(pos + 1).join("\n");

		const textWithNewline = text.endsWith("\n") ? text : text + "\n";
		return `${pre}\n${textWithNewline}${post}`;
	}

	private async insertAfterHandler(formatted: string) {
		if (!this.choice || !this.choice.insertAfter) {
			return this.fileContent;
		}

		const targetString = this.choice.insertAfter.after;

		if (this.choice.insertAfter?.inline) {
			return this.insertAfterInlineHandler(formatted, targetString);
		}

		const fileContentLines = this.fileContent.split("\n");
		let targetPosition = this.findInsertAfterIndex(fileContentLines, targetString);
		const targetNotFound = targetPosition === -1;

		if (targetNotFound) {
			if (this.choice.insertAfter?.createIfNotFound) {
				return await this.createInsertAfterIfNotFound(formatted);
			}
			return this.fileContent;
		}

		if (this.choice.insertAfter?.insertAtEnd) {
			targetPosition = this.findEndOfSection(fileContentLines, targetPosition);
		} else {
			// When not inserting at end, insert immediately after the heading, ignoring blank lines
			// This fixes the issue where content was being inserted after blank lines instead of right after the heading
			targetPosition = targetPosition; // Insert right after the heading line
		}

		return this.insertTextAfterPositionInBody(
			formatted,
			this.fileContent,
			targetPosition,
		);
	}

	private findInsertAfterIndex(lines: string[], rawTarget: string): number {
		const target = rawTarget.replace("\\n", "").trimEnd();
		let partialIndex = -1;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]?.trimStart();

			// Exact match
			if (line === target) return i;

			// Prefix match
			if (line && line.startsWith(target)) {
				const suffix = line.slice(target.length);
				if (/^\s*$/.test(suffix)) return i;
				if (partialIndex === -1) {
					partialIndex = i;
				}
				continue;
			}

			// Substring match
			if (line) {
				const targetIndex = line.indexOf(target);
				if (targetIndex !== -1) {
					const suffix = line.slice(targetIndex + target.length);
					if (/^\s*$/.test(suffix)) return i;
					if (partialIndex === -1) {
						partialIndex = i;
					}
				}
			}
		}

		return partialIndex;
	}

	private findEndOfSection(lines: string[], startIndex: number): number {
		let position = startIndex;
		let headingLevel = this.getHeadingLevel(lines[startIndex] || '');

		if (headingLevel === -1) return startIndex;

		// 首先找到章节的末尾（遇到相同或更高优先级的标题时停止）
		let endIndex = startIndex;
		for (let i = startIndex + 1; i < lines.length; i++) {
			const currentLevel = this.getHeadingLevel(lines[i] || '');
			if (currentLevel !== -1 && currentLevel <= headingLevel) {
				break;
			}
			endIndex = i;
		}

		// 然后从末尾向前查找，找到第一个非空行
		position = endIndex;
		for (let i = endIndex; i > startIndex; i--) {
			const line = lines[i];
			if (line && line.trim().length > 0) {
				position = i;
				break;
			}
		}

		return position;
	}

	private getHeadingLevel(line: string): number {
		const match = line.match(/^\s{0,3}(#{1,6})\s+/);
		if (!match) return -1;
		return match[1]?.length || -1;
	}

	private async insertAfterInlineHandler(
		formatted: string,
		targetString: string,
	): Promise<string> {
		const matchIndex = this.fileContent.indexOf(targetString);
		if (matchIndex === -1) {
			if (this.choice?.insertAfter?.createIfNotFound) {
				return await this.createInlineInsertAfterIfNotFound(formatted, targetString);
			}
			return this.fileContent;
		}

		const matchEnd = matchIndex + targetString.length;
		if (this.choice?.insertAfter?.replaceExisting) {
			const endOfLine = this.getInlineEndOfLine(matchEnd);
			return this.fileContent.slice(0, matchEnd) + formatted + this.fileContent.slice(endOfLine);
		}

		return this.fileContent.slice(0, matchEnd) + formatted + this.fileContent.slice(matchEnd);
	}

	private getInlineEndOfLine(startIndex: number): number {
		const newlineIndex = this.fileContent.indexOf("\n", startIndex);
		if (newlineIndex === -1) return this.fileContent.length;
		if (newlineIndex > 0 && this.fileContent[newlineIndex - 1] === "\r") {
			return newlineIndex - 1;
		}
		return newlineIndex;
	}

	private async createInsertAfterIfNotFound(formatted: string) {
		if (!this.choice || !this.choice.insertAfter) {
			return this.fileContent;
		}

		const insertAfterLine = this.choice.insertAfter.after;
		const insertAfterLineAndFormatted = `${insertAfterLine}\n${formatted}`;

		if (this.choice.insertAfter?.createIfNotFoundLocation === "top") {
			const frontmatterEndPosition = this.getFrontmatterEndPosition(this.file!, this.fileContent);
			return this.insertTextAfterPositionInBody(
				insertAfterLineAndFormatted,
				this.fileContent,
				frontmatterEndPosition || -1,
			);
		}

		if (this.choice.insertAfter?.createIfNotFoundLocation === "bottom") {
			return `${this.fileContent}\n${insertAfterLineAndFormatted}`;
		}

		return this.fileContent;
	}

	private async createInlineInsertAfterIfNotFound(
		formatted: string,
		targetString: string,
	): Promise<string> {
		const insertAfterLineAndFormatted = `${targetString}${formatted}`;

		if (this.choice?.insertAfter?.createIfNotFoundLocation === "top") {
			const frontmatterEndPosition = this.getFrontmatterEndPosition(this.file!, this.fileContent);
			return this.insertTextAfterPositionInBody(
				insertAfterLineAndFormatted,
				this.fileContent,
				frontmatterEndPosition || -1,
			);
		}

		if (this.choice?.insertAfter?.createIfNotFoundLocation === "bottom") {
			return `${this.fileContent}\n${insertAfterLineAndFormatted}`;
		}

		return this.fileContent;
	}
}
