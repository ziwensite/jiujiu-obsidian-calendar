import { Notice, type App, TFile } from "obsidian";
import { t } from "../i18n";
import type { IChoiceExecutor } from "../IChoiceExecutor";
import { normalizeAppendLinkOptions, type AppendLinkOptions } from "../types/linkPlacement";
import { getCaptureAction, type CaptureAction } from "./captureAction";
import { CaptureChoiceFormatter } from "../formatters/captureChoiceFormatter";
import { appendToCurrentLine, getMarkdownFilesInFolder, getMarkdownFilesWithTag, getTemplaterPlugin, insertFileLinkToActiveView, insertOnNewLineAbove, insertOnNewLineBelow, isTemplaterTriggerOnCreateEnabled, jumpToNextTemplaterCursorIfPossible, isFolder, openExistingFileTab, openFile, overwriteTemplaterOnce, templaterParseTemplate, waitForTemplaterTriggerOnCreateToComplete } from "../utilityObsidian";
import type ICaptureChoice from "../types/choices/ICaptureChoice";
import type MyPlugin from "../main";

const DEFAULT_NOTICE_DURATION = 4000;

export class CaptureChoiceEngine {
	choice: ICaptureChoice;
	private formatter: CaptureChoiceFormatter;
	private readonly plugin: MyPlugin;

	constructor(
		app: App,
		plugin: MyPlugin,
		choice: ICaptureChoice,
		private choiceExecutor: IChoiceExecutor,
	) {
		this.choice = choice;
		this.plugin = plugin;
		this.formatter = new CaptureChoiceFormatter(app, plugin, choiceExecutor);
		// Set input method if provided
		if ((choice as any).inputMethod) {
			this.formatter.setInputMethod((choice as any).inputMethod);
		}
		// Set choice so formatters can use it for target date
		this.formatter.setChoice(choice);
	}

	public setCaptureValue(value: string): void {
		this.formatter.setCaptureValue(value);
	}

	private showSuccessNotice(
		file: TFile,
		{ wasNewFile, action }: { wasNewFile: boolean; action: CaptureAction },
	) {
		const fileName = `'${file.basename}'`;

		if (wasNewFile) {
			new Notice(
				`Created and captured to ${fileName}`,
				DEFAULT_NOTICE_DURATION,
			);
			return;
		}

		let msg = "";
		switch (action) {
			case "currentLine":
				msg = `Captured to current line in ${fileName}`;
				break;
			case "prepend":
			case "activeFileTop":
				msg = `Captured to top of ${fileName}`;
				break;
			case "append":
				msg = `Captured to ${fileName}`;
				break;
			case "insertAfter": {
				const heading = this.choice.insertAfter.after;
				msg = heading
					? `Captured to ${fileName} under '${heading}'`
					: `Captured to ${fileName}`;
				break;
			}
		}

		new Notice(msg, DEFAULT_NOTICE_DURATION);
	}

