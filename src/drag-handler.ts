import { TAbstractFile, TFile, TFolder } from 'obsidian';
import type FolderSortRulesPlugin from './main';
import { FolderSortRule } from './types';

interface DragState {
	draggedEl: HTMLElement | null;
	draggedFile: TAbstractFile | null;
	placeholder: HTMLElement | null;
}

export class DragHandler {
	private plugin: FolderSortRulesPlugin;
	private state: DragState = {
		draggedEl: null,
		draggedFile: null,
		placeholder: null,
	};
	private cleanupFns: (() => void)[] = [];

	constructor(plugin: FolderSortRulesPlugin) {
		this.plugin = plugin;
	}

	setup(explorerView: any): void {
		this.cleanup();

		const fileItems = explorerView.fileItems;
		if (!fileItems) return;

		for (const rule of this.plugin.settings.rules) {
			if (
				rule.fileSortOrder !== 'manual' &&
				rule.folderSortOrder !== 'manual'
			) {
				continue;
			}

			const folderItem = fileItems[rule.folderPath];
			if (!folderItem) continue;

			this.setupFolderDrag(folderItem, rule, fileItems);
		}
	}

	cleanup(): void {
		for (const fn of this.cleanupFns) {
			fn();
		}
		this.cleanupFns = [];
	}

	private setupFolderDrag(
		folderItem: any,
		rule: FolderSortRule,
		fileItems: Record<string, any>
	): void {
		const folder = this.plugin.app.vault.getFolderByPath(
			rule.folderPath
		);
		if (!folder) return;

		for (const child of folder.children) {
			const isFile = child instanceof TFile;
			const isFolder = child instanceof TFolder;

			if (isFile && rule.fileSortOrder !== 'manual') continue;
			if (isFolder && rule.folderSortOrder !== 'manual') continue;

			const childItem = fileItems[child.path];
			if (!childItem || !childItem.selfEl) continue;

			const el = childItem.selfEl as HTMLElement;
			el.setAttribute('draggable', 'true');
			el.addClass('folder-sort-rules-draggable');

			const onDragStart = (e: DragEvent) => {
				this.state.draggedEl = el;
				this.state.draggedFile = child;
				el.addClass('folder-sort-rules-dragging');
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text/plain', child.path);
				}
			};

			const onDragEnd = () => {
				el.removeClass('folder-sort-rules-dragging');
				this.removePlaceholder();
				this.state.draggedEl = null;
				this.state.draggedFile = null;
			};

			const onDragOver = (e: DragEvent) => {
				if (!this.state.draggedFile) return;
				if (this.state.draggedFile === child) return;

				// Only allow drag between same type
				const draggedIsFile =
					this.state.draggedFile instanceof TFile;
				const targetIsFile = child instanceof TFile;
				if (draggedIsFile !== targetIsFile) return;

				e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = 'move';
				}

				const rect = el.getBoundingClientRect();
				const midY = rect.top + rect.height / 2;

				this.removePlaceholder();
				this.state.placeholder = createDiv({
					cls: 'folder-sort-rules-drop-indicator',
				});

				if (e.clientY < midY) {
					el.parentElement?.insertBefore(
						this.state.placeholder,
						el
					);
				} else {
					el.parentElement?.insertBefore(
						this.state.placeholder,
						el.nextSibling
					);
				}
			};

			const onDrop = async (e: DragEvent) => {
				e.preventDefault();
				if (!this.state.draggedFile) return;
				if (this.state.draggedFile === child) return;

				const draggedIsFile =
					this.state.draggedFile instanceof TFile;
				const targetIsFile = child instanceof TFile;
				if (draggedIsFile !== targetIsFile) return;

				const rect = el.getBoundingClientRect();
				const midY = rect.top + rect.height / 2;
				const insertBefore = e.clientY < midY;

				const orderKey = draggedIsFile
					? 'manualFileOrder'
					: 'manualFolderOrder';
				await this.updateManualOrder(
					rule,
					orderKey,
					this.state.draggedFile.name,
					child.name,
					insertBefore
				);

				this.removePlaceholder();
				this.plugin.requestSort();
			};

			el.addEventListener('dragstart', onDragStart);
			el.addEventListener('dragend', onDragEnd);
			el.addEventListener('dragover', onDragOver);
			el.addEventListener('drop', onDrop);

			this.cleanupFns.push(() => {
				el.removeEventListener('dragstart', onDragStart);
				el.removeEventListener('dragend', onDragEnd);
				el.removeEventListener('dragover', onDragOver);
				el.removeEventListener('drop', onDrop);
				el.removeAttribute('draggable');
				el.removeClass('folder-sort-rules-draggable');
			});
		}
	}

	private removePlaceholder(): void {
		if (this.state.placeholder) {
			this.state.placeholder.remove();
			this.state.placeholder = null;
		}
	}

	private async updateManualOrder(
		rule: FolderSortRule,
		key: 'manualFileOrder' | 'manualFolderOrder',
		draggedName: string,
		targetName: string,
		insertBefore: boolean
	): Promise<void> {
		const folder = this.plugin.app.vault.getFolderByPath(
			rule.folderPath
		);
		if (!folder) return;

		// Build current order if empty
		if (rule[key].length === 0) {
			const isFiles = key === 'manualFileOrder';
			rule[key] = folder.children
				.filter((c) =>
					isFiles ? c instanceof TFile : c instanceof TFolder
				)
				.map((c) => c.name);
		}

		// Remove dragged item
		const order = rule[key].filter((n) => n !== draggedName);

		// Find target position
		const targetIdx = order.indexOf(targetName);
		if (targetIdx === -1) {
			order.push(draggedName);
		} else if (insertBefore) {
			order.splice(targetIdx, 0, draggedName);
		} else {
			order.splice(targetIdx + 1, 0, draggedName);
		}

		rule[key] = order;
		await this.plugin.saveSettings();
	}
}
