@echo off
title FoodLens
echo Starting FoodLens... keep this window open.
echo When you see "Local: http://localhost:8080/", open that address in your browser.
echo.
if not exist node_modules (
  echo First run: installing dependencies, please wait 1-2 minutes...
  call npm install
)
npm run dev
pause
