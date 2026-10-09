import { element } from "./dom.js";
import { formatCell, formatCompact, formatMeasure } from "./format.js";
import { STACKABLE } from "./validation.js";

const LIGHT_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

const DARK_PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

const FALLBACK_THEME = {
  muted: "#667085",
  border: "#e2e5ea",
  surface: "#ffffff",
  text: "#1c2330",
  font: "system-ui, sans-serif",
};

const LABEL_SIZE = 11;

const COMBO_STACK = "columns";

const NICE_STEPS = [1, 2, 2.5, 5, 10];

const DARK_SCHEME = "(prefers-color-scheme: dark)";

const EMPTY_MESSAGE = "Sem dados para exibir.";

const MISSING_LIBRARY_MESSAGE = "A biblioteca de gráficos não carregou.";

const ELLIPSIS = "…";

const HTML_ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

const DIMMED_OPACITY = 0.3;

const SLIDER_THRESHOLD = 15;

const SLIDER_SIZE = 16;

const LEGEND_HEIGHT = 28;

const EDGE_GAP = 8;

const CATEGORY_LABEL_WIDTH = 96;

const SIDE_LABEL_WIDTH = 120;

const LEGEND_LABEL_WIDTH = 140;

const PIE_LABEL_LIMIT = 12;

const PIE_MINIMUM_LABEL_ANGLE = 4;

const MARKER_SIZE = 7;

const SELECTED_MARKER_SIZE = 10;

const BAR_RADIUS = 4;

const BAR_MAXIMUM_WIDTH = 32;

const AREA_OPACITY = 0.16;

const STACKED_AREA_OPACITY = 0.5;

const STACK_GROUP = "total";

const SHARE_DECIMALS = 1;

const NEUTRAL_WASH = "rgba(127, 127, 127, 0.14)";

const ANIMATION_DURATION = 300;

const UPDATE_DURATION = 200;

