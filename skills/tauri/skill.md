---
name: tauri
description: Expert skill for building lightweight, secure cross-platform desktop apps using Rust and Web technologies.
---
# TAURI EXPERT SKILL

## 1. Core Philosophy
Tauri is about small binaries, low memory usage, and security. It uses a Rust backend and a web-based frontend (HTML/JS/CSS).

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never expose dangerous Rust commands to the frontend without proper permission scoping.
- ❌ Never bundle massive JS frameworks if they are not needed. Keep the frontend light.
- ❌ Never ignore the security isolation between the main thread and the webview.

## 3. Practical Patterns

### 3.1 Invoking Rust from JS
Use the `invoke` command pattern for performance-critical tasks.
```javascript
import { invoke } from '@tauri-apps/api/tauri';

async function performHeavyTask() {
  const result = await invoke('my_custom_command', { payload: 'data' });
}
```

### 3.2 Rust Command Implementation
Implement commands in `src-tauri/src/main.rs`.
```rust
#[tauri::command]
fn my_custom_command(payload: String) -> String {
    format!("Processed: {}", payload)
}
```

### 3.3 Multi-window Management
Use the Tauri API to handle multiple windows and system tray integration.

## 4. Packaging & Security
- Use the `tauri.conf.json` to strictly define the allowlist of APIs.
- Use `tauri build` to generate installers for Windows (MSI), macOS (DMG), and Linux (AppImage/Deb).
