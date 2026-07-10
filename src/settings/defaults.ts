import { MyPluginSettings } from './types';

export const DEFAULT_SETTINGS: MyPluginSettings = {
    fleetingNote: {
        savePath: "闪念",
        templatePath: "模板/闪念模板",
        fileNameFormat: "闪念 YYYY-MM"
    },
    dailyNote: {
        savePath: "日记",
        templatePath: "模板/日记模板",
        fileNameFormat: "YYYY-MM-DD"
    },
    weeklyNote: {
        savePath: "周报",
        templatePath: "模板/周报模板",
        fileNameFormat: "GGGG-[w]WW"
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
        enableTaskPropertyHints: false,
        taskClickEdit: true,
        captureToSettings: {
            enabled: true,
            fleetingNoteConfigId: "fleetingNote",
            recordConfigId: "record",
            taskConfigId: "task",
            configs: [
                {
                    id: "fleetingNote",
                    name: "默认闪念",
                    description: "默认的闪念捕获插入配置",
                    enabled: true,
                    defaultCapturePath: "{{闪念}}",
                    captureToActiveFile: false,
                    hotkey: null,
                    inputMethod: "single-line",
                    createFileIfItDoesntExist: {
                        enabled: true,
                        createWithTemplate: true,
                        template: "{{闪念模板}}"
                    },
                    format: {
                        enabled: true,
                        format: "- ==💡{{DATE:YYYY-MM-DD HH:mm}}==  {{VALUE}}  \n"
                    },
                    prepend: false,
                    appendLink: false,
                    task: false,
                    autoAddCreatedDate: false,
                    autoAddDueDate: false,
                    dueDateOption: "today",
                    customDueDays: 1,
                    insertAfter: {
                        enabled: true,
                        after: "## 闪念",
                        insertAtEnd: false,
                        considerSubsections: false,
                        createIfNotFound: true,
                        createIfNotFoundLocation: "bottom" as "top" | "bottom"
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
                    }
                },
                {
                    id: "record",
                    name: "默认记录",
                    description: "默认的记录捕获插入配置",
                    enabled: true,
                    defaultCapturePath: "{{日记}}",
                    captureToActiveFile: false,
                    hotkey: null,
                    inputMethod: "single-line",
                    createFileIfItDoesntExist: {
                        enabled: true,
                        createWithTemplate: true,
                        template: "{{日记模板}}"
                    },
                    format: {
                        enabled: true,
                        format: "- 📝  {{VALUE}}  \n"
                    },
                    prepend: false,
                    appendLink: false,
                    task: false,
                    autoAddCreatedDate: false,
                    autoAddDueDate: false,
                    dueDateOption: "today",
                    customDueDays: 1,
                    insertAfter: {
                        enabled: true,
                        after: "## 日常记录",
                        insertAtEnd: true,
                        considerSubsections: false,
                        createIfNotFound: true,
                        createIfNotFoundLocation: "bottom" as "top" | "bottom"
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
                    }
                },
                {
                    id: "task",
                    name: "默认任务",
                    description: "默认的捕获插入配置",
                    enabled: true,
                    defaultCapturePath: "{{日记}}",
                    captureToActiveFile: false,
                    hotkey: null,
                    inputMethod: "single-line",
                    createFileIfItDoesntExist: {
                        enabled: true,
                        createWithTemplate: true,
                        template: "{{日记模板}}"
                    },
                    format: {
                        enabled: true,
                        format: "⏰  {{VALUE}}"
                    },
                    prepend: false,
                    appendLink: false,
                    task: true,
                    autoAddCreatedDate: false,
                    autoAddDueDate: true,
                    dueDateOption: "today",
                    customDueDays: 1,
                    insertAfter: {
                        enabled: true,
                        after: "## 日常记录",
                        insertAtEnd: true,
                        considerSubsections: false,
                        createIfNotFound: true,
                        createIfNotFoundLocation: "bottom" as "top" | "bottom"
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
                    }
                },
                {
                    id: "daily",
                    name: "默认daily",
                    description: "专门用于每日笔记的配置",
                    enabled: true,
                    defaultCapturePath: "{{日记}}",
                    captureToActiveFile: false,
                    hotkey: null,
                    inputMethod: "none",
                    createFileIfItDoesntExist: {
                        enabled: true,
                        createWithTemplate: true,
                        template: "{{日记模板}}"
                    },
                    format: {
                        enabled: true,
                        format: "{{VALUE}}\n"
                    },
                    prepend: false,
                    appendLink: false,
                    task: false,
                    autoAddCreatedDate: false,
                    autoAddDueDate: false,
                    dueDateOption: "today",
                    customDueDays: 1,
                    insertAfter: {
                        enabled: true,
                        after: "## 日常记录",
                        insertAtEnd: true,
                        considerSubsections: false,
                        createIfNotFound: true,
                        createIfNotFoundLocation: "bottom" as "top" | "bottom"
                    },
                    newLineCapture: {
                        enabled: false,
                        direction: "below"
                    },
                    openFile: true,
                    fileOpening: {
                        location: "tab",
                        direction: "vertical",
                        mode: "default",
                        focus: true
                    }
                },
                {
                    id: "weekly",
                    name: "默认weekly",
                    description: "专门用于周报的配置",
                    enabled: true,
                    defaultCapturePath: "{{周报}}",
                    captureToActiveFile: false,
                    hotkey: null,
                    inputMethod: "none",
                    createFileIfItDoesntExist: {
                        enabled: true,
                        createWithTemplate: true,
                        template: "{{周报模板}}"
                    },
                    format: {
                        enabled: true,
                        format: "## {{VALUE}}\n\n- 本周工作: \n- 下周计划: \n- 遇到问题: \n\n"
                    },
                    prepend: false,
                    appendLink: false,
                    task: false,
                    autoAddCreatedDate: false,
                    autoAddDueDate: false,
                    dueDateOption: "today",
                    customDueDays: 1,
                    insertAfter: {
                        enabled: true,
                        after: "## 工作记录",
                        insertAtEnd: true,
                        considerSubsections: false,
                        createIfNotFound: true,
                        createIfNotFoundLocation: "bottom" as "top" | "bottom"
                    },
                    newLineCapture: {
                        enabled: false,
                        direction: "below"
                    },
                    openFile: true,
                    fileOpening: {
                        location: "tab",
                        direction: "vertical",
                        mode: "default",
                        focus: true
                    }
                },
                {
                    id: "monthly",
                    name: "默认monthly",
                    description: "专门用于月报的配置",
                    enabled: true,
                    defaultCapturePath: "{{月报}}",
                    captureToActiveFile: false,
                    hotkey: null,
                    inputMethod: "none",
                    createFileIfItDoesntExist: {
                        enabled: true,
                        createWithTemplate: true,
                        template: "{{月报模板}}"
                    },
                    format: {
                        enabled: true,
                        format: "## {{VALUE}}\n\n- 本月工作: \n- 下月计划: \n- 总结反思: \n\n"
                    },
                    prepend: false,
                    appendLink: false,
                    task: false,
                    autoAddCreatedDate: false,
                    autoAddDueDate: false,
                    dueDateOption: "today",
                    customDueDays: 1,
                    insertAfter: {
                        enabled: true,
                        after: "## 月度总结",
                        insertAtEnd: true,
                        considerSubsections: false,
                        createIfNotFound: true,
                        createIfNotFoundLocation: "bottom" as "top" | "bottom"
                    },
                    newLineCapture: {
                        enabled: false,
                        direction: "below"
                    },
                    openFile: true,
                    fileOpening: {
                        location: "tab",
                        direction: "vertical",
                        mode: "default",
                        focus: true
                    }
                },
                {
                    id: "quarterly",
                    name: "默认quarterly",
                    description: "专门用于季报的配置",
                    enabled: true,
                    defaultCapturePath: "{{季报}}",
                    captureToActiveFile: false,
                    hotkey: null,
                    inputMethod: "none",
                    createFileIfItDoesntExist: {
                        enabled: true,
                        createWithTemplate: true,
                        template: "{{季报模板}}"
                    },
                    format: {
                        enabled: true,
                        format: "## {{VALUE}}\n\n- 本季工作: \n- 下季计划: \n- 季度反思: \n\n"
                    },
                    prepend: false,
                    appendLink: false,
                    task: false,
                    autoAddCreatedDate: false,
                    autoAddDueDate: false,
                    dueDateOption: "today",
                    customDueDays: 1,
                    insertAfter: {
                        enabled: true,
                        after: "## 季度总结",
                        insertAtEnd: true,
                        considerSubsections: false,
                        createIfNotFound: true,
                        createIfNotFoundLocation: "bottom" as "top" | "bottom"
                    },
                    newLineCapture: {
                        enabled: false,
                        direction: "below"
                    },
                    openFile: true,
                    fileOpening: {
                        location: "tab",
                        direction: "vertical",
                        mode: "default",
                        focus: true
                    }
                },
                {
                    id: "yearly",
                    name: "默认yearly",
                    description: "专门用于年报的配置",
                    enabled: true,
                    defaultCapturePath: "{{年报}}",
                    captureToActiveFile: false,
                    hotkey: null,
                    inputMethod: "none",
                    createFileIfItDoesntExist: {
                        enabled: true,
                        createWithTemplate: true,
                        template: "{{年报模板}}"
                    },
                    format: {
                        enabled: true,
                        format: "## {{VALUE}}\n\n- 本年工作: \n- 明年计划: \n- 年度反思: \n- 目标达成: \n\n"
                    },
                    prepend: false,
                    appendLink: false,
                    task: false,
                    autoAddCreatedDate: false,
                    autoAddDueDate: false,
                    dueDateOption: "today",
                    customDueDays: 1,
                    insertAfter: {
                        enabled: true,
                        after: "## 年度总结",
                        insertAtEnd: true,
                        considerSubsections: false,
                        createIfNotFound: true,
                        createIfNotFoundLocation: "bottom" as "top" | "bottom"
                    },
                    newLineCapture: {
                        enabled: false,
                        direction: "below"
                    },
                    openFile: true,
                    fileOpening: {
                        location: "tab",
                        direction: "vertical",
                        mode: "default",
                        focus: true
                    }
                },
                {
                    id: "meeting",
                    name: "会议笔记",
                    description: "专门用于会议笔记的配置",
                    enabled: true,
                    defaultCapturePath: "{{日记}}",
                    captureToActiveFile: false,
                    hotkey: null,
                    inputMethod: "single-line",
                    createFileIfItDoesntExist: {
                        enabled: true,
                        createWithTemplate: true,
                        template: "{{日记模板}}"
                    },
                    format: {
                        enabled: true,
                        format: "## {{VALUE}}\n\n- 时间: {{DATE}}\n- 地点: \n- 参与人员: \n- 内容: \n- 行动项: \n\n"
                    },
                    prepend: false,
                    appendLink: false,
                    task: false,
                    autoAddCreatedDate: false,
                    autoAddDueDate: false,
                    dueDateOption: "today",
                    customDueDays: 1,
                    insertAfter: {
                        enabled: true,
                        after: "## 日常记录",
                        insertAtEnd: true,
                        considerSubsections: false,
                        createIfNotFound: true,
                        createIfNotFoundLocation: "bottom" as "top" | "bottom"
                    },
                    newLineCapture: {
                        enabled: false,
                        direction: "below"
                    },
                    openFile: true,
                    fileOpening: {
                        location: "tab",
                        direction: "vertical",
                        mode: "default",
                        focus: true
                    }
                }
            ]
        },
        recurrenceSettings: {
            newTaskPosition: "below"
        }
    },
    moreLabelSettings: {
        lb1: {
            enabled: false,
            labelText: "LB1",
            actionType: "systemCommand",
            systemCommand: "",
            filePath: ""
        },
        lb2: {
            enabled: false,
            labelText: "LB2",
            actionType: "systemCommand",
            systemCommand: "",
            filePath: ""
        }
    },
    showLunarCalendar: true,
    autoOpenSidebar: true,
    sidebarPosition: 'right'
};