function numeric(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

function measurePositions(columns) {
  return columns.flatMap((column, index) => (index > 0 && column.kind === "measure" ? [index] : []));
}

function measureSeries(columns, rows) {
  return measurePositions(columns).map((columnIndex) => ({
    column: columns[columnIndex],
    values: rows.map((row) => numeric(row[columnIndex])),
  }));
}

function hasValues(series) {
  return series.some((item) => item.values.some((value) => value !== null));
}

function highlightFlags(rows, selected) {
  return rows.map((row) => selected.size === 0 || selected.has(row[0]));
}

function stackMode(field, visual) {
  return STACKABLE.has(visual) && (field.stack === "stacked" || field.stack === "percent") ? field.stack : "none";
}

function positiveTotal(series, index) {
  return series.reduce((total, item) => {
    const value = item.values[index];
    return value !== null && value > 0 ? total + value : total;
  }, 0);
}

function shareOf(value, total) {
  return value === null || total <= 0 ? null : value / total;
}

function withShares(series) {
  const totals = [...series[0].values.keys()].map((index) => positiveTotal(series, index));
  return series.map((item) => ({ ...item, shares: item.values.map((value, index) => shareOf(value, totals[index])) }));
}

function chartModel(field, result, interaction) {
  const columns = result.columns || [];
  const rows = result.rows || [];
  const groupColumn = columns[0];
  if (!groupColumn || groupColumn.kind !== "group" || !rows.length) {
    return null;
  }
  const series = measureSeries(columns, rows);
  if (!hasValues(series)) {
    return null;
  }
  const selected = new Set(interaction.selectedValues || []);
  const visual = BUILDERS[field.visual] ? field.visual : "column";
  const stack = stackMode(field, visual);
  const styled = series.map((item) => ({ ...item, style: seriesStyle(field, item.column) }));
  const format = field.format || {};
  return {
    visual,
    stack,
    stackColumns: visual === "combo" && field.stack === "stacked",
    categories: rows.map((row) => formatCell(row[0], groupColumn)),
    series: stack === "percent" ? withShares(styled) : styled,
    selecting: selected.size > 0,
    highlighted: highlightFlags(rows, selected),
    clickable: Boolean(interaction.onSelect || interaction.onDrill),
    legend: format.legend || "bottom",
    labels: Boolean(format.data_labels),
  };
}

function seriesStyle(field, column) {
  const styles = field.series || {};
  return styles[column.key] || {};
}

function labelled(model, series) {
  return typeof series.style.labels === "boolean" ? series.style.labels : model.labels;
}

function labelText(model, series) {
  return (entry) => {
    const index = entry.dataIndex;
    if (!Number.isInteger(index) || series.values[index] === null) {
      return "";
    }
    if (model.stack !== "percent") {
      return formattedValue(series, index);
    }
    const share = series.shares[index];
    return share === null ? formattedValue(series, index) : `${formattedValue(series, index)}  ${formatMeasure(share, "percent", 0)}`;
  };
}

function labelOptions(model, series, theme, position) {
  if (!labelled(model, series)) {
    return {};
  }
  return {
    label: {
      show: true,
      position,
      color: theme.text,
      fontSize: LABEL_SIZE,
      fontFamily: theme.font,
      formatter: labelText(model, series),
    },
    labelLayout: { hideOverlap: true },
  };
}

function colorPart(series) {
  return series.style.color ? { itemStyle: { color: series.style.color } } : {};
}

function seriesColors(field, theme) {
  const custom = field.format && field.format.color;
  if (!custom) {
    return theme.palette;
  }
  return [custom, ...theme.palette.filter((color) => color.toLowerCase() !== custom.toLowerCase())];
}

function escaped(text) {
  return String(text).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

function formattedValue(series, index) {
  return formatCell(series.values[index], series.column);
}

function shareValue(series, index) {
  const share = series.shares[index];
  const value = formattedValue(series, index);
  return share === null ? value : `${formatMeasure(share, "percent", SHARE_DECIMALS)} (${value})`;
}

function tooltipValue(model, series, index) {
  return model.stack === "percent" ? shareValue(series, index) : formattedValue(series, index);
}

function tooltipLine(marker, title, value) {
  return `${marker}${escaped(title)}: <strong>${escaped(value)}</strong>`;
}

function tooltipHeader(text) {
  return `<strong>${escaped(text)}</strong>`;
}

function axisTooltip(model) {
  return (entries) => {
    const list = [].concat(entries);
    const index = list.length ? list[0].dataIndex : null;
    if (!Number.isInteger(index)) {
      return "";
    }
    const lines = list.map((entry) => {
      const series = model.series[entry.seriesIndex];
      return tooltipLine(entry.marker, series.column.title, tooltipValue(model, series, index));
    });
    return [tooltipHeader(model.categories[index]), ...lines].join("<br>");
  };
}

function shareText(entry) {
  return formatMeasure(entry.percent / 100, "percent", 1);
}

function pieTooltip(model) {
  const series = model.series[0];
  return (entry) => {
    if (!Number.isInteger(entry.dataIndex)) {
      return escaped(entry.name ?? "");
    }
    const value = `${formattedValue(series, entry.dataIndex)} (${shareText(entry)})`;
    return `${tooltipHeader(model.categories[entry.dataIndex])}<br>${tooltipLine(entry.marker, series.column.title, value)}`;
  };
}

function axisPointerOptions(theme, pointer) {
  return {
    type: pointer,
    shadowStyle: { color: NEUTRAL_WASH },
    lineStyle: { color: theme.muted, type: "dashed" },
  };
}

function tooltipOptions(theme, trigger, formatter, pointer) {
  const options = {
    trigger,
    confine: true,
    formatter,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: theme.text, fontFamily: theme.font, fontSize: 12 },
    extraCssText: "border-radius: 8px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);",
  };
  return pointer ? { ...options, axisPointer: axisPointerOptions(theme, pointer) } : options;
}

function percentTick(value) {
  const points = Math.round(value * 1000) / 10;
  return formatMeasure(value, "percent", Number.isInteger(points) ? 0 : 1);
}

function compactTick(value) {
  return formatCompact(value);
}

function tickFormatter(columns) {
  const percent = columns.length > 0 && columns.every((column) => column.format === "percent");
  return percent ? percentTick : compactTick;
}

function baseOptions(theme, colors) {
  return {
    backgroundColor: "transparent",
    color: colors,
    textStyle: { fontFamily: theme.font, color: theme.muted },
    animationDuration: ANIMATION_DURATION,
    animationDurationUpdate: UPDATE_DURATION,
    animationEasing: "cubicOut",
  };
}

function legendVisible(model) {
  return model.legend !== "none" && (model.visual === "pie" || model.series.length > 1);
}

function legendPlacement(model) {
  return model && model.legend === "top" ? { top: 0 } : { bottom: 0 };
}

function legendOptions(theme, model = null) {
  return {
    type: "scroll",
    ...legendPlacement(model),
    left: "center",
    icon: "roundRect",
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 14,
    textStyle: { color: theme.muted, width: LEGEND_LABEL_WIDTH, overflow: "truncate", ellipsis: ELLIPSIS },
    pageIconColor: theme.muted,
    pageIconInactiveColor: theme.border,
    pageTextStyle: { color: theme.muted },
    tooltip: { show: true, formatter: (entry) => escaped(entry.name ?? "") },
  };
}

function legendPart(model, theme) {
  return legendVisible(model) ? { legend: legendOptions(theme, model) } : {};
}

function pointerCursor(model) {
  return model.clickable ? "pointer" : "default";
}

function categoryAxis(model, theme, shape) {
  return {
    type: "category",
    data: model.categories,
    inverse: shape.horizontal,
    boundaryGap: !shape.continuous,
    triggerEvent: model.clickable,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: theme.border } },
    axisLabel: {
      color: theme.muted,
      width: shape.horizontal ? SIDE_LABEL_WIDTH : CATEGORY_LABEL_WIDTH,
      overflow: "truncate",
      ellipsis: ELLIPSIS,
      hideOverlap: true,
    },
  };
}

