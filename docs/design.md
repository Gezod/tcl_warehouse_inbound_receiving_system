# Design System Specification: Warehouse Receiving System

| Item | Detail |
|---|---|
| Version | 1.0 |
| Date | 25 October 2026 |
| Audience | Frontend developers, reviewers, warehouse stakeholders |
| Companion Documents | docs/prd.md, docs/technical-spec.md |

---

## 1. Design Principles & Goals

1. **Information Density & Speed**:
   Floor operators at the receiving dock and shift supervisors require fast scan-and-act interfaces without unnecessary clutter, animations, or marketing fluff. High contrast, clear tabular numbers, and deterministic statuses are paramount.

2. **Accurate Hierarchy**:
   Every screen presents a clear primary action, contextual secondary controls, and unambiguous system status indicators using standard, semantic tokens.

3. **Accessibility & Assistive Tech**:
   - Contrast ratios comply with WCAG 2.1 AA.
   - All interactive elements possess explicit 2px focus rings with a 2px offset (`focus-visible`).
   - Status indicators do not rely on color alone; labels are clearly printed inside rounded pill badges.
   - Form fields have matching labels, validation messages are announced with `role="alert"`.

---

## 2. Design Tokens

### 2.1 Color Palette

| Token | Hex Value | Usage |
|---|---|---|
| **background** | `#FFFFFF` | Default canvas background |
| **surface** | `#FFFFFF` | Card, sheet, modal, and table containers |
| **surface-hover** | `#F8FAFC` | Hover states on table rows, secondary button hovers |
| **border** | `#E5E7EB` | Subtle dividers, card borders, table separators |
| **primary** | `#0A0A0A` | Near-black text, primary action buttons, active navigation states |
| **secondary** | `#6B7280` | Supporting metadata, field labels, descriptive subtitles |
| **muted** | `#9CA3AF` | Placeholder text, inactive icons, disabled states |

### 2.2 Status Badges & Indicators

Status indicators are styled with semantic background, text, and border tokens rendered as rounded pill badges (`rounded-pill px-2.5 py-0.5 text-xs font-medium`):

| Status | Background | Text Color | Border | Visual Meaning |
|---|---|---|---|---|
| **DRAFT** | `#F3F4F6` | `#4B5563` | `#E5E7EB` | Neutral gray, document being drafted |
| **OPEN** | `#EFF6FF` | `#1D4ED8` | `#BFDBFE` | Blue, submitted and ready for receiving |
| **PARTIALLY_RECEIVED** | `#FEF3C7` | `#B45309` | `#FDE68A` | Amber, goods are actively arriving |
| **COMPLETED** | `#ECFDF5` | `#047857` | `#A7F3D0` | Emerald green, delivery fulfilled and closed |
| **CANCELLED** | `#FEF2F2` | `#B91C1C` | `#FECACA` | Crimson red, cancelled before receipt |
| **ACTIVE (Product)** | `#ECFDF5` | `#047857` | `#A7F3D0` | Product active in catalogue |
| **INACTIVE (Product)**| `#F3F4F6` | `#4B5563` | `#E5E7EB` | Deactivated product |

### 2.3 Radii & Spacing

| Token | CSS Value | Usage |
|---|---|---|
| **rounded-card** | `12px` | Content cards, data tables, modals |
| **rounded-dialog** | `12px` | Confirmation dialogs, slide-over panels |
| **rounded-input** | `8px` | Text inputs, dropdowns, textareas |
| **rounded-button**| `8px` | Action buttons, filter pills |
| **rounded-pill** | `9999px` | Status badges, role tags |
| **max-w-content** | `1280px` | Maximum content width for standard viewport |

### 2.4 Typography

- **Font Family**: Inter (`--font-inter`), sans-serif fallback.
- **Monospace**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` for SKUs, document numbers (`RD-YYYY-NNNNNN`), and quantities.
- **Scale**:
  - `text-2xl`: Screen main titles (`24px`, font-bold, tracking-tight).
  - `text-xl`: Page headers, card section titles (`20px`, font-semibold).
  - `text-base`: Sub-headings, item labels (`16px`, font-semibold).
  - `text-sm`: Default body copy, table cell text, inputs (`14px`).
  - `text-xs`: Secondary descriptions, table header labels, badge text (`12px`).

---

## 3. Layout Architecture & Shared Shell

### 3.1 Structure

```
+-------------------------------------------------------------------------+
| Top Navigation Bar (Mobile only) / Desktop Fixed Sidebar (260px)        |
| - Logo & System Name ("Warehouse Receiving")                            |
| - Navigation links:                                                     |
|     * Dashboard                                                         |
|     * Receiving Documents                                               |
|     * Products                                                          |
|     * Inventory                                                         |
|     * Transactions                                                      |
|     * Users (Supervisor only)                                           |
| - Bottom user profile card: Name, Role Pill, Logout button              |
+-------------------------------------------------------------------------+
| Main Workspace (max-w-content: 1280px)                                  |
| - Page Header with Title & Contextual Action Buttons                    |
| - Metric Cards / Filter Toolbar                                         |
| - Primary Data Tables / Interactive Panels                              |
+-------------------------------------------------------------------------+
```

### 3.2 Navigation State
- Active items display high-contrast styling: `bg-primary text-white font-medium shadow-sm`.
- Inactive items display `text-secondary hover:text-primary hover:bg-surface-hover`.
- Mobile users access the same links through an off-canvas drawer triggered by a standard hamburger toggle button.

---

## 4. Component Patterns

### 4.1 Data Tables
- Header row with `text-xs uppercase font-medium text-muted bg-surface-hover`.
- Row height consistent at `48px` with subtle hover highlight (`hover:bg-surface-hover/70`).
- Numbers aligned to the right, SKUs and Document numbers formatted in monospace font.
- Empty states rendered with centered messaging and explicit guidance.

### 4.2 Modals & Sheets
- Semi-transparent backdrop with subtle blur (`bg-black/50 backdrop-blur-sm`).
- Modal dialogs capped at max-height `90vh` with internal scroll.
- Escape key and backdrop dismissal supported.
- Destructive actions (such as Document Cancellation) require explicit user confirmation.

### 4.3 Form Inputs
- Clear label above each input with red asterisk for mandatory fields.
- Field-level validation errors displayed directly beneath the input in red text (`text-xs text-red-600`) with assistive alert role.
- Global submission errors presented in an alert banner at the top of the dialog.
