# Adminyo UI - Complete Redesign Notes

## Overview
Complete UI redesign of the Adminyo React admin panel with a clean, minimal white aesthetic, modern shadows, and a floating sidebar overlay (similar to VSCode/Freeflow).

## Design System

### Color Palette
```
--background:  0 0% 100%      /* Pure white */
--foreground:  0 0% 5%        /* Almost black (#0D0D0D) */
--muted:       0 0% 45%       /* Medium gray (#737373) */
--border:      0 0% 92%       /* Very light gray (#EBEBEB) */
--primary:     262 80% 50%    /* Indigo (#6C5CE7) */
--radius:      0.5rem         /* 8px border-radius */
```

### Layout Structure

```
┌──────────────────────────────────────────────────────┐
│  NAVBAR (56px height, white, shadow-sm)              │
├────────┬────────────────────────────────────────────┤
│        │                                            │
│ FSB    │  MAIN CONTENT (white, overflow-auto)      │
│ (250px)│  • Header (border-b)                      │
│        │  • Toolbar                                │
│        │  • Table/Content area                     │
│        │                                            │
└────────┴────────────────────────────────────────────┘

FSB = Floating Sidebar (fixed desktop, modal mobile)
```

## Files Modified (16 Total)

### Layout & Structure
1. **Layout.tsx** - Main layout wrapper with sidebar state management
2. **Navbar.tsx** - Top navigation bar with logo and user menu
3. **Sidebar.tsx** - Floating sidebar with navigation items

### Global Styles
4. **index.css** - CSS variables and base styles

### UI Components
5. **Button.tsx** - Button component with multiple variants
6. **Input.tsx** - Text input with clean styling
7. **Card.tsx** - Card container with subtle shadows
8. **Badge.tsx** - Status badges without borders
9. **Table.tsx** - Table structure and styling
10. **DropdownMenu.tsx** - Dropdown menus with smooth animations
11. **Dialog.tsx** - Modal dialogs with overlay
12. **Skeleton.tsx** - Loading skeleton placeholders
13. **EmptyState.tsx** - Empty state illustration

### Pages/Views
14. **Login.tsx** - Login page with centered card
15. **EntityView.tsx** - Entity list view with header and toolbar
16. **DataTable.tsx** - Data table with actions and pagination

## Key Features

### Navbar (56px)
- Logo + app name on the left
- User avatar dropdown on the right
- Hamburger menu for mobile
- Subtle shadow: `shadow-sm`
- Clean white background

### Floating Sidebar

**Desktop (md+):**
- Position: `fixed`
- Width: `250px`
- Shadow: `shadow-lg` (modern depth)
- Top: `56px` (below navbar)
- Navigation items with active left border (PRIMARY color)

**Mobile:**
- Modal drawer that slides in from left
- Overlay: `bg-black/20`
- Smooth animation: `translate-x` with `transition-200`
- Close button and overlay tap to dismiss

### Main Content
- Background: white
- Overflow-auto for scrollable content
- Responsive padding:
  - Desktop: `32px`
  - Tablet: `24px`
  - Mobile: `16px`

### Components

**Button**
- Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- Sizes: `sm` (h-8), `default` (h-10), `lg` (h-11), `icon`
- Default state: `bg-primary` with `shadow-sm`
- Hover: `shadow-md` + `opacity-90`
- Active: `scale-95` transform

**Input**
- Border: light gray (`#E5E7EB`)
- Focus: `ring-primary/20` + `border-primary`
- Disabled: `bg-gray-50`
- Smooth transitions: `150ms`

**Card**
- Border: light gray
- Shadow: `sm` with `hover:shadow-md`
- Padding: `p-6`
- Rounded: `md` (8px)

**Table**
- Header: `bg-gray-50` with uppercase text
- Rows: `border-b` with `hover:bg-gray-50`
- Smooth transitions: `150ms`

**Dropdown Menu**
- Content: rounded-lg, `shadow-lg`
- Items: `hover:bg-gray-50`
- Separators: `bg-border`
- Smooth animations

**Dialog**
- Overlay: `bg-black/20`
- Content: white background, `rounded-lg`, `shadow-lg`
- Close button: `hover:bg-gray-100`

## Responsive Design

| Breakpoint | Layout |
|------------|--------|
| Mobile (<640px) | Sidebar: modal drawer, Navbar: hamburger menu |
| Tablet (640-1024px) | Sidebar: adjustable, Navbar: full |
| Desktop (>1024px) | Sidebar: fixed floating (250px), Navbar: full width |

## Transitions & Animations

All transitions use:
- Duration: `150ms`
- Easing: `ease-out`
- Properties: colors, shadow, transform

Examples:
```tsx
className="transition-all duration-150"
className="transition-colors duration-150"
className="hover:shadow-md transition-shadow duration-150"
```

## Color Usage

| Component | Usage |
|-----------|-------|
| Primary | Logo, active states, buttons, links |
| Foreground | Main text, headings |
| Muted | Placeholder text, secondary text |
| Border | Divider lines, input borders |
| Background | Page background |
| Gray-50 | Hover states, section backgrounds |
| Red-50 | Error states background |

## Accessibility

- Radix UI for complex components
- ARIA labels on interactive elements
- Focus rings in primary color
- Full keyboard navigation support
- Semantic HTML structure

## Implementation Notes

1. **No gradients** - All solid colors using CSS variables
2. **Subtle shadows** - `shadow-sm` for elements, `shadow-lg` for modals
3. **Consistent spacing** - Padding: `p-4`, `p-6`; Gap: `gap-3`, `gap-4`
4. **Default rounded** - All corners use `rounded-md` (8px)
5. **Smooth interactions** - Hover states with transitions
6. **Mobile-first approach** - Design for mobile, enhance for desktop

## How to Build

```bash
cd /Users/feli/flewlabs/aminyo/ui
npm install
npm run build

# For development
npm run dev
```

## Customization

To customize colors, edit CSS variables in `src/index.css`:

```css
:root {
  --primary: 262 80% 50%;      /* Change primary color */
  --background: 0 0% 100%;     /* Change background */
  --foreground: 0 0% 5%;       /* Change text color */
}
```

All Tailwind utilities will automatically use the updated colors.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS variables support required
- Flexbox and Grid support required
- Radix UI components handle accessibility

## Performance

- Lightweight components with no bloat
- CSS variables for fast theme switching
- Optimized Tailwind output
- Minimal JavaScript in UI components
- No unnecessary re-renders

---

**Status:** ✅ Complete and ready to compile
**Date:** April 4, 2026
**Version:** 1.0.0