function valueAxis(columns, theme, gridLines) {
  return {
    type: "value",
    axisLabel: { color: theme.muted, formatter: tickFormatter(columns) },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: gridLines, lineStyle: { color: theme.border } },
  };
}

function shareAxis(theme) {
  const axis = valueAxis([], theme, true);
  return { ...axis, min: 0, max: 1, axisLabel: { ...axis.axisLabel, formatter: percentTick } };
}

function plotAxis(model, theme) {
  return model.stack === "percent" ? shareAxis(theme) : valueAxis(measureColumns(model.series), theme, true);
}

function plottedValues(model, series) {
  if (model.stack === "none") {
    return series.values;
  }
  const values = model.stack === "percent" ? series.shares : series.values;
  return values.map((value) => (value === null ? 0 : value));
}

function stackPart(model) {
  return model.stack === "none" ? {} : { stack: STACK_GROUP };
}

function barRadius(model, horizontal) {
  if (model.stack !== "none" || model.stackColumns) {
    return 0;
  }
  return horizontal ? [0, BAR_RADIUS, BAR_RADIUS, 0] : [BAR_RADIUS, BAR_RADIUS, 0, 0];
}

function areaOpacity(model) {
  return model.stack === "none" ? AREA_OPACITY : STACKED_AREA_OPACITY;
}

function itemOpacity(model, index) {
  return model.highlighted[index] ? 1 : DIMMED_OPACITY;
}

function markerSize(model, index) {
  return model.selecting && model.highlighted[index] ? SELECTED_MARKER_SIZE : MARKER_SIZE;
}

function barItems(model, values) {
  return values.map((value, index) => ({ value, itemStyle: { opacity: itemOpacity(model, index) } }));
}

function lineItems(model, values) {
  return values.map((value, index) => ({
    value,
    symbolSize: markerSize(model, index),
    itemStyle: { opacity: itemOpacity(model, index) },
  }));
}

function barLabelPosition(model, horizontal) {
  if (model.stack !== "none" || model.stackColumns) {
    return "inside";
  }
  return horizontal ? "right" : "top";
}

function barSeries(model, series, horizontal, theme) {
  const color = series.style.color ? { color: series.style.color } : {};
  return {
    type: "bar",
    name: series.column.title,
    data: barItems(model, plottedValues(model, series)),
    cursor: pointerCursor(model),
    barMaxWidth: BAR_MAXIMUM_WIDTH,
    barGap: "12%",
    itemStyle: { borderRadius: barRadius(model, horizontal), ...color },
    ...labelOptions(model, series, theme, barLabelPosition(model, horizontal)),
    ...stackPart(model),
  };
}

function lineSeries(model, series, area, axisIndex, theme) {
  const options = {
    type: "line",
    name: series.column.title,
    data: lineItems(model, plottedValues(model, series)),
    yAxisIndex: axisIndex,
    cursor: pointerCursor(model),
    symbol: "circle",
    showAllSymbol: model.selecting ? true : "auto",
    lineStyle: { width: 2, ...(series.style.dashed ? { type: "dashed" } : {}), ...(series.style.color ? { color: series.style.color } : {}) },
    ...colorPart(series),
    ...labelOptions(model, series, theme, "top"),
    ...stackPart(model),
  };
  return area ? { ...options, areaStyle: { opacity: areaOpacity(model) } } : options;
}

