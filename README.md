# Folder Sort Rules

Define custom sort orders per folder in your Obsidian vault. Override the global file explorer sorting with independent rules for files and subfolders.

## Features

- **Per-folder sort rules** — Set a different sort order for any folder in your vault.
- **Independent file/folder sorting** — Choose separate sort orders for files and subfolders within the same folder.
- **Recursive rules** — A rule can apply to all nested subfolders unless overridden by a more specific rule.
- **Manual drag & drop** — Reorder files or subfolders manually via drag and drop in the file explorer.
- **7 sort orders** — Name (A→Z), Name (Z→A), Modified time (new→old), Modified time (old→new), Created time (new→old), Created time (old→new), Manual.

## How to use

1. Go to **Settings → Folder Sort Rules**.
2. Click **+ Add rule** and select a folder from your vault.
3. Choose the desired sort order for **files** and **subfolders** independently.
4. Toggle **Apply recursively** to extend the rule to nested subfolders.
5. If you select **Manual (drag & drop)**, you can reorder items directly in the file explorer.

## Rule resolution

When displaying a folder, the plugin resolves which rule to apply:

1. **Exact match** — If a rule exists for this exact folder, use it.
2. **Recursive parent** — Walk up the folder tree and use the first parent rule that has recursion enabled.
3. **Default** — If no rule matches, use Obsidian's global sort order.

The most specific rule always wins.

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community plugins → Browse**.
2. Search for **Folder Sort Rules**.
3. Click **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/wepe/obsidian-folder-sort-rules/releases/latest).
2. Create a folder `folder-sort-rules` inside your vault's `.obsidian/plugins/` directory.
3. Copy the downloaded files into that folder.
4. Enable the plugin in **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

## License

[MIT](LICENSE)
