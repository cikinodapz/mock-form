# AGENTS.md - Developer & AI Assistant Guidelines

This document serves as the **Single Source of Truth** for AI assistants, agents, and contributors working on the **mock-form** codebase.

---

## 1. Core Constraints & Styling Rules (STRICT)

1. **NO UNREQUESTED VISUAL OR STYLING CHANGES**
   - NEVER alter existing colors, fonts, shapes, borders, animations, or component layouts unless the user explicitly requests it.
   - Do not apply generic framework/UI biases (e.g., automatically turning "success" into green or adding artificial button frames).

2. **Monochrome Minimalist Identity**
   - **Success State & Toast HUD**: Must retain the signature dark monochrome aesthetic (`#09090b` and `rgba(9, 9, 11, 0.92)`), **NOT** green (`#10b981`).
   - **Accent Palette**: 
     - Light Mode: `#0f172a` (Dark Slate)
     - Dark Mode: `#f8fafc` (Off-white / High Contrast)
   - **Status HUD Colors**:
     - Info: `bg: rgba(15, 23, 42, 0.92)`, `text: #f8fafc`, `border: rgba(51, 65, 85, 0.8)`
     - Success: `bg: rgba(9, 9, 11, 0.92)`, `text: #f4f4f5`, `border: rgba(39, 39, 42, 0.8)`
     - Error: `bg: rgba(127, 29, 29, 0.92)`, `text: #fef2f2`, `border: rgba(220, 38, 38, 0.8)`

3. **Contextual Floating Icon Specification**
   - **Dimensions**: `28px × 28px` floating element (`icons/logo-ui.png`).
   - **Container**: Transparent background with drop shadow (`drop-shadow(0 2px 5px rgba(0,0,0,0.2))`). Do not wrap in an artificial colored circle or pill unless explicitly requested.
   - **Theme Adaptation**:
     - Light Mode / Light Inputs: `filter: none`
     - Dark Mode / Dark Inputs: `filter: brightness(0) invert(1)` (renders clean white logo)
   - **Icon States**:
     - Default: `logo-ui.png`
     - Loading: Spinner (`#6366f1` / `#38bdf8`)
     - Success: Checkmark SVG (`#09090b`)

---

## 2. Workflow & Execution Principles

1. **Strict Scope Discipline**:
   - Only touch files and logic directly relevant to the user's task.
   - Do not refactor unrelated functions or rename variables without request.

2. **Git & Commit Rules**:
   - **NEVER** run `git commit` or `git push` autonomously.
   - Only execute Git commit / push when the user explicitly commands it.

3. **Preserve Compatibility**:
   - Ensure compatibility with Chrome Manifest V3, Webpack/Vanilla JS structure, and synthetic event dispatching (`input`, `change`, `blur`) for framework reactivity (React, Vue, etc.).
