# ProofMesh Desktop - Tauri Setup Guide

## Prerequisites

Before starting, install:
- **Node.js** (v18 or later): https://nodejs.org/
- **Rust**: https://www.rust-lang.org/tools/install
- **Platform-specific tools**:
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev`

## Step 1: Create Tauri Project

```bash
# Create a new directory
mkdir proofmesh-desktop
cd proofmesh-desktop

# Initialize npm project
npm init -y

# Install Tauri CLI
npm install -D @tauri-apps/cli@latest

# Create Tauri app
npm exec tauri init
```

When prompted:
- **App name**: `ProofMesh Desktop`
- **Window title**: `ProofMesh`
- **Web assets path**: `../dist`
- **Dev server URL**: `http://localhost:5173`
- **Frontend dev command**: `npm run dev`
- **Frontend build command**: `npm run build`

## Step 2: Install React + Vite

```bash
# Install Vite and React dependencies
npm install vite @vitejs/plugin-react react react-dom
npm install -D @types/react @types/react-dom typescript

# Install UI dependencies
npm install lucide-react tailwindcss postcss autoprefixer class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-switch @radix-ui/react-tabs

# Initialize Tailwind
npx tailwindcss init -p
```

## Step 3: Wire in ProofMesh Code

From this Lovable project, copy:
1. **`/src/desktop-app/`** → `/src/` (all React components)
2. **`/src/lib/desktop/`** → `/src/lib/desktop/` (core modules)
3. **`vite.config.ts`** → root (Vite config)
4. **`tailwind.config.ts`** → root (Tailwind config)
5. **`src/index.css`** → `/src/` (styles)

Then install the official SDK:

```bash
npm install @proofmesh/sdk
```

In a pnpm monorepo like this one, you can instead depend on the local package:

```bash
pnpm add @proofmesh/sdk
```

## Step 4: Configure Tauri

### Edit `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "ProofMesh Desktop",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "fs": {
        "all": true,
        "scope": ["$HOME/**"]
      },
      "dialog": {
        "all": true
      },
      "notification": {
        "all": true
      },
      "path": {
        "all": true
      },
      "shell": {
        "all": false,
        "open": true
      },
      "systemTray": {
        "all": true
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.proofmesh.desktop",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "ProofMesh",
        "width": 1000,
        "height": 700,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "systemTray": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true,
      "menuOnLeftClick": false
    }
  }
}
```

## Step 5: Add Rust Backend Code

### Create `src-tauri/src/file_watcher.rs`:

```rust
use notify::{Watcher, RecursiveMode, Result};
use std::sync::mpsc::channel;
use std::path::Path;
use tauri::Window;

#[tauri::command]
pub fn start_watching(window: Window, path: String) -> Result<(), String> {
    let (tx, rx) = channel();
    
    let mut watcher = notify::recommended_watcher(tx)
        .map_err(|e| e.to_string())?;

    watcher.watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        loop {
            match rx.recv() {
                Ok(event) => {
                    window.emit("file-change", event).ok();
                }
                Err(e) => eprintln!("watch error: {:?}", e),
            }
        }
    });

    Ok(())
}
```

### Update `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "1.5", features = ["dialog-all", "fs-all", "notification-all", "path-all", "shell-open", "system-tray"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
notify = "6.0"
```

### Update `src-tauri/src/main.rs`:

```rust
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod file_watcher;

use tauri::{CustomMenuItem, SystemTray, SystemTrayMenu, SystemTrayEvent};
use tauri::Manager;

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show ProofMesh"))
        .add_item(CustomMenuItem::new("hide", "Hide"))
        .add_item(CustomMenuItem::new("quit", "Quit"));

    let tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => {
                match id.as_str() {
                    "show" => {
                        let window = app.get_window("main").unwrap();
                        window.show().unwrap();
                    }
                    "hide" => {
                        let window = app.get_window("main").unwrap();
                        window.hide().unwrap();
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            file_watcher::start_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Step 6: Run the App

### Development Mode:
```bash
npm run tauri dev
```

### Build for Production:
```bash
npm run tauri build
```

Builds will be in `src-tauri/target/release/bundle/`

## Step 7: Testing Features

1. **Login**: Use your ProofMesh credentials
2. **Add Folder**: Click "Add Folder" and select a directory
3. **Drop Files**: Drag files onto the drop zone
4. **System Tray**: Check the tray icon for status
5. **Auto-stamp**: Save a file in a watched folder

## Troubleshooting

### Windows Build Issues:
- Install Visual Studio Build Tools
- Restart terminal after installing Rust

### macOS Code Signing:
- For development: `export TAURI_SKIP_DEVTOOLS_CHECK=true`
- For distribution: Follow Apple's notarization process

### Linux Permission Issues:
- File watching: `sudo sysctl fs.inotify.max_user_watches=524288`

## Next Steps

1. **Icons**: Replace icons in `src-tauri/icons/`
2. **Auto-updates**: Configure Tauri updater
3. **Installer**: Customize installer with `src-tauri/bundle/`
4. **Code signing**: Set up certificates for production

## Resources

- Tauri Docs: https://tauri.app/
- ProofMesh API: https://docs.proofmesh.com/
- Discord Support: [Your Discord]
