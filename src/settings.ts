import { App, PluginSettingTab, Setting } from 'obsidian';
import type FolderSortRulesPlugin from './main';
import {
	FolderSortRule,
	SORT_ORDER_DISPLAY,
	SortOrder,
	createDefaultRule,
} from './types';
import { FolderSuggest } from './folder-suggest';

export class FolderSortRulesSettingTab extends PluginSettingTab {
	plugin: FolderSortRulesPlugin;

	constructor(app: App, plugin: FolderSortRulesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Add rule')
			.setDesc('Add a custom sort rule for a specific folder.')
			.addButton((btn) =>
				btn.setButtonText('+ Add rule').onClick(() => {
					this.openFolderPicker();
				})
			);

		if (this.plugin.settings.rules.length === 0) {
			containerEl.createEl('p', {
				text: 'No folder rules defined yet. Click "+ Add rule" to create one.',
				cls: 'folder-sort-rules-empty',
			});
			return;
		}

		for (let i = 0; i < this.plugin.settings.rules.length; i++) {
			this.renderRule(containerEl, this.plugin.settings.rules[i], i);
		}
	}

	private renderRule(
		containerEl: HTMLElement,
		rule: FolderSortRule,
		index: number
	): void {
		const ruleContainer = containerEl.createDiv({
			cls: 'folder-sort-rules-rule',
		});

		new Setting(ruleContainer)
			.setName(rule.folderPath || '/ (vault root)')
			.setHeading()
			.addButton((btn) =>
				btn
					.setButtonText('Delete')
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.rules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
			);

		const dropdownOptions: Record<string, string> = {};
		for (const [key, label] of Object.entries(SORT_ORDER_DISPLAY)) {
			dropdownOptions[key] = label;
		}

		new Setting(ruleContainer)
			.setName('Files sort order')
			.setDesc('How files in this folder are sorted.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(dropdownOptions)
					.setValue(rule.fileSortOrder)
					.onChange(async (value) => {
						rule.fileSortOrder = value as SortOrder;
						await this.plugin.saveSettings();
					})
			);

		new Setting(ruleContainer)
			.setName('Subfolders sort order')
			.setDesc('How subfolders in this folder are sorted.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(dropdownOptions)
					.setValue(rule.folderSortOrder)
					.onChange(async (value) => {
						rule.folderSortOrder = value as SortOrder;
						await this.plugin.saveSettings();
					})
			);

		new Setting(ruleContainer)
			.setName('Apply recursively')
			.setDesc(
				'Apply this rule to all nested subfolders that do not have their own rule.'
			)
			.addToggle((toggle) =>
				toggle.setValue(rule.recursive).onChange(async (value) => {
					rule.recursive = value;
					await this.plugin.saveSettings();
				})
			);
	}

	private openFolderPicker(): void {
		const { containerEl } = this;

		const modal = containerEl.createDiv({
			cls: 'folder-sort-rules-picker',
		});

		const setting = new Setting(modal)
			.setName('Folder path')
			.setDesc('Type to search for a folder in your vault.')
			.addText((text) => {
				text.setPlaceholder('e.g. Daily notes');
				new FolderSuggest(this.app, text.inputEl);
				text.inputEl.addEventListener('keydown', async (e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						await this.addRule(text.getValue());
						modal.remove();
					}
				});
			})
			.addButton((btn) =>
				btn.setButtonText('Add').onClick(async () => {
					const input = modal.querySelector('input');
					if (input) {
						await this.addRule(input.value);
						modal.remove();
					}
				})
			)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => {
					modal.remove();
				})
			);

		setting.settingEl.scrollIntoView({ behavior: 'smooth' });
	}

	private async addRule(folderPath: string): Promise<void> {
		const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');

		// Check for duplicate
		if (
			this.plugin.settings.rules.some(
				(r) => r.folderPath === normalizedPath
			)
		) {
			return;
		}

		// Validate folder exists
		if (normalizedPath !== '') {
			const folder =
				this.app.vault.getFolderByPath(normalizedPath);
			if (!folder) {
				return;
			}
		}

		this.plugin.settings.rules.push(createDefaultRule(normalizedPath));
		await this.plugin.saveSettings();
		this.display();
	}
}
