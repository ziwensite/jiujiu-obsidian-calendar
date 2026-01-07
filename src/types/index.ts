export interface Task {
    text: string;
    completed: boolean;
    filePath: string;
    dueDate?: Date;
    rawText: string;
}

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

export type TaskStatusFilter = 'all' | 'todo' | 'done';
