import { svgElement } from "./dom.js";

const SHAPES = {
  target: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["circle", { cx: 12, cy: 12, r: 5 }],
    ["circle", { cx: 12, cy: 12, r: 1.5 }],
  ],
  person: [
    ["circle", { cx: 12, cy: 8, r: 4 }],
    ["path", { d: "M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" }],
  ],
  building: [
    ["rect", { x: 4, y: 3, width: 16, height: 18, rx: 1 }],
    ["path", { d: "M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M11 21v-3h2v3" }],
  ],
  home: [
    ["path", { d: "M3 11l9-7 9 7" }],
    ["path", { d: "M5 10v10h14V10M10 20v-5h4v5" }],
  ],
  money: [
    ["rect", { x: 2, y: 6, width: 20, height: 12, rx: 2 }],
    ["circle", { cx: 12, cy: 12, r: 3 }],
  ],
  calendar: [
    ["rect", { x: 3, y: 5, width: 18, height: 16, rx: 2 }],
    ["path", { d: "M3 10h18M8 3v4M16 3v4" }],
  ],
  chart: [["path", { d: "M4 20V11M10 20V5M16 20v-7M2 20h20" }]],
  arrow_up: [["path", { d: "M12 19V5M5 12l7-7 7 7" }]],
  arrow_down: [["path", { d: "M12 5v14M19 12l-7 7-7-7" }]],
  check: [["path", { d: "M5 12l5 5 9-10" }]],
  alert: [
    ["path", { d: "M12 3l10 18H2z" }],
    ["path", { d: "M12 10v5M12 18v.5" }],
  ],
};

export function icon(name, title = "") {
  const shapes = SHAPES[name];
  if (!shapes) {
    return null;
  }
  return svgElement(
    "svg",
    {
      class: "icon",
      viewBox: "0 0 24 24",
      width: 18,
      height: 18,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.8,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      role: title ? "img" : "presentation",
      "aria-label": title || null,
      "aria-hidden": title ? null : "true",
    },
    shapes.map(([tag, attributes]) => svgElement(tag, attributes)),
  );
}