function cartesianLayout(model, horizontal) {
  const legend = legendVisible(model) ? LEGEND_HEIGHT : 0;
  const legendSpace = model.legend === "top" ? 0 : legend;
  const slider = model.categories.length > SLIDER_THRESHOLD;
  const sliderSpace = slider ? SLIDER_SIZE + EDGE_GAP : 0;
  return {
    slider,
    legendSpace,
    top: EDGE_GAP * 2 + (model.legend === "top" ? legend : 0),
    bottom: legendSpace + EDGE_GAP + (horizontal ? 0 : sliderSpace),
    right: EDGE_GAP * 2 + (horizontal ? sliderSpace : 0),
  };
}

function sliderPlacement(horizontal, layout) {
  if (horizontal) {
    return { yAxisIndex: 0, orient: "vertical", right: EDGE_GAP / 2, top: EDGE_GAP * 2, bottom: layout.bottom, width: SLIDER_SIZE };
  }
  return { xAxisIndex: 0, left: EDGE_GAP * 2, right: EDGE_GAP * 2, bottom: layout.legendSpace + EDGE_GAP / 2, height: SLIDER_SIZE };
}

function sliderOptions(theme, horizontal, layout) {
  return {
    type: "slider",
    ...sliderPlacement(horizontal, layout),
    showDetail: false,
    brushSelect: false,
    backgroundColor: "transparent",
    borderColor: theme.border,
    fillerColor: NEUTRAL_WASH,
    dataBackground: { lineStyle: { color: theme.border }, areaStyle: { color: theme.border } },
    selectedDataBackground: { lineStyle: { color: theme.muted }, areaStyle: { color: theme.muted, opacity: 0.3 } },
    handleStyle: { color: theme.surface, borderColor: theme.muted },
    moveHandleStyle: { color: theme.border },
    textStyle: { color: theme.muted },
  };
}

function zoomOptions(theme, horizontal, layout) {
  const axis = horizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
  const inside = { type: "inside", ...axis, zoomOnMouseWheel: "shift", moveOnMouseWheel: false };
  return layout.slider ? [inside, sliderOptions(theme, horizontal, layout)] : [inside];
}

function gridOptions(layout) {
  return { left: EDGE_GAP, right: layout.right, top: layout.top, bottom: layout.bottom, containLabel: true };
}

function cartesianOptions(model, theme, colors, shape) {
  const layout = cartesianLayout(model, shape.horizontal);
  const categories = categoryAxis(model, theme, shape);
  return {
    ...baseOptions(theme, colors),
    ...legendPart(model, theme),
    tooltip: tooltipOptions(theme, "axis", axisTooltip(model), shape.pointer),
    grid: gridOptions(layout),
    dataZoom: zoomOptions(theme, shape.horizontal, layout),
    xAxis: shape.horizontal ? shape.values : categories,
    yAxis: shape.horizontal ? categories : shape.values,
    series: shape.series,
  };
}

function measureColumns(seriesList) {
  return seriesList.map((series) => series.column);
}

function columnOptions(model, theme, colors) {
  return cartesianOptions(model, theme, colors, {
    horizontal: false,
    continuous: false,
    pointer: "shadow",
    values: plotAxis(model, theme),
    series: model.series.map((series) => barSeries(model, series, false, theme)),
  });
}

function horizontalBarOptions(model, theme, colors) {
  return cartesianOptions(model, theme, colors, {
    horizontal: true,
    continuous: false,
    pointer: "shadow",
    values: plotAxis(model, theme),
    series: model.series.map((series) => barSeries(model, series, true, theme)),
  });
}

function trendOptions(model, theme, colors, area) {
  return cartesianOptions(model, theme, colors, {
    horizontal: false,
    continuous: true,
    pointer: "line",
    values: plotAxis(model, theme),
    series: model.series.map((series) => lineSeries(model, series, area, 0, theme)),
  });
}

function lineOptions(model, theme, colors) {
  return trendOptions(model, theme, colors, false);
}

function areaOptions(model, theme, colors) {
  return trendOptions(model, theme, colors, true);
}

