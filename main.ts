import { MarkdownView, Plugin, TFile, getAllTags, Notice, TAbstractFile, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, AutoNoteMoverSettings, AutoNoteMoverSettingTab } from 'settings/settings';
import { fileMove, getTriggerIndicator, isFmDisable } from 'utils/Utils';

export default class AutoNoteMover extends Plugin {
    settings: AutoNoteMoverSettings;

    async onload() {
        await this.loadSettings();
        const folderTagPattern = this.settings.folder_tag_pattern;
        const excludedFolder = this.settings.excluded_folder;

        const fileCheck = (file: TAbstractFile, oldPath?: string, caller?: string) => {
            if (caller !== 'cmd') {
                return;
            }
            if (!(file instanceof TFile)) return;

            // The rename event with no basename change will be terminated.
            if (oldPath && oldPath.split('/').pop() === file.basename + '.' + file.extension) {
                return;
            }

            // Excluded Folder check
            const excludedFolderLength = excludedFolder.length;
            for (let i = 0; i < excludedFolderLength; i++) {
                if (
                    !this.settings.use_regex_to_check_for_excluded_folder &&
                    excludedFolder[i].folder &&
                    file.parent.path === normalizePath(excludedFolder[i].folder)
                ) {
                    return;
                } else if (this.settings.use_regex_to_check_for_excluded_folder && excludedFolder[i].folder) {
                    const regex = new RegExp(excludedFolder[i].folder);
                    if (regex.test(file.parent.path)) {
                        return;
                    }
                }
            }

            const fileCache = this.app.metadataCache.getFileCache(file);
            // Disable AutoNoteMover when "AutoNoteMover: disable" is present in the frontmatter.
            if (isFmDisable(fileCache)) {
                return;
            }

            const fileName = file.basename;
            const fileFullName = file.basename + '.' + file.extension;
            const settingsLength = folderTagPattern.length;
            const cacheTag = getAllTags(fileCache);

            // checker
            for (let i = 0; i < settingsLength; i++) {
                const settingFolder = folderTagPattern[i].folder;
                const settingTag = folderTagPattern[i].tag;
                const settingPattern = folderTagPattern[i].pattern;
                // Tag check
                if (!settingPattern) {
                    if (!this.settings.use_regex_to_check_for_tags) {
                        if (cacheTag.find((e) => e === settingTag)) {
                            fileMove(this.app, settingFolder, fileFullName, file);
                            break;
                        }
                    } else if (this.settings.use_regex_to_check_for_tags) {
                        const regex = new RegExp(settingTag);
                        if (cacheTag.find((e) => regex.test(e))) {
                            fileMove(this.app, settingFolder, fileFullName, file);
                            break;
                        }
                    }
                    // Title check
                } else if (!settingTag) {
                    const regex = new RegExp(settingPattern);
                    const isMatch = regex.test(fileName);
                    if (isMatch) {
                        fileMove(this.app, settingFolder, fileFullName, file);
                        break;
                    }
                }
            }
        };

        const moveNoteCommand = (view: MarkdownView) => {
            if (isFmDisable(this.app.metadataCache.getFileCache(view.file))) {
                new Notice('Auto Note Mover is disabled in the frontmatter.');
                return;
            }
            fileCheck(view.file, undefined, 'cmd');
        };

        const checkAllFilesCommand = () => {
            this.app.vault.getMarkdownFiles().forEach((file) => {
                if (!isFmDisable(this.app.metadataCache.getFileCache(file))) {
                    fileCheck(file, undefined, 'cmd');
                }
            });
        };

        this.addCommand({
            id: 'Check-all-files',
            name: 'Check all files',
            callback: checkAllFilesCommand,
        });

        this.addCommand({
            id: 'Move-the-note',
            name: 'Move the note',
            checkCallback: (checking: boolean) => {
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView) {
                    if (!checking) {
                        moveNoteCommand(markdownView);
                    }
                    return true;
                }
            },
        });

        this.addSettingTab(new AutoNoteMoverSettingTab(this.app, this));
    }

    onunload() { }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
