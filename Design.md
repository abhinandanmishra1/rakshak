# Rakshak — UI/UX Design System Specification

This document details the user interface (UI) design, visual layout, and user experience (UX) paradigms implemented across the Rakshak Proactive AI Intervention Engine.

---

## 1. Design Aesthetics & Visual Language

Rakshak employs a specialized **Light Cyber Security Operations Center (CSOC)** theme. The theme rejects traditional dark, chaotic hacker-style green-on-black consoles in favor of a clean, premium, and trustworthy medical-grade enterprise safety aesthetic.

### 1.1. Color Palette

The color strategy uses high contrast ratios to separate safe, monitoring, and warning states:

| CSS Color Variable | Hex Code | Visual Application | Emotional Intent |
| :--- | :--- | :--- | :--- |
| `--background-base` | `#f8fafc` | Main screen body background | Professionalism, cleanliness |
| `--surface-card` | `#ffffff` | Elevation grids, cards, sidebars | Trust, transparency |
| `--text-main` | `#0f172a` | Headers, active menu links, labels | High legibility, authority |
| `--text-muted` | `#64748b` | Sub-captions, timestamps, disabled items | Secondary focus, low clutter |
| `--guardian-emerald` | `#10b981` | Safe states, monitoring indicators | Calmness, security, protection |
| `--primary-glow` | `#0072ff` | Connection active toggles, hover paths | Innovation, intelligence |
| `--warning-crimson` | `#ef4444` | High-risk overlays, hazard icons | Urgency, immediate pause |

### 1.2. Typography

*   **Main Font Family**: Google Fonts' **Inter** or **Outfit** (`var(--font-sans)`).
*   **Weights**:
    *   `500` (Medium) for body copy.
    *   `600` (Semi-bold) for navigation buttons and form labels.
    *   `700` (Bold) for grid card headers.
    *   `800` (Extra-bold) for brand headings and risk warnings.

---

## 2. Layout Structure & Navigation Grid

The workspace is organized into a split viewport that balances persistent system monitoring on the left and interactive content/controls on the right.

### 2.1. Left Sticky Sidebar (`280px`)

The left sidebar is persistent, providing immediate brand recognition and passive status verification:
1.  **Brand Identity Section**: Combines a bold shield icon (`🛡️`) with the `Rakshak` title and sub-tagline `PROACTIVE AI GUARDIAN`.
2.  **Navigation Links**: Clean, icon-prefix buttons with transition slides when hovered.
3.  **Passive Status Indicator**: A light grey-surface card nested at the bottom:
    *   Displays a green checkmark (`✓`) with the status `STANDBY`.
    *   Hosts an active, animated **Audio-Wave Sparkline** (simulated via CSS `@keyframes` on varying height bars) to reassure users that the cognitive shield is actively listening and reasoning in the background.

### 2.2. Main Control Workspace (Right Column Grid)

The right panel is highly organized, using responsive CSS grid templates (`grid-template-columns: 1.2fr 1fr`):
*   **Header Bar**: Displayed at the very top with light drop-shadows. Provides quick-access language controls and active stream status indicators.
*   **Guardian View Card (Left Column)**: The focal point of visual evidence. Displays the active screen-capture stream. When inactive, it presents a double-radial-pulsing shield illustration to encourage the user to engage screen capture.
*   **Live Session Manager Card (Right Column Top)**: Organizes actions into high-end vertical row buttons rather than plain form fields. Includes interactive connection rows, screen tracking toggles, and microphone shield overrides.
*   **Console Event Streams Card (Right Column Bottom)**: A dark-surface (`#0f172a`) developer-facing cybersecurity console showing real-time event logs with distinct coloration for `SYSTEM`, `INFO`, and `WARN` events.
*   **Intervention Logs Card (Full-Width Bottom)**: Dynamic responsive card grid displaying historical threats complete with visual screen captures and verbal dialog outputs.

---

## 3. High-Confidence Intervention Overlay UX

The **AI Intervention Overlay** is a critical, high-impact modal that interrupts unsafe user behavior immediately:

```
+-------------------------------------------------------------+
|                                                             |
|                       ⚠️ WARNING                             |
|             Unsafe Interaction Detected                     |
|                                                             |
|   Intervention Analysis:                                    |
|   "User is trying to enter their UPI PIN to receive money."  |
|                                                             |
|   [======================== 95% Confidence ===============] |
|                                                             |
|   Verbal Dialog Shield:                                     |
|   (🔊 Audio warning looping in Hindi / English)              |
|                                                             |
|                     [ Resume Protection ]                   |
|                                                             |
+-------------------------------------------------------------+
```

### 3.1. Visual & Audio Staging
*   **Pulse Interruption**: Uses an absolute crimson translucent wrapper with high blur (`backdrop-filter: blur(8px)`) that instantly grabs the user's attention.
*   **Confidence Meter**: Includes a linear horizontal progress bar displaying the exact confidence score (e.g., `95%`) calculated by Gemini, increasing the user's trust in the engine's warning.
*   **Dialogue Waves**: Displays an active, animated equalizer wave adjacent to the Hindi warning subtitles, indicating that vocal alerts are currently playing back from their speakers.