	async run(): Promise<void> {
		try {
			const linkOptions = normalizeAppendLinkOptions(this.choice.appendLink);
			const useSelectionAsCaptureValue = this.choice.useSelectionAsCaptureValue ?? true;
			this.formatter.setUseSelectionAsCaptureValue(useSelectionAsCaptureValue);

			const filePath = await this.getFormattedPathToCaptureTo(
				this.choice.captureToActiveFile,
			);
			const content = this.getCaptureContent();

			let getFileAndAddContentFn: typeof this.onFileExists;
			const fileAlreadyExists = await this.fileExists(filePath);

			if (fileAlreadyExists) {
				getFileAndAddContentFn = this.onFileExists.bind(
					this,
				) as typeof this.onFileExists;
			} else if (this.choice?.createFileIfItDoesntExist?.enabled) {
				getFileAndAddContentFn = ((path, capture, _options) =>
					this.onCreateFileIfItDoesntExist(path, capture, linkOptions)
				) as typeof this.onCreateFileIfItDoesntExist;
			} else {
				console.warn(
					`The file ${filePath} does not exist and "Create file if it doesn't exist" is disabled.`,
				);
				return;
			}

			const { file, newFileContent, captureContent } = await getFileAndAddContentFn(filePath, content);

			const action = getCaptureAction(this.choice);
			const isEditorInsertionAction =
				action === "currentLine" ||
				action === "newLineAbove" ||
				action === "newLineBelow";

			// Handle capture to active file with special actions
			// If the file was just created, we should use vault.modify instead of editor insertion
			if (isEditorInsertionAction && fileAlreadyExists) {
				// Parse Templater syntax in the capture content
				if (captureContent.includes('<%') && !getTemplaterPlugin(this.plugin.app)) {
					new Notice(t('模板包含 <% tp %> 语法，请安装 Templater 插件以启用完整模板功能'), 5000);
				}
				const content = await templaterParseTemplate(
					this.plugin.app,
					captureContent,
					file,
				);

				switch (action) {
					case "currentLine":
						appendToCurrentLine(content, this.plugin.app);
						break;
					case "newLineAbove":
						insertOnNewLineAbove(content, this.plugin.app);
						break;
					case "newLineBelow":
						insertOnNewLineBelow(content, this.plugin.app);
						break;
				}
			} else {
				await this.plugin.app.vault.modify(file, newFileContent);
				if (this.choice.templater?.afterCapture === "wholeFile") {
					await overwriteTemplaterOnce(this.plugin.app, file);
				}
			}

			// Show success notification
			this.showSuccessNotice(file, {
				wasNewFile: !fileAlreadyExists,
				action,
			});

			if (linkOptions.enabled) {
				insertFileLinkToActiveView(this.plugin.app, file, linkOptions);
			}

			if (this.choice.openFile && file) {
				const fileOpening = this.choice.fileOpening;
				const focus = fileOpening.focus ?? true;
				const openExistingTab = openExistingFileTab(this.plugin.app, file, focus);

				if (!openExistingTab) {
					await openFile(this.plugin.app, file, fileOpening);
				}

				await jumpToNextTemplaterCursorIfPossible(this.plugin.app, file);
			}
		} catch (err) {
			console.error(`Error running capture choice "${this.choice.name}":`, err);
			new Notice(`Error running capture choice: ${(err as Error).message}`, DEFAULT_NOTICE_DURATION);
		}
	}

	private getCaptureContent(): string {
		let content: string;

		if (!this.choice.format.enabled) content = "{{VALUE}}";
		else content = this.choice.format.format;

		return content;
	}

	private async getFormattedPathToCaptureTo(
		shouldCaptureToActiveFile: boolean,
	): Promise<string> {
		if (shouldCaptureToActiveFile) {
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (!activeFile) {
				throw new Error("Cannot capture to active file - no active file.");
			}

			return activeFile.path;
		}

		const captureTo = this.choice.captureTo;
		const formattedCaptureTo = await this.formatFilePath(captureTo);

		// Removing the trailing slash from the capture to path
		const folderPath = formattedCaptureTo.replace(/^\/$|\/\.md$|^\.md$/, "");
		// Empty string means we suggest to capture anywhere in the vault
		const captureAnywhereInVault = folderPath === "";
		const shouldCaptureToFolder =
			captureAnywhereInVault || isFolder(this.plugin.app, folderPath);
		const shouldCaptureWithTag = formattedCaptureTo.startsWith("#");

		if (shouldCaptureToFolder) {
			return this.selectFileInFolder(folderPath, captureAnywhereInVault);
		}

		if (shouldCaptureWithTag) {
			const tag = formattedCaptureTo.replace(/\.md$/, "");
			return this.selectFileWithTag(tag);
		}

		return formattedCaptureTo;
	}

	private async selectFileInFolder(
		folderPath: string,
		captureAnywhereInVault: boolean,
	): Promise<string> {
		const folderPathSlash =
			folderPath.endsWith("/") || captureAnywhereInVault
				? folderPath
				: `${folderPath}/`;
		const filesInFolder = getMarkdownFilesInFolder(this.plugin.app, folderPathSlash);

		if (filesInFolder.length === 0) {
			throw new Error(`Folder ${folderPathSlash} is empty.`);
		}

		// For simplicity, just return the first file in the folder
		// In a full implementation, you would show a file picker
		return filesInFolder.length > 0 ? (filesInFolder[0] as any).path : '';
	}

	private async selectFileWithTag(tag: string): Promise<string> {
		const tagWithHash = tag.startsWith("#") ? tag : `#${tag}`;
		const filesWithTag = getMarkdownFilesWithTag(this.plugin.app, tagWithHash);

		if (filesWithTag.length === 0) {
			throw new Error(`No files with tag ${tag}.`);
		}

		// For simplicity, just return the first file with the tag
		// In a full implementation, you would show a file picker
		return filesWithTag.length > 0 ? (filesWithTag[0] as any).path : '';
	}