function comboKind(series, index) {
  return series.style.type || (index === 0 ? "column" : "line");
}

function comboAxisIndex(series, index) {
  const axis = series.style.axis || (index === 0 ? "primary" : "secondary");
  return axis === "secondary" ? 1 : 0;
}

function stackedExtent(columns, index) {
  let up = 0;
  let down = 0;
  for (const item of columns) {
    const value = item.series.values[index];
    if (value > 0) {
      up += value;
    } else if (value < 0) {
      down += value;
    }
  }
  return { up, down };
}

function axisExtent(model, items) {
  const extent = { low: 0, high: 0 };
  const columns = model.stackColumns ? items.filter((item) => item.kind === "column") : [];
  const loose = items.filter((item) => !columns.includes(item));
  for (let index = 0; index < model.categories.length && columns.length; index += 1) {
    const { up, down } = stackedExtent(columns, index);
    extent.high = Math.max(extent.high, up);
    extent.low = Math.min(extent.low, down);
  }
  for (const item of loose) {
    for (const value of item.series.values) {
      if (value !== null) {
        extent.high = Math.max(extent.high, value);
        extent.low = Math.min(extent.low, value);
      }
    }
  }
  return extent;
}

function niceCeiling(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return NICE_STEPS.map((step) => step * magnitude).find((candidate) => candidate >= value);
}

function alignedBounds(extents) {
  if (extents.some((extent) => extent.high <= 0)) {
    return null;
  }
  const ratio = Math.max(...extents.map((extent) => -extent.low / extent.high));
  if (ratio <= 0) {
    return null;
  }
  return extents.map((extent) => {
    const max = niceCeiling(extent.high);
    return { min: -max * ratio, max };
  });
}

function boundedAxis(axis, bounds) {
  return { ...axis, ...bounds, axisLabel: { ...axis.axisLabel, showMinLabel: false } };
}

function comboAxes(placed, theme, model) {
  const primaryItems = placed.filter((item) => item.axis === 0);
  const secondaryItems = placed.filter((item) => item.axis === 1);
  const primaryAxis = valueAxis(measureColumns(primaryItems.map((item) => item.series)), theme, true);
  if (!secondaryItems.length) {
    return [primaryAxis];
  }
  const secondaryAxis = valueAxis(measureColumns(secondaryItems.map((item) => item.series)), theme, false);
  const bounds = alignedBounds([axisExtent(model, primaryItems), axisExtent(model, secondaryItems)]);
  if (!bounds) {
    return [primaryAxis, { ...secondaryAxis, alignTicks: true }];
  }
  return [boundedAxis(primaryAxis, bounds[0]), boundedAxis(secondaryAxis, bounds[1])];
}

function comboSeries(model, item, theme) {
  if (item.kind !== "column") {
    return lineSeries(model, item.series, item.kind === "area", item.axis, theme);
  }
  const bar = { ...barSeries(model, item.series, false, theme), yAxisIndex: item.axis };
  return model.stackColumns ? { ...bar, stack: COMBO_STACK } : bar;
}

function comboOptions(model, theme, colors) {
  const placed = model.series.map((series, index) => ({ series, kind: comboKind(series, index), axis: comboAxisIndex(series, index) }));
  return cartesianOptions(model, theme, colors, {
    horizontal: false,
    continuous: false,
    pointer: "shadow",
    values: comboAxes(placed, theme, model),
    series: placed.map((item) => comboSeries(model, item, theme)),
  });
}

function pieItems(model, series) {
  return series.values.map((value, index) => ({
    name: model.categories[index],
    value: value !== null && value >= 0 ? value : null,
    itemStyle: { opacity: itemOpacity(model, index) },
  }));
}

function pieSeries(model, series, theme) {
  return {
    type: "pie",
    name: series.column.title,
    radius: ["45%", "70%"],
    center: ["50%", "46%"],
    cursor: pointerCursor(model),
    avoidLabelOverlap: true,
    minShowLabelAngle: PIE_MINIMUM_LABEL_ANGLE,
    itemStyle: { borderColor: theme.surface, borderWidth: 2, borderRadius: BAR_RADIUS },
    label: { show: model.categories.length <= PIE_LABEL_LIMIT, color: theme.muted, formatter: shareText },
    labelLine: { lineStyle: { color: theme.border } },
    data: pieItems(model, series),
  };
}

