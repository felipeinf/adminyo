const HSL_COMPONENTS =
  /^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/;
const HSL_FUNCTION = /^hsla?\((.+)\)$/i;
const RGB_FUNCTION = /^rgba?\((.+)\)$/i;

export function isGradient(color: string): boolean {
  return /(?:linear|radial)-gradient\(/i.test(color);
}

export function primaryColorToCssVar(raw: string): string | null {
  const normalizedHsl = normalizeHsl(raw);
  if (normalizedHsl) {
    return normalizedHsl;
  }

  const hex = normalizeHex(raw) ?? rgbToHex(raw);
  if (!hex) {
    return null;
  }

  return hexToHslSpaceSeparated(hex);
}

export function hslToHex(hsl: string): string {
  const normalized = normalizeHsl(hsl);
  if (!normalized) {
    return "#000000";
  }

  const [hRaw, sRaw, lRaw] = normalized.split(" ");
  const h = Number.parseFloat(hRaw) / 360;
  const s = Number.parseFloat(sRaw.replace("%", "")) / 100;
  const l = Number.parseFloat(lRaw.replace("%", "")) / 100;

  const hueToRgb = (p: number, q: number, t: number): number => {
    let hue = t;
    if (hue < 0) hue += 1;
    if (hue > 1) hue -= 1;
    if (hue < 1 / 6) return p + (q - p) * 6 * hue;
    if (hue < 1 / 2) return q;
    if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
    return p;
  };

  let r = l;
  let g = l;
  let b = l;

  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  return rgbChannelsToHex([r * 255, g * 255, b * 255]);
}

export function extractFirstColorFromGradient(gradient: string): string {
  const hexMatch = gradient.match(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/);
  if (hexMatch) {
    return normalizeHex(hexMatch[0]) ?? "#000000";
  }

  const hslMatch = gradient.match(/hsla?\([^)]+\)|\b\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%/i);
  if (hslMatch) {
    return hslToHex(hslMatch[0]);
  }

  const rgbMatch = gradient.match(/rgba?\([^)]+\)/i);
  if (rgbMatch) {
    return rgbToHex(rgbMatch[0]) ?? "#000000";
  }

  return "#000000";
}

export function calculateLuminance(hex: string): number {
  const normalized = normalizeHex(hex) ?? rgbToHex(hex);
  if (!normalized) {
    return 0;
  }

  const [r, g, b] = hexToRgb(normalized).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyBrandingColor(color: string): void {
  const root = document.documentElement;
  const trimmed = color.trim();
  if (!trimmed) {
    return;
  }

  if (isGradient(trimmed)) {
    const firstColor = extractFirstColorFromGradient(trimmed);
    const primary = primaryColorToCssVar(firstColor);
    root.style.setProperty("--primary-gradient", trimmed);
    if (primary) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--ring", primary);
    }
    setSmartContrast(firstColor);
    return;
  }

  root.style.setProperty("--primary-gradient", "none");

  const primary = primaryColorToCssVar(trimmed);
  if (!primary) {
    return;
  }

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  setSmartContrast(trimmed.startsWith("#") ? trimmed : hslToHex(trimmed));
}

function setSmartContrast(color: string): void {
  const foreground = calculateLuminance(color) > 0.5 ? "0 0% 0%" : "0 0% 100%";
  document.documentElement.style.setProperty("--primary-foreground", foreground);
}

function normalizeHsl(raw: string): string | null {
  const trimmed = raw.trim();
  const inner = trimmed.match(HSL_FUNCTION)?.[1] ?? trimmed;
  const normalized = inner
    .replace(/\s*,\s*/g, " ")
    .replace(/\s*\/\s*[\d.]+%?$/, "")
    .replace(/\s+/g, " ")
    .trim();

  return HSL_COMPONENTS.test(normalized) ? normalized : null;
}

function normalizeHex(raw: string): string | null {
  let value = raw.trim();
  if (!value.startsWith("#")) {
    if (
      /^[0-9a-fA-F]{3,4}$/.test(value) ||
      /^[0-9a-fA-F]{6}$/.test(value) ||
      /^[0-9a-fA-F]{8}$/.test(value)
    ) {
      value = `#${value}`;
    } else {
      return null;
    }
  }

  const match = value.match(/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) {
    return null;
  }

  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((char) => char + char).join("");
  }

  return `#${hex.slice(0, 6)}`;
}

function rgbToHex(raw: string): string | null {
  const match = raw.trim().match(RGB_FUNCTION);
  if (!match) {
    return null;
  }

  const values = match[1]
    .split(/[\s,\/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((channel) => {
      if (channel.endsWith("%")) {
        return Math.max(
          0,
          Math.min(255, Math.round((Number.parseFloat(channel) / 100) * 255)),
        );
      }

      return Math.max(0, Math.min(255, Number.parseFloat(channel)));
    });

  if (values.length !== 3 || values.some(Number.isNaN)) {
    return null;
  }

  return rgbChannelsToHex(values);
}

function rgbChannelsToHex([r, g, b]: number[]): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(channel).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function hexToHslSpaceSeparated(hex: string): string | null {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return null;
  }

  const [r, g, b] = hexToRgb(normalized).map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let sat = 0;

  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        hue = ((b - r) / d + 2) / 6;
        break;
      default:
        hue = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}