	private async onFileExists(
		filePath: string,
		content: string,
	): Promise<{
		file: TFile;
		newFileContent: string;
		captureContent: string;
	}> {
		const file: TFile = this.getFileByPath(filePath);
		if (!file) throw new Error("File not found");

		// Set the title to the existing file's basename
		this.formatter.setTitle(file.basename);

		// Set the choice so formatters can use it for title
		this.formatter.setChoice(this.choice);

		// Set the destination file so formatters can generate proper relative links
		this.formatter.setDestinationFile(file);

		// First format pass...
		const formatted = await this.formatter.formatContentOnly(content);

		const fileContent: string = await this.plugin.app.vault.read(file);
		// Second format pass, with the file content...
		const formattedFileContent: string = await this.formatter.formatContentWithFile(
			formatted,
			this.choice,
			fileContent,
			file,
		);

		return { file, newFileContent: formattedFileContent, captureContent: formatted };
	}

	private async onCreateFileIfItDoesntExist(
		filePath: string,
		captureContent: string,
		linkOptions?: AppendLinkOptions,
	): Promise<{
		file: TFile;
		newFileContent: string;
		captureContent: string;
	}> {
		// Extract filename without extension from the full path
		const fileBasename = filePath.split("/").pop()?.replace(/\.md$/, "") || "";
		this.formatter.setTitle(fileBasename);

		// Set the choice so formatters can use it for title
		this.formatter.setChoice(this.choice);

		// Set the destination path so formatters can generate proper relative links
		this.formatter.setDestinationSourcePath(filePath);

		// First formatting pass: resolve placeholders and prompt for user input
		const formattedCaptureContent: string = await this.formatter.formatContentOnly(captureContent);

		let fileContent = "";
		if (this.choice.createFileIfItDoesntExist.createWithTemplate) {
			// 获取模板路径
			let templatePath = this.choice.createFileIfItDoesntExist.template;
			if (templatePath) {
				try {
					// 先格式化模板路径，替换其中的变量
					templatePath = await this.formatter.formatFileName(templatePath, this.choice.name);
					
					// 确保模板路径有 .md 扩展名
					if (!templatePath.endsWith('.md')) {
						templatePath += '.md';
					}
					
					// 尝试读取模板文件内容
					const templateFile = this.plugin.app.vault.getAbstractFileByPath(templatePath);
					if (templateFile && templateFile instanceof TFile) {
						fileContent = await this.plugin.app.vault.read(templateFile);
					} else {
						fileContent = "";
					}
				} catch (error) {
					fileContent = "";
				}
			}
		}

		// Create the new file with the (optional) template content
		const file: TFile = await this.plugin.app.vault.create(filePath, fileContent);

		// Process Templater commands in the template if a template was used
		if (
			this.choice.createFileIfItDoesntExist.createWithTemplate &&
			fileContent
		) {
			if (fileContent.includes('<%') && !getTemplaterPlugin(this.plugin.app)) {
				new Notice(t('模板文件包含 <% tp %> 语法，请安装 Templater 插件以启用完整模板功能'), 5000);
			}
			await overwriteTemplaterOnce(this.plugin.app, file);
		} else if (isTemplaterTriggerOnCreateEnabled(this.plugin.app)) {
			await waitForTemplaterTriggerOnCreateToComplete(this.plugin.app, file);
		}

		// Read the file fresh from disk
		const updatedFileContent: string = await this.plugin.app.vault.read(file);
		// Second formatting pass: embed the already-resolved capture content into the newly created file
		const newFileContent: string = await this.formatter.formatContentWithFile(
			formattedCaptureContent,
			this.choice,
			updatedFileContent,
			file,
		);

		return { file, newFileContent, captureContent: formattedCaptureContent };
	}

	private async formatFilePath(captureTo: string) {
		const formattedCaptureTo: string = await this.formatter.formatFileName(
			captureTo,
			this.choice.name,
		);

		return this.normalizeMarkdownFilePath("", formattedCaptureTo);
	}

	private normalizeMarkdownFilePath(basePath: string, fileName: string): string {
		if (!fileName.endsWith(".md")) {
			fileName += ".md";
		}
		return basePath ? `${basePath}/${fileName}` : fileName;
	}

	private async fileExists(path: string): Promise<boolean> {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		return file !== null;
	}

	private getFileByPath(path: string): TFile {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`File not found: ${path}`);
		}
		return file;
	}
}
