---
name: Dubai Phone Retail Logic
colors:
  surface: '#FAFAFA'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#FFFFFF'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#424656'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#727687'
  outline-variant: '#c2c6d8'
  surface-tint: '#0054d6'
  primary: '#0050cb'
  on-primary: '#ffffff'
  primary-container: '#0066ff'
  on-primary-container: '#f8f7ff'
  inverse-primary: '#b3c5ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#7f4f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#a06500'
  on-tertiary-container: '#fff7f1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae1ff'
  primary-fixed-dim: '#b3c5ff'
  on-primary-fixed: '#001849'
  on-primary-fixed-variant: '#003fa4'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  destructive: '#EF4444'
  text-primary: '#0F172A'
  text-secondary: '#475569'
  border-subtle: '#E2E8F0'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
  price-display:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  component-gap: 8px
  section-gap: 24px
---

## Brand & Style

The design system is crafted for the retail management landscape of Cameroon, specifically tailored for "Dubai Phone." It embodies a **Corporate / Modern** aesthetic with a heavy emphasis on **High-Density but Readable** layouts, drawing inspiration from the precision and clarity of Stripe and Linear.

The brand personality is **Precise, Fast, and Authoritative**. It aims to evoke a sense of operational control and professional trust. The UI utilizes a "Management-First" approach: every pixel is dedicated to clarity, ensuring that store managers and sales staff can process transactions (XAF) and track inventory with zero friction. While the core is professional, subtle **Glassmorphism** is used on overlays and sidebars to provide a contemporary, tech-forward feel that differentiates the tool from legacy ERP software.

## Colors

The palette is anchored by **Trust Blue (#0066FF)**, chosen for its association with reliability and digital infrastructure. 

- **Primary:** Driving the main action hierarchy and navigation.
- **Success & Warning:** High-saturation greens and ambers are used for stock levels and transaction approvals.
- **Destructive:** A clear, bright red for stock deletions or voided sales.
- **Neutral Grays:** We use a Slate-based gray scale to provide professional depth without feeling "cold."

The default mode is **Light**, optimized for high-visibility retail environments. Surfaces use a layered approach: a very light off-white background (`#FAFAFA`) with pure white containers (`#FFFFFF`) to create distinct separation of data modules.

## Typography

This design system uses **Inter** exclusively to ensure maximum legibility across various screen qualities. The hierarchy is designed for **High-Density Data**:

- **Numerical Clarity:** Prices (XAF) and stock quantities use `price-display` or `headline-md` with `tabular-nums` settings to ensure columns of numbers align perfectly in tables.
- **Scannability:** Labels are prioritized with slightly increased letter spacing and uppercase styling where appropriate to differentiate metadata from user data.
- **Adaptability:** On mobile, headlines scale down to ensure that long product names (e.g., specific phone models) do not break the layout.

## Layout & Spacing

The system follows a **Fixed Grid** philosophy for desktop dashboards to ensure data columns remain predictable for staff, transitioning to a **Fluid Grid** for mobile inventory counting.

- **Desktop (1280px+):** 12-column grid with 32px margins and 16px gutters.
- **Tablet (768px - 1279px):** 8-column grid with 24px margins.
- **Mobile (Up to 767px):** 4-column grid with 16px margins.

We use a **4px base unit** (8px rhythm). For POS (Point of Sale) screens, we prioritize "Compact" spacing (8px between elements) to keep all critical transaction data above the fold. Dashboard views use "Relaxed" spacing (16px - 24px) to reduce cognitive load during financial reviews.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** and **Low-Contrast Outlines**. Instead of heavy shadows, we use subtle borders to define structure, keeping the UI clean and fast.

- **Level 0 (Background):** `#FAFAFA` — The canvas.
- **Level 1 (Cards/Tables):** `#FFFFFF` with a `1px` border in `#E2E8F0`. 
- **Level 2 (Dropdowns/Modals):** High-diffused ambient shadow: `0px 10px 15px -3px rgba(0, 0, 0, 0.05), 0px 4px 6px -2px rgba(0, 0, 0, 0.02)`.
- **Interactions:** Hover states on rows or buttons utilize a `2px` lift or a subtle background tint (`#F1F5F9`) rather than increased elevation to maintain the "flat" professional aesthetic.

## Shapes

The design system uses a **Rounded** (8px) language. This radius is applied consistently to all primary UI elements:

- **Buttons & Inputs:** 8px (`rounded`) for a balanced, modern look.
- **Small Components:** 4px (`rounded-sm`) for checkboxes and tags.
- **Status Badges:** Pill-shaped (`rounded-full`) to clearly distinguish them from interactive buttons.
- **Cards:** 12px (`rounded-lg`) for main dashboard containers to provide a softer frame for the dense data within.

## Components

### Buttons
- **Primary:** Solid `#0066FF` with white text. High-contrast, 8px radius.
- **Secondary:** White background with a `#E2E8F0` border and `#475569` text.
- **POS Action:** Large, 48px height buttons for quick tapping on tablets.

### Data Tables
- **Header:** Light gray background (`#F8FAFC`), bold labels, 1px bottom border.
- **Rows:** 56px minimum height for readability. Alternate row striping is optional; use hover highlights as the default.
- **Currency:** Right-aligned XAF values using Inter’s tabular figures.

### Input Fields
- **Stateful:** Clear focus rings using a 2px blue outline with 4px offset.
- **Validation:** Inline error messages in `#EF4444` with small icons.

### Status Badges
- **Success (In Stock):** Light green background with dark green text.
- **Low Stock:** Light amber background with dark amber text.
- **Out of Stock:** Light red background with dark red text.

### Charts & Financials
- Use simplified line charts for sales trends. 
- Avoid heavy gradients; use solid strokes of Primary Blue or Success Green with a 10% opacity fill underneath.