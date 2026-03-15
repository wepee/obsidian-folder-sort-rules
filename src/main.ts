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
	private originalRequestSort: (() => void) | null = null;
	private dragHandler: DragHandler;
	private explorerView: any = null;
	private sortTimer: number | null = null;
	private observer: MutationObserver | null = null;
	private isApplyingSort = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.dragHandler = new DragHandler(this);
		this.addSettingTab(new FolderSortRulesSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.patchFileExplorer();
		});

		// Re-sort when vault contents change
		this.registerEvent(
			this.app.vault.on('create', () => this.scheduleCustomSort())
		);
		this.registerEvent(
			this.app.vault.on('delete', () => this.scheduleCustomSort())
		);
		this.registerEvent(
			this.app.vault.on('rename', () => this.scheduleCustomSort())
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
		// Restore original sort methods
		if (this.explorerView) {
			if (this.originalSort) {
				this.explorerView.sort = this.originalSort;
				this.originalSort = null;
			}
			if (this.originalRequestSort) {
				this.explorerView.requestSort = this.originalRequestSort;
				this.originalRequestSort = null;
			}
		}
		if (this.sortTimer !== null) {
			window.clearTimeout(this.sortTimer);
		}
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
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
		this.scheduleCustomSort();
	}

	requestSort(): void {
		this.scheduleCustomSort();
	}

	/**
	 * Debounced custom sort — schedules applyCustomSort to run after
	 * Obsidian has finished its own async DOM updates.
	 */
	private scheduleCustomSort(): void {
		if (this.sortTimer !== null) {
			window.clearTimeout(this.sortTimer);
		}
		this.sortTimer = window.setTimeout(() => {
			this.sortTimer = null;
			this.applyCustomSort();
		}, 50);
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

		// Patch sort()
		this.originalSort = view.sort.bind(view);
		const plugin = this;
		view.sort = function () {
			if (plugin.originalSort) {
				plugin.originalSort();
			}
			// Defer custom sort to run after Obsidian finishes DOM updates
			plugin.scheduleCustomSort();
		};

		// Also patch requestSort() if it exists — some code paths call it directly
		if (typeof view.requestSort === 'function') {
			this.originalRequestSort = view.requestSort.bind(view);
			view.requestSort = function () {
				if (plugin.originalRequestSort) {
					plugin.originalRequestSort();
				}
				plugin.scheduleCustomSort();
			};
		}

		// Register cleanup
		this.register(() => {
			if (this.originalSort) {
				view.sort = this.originalSort;
				this.originalSort = null;
			}
			if (this.originalRequestSort) {
				view.requestSort = this.originalRequestSort;
				this.originalRequestSort = null;
			}
		});

		// MutationObserver as a safety net — catches DOM reorders
		// that bypass our patched methods
		this.setupMutationObserver(view);

		// Apply initial sort
		this.scheduleCustomSort();
	}

	private setupMutationObserver(view: any): void {
		if (this.observer) {
			this.observer.disconnect();
		}

		const containerEl = view.containerEl as HTMLElement | undefined;
		if (!containerEl) return;

		this.observer = new MutationObserver(() => {
			// Only react if we're not the ones currently sorting
			if (!this.isApplyingSort) {
				this.scheduleCustomSort();
			}
		});

		this.observer.observe(containerEl, {
			childList: true,
			subtree: true,
		});

		this.register(() => {
			if (this.observer) {
				this.observer.disconnect();
				this.observer = null;
			}
		});
	}

	private applyCustomSort(): void {
		if (!this.explorerView) return;
		if (this.settings.rules.length === 0) return;

		const fileItems = this.explorerView.fileItems;
		if (!fileItems) return;

		// Guard against re-entrant calls from MutationObserver
		this.isApplyingSort = true;

		try {
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
		} finally {
			// Use rAF to keep the guard up until the DOM has settled
			requestAnimationFrame(() => {
				this.isApplyingSort = false;
			});
		}
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
