export interface NoteTemplateSettings {
    savePath: string;
    templatePath: string;
    fileNameFormat: string;
}

export interface TaskInsertSettings {
    insertSection: string;
    insertPosition: "first" | "last";
}

export interface CreateFileIfItDoesntExist {
    enabled: boolean;
    createWithTemplate: boolean;
    template: string;
}

export interface FormatSettings {
    enabled: boolean;
    format: string;
}

export interface InsertAfterSettings {
    enabled: boolean;
    after: string;
    insertAtEnd: boolean;
    considerSubsections: boolean;
    createIfNotFound: boolean;
    createIfNotFoundLocation: "top" | "bottom";
}

export interface NewLineCaptureSettings {
    enabled: boolean;
    direction: "above" | "below";
}

export interface FileOpeningSettings {
    location: "reuse" | "tab" | "split" | "window" | "left-sidebar" | "right-sidebar";
    direction: "vertical" | "horizontal";
    mode: "preview" | "source" | "live" | "live-preview" | "default";
    focus: boolean;
}

export interface CaptureToConfig {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    defaultCapturePath: string;
    captureToActiveFile: boolean;
    hotkey: {
        modifiers: string[];
        key: string;
    } | null;
    inputMethod: "single-line" | "multi-line" | "none";
    createFileIfItDoesntExist: CreateFileIfItDoesntExist;
    format: FormatSettings;
    prepend: boolean;
    appendLink: boolean;
    autoAddCreatedDate: boolean;
    autoAddDueDate: boolean;
    dueDateOption: "today" | "custom" | "weekend" | "monthEnd" | "yearEnd";
    customDueDays: number;
    insertAfter: InsertAfterSettings;
    newLineCapture: NewLineCaptureSettings;
    openFile: boolean;
    fileOpening: FileOpeningSettings;
}

export interface CaptureToSettings {
    enabled: boolean;
    fleetingNoteConfigId: string;
    recordConfigId: string;
    taskConfigId: string;
    configs: CaptureToConfig[];
}

export interface TaskSettings {
    captureToSettings: CaptureToSettings;
    recurrenceSettings: {
        newTaskPosition: "above" | "below";
    };
    enableTaskPropertyHints: boolean;
    taskClickEdit: boolean;
}

export interface TaskFilterSettings {
    customFilter: string;
}

export interface CustomLabel {
    enabled: boolean;
    labelText: string;
    actionType: "systemCommand" | "openFile";
    systemCommand: string;
    filePath: string;
}

export interface MoreLabelSettings {
    lb1: CustomLabel;
    lb2: CustomLabel;
}

export interface MyPluginSettings {
    fleetingNote: NoteTemplateSettings;
    dailyNote: NoteTemplateSettings;
    weeklyNote: NoteTemplateSettings;
    monthlyNote: NoteTemplateSettings;
    quarterlyNote: NoteTemplateSettings;
    yearlyNote: NoteTemplateSettings;
    taskFilter: TaskFilterSettings;
    taskSettings: TaskSettings;
    moreLabelSettings: MoreLabelSettings;
    showLunarCalendar: boolean;
    autoOpenSidebar: boolean;
    sidebarPosition: 'left' | 'right';
}
