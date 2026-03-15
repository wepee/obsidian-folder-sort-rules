# Folder Sort Rules

Define custom sort orders per folder in your Obsidian vault, overriding the global file explorer sorting.

## Features

- **Per-folder sort rules** — Set a different sort order for any folder in your vault.
- **Independent file and subfolder sorting** — Choose separate sort orders for files and subfolders within the same folder.
- **Recursive rules** — A rule can apply to all nested subfolders automatically, unless a subfolder has its own rule.
- **Manual drag & drop** — Reorder files or subfolders manually by dragging them in the file explorer.
- **7 sort orders** — Name (A-Z), Name (Z-A), Modified time (new/old), Created time (new/old), and Manual.

## How it works

1. Go to **Settings > Folder Sort Rules**.
2. Click **+ Add rule** and select a folder from your vault.
3. Choose a sort order for **files** and **subfolders** independently.
4. Enable or disable **recursive** application to nested subfolders.
5. If you select **Manual (drag & drop)**, you can reorder items directly in the file explorer.

### Rule resolution

When the file explorer renders a folder:

1. If the folder has its own rule, that rule is used.
2. Otherwise, the plugin walks up the parent chain looking for a recursive rule.
3. If no rule matches, the default Obsidian sort order is used.

## Installation

### From Obsidian Community Plugins

1. Open **Settings > Community plugins**.
2. Click **Browse** and search for "Folder Sort Rules".
3. Click **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/wepee/folder-sort-rules/releases/latest).
2. Create a folder `folder-sort-rules` in your vault's `.obsidian/plugins/` directory.
3. Copy the downloaded files into that folder.
4. Enable the plugin in **Settings > Community plugins**.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```
