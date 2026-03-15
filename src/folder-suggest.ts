import { AbstractInputSuggest, App, TFolder } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const lowerInput = inputStr.toLowerCase();
		const folders: TFolder[] = [];

		const root = this.app.vault.getRoot();
		this.collectFolders(root, folders);

		return folders.filter((f) =>
			f.path.toLowerCase().includes(lowerInput)
		);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.createEl('div', { text: folder.path || '/' });
	}

	selectSuggestion(folder: TFolder): void {
		this.inputEl.value = folder.path;
		this.inputEl.trigger('input');
		this.close();
	}

	private collectFolders(folder: TFolder, result: TFolder[]): void {
		result.push(folder);
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				this.collectFolders(child, result);
			}
		}
	}
}
