const BASES = {
  light: {
    "--background": "#ededee",
    "--surface": "#ffffff",
    "--surface-muted": "#f5f5f6",
    "--text": "#1f2328",
    "--text-muted": "#61666d",
    "--border": "#d9dadc",
    "--accent": "#3a4048",
    "--accent-soft": "#e6e7e9",
  },
  dark: {
    "--background": "#161718",
    "--surface": "#1e1f21",
    "--surface-muted": "#26282a",
    "--text": "#e6e7e8",
    "--text-muted": "#9a9ea4",
    "--border": "#34363a",
    "--accent": "#c9ccd1",
    "--accent-soft": "#303236",
  },
};

const FONTS = {
  condensed: '"Bahnschrift", "DIN Alternate", "Roboto Condensed", "Arial Narrow", sans-serif',
  rounded: '"Nunito", "Segoe UI Variable Display", ui-rounded, system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Cascadia Code", Consolas, "SFMono-Regular", Menlo, monospace',
};

const ACCENT_WEIGHT = 0.32;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const THEMED = [
  "--background",
  "--surface",
  "--surface-muted",
  "--text",
  "--text-muted",
  "--border",
  "--accent",
  "--accent-soft",
  "--report-title",
  "--success",
  "--danger",
  "--radius",
  "--shadow",
  "--font",
  "--report-palette",
  "--report-title-transform",
  "--row-height",
  "--grid-gap",
  "color-scheme",
];

export const TEXT_SIZES = { small: "14px", medium: "18px", large: "26px", huge: "40px" };

export const VALUE_SIZES = { small: "15px", medium: "20px", large: "28px", huge: "38px" };

export const TITLE_SIZES = { small: "11px", medium: "13px", large: "16px", huge: "22px" };

export const WEIGHTS = { light: "300", regular: "400", bold: "700" };

export function setVariables(node, variables) {
  for (const [name, value] of Object.entries(variables)) {
    if (value === null || value === undefined || value === "") {
      node.style.removeProperty(name);
    } else {
      node.style.setProperty(name, value);
    }
  }
  return node;
}

function channels(color) {
  return [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
}

function blended(color, backdrop, weight) {
  const front = channels(color);
  const back = channels(backdrop);
  return `#${front
    .map((value, index) => Math.round(value * weight + back[index] * (1 - weight)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function accentVariables(theme, base) {
  const accent = Array.isArray(theme.palette) ? theme.palette[0] : null;
  const surface = theme.surface || base["--surface"];
  if (!HEX_COLOR.test(accent || "") || !HEX_COLOR.test(surface || "")) {
    return {};
  }
  return { "--accent": accent, "--accent-soft": blended(accent, surface, ACCENT_WEIGHT) };
}

function themeVariables(theme) {
  const base = BASES[theme.mode] || {};
  return {
    ...base,
    ...accentVariables(theme, base),
    "--background": theme.background || base["--background"],
    "--surface": theme.surface || base["--surface"],
    "--text": theme.text || base["--text"],
    "--text-muted": theme.muted || base["--text-muted"],
    "--border": theme.border || base["--border"],
    "--report-title": theme.title,
    "--success": theme.positive,
    "--danger": theme.negative,
    "--radius": Number.isInteger(theme.radius) ? `${theme.radius}px` : null,
    "--shadow": theme.shadow === false ? "none" : null,
    "--font": FONTS[theme.font],
    "--report-palette": Array.isArray(theme.palette) && theme.palette.length ? theme.palette.join(",") : null,
    "--report-title-transform": theme.uppercase_titles ? "uppercase" : null,
    "--row-height": Number.isInteger(theme.row_height) ? `${theme.row_height}px` : null,
    "--grid-gap": Number.isInteger(theme.gap) ? `${theme.gap}px` : null,
    "color-scheme": BASES[theme.mode] ? theme.mode : null,
  };
}

const SHELL = [
  "--background",
  "--surface",
  "--surface-muted",
  "--text",
  "--text-muted",
  "--border",
  "--accent",
  "--accent-soft",
  "--font",
  "color-scheme",
];

export function applyShell(theme) {
  const root = document.documentElement;
  setVariables(root, Object.fromEntries(SHELL.map((name) => [name, null])));
  root.classList.toggle("shell-themed", Boolean(theme && theme.shell));
  if (!theme || !theme.shell) {
    return;
  }
  const variables = themeVariables(theme);
  setVariables(root, Object.fromEntries(SHELL.map((name) => [name, variables[name]])));
}

export function applyTheme(target, theme) {
  setVariables(target, Object.fromEntries(THEMED.map((name) => [name, null])));
  target.classList.toggle("themed", Boolean(theme));
  if (theme) {
    setVariables(target, themeVariables(theme));
  }
}
