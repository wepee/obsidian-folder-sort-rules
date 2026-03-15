export type SortOrder =
	| 'alphabetical-asc'
	| 'alphabetical-desc'
	| 'modified-desc'
	| 'modified-asc'
	| 'created-desc'
	| 'created-asc'
	| 'manual';

export interface FolderSortRule {
	folderPath: string;
	fileSortOrder: SortOrder;
	folderSortOrder: SortOrder;
	recursive: boolean;
	manualFileOrder: string[];
	manualFolderOrder: string[];
}

export interface FolderSortRulesSettings {
	rules: FolderSortRule[];
}

export const DEFAULT_SETTINGS: FolderSortRulesSettings = {
	rules: [],
};

export const SORT_ORDER_DISPLAY: Record<SortOrder, string> = {
	'alphabetical-asc': 'Name (A → Z)',
	'alphabetical-desc': 'Name (Z → A)',
	'modified-desc': 'Modified time (new → old)',
	'modified-asc': 'Modified time (old → new)',
	'created-desc': 'Created time (new → old)',
	'created-asc': 'Created time (old → new)',
	'manual': 'Manual (drag & drop)',
};

export function createDefaultRule(folderPath: string): FolderSortRule {
	return {
		folderPath,
		fileSortOrder: 'alphabetical-asc',
		folderSortOrder: 'alphabetical-asc',
		recursive: true,
		manualFileOrder: [],
		manualFolderOrder: [],
	};
}
