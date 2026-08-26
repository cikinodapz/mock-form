# mock-form

An open-source Chrome extension powered by Google Gemini AI to inspect, mock, and auto-fill web forms and upload images.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](#features)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4.svg?logo=googlechrome&logoColor=white)](#installation)
[![Google Gemini AI](https://img.shields.io/badge/Google-Gemini_AI-8E75FF.svg?logo=google&logoColor=white)](https://aistudio.google.com/)
[![License MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](#contributing)

---

## Overview

**mock-form** is a lightweight, privacy-focused browser extension designed for developers, QA engineers, software testers, and power users.

Tired of manually filling out tedious registration forms, checkout flows, or complex enterprise inputs during development and testing? **mock-form** uses **Google Gemini AI** (including Gemini 3.1 Flash Lite) to inspect DOM fields, infer context, and generate accurate, realistic mock data or custom persona entries with a single click.

---

## Features

- **Context-Aware AI Filling**: Automatically detects text, email, phone, numbers, dates, textareas, selects, checkboxes, and radio buttons.
- **Image & Avatar Injection**: Inject mock avatar photos into standard `<input type="file">` elements and custom drag-and-drop uploaders.
- **Natural Language Prompts**: Instruct the AI with custom prompts (e.g., *"Fill out as a Senior React Engineer living in San Francisco with a valid US phone number"*).
- **Framework Compatible**: Dispatches native synthetic JavaScript events (`input`, `change`, `blur`) to ensure reactivity with **React, Vue, Angular, Svelte**, and **Alpine.js**.
- **Reusable Data Profiles**: Save custom user profiles for instant 1-click population.
- **Pre-fill Field Inspector**: Scan and review detected fields before triggering auto-fill.
- **Flexible UI Modes**: Supports Side Panel, Floating Draggable Widget, or standard Action Popup.
- **Privacy & Security First**: API keys are stored strictly in your browser (`chrome.storage.local`). Direct communication with Google AI Studio with no middleman servers or telemetry tracking.

---

## Quick Start & Installation

### 1. Clone or Download Repository
```bash
git clone https://github.com/your-username/mock-form.git
```
*(Or download the repository ZIP file and extract it to a folder).*

### 2. Load Extension in Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** on in the top-right corner.
3. Click the **Load unpacked** button in the top-left.
4. Select the extracted `mock-form` directory.
5. **mock-form** is ready to use!

---

## Gemini API Key Setup

mock-form runs using Google's free tier for Gemini AI:

1. Open **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2. Sign in with your Google Account.
3. Click **Create API Key**.
4. Copy your key.
5. Open the **mock-form** extension -> navigate to the **Settings** tab -> paste your API Key -> Click **Save Key**.

---

## Supported Gemini Models

Choose from a variety of free-tier Google Gemini models directly inside the extension settings:

| Model Name | Speed | Typical Use Case | Cost |
| :--- | :---: | :--- | :---: |
| **Gemini 3.7 Flash** | Ultra Fast | State-of-the-art hybrid reasoning & speed | Free |
| **Gemini 3.6 Flash** | Ultra Fast | High-efficiency next-gen generation | Free |
| **Gemini 3.1 Flash Lite** | Ultra Fast | Instant form population | Free |
| **Gemini 3 Flash** | Very Fast | High accuracy for complex forms | Free |
| **Gemini 2.5 Flash** | Very Fast | High quality & balanced performance | Free |
| **Gemini 2.5 Flash Lite** | Ultra Fast | Fast default option | Free |
| **Gemini 2.0 Flash** | Fast | Standard AI task model | Free |
| **Gemini 1.5 Flash** | Moderate | Legacy support | Free |

---

## Usage

### 1. Fill Forms Automatically
1. Navigate to any website with an HTML form.
2. Open the **mock-form** extension panel.
3. Under the **Fill Form** tab, enter a custom instruction or leave it blank to auto-generate realistic dummy data.
   - *Example Prompt*: `"Fill with John Doe, john@example.com, phone +1555123456, software engineer"`
4. Click **Auto Fill**.

### 2. Inject Mock Avatar / Images
- Go to the **Image Injector** section in the extension popup.
- Select a mock avatar style.
- Click **Inject Image** to automatically attach the generated image to file inputs or drag-and-drop upload areas.

### 3. Save Custom Profiles
- Open the **Profiles** tab to create preset records (Name, Email, Phone, Address, Job Title, etc.).
- Click the **Play** button on any profile to instantly fill the current page using saved data.

---

## Architecture

1. **DOM Inspection**: `content.js` scans the active webpage for targetable HTML form controls, parsing labels, placeholders, `name`, `id`, `aria-label`, and type attributes.
2. **Context-Aware Prompt**: The extension formats form field metadata into a structured JSON schema and sends it to the Gemini API endpoint.
3. **Structured Response**: Gemini returns strict JSON mapping each field index to its contextually appropriate value.
4. **Synthetic Event Dispatch**: `content.js` updates each input value and dispatches native browser events (`InputEvent`, `ChangeEvent`, `BlurEvent`) so state-driven UI frameworks (React, Vue) detect the updates automatically.

---

## Security & Privacy

- **No Remote Servers**: Requests go directly from your browser to Google AI Studio APIs (`https://generativelanguage.googleapis.com`).
- **Local Storage Only**: Your API Key and saved profiles never leave your browser's local storage.
- **Minimal Permissions**: Uses standard Chrome `activeTab`, `storage`, and `scripting` APIs.

---

## Contributing

Contributions, bug reports, and feature requests are welcome.

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.
