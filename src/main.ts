import { Plugin, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	FolderSortRule,
	FolderSortRulesSettings,
} from './types';
import { compareItems, resolveRule } from './sorter';
import { FolderSortRulesSettingTab } from './settings';
import { DragHandler } from './drag-handler';

/**
 * Monkey-patch a method on an object's prototype.
 * Returns an uninstaller function that restores the original.
 */
function patchPrototype(
	obj: any,
	methodName: string,
	factory: (original: (...args: any[]) => any) => (...args: any[]) => any
): () => void {
	const proto = obj.constructor.prototype;
	const original = proto[methodName];
	const patched = factory(original);
	proto[methodName] = patched;
	return () => {
		proto[methodName] = original;
	};
}

export default class FolderSortRulesPlugin extends Plugin {
	settings: FolderSortRulesSettings = DEFAULT_SETTINGS;
	private uninstallPatch: (() => void) | null = null;
	private dragHandler: DragHandler;
	private dragSetupTimer: number | null = null;
	private patched = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.dragHandler = new DragHandler(this);
		this.addSettingTab(new FolderSortRulesSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.patchFileExplorer();
		});

		this.registerEvent(
			this.app.vault.on('create', () => this.requestSort())
		);
		this.registerEvent(
			this.app.vault.on('delete', () => this.requestSort())
		);
		this.registerEvent(
			this.app.vault.on('rename', () => this.requestSort())
		);

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				if (!this.patched) {
					this.patchFileExplorer();
				}
			})
		);
	}

	onunload(): void {
		if (this.uninstallPatch) {
			this.uninstallPatch();
			this.uninstallPatch = null;
		}
		if (this.dragSetupTimer !== null) {
			window.clearTimeout(this.dragSetupTimer);
		}
		this.dragHandler.cleanup();
		this.patched = false;

		// Trigger re-sort to restore default order
		const leaf = this.getFileExplorerLeaf();
		if (leaf) {
			(leaf.view as any).requestSort?.();
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.requestSort();
	}

	requestSort(): void {
		const leaf = this.getFileExplorerLeaf();
		if (leaf) {
			(leaf.view as any).requestSort?.();
		}
		this.scheduleDragSetup();
	}

	private getFileExplorerLeaf(): WorkspaceLeaf | null {
		const leaves = this.app.workspace.getLeavesOfType('file-explorer');
		return leaves.length > 0 ? leaves[0] : null;
	}

	private patchFileExplorer(): void {
		const leaf = this.getFileExplorerLeaf();
		if (!leaf) return;

		const view = leaf.view as any;
		if (
			!view ||
			typeof view.getSortedFolderItems !== 'function'
		) {
			return;
		}

		if (this.patched) return;

		const plugin = this;

		this.uninstallPatch = patchPrototype(
			view,
			'getSortedFolderItems',
			(original) =>
				function (this: any, folder: TFolder) {
					const items = original.call(this, folder);

					if (plugin.settings.rules.length === 0) return items;

					const rule = resolveRule(
						folder.path,
						plugin.settings
					);
					if (!rule) return items;

					return plugin.sortItems(items, rule);
				}
		);

		this.patched = true;

		this.register(() => {
			if (this.uninstallPatch) {
				this.uninstallPatch();
				this.uninstallPatch = null;
				this.patched = false;
			}
		});

		// Trigger initial sort
		view.requestSort();
		this.scheduleDragSetup();
	}

	private scheduleDragSetup(): void {
		if (this.dragSetupTimer !== null) {
			window.clearTimeout(this.dragSetupTimer);
		}
		this.dragSetupTimer = window.setTimeout(() => {
			this.dragSetupTimer = null;
			const leaf = this.getFileExplorerLeaf();
			if (leaf) {
				this.dragHandler.setup((leaf.view as any));
			}
		}, 100);
	}

	private sortItems(items: any[], rule: FolderSortRule): any[] {
		const folderItems: any[] = [];
		const fileItems: any[] = [];

		for (const item of items) {
			if (!item || !item.file) continue;
			if (item.file instanceof TFolder) {
				folderItems.push(item);
			} else if (item.file instanceof TFile) {
				fileItems.push(item);
			}
		}

		folderItems.sort((a, b) =>
			compareItems(
				a.file,
				b.file,
				rule.folderSortOrder,
				rule.manualFolderOrder
			)
		);

		fileItems.sort((a, b) =>
			compareItems(
				a.file,
				b.file,
				rule.fileSortOrder,
				rule.manualFileOrder
			)
		);

		return [...folderItems, ...fileItems];
	}
}