function pieOptions(model, theme, colors) {
  return {
    ...baseOptions(theme, colors),
    ...(model.legend === "none" ? {} : { legend: legendOptions(theme, model) }),
    tooltip: tooltipOptions(theme, "item", pieTooltip(model), null),
    series: [pieSeries(model, model.series[0], theme)],
  };
}

const BUILDERS = {
  bar: horizontalBarOptions,
  column: columnOptions,
  line: lineOptions,
  area: areaOptions,
  pie: pieOptions,
  combo: comboOptions,
};

function chartOptions(field, result, interaction, theme) {
  const model = chartModel(field, result, interaction);
  return model ? BUILDERS[model.visual](model, theme, seriesColors(field, theme)) : null;
}

function cssVariable(styles, name, fallback) {
  return styles.getPropertyValue(name).trim() || fallback;
}

function darkScheme(styles) {
  const scheme = (styles.colorScheme || "").trim();
  if (scheme === "light" || scheme === "dark") {
    return scheme === "dark";
  }
  return window.matchMedia(DARK_SCHEME).matches;
}

function customPalette(styles) {
  return cssVariable(styles, "--report-palette", "")
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
}

function readTheme(container) {
  const styles = getComputedStyle(container || document.documentElement);
  const custom = customPalette(styles);
  return {
    muted: cssVariable(styles, "--text-muted", FALLBACK_THEME.muted),
    border: cssVariable(styles, "--border", FALLBACK_THEME.border),
    surface: cssVariable(styles, "--surface", FALLBACK_THEME.surface),
    text: cssVariable(styles, "--text", FALLBACK_THEME.text),
    font: cssVariable(styles, "--font", FALLBACK_THEME.font),
    palette: custom.length ? custom : darkScheme(styles) ? DARK_PALETTE : LIGHT_PALETTE,
  };
}

function showNotice(container, message) {
  container.append(element("div", { class: "empty" }, message));
  return () => {};
}

function additiveClick(zrenderEvent) {
  const nativeEvent = zrenderEvent && zrenderEvent.event;
  return Boolean(nativeEvent && (nativeEvent.ctrlKey || nativeEvent.metaKey));
}

function categoryHandler(result, interaction) {
  return (dataIndex, zrenderEvent) => {
    const row = Number.isInteger(dataIndex) ? result.rows[dataIndex] : null;
    if (!row) {
      return;
    }
    if (interaction.onDrill) {
      interaction.onDrill({ value: row[0] });
      return;
    }
    interaction.onSelect({ value: row[0], additive: additiveClick(zrenderEvent) });
  };
}

function plotIndex(binding, zrenderEvent) {
  const point = [zrenderEvent.offsetX, zrenderEvent.offsetY];
  if (binding.chart.isDisposed() || !binding.chart.containPixel("grid", point)) {
    return null;
  }
  const coordinates = binding.chart.convertFromPixel("grid", point) || [];
  const index = Math.round(coordinates[binding.horizontal ? 1 : 0]);
  return index >= 0 && index < binding.count ? index : null;
}

function plotClick(binding, zrenderEvent) {
  if (binding.handledEvents.has(zrenderEvent)) {
    return;
  }
  const index = plotIndex(binding, zrenderEvent);
  if (index !== null) {
    binding.handle(index, zrenderEvent);
  }
}

function plotHover(binding, zrenderEvent) {
  if (plotIndex(binding, zrenderEvent) !== null) {
    binding.chart.getZr().setCursorStyle("pointer");
  }
}

function bindItemClicks(binding) {
  binding.chart.on("click", (event) => {
    if (event.event) {
      binding.handledEvents.add(event.event);
    }
    binding.handle(event.dataIndex, event.event);
  });
}

function bindPlotClicks(binding) {
  const renderer = binding.chart.getZr();
  renderer.on("click", (zrenderEvent) => queueMicrotask(() => plotClick(binding, zrenderEvent)));
  renderer.on("mousemove", (zrenderEvent) => plotHover(binding, zrenderEvent));
}

function bindClicks(chart, field, result, interaction) {
  if (!interaction.onSelect && !interaction.onDrill) {
    return;
  }
  const binding = {
    chart,
    handle: categoryHandler(result, interaction),
    handledEvents: new WeakSet(),
    horizontal: field.visual === "bar",
    count: result.rows.length,
  };
  bindItemClicks(binding);
  if (field.visual !== "pie") {
    bindPlotClicks(binding);
  }
}

