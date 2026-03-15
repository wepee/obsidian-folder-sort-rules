import { Plugin, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	FolderSortRule,
	FolderSortRulesSettings,
} from './types';
import { compareItems, resolveRule } from './sorter';
import { FolderSortRulesSettingTab } from './settings';
import { DragHandler } from './drag-handler';

export default class FolderSortRulesPlugin extends Plugin {
	settings: FolderSortRulesSettings = DEFAULT_SETTINGS;
	private originalSort: (() => void) | null = null;
	private dragHandler: DragHandler;
	private explorerView: any = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.dragHandler = new DragHandler(this);
		this.addSettingTab(new FolderSortRulesSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.patchFileExplorer();
		});

		// Re-sort when vault contents change
		this.registerEvent(
			this.app.vault.on('create', () => this.requestSort())
		);
		this.registerEvent(
			this.app.vault.on('delete', () => this.requestSort())
		);
		this.registerEvent(
			this.app.vault.on('rename', () => this.requestSort())
		);

		// Re-patch if file explorer is recreated
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				if (!this.explorerView || !this.getFileExplorerLeaf()) {
					this.patchFileExplorer();
				}
			})
		);
	}

	onunload(): void {
		// Restore original sort
		if (this.explorerView && this.originalSort) {
			this.explorerView.sort = this.originalSort;
			this.originalSort = null;
		}
		this.dragHandler.cleanup();
		this.explorerView = null;
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
		if (this.explorerView) {
			this.explorerView.sort();
		}
	}

	private getFileExplorerLeaf(): WorkspaceLeaf | null {
		const leaves = this.app.workspace.getLeavesOfType('file-explorer');
		return leaves.length > 0 ? leaves[0] : null;
	}

	private patchFileExplorer(): void {
		const leaf = this.getFileExplorerLeaf();
		if (!leaf) return;

		const view = leaf.view as any;
		if (!view || !view.sort) return;

		// Don't patch twice
		if (this.explorerView === view) return;

		this.explorerView = view;
		this.originalSort = view.sort.bind(view);

		const plugin = this;
		view.sort = function () {
			// Call original sort first
			if (plugin.originalSort) {
				plugin.originalSort();
			}
			// Apply our custom sort on top
			plugin.applyCustomSort();
		};

		// Register cleanup
		this.register(() => {
			if (this.originalSort) {
				view.sort = this.originalSort;
				this.originalSort = null;
			}
		});

		// Apply initial sort
		this.applyCustomSort();
	}

	private applyCustomSort(): void {
		if (!this.explorerView) return;
		if (this.settings.rules.length === 0) return;

		const fileItems = this.explorerView.fileItems;
		if (!fileItems) return;

		// Collect all folder paths that need custom sorting
		const processedFolders = new Set<string>();

		for (const path of Object.keys(fileItems)) {
			const item = fileItems[path];
			if (!item) continue;

			const file = item.file;
			if (!(file instanceof TFolder)) continue;
			if (processedFolders.has(path)) continue;

			const rule = resolveRule(path, this.settings);
			if (!rule) continue;

			this.sortFolderChildren(item, file, rule);
			processedFolders.add(path);
		}

		// Setup drag handlers for manual sort
		this.dragHandler.setup(this.explorerView);
	}

	private sortFolderChildren(
		folderItem: any,
		folder: TFolder,
		rule: FolderSortRule
	): void {
		// Try to find the children container - Obsidian uses vChildren
		const vChildren =
			folderItem.vChildren || folderItem.childrenEl?._children;
		if (!vChildren) return;

		const children: any[] = vChildren._children || vChildren.children;
		if (!children || !Array.isArray(children) || children.length < 2)
			return;

		// Separate folders and files
		const folderChildren: any[] = [];
		const fileChildren: any[] = [];

		for (const child of children) {
			if (!child.file) continue;
			if (child.file instanceof TFolder) {
				folderChildren.push(child);
			} else if (child.file instanceof TFile) {
				fileChildren.push(child);
			}
		}

		// Sort each group
		folderChildren.sort((a, b) =>
			compareItems(
				a.file,
				b.file,
				rule.folderSortOrder,
				rule.manualFolderOrder
			)
		);

		fileChildren.sort((a, b) =>
			compareItems(
				a.file,
				b.file,
				rule.fileSortOrder,
				rule.manualFileOrder
			)
		);

		// Reconstruct the children array: folders first, then files
		const sorted = [...folderChildren, ...fileChildren];

		// Update the internal array
		if (vChildren._children) {
			vChildren._children.length = 0;
			vChildren._children.push(...sorted);
		} else if (vChildren.children) {
			vChildren.children.length = 0;
			vChildren.children.push(...sorted);
		}

		// Reorder DOM elements
		const containerEl =
			folderItem.childrenEl ||
			folderItem.el?.querySelector('.tree-item-children');
		if (containerEl) {
			for (const child of sorted) {
				const el = child.el || child.selfEl?.parentElement;
				if (el && el.parentElement === containerEl) {
					containerEl.appendChild(el);
				}
			}
		}
	}
}
