#!/bin/bash

# Script to copy ProofMesh desktop app files to Tauri project
# Usage: ./copy-to-tauri.sh /path/to/proofmesh-desktop

if [ -z "$1" ]; then
    echo "Error: Please provide the path to your Tauri project"
    echo "Usage: ./copy-to-tauri.sh /path/to/proofmesh-desktop"
    exit 1
fi

TAURI_PROJECT="$1"

if [ ! -d "$TAURI_PROJECT" ]; then
    echo "Error: Directory $TAURI_PROJECT does not exist"
    exit 1
fi

echo "Copying files to $TAURI_PROJECT..."

# Create directories if they don't exist
mkdir -p "$TAURI_PROJECT/src"
mkdir -p "$TAURI_PROJECT/src/lib"

# Copy desktop app files
echo "✓ Copying desktop app components..."
cp -r src/desktop-app "$TAURI_PROJECT/src/"

echo "✓ Copying desktop lib modules..."
cp -r src/lib/desktop "$TAURI_PROJECT/src/lib/"

echo "✓ Copying SDK..."
cp -r src/lib/sdk "$TAURI_PROJECT/src/lib/"

echo "✓ Copying hash utility..."
cp src/lib/hash.ts "$TAURI_PROJECT/src/lib/"

echo "✓ Copying utils..."
cp src/lib/utils.ts "$TAURI_PROJECT/src/lib/"

echo "✓ Copying styles..."
cp src/index.css "$TAURI_PROJECT/src/"

echo "✓ Copying config files..."
cp tailwind.config.ts "$TAURI_PROJECT/"
cp vite.config.ts "$TAURI_PROJECT/"

echo "✓ Copying component library..."
cp -r src/components/ui "$TAURI_PROJECT/src/components/"

echo ""
echo "✅ All files copied successfully!"
echo ""
echo "Next steps:"
echo "1. cd $TAURI_PROJECT"
echo "2. Update package.json scripts (see DESKTOP_SETUP_GUIDE.md)"
echo "3. Update index.html to point to src/desktop-app/main.tsx"
echo "4. npm run tauri dev"
