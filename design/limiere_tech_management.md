---
name: Lumière Tech Management
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#424656'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
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
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-margin: 24px
  gutter: 16px
  card-padding: 20px
---

## Brand & Style
The design system is engineered for the high-paced retail environment of Cameroon’s tech sector. It balances professional reliability with a vibrant, local energy. The brand personality is "The Precise Partner"—an interface that feels cutting-edge yet approachable for store owners and staff.

The aesthetic utilizes **Corporate Modern** foundations with **Glassmorphism** accents to signify a premium, tech-forward experience. High contrast is a functional requirement to ensure legibility in varied lighting environments, from brightly lit storefronts to outdoor markets. The emotional response should be one of confidence, clarity, and momentum.

## Colors
This design system uses a high-chroma palette to differentiate various management states:
- **Primary (Tech Blue):** Used for primary actions, navigation, and brand-critical elements. It represents the digital infrastructure.
- **Secondary (Emerald Green):** Reserved for "Success" states, sales growth indicators, and "In Stock" markers.
- **Accent (Burnt Orange):** Applied sparingly for urgent alerts, low-stock warnings, and highlight callouts.
- **Neutral:** A deep slate blue-black is used for typography and icons to maintain professional grounding and high contrast against the light background.

The background uses a subtle cool-gray tint (#F8FAFC) to reduce eye strain while allowing glassmorphic cards to pop.

## Typography
The system relies exclusively on **Inter** for its neutral, systematic, and highly legible characteristics. 

- **Hierarchy:** Use bold weights for currency and stock counts to ensure they are the first thing a user sees.
- **Readability:** Maintain a minimum body size of 16px for general data entry to prevent fatigue during long shifts.
- **Numbers:** Since this is a management app, ensure tabular figures are used in data tables to keep currency (XAF) and quantities aligned and scannable.

## Layout & Spacing
The layout follows a **Fluid Grid** philosophy to accommodate everything from tablets used at a sales counter to mobile phones used for warehouse inventory.

- **Desktop/Tablet:** 12-column grid with 24px margins. Elements should be grouped into cards to maintain the glassmorphic structure.
- **Mobile:** 4-column grid with 16px margins. 
- **Rhythm:** All spacing must be a multiple of 8px. This "8pt Grid" ensures a clean, consistent vertical rhythm across dense data tables and spacious dashboards.
- **Data Density:** Use "Spacious" padding for dashboards to provide breathing room, but switch to "Compact" padding (8px) for inventory lists to maximize information density.

## Elevation & Depth
Depth is created through a mix of **Glassmorphism** and **Ambient Shadows**:

- **Surface Layer:** The main background is a flat, light neutral.
- **Card Layer:** Interactive containers use a semi-transparent white background (rgba(255, 255, 255, 0.7)) with a `backdrop-filter: blur(12px)`.
- **Shadows:** Cards use a very soft, diffused shadow (0px 8px 30px rgba(0, 102, 255, 0.08)). The shadow is subtly tinted with the Primary Tech Blue to create a sense of cohesion.
- **Active State:** When an item is selected or hovered, increase the shadow spread and reduce the transparency of the glass background to create a "lifted" effect.

## Shapes
The shape language is friendly but structured. 
- **Standard UI Elements:** Buttons, input fields, and small chips use a `0.5rem` (8px) radius.
- **Large Containers:** Dashboard cards and modal overlays use `rounded-lg` (16px) to emphasize the soft, modern feel.
- **Search Bars:** Should use `rounded-xl` (24px) or pill-shaped styling to distinguish global actions from data-entry fields.

## Components
- **Buttons:** Primary buttons are solid "Tech Blue" with white text. Secondary buttons use a glassmorphic style (transparent background with a thin border).
- **Inventory Chips:** Status indicators (e.g., "In Stock", "Out of Stock") use high-contrast pill shapes. "In Stock" uses a light Emerald Green background with dark green text.
- **Input Fields:** Use a solid white background with a 1px border. On focus, the border should transition to Tech Blue with a subtle outer glow.
- **Data Cards:** Every card should have a 1px semi-transparent white border to define its edges against the background, reinforcing the glass effect.
- **Sales List:** Items should have generous vertical padding (16px) with a subtle divider line. Use a larger, bold font for the price and a smaller, muted font for the IMEI or Serial Number.
- **KPI Widgets:** Prominent dashboard tiles showing "Daily Sales" or "Stock Value" should use the Primary color for the icon and the Secondary/Accent colors for the trend indicators.
