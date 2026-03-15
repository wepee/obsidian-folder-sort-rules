import { TAbstractFile, TFile, TFolder } from 'obsidian';
import { FolderSortRule, FolderSortRulesSettings, SortOrder } from './types';

export function resolveRule(
	folderPath: string,
	settings: FolderSortRulesSettings
): FolderSortRule | null {
	// Exact match first
	const exact = settings.rules.find((r) => r.folderPath === folderPath);
	if (exact) return exact;

	// Walk up parents looking for a recursive rule
	let current = folderPath;
	while (current.includes('/')) {
		current = current.substring(0, current.lastIndexOf('/'));
		const parent = settings.rules.find((r) => r.folderPath === current);
		if (parent && parent.recursive) return parent;
	}

	// Check root-level rule
	if (folderPath !== '') {
		const rootRule = settings.rules.find((r) => r.folderPath === '');
		if (rootRule && rootRule.recursive) return rootRule;
	}

	return null;
}

export function compareItems(
	a: TAbstractFile,
	b: TAbstractFile,
	order: SortOrder,
	manualOrder?: string[]
): number {
	switch (order) {
		case 'alphabetical-asc':
			return a.name.localeCompare(b.name, undefined, {
				sensitivity: 'base',
				numeric: true,
			});
		case 'alphabetical-desc':
			return b.name.localeCompare(a.name, undefined, {
				sensitivity: 'base',
				numeric: true,
			});
		case 'modified-desc':
			return getModified(b) - getModified(a);
		case 'modified-asc':
			return getModified(a) - getModified(b);
		case 'created-desc':
			return getCreated(b) - getCreated(a);
		case 'created-asc':
			return getCreated(a) - getCreated(b);
		case 'manual': {
			if (!manualOrder) return 0;
			const aIdx = manualOrder.indexOf(a.name);
			const bIdx = manualOrder.indexOf(b.name);
			const aPos = aIdx === -1 ? Infinity : aIdx;
			const bPos = bIdx === -1 ? Infinity : bIdx;
			if (aPos === bPos) return a.name.localeCompare(b.name);
			return aPos - bPos;
		}
	}
}

function getModified(file: TAbstractFile): number {
	if (file instanceof TFile) return file.stat.mtime;
	if (file instanceof TFolder) {
		// For folders, use the most recently modified child file
		let latest = 0;
		for (const child of file.children) {
			if (child instanceof TFile && child.stat.mtime > latest) {
				latest = child.stat.mtime;
			}
		}
		return latest;
	}
	return 0;
}

function getCreated(file: TAbstractFile): number {
	if (file instanceof TFile) return file.stat.ctime;
	if (file instanceof TFolder) {
		// For folders, use the earliest created child file
		let earliest = Infinity;
		for (const child of file.children) {
			if (child instanceof TFile && child.stat.ctime < earliest) {
				earliest = child.stat.ctime;
			}
		}
		return earliest === Infinity ? 0 : earliest;
	}
	return 0;
}