function resizeChart(chart) {
  if (!chart.isDisposed()) {
    chart.resize();
  }
}

function watchColorScheme(redraw) {
  const query = window.matchMedia(DARK_SCHEME);
  query.addEventListener("change", redraw);
  return () => query.removeEventListener("change", redraw);
}

function animated(options, settings) {
  return settings.animation === false ? { ...options, animation: false } : options;
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function merged(base, extra) {
  if (Array.isArray(base) && Array.isArray(extra)) {
    return extra.map((item, index) => (index < base.length ? merged(base[index], item) : item)).concat(base.slice(extra.length));
  }
  if (plainObject(base) && plainObject(extra)) {
    const result = { ...base };
    for (const [key, value] of Object.entries(extra)) {
      result[key] = key in base ? merged(base[key], value) : value;
    }
    return result;
  }
  return extra;
}

const WHOLE_PLACEHOLDER = /^\{\{\s*([^{}]+?)\s*\}\}$/;

const ANY_PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

function rowValues(result) {
  const row = (result.rows || [])[0] || [];
  const raw = {};
  const shown = {};
  result.columns.forEach((column, index) => {
    raw[column.key] = row[index] ?? null;
    shown[column.key] = formatCell(row[index], column);
  });
  return { raw, shown };
}

function filledOptions(value, values) {
  if (typeof value === "string") {
    const whole = WHOLE_PLACEHOLDER.exec(value);
    if (whole && whole[1] in values.raw) {
      return values.raw[whole[1]];
    }
    return value.replace(ANY_PLACEHOLDER, (match, key) => values.shown[key] ?? match);
  }
  if (Array.isArray(value)) {
    return value.map((item) => filledOptions(item, values));
  }
  if (plainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, filledOptions(item, values)]));
  }
  return value;
}

function datasetSource(result) {
  return [
    result.columns.map((column) => column.title),
    ...result.rows.map((row) =>
      row.map((value, index) => {
        const column = result.columns[index];
        return column.kind === "measure" ? numeric(value) : value === null ? null : formatCell(value, column);
      }),
    ),
  ];
}

function freeChartOptions(field, result, theme) {
  if (!result.rows.length) {
    return null;
  }
  const base = {
    ...baseOptions(theme, theme.palette),
    tooltip: tooltipOptions(theme, "item"),
    dataset: { source: datasetSource(result) },
  };
  return merged(base, filledOptions(field.chart_options || {}, rowValues(result)));
}

function optionsFor(field, result, settings, theme) {
  if (field.visual === "chart") {
    return freeChartOptions(field, result, theme);
  }
  const options = chartOptions(field, result, settings, theme);
  if (!options || !field.chart_options) {
    return options;
  }
  return merged(options, filledOptions(field.chart_options, rowValues(result)));
}

function bindFreeClicks(chart, result, interaction) {
  if (!interaction.onSelect || !result.columns.length || result.columns[0].kind !== "group") {
    return;
  }
  chart.on("click", (parameters) => {
    const row = result.rows[parameters.dataIndex];
    if (row) {
      interaction.onSelect({ value: row[0], additive: additiveClick(parameters.event) });
    }
  });
}

export function renderChart(container, field, result, interaction = {}) {
  const settings = interaction || {};
  if (!window.echarts) {
    return showNotice(container, MISSING_LIBRARY_MESSAGE);
  }
  const options = optionsFor(field, result, settings, readTheme(container));
  if (!options) {
    return showNotice(container, EMPTY_MESSAGE);
  }
  const surface = element("div", { class: "chart-surface" });
  container.append(surface);
  const chart = window.echarts.init(surface, null, { renderer: settings.renderer || "canvas" });
  chart.setOption(animated(options, settings));
  if (field.visual === "chart") {
    bindFreeClicks(chart, result, settings);
  } else {
    bindClicks(chart, field, result, settings);
  }
  const observer = new ResizeObserver(() => resizeChart(chart));
  observer.observe(surface);
  const stopWatching = watchColorScheme(() =>
    chart.setOption(animated(optionsFor(field, result, settings, readTheme(container)), settings), true),
  );
  return () => {
    observer.disconnect();
    stopWatching();
    if (!chart.isDisposed()) {
      chart.dispose();
    }
  };
}
