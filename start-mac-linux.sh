#!/usr/bin/env bash
# Double-click / run: ./start-mac-linux.sh  (first time: chmod +x start-mac-linux.sh)
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "First run: installing dependencies, please wait 1-2 minutes..."
  npm install
fi
echo "When you see 'Local: http://localhost:8080/', open that address in your browser."
npm run dev
