import { App } from 'obsidian';

// 检查笔记是否存在
export async function noteExists(app: App, path: string): Promise<boolean> {
    const file = app.vault.getAbstractFileByPath(path);
    return file !== null;
}

// 获取模板内容
export async function getTemplateContent(app: App, templatePath: string): Promise<string> {
    try {
        const file = app.vault.getAbstractFileByPath(`${templatePath}.md`);
        if (file && 'stat' in file) {
            return await app.vault.read(file as any);
        }
    } catch (error) {
        console.error('Failed to read template:', error);
    }
    return '';
}

// 新建或打开笔记
export async function createOrOpenNote(
    app: App, 
    savePath: string, 
    fileName: string, 
    templatePath: string
): Promise<void> {
    const fullPath = `${savePath}/${fileName}.md`;
    
    if (await noteExists(app, fullPath)) {
        // 打开现有笔记
        const file = app.vault.getAbstractFileByPath(fullPath);
        if (file && 'stat' in file) {
            const leaf = app.workspace.getLeaf(false);
            await leaf.openFile(file as any);
        }
    } else {
        // 新建笔记
        const templateContent = await getTemplateContent(app, templatePath);
        const file = await app.vault.create(fullPath, templateContent);
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
    }
}