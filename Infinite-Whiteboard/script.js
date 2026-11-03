// =====================================
// Infinity Studio
// =====================================

const canvas = document.getElementById("boardCanvas");
const ctx = canvas.getContext("2d");
const board = document.getElementById("board");

const toolbar = document.getElementById("toolbar");
const moveHandle = document.getElementById("moveHandle");
const quickToolbar = document.getElementById("quickToolbar");

const settingsPanel = document.getElementById("settingsPanel");
const panelTitle = document.getElementById("panelTitle");

const settingsSections = {
  pen: document.getElementById("penSettings"),
  highlighter: document.getElementById("highlighterSettings"),
  eraser: document.getElementById("eraserSettings"),
  background: document.getElementById("backgroundSettings")
};

// =====================================
// المتغيرات الأساسية
// =====================================

let currentTool = "pen";

let penColor = "#202020";
let highlighterColor = "#ffeb3b";

let penSize = 4;
let highlighterSize = 20;
let eraserSize = 30;

let highlightOpacity = 0.35;

let penSmoothing = true;
let highlighterSmoothing = true;

let eraserMode = "normal";

let strokes = [];
let redoStack = [];

let currentStroke = null;
let isDrawing = false;
let isPanning = false;

let activePointerId = null;
let panStart = null;

let boardOffsetX = 0;
let boardOffsetY = 0;

let backgroundType = "dots";
let pageColor = "#ffffff";
let patternColor = "#d8dce3";

let lastErasePosition = null;

// =====================================
// ضبط حجم لوحة الرسم
// =====================================

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);

  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  redrawCanvas();
}

window.addEventListener("resize", resizeCanvas);

function getBoardPosition(event) {
  return {
    x: event.clientX - boardOffsetX,
    y: event.clientY - boardOffsetY
  };
}

// =====================================
// إنشاء الخطوط
// =====================================

function createStroke(position) {
  const isPen = currentTool === "pen";
  const isHighlighter = currentTool === "highlighter";

  return {
    tool: currentTool,

    color: isPen ? penColor : highlighterColor,

    size: isPen ? penSize : highlighterSize,

    opacity: isHighlighter ? highlightOpacity : 1,

    smoothing: isPen ? penSmoothing : highlighterSmoothing,

    points: [position]
  };
}

// =====================================
// تحسين سرعة تحديث الرسم
// =====================================

let redrawFrame = null;

function scheduleRedraw() {
  if (redrawFrame !== null) return;

  redrawFrame = requestAnimationFrame(() => {
    redrawFrame = null;
    redrawCanvas();
  });
}

// =====================================
// بدء الرسم
// =====================================

function startDrawing(event) {
  if (currentTool === "hand") {
    isPanning = true;

    panStart = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: boardOffsetX,
      offsetY: boardOffsetY
    };

    return;
  }

  const position = getBoardPosition(event);

  if (currentTool === "eraser" && eraserMode === "stroke") {
    isDrawing = true;
    eraseWholeStroke(position);
    lastErasePosition = position;
    return;
  }

  if (currentTool === "eraser") {
    currentStroke = {
      tool: "eraser",
      color: "#000000",
      size: eraserSize,
      opacity: 1,
      smoothing: true,
      points: [position]
    };
  } else {
    currentStroke = createStroke(position);
  }

  isDrawing = true;

  strokes.push(currentStroke);
  redoStack = [];

  scheduleRedraw();
}

// =====================================
// متابعة الرسم
// =====================================

function continueDrawing(event) {
  if (isPanning && panStart) {
    boardOffsetX =
      panStart.offsetX + event.clientX - panStart.pointerX;

    boardOffsetY =
      panStart.offsetY + event.clientY - panStart.pointerY;

    redrawCanvas();
    return;
  }

  if (
    currentTool === "eraser" &&
    eraserMode === "stroke" &&
    isDrawing
  ) {
    const position = getBoardPosition(event);

    if (
      !lastErasePosition ||
      Math.hypot(
        position.x - lastErasePosition.x,
        position.y - lastErasePosition.y
      ) > 5
    ) {
      eraseWholeStroke(position);
      lastErasePosition = position;
    }

    return;
  }

  if (!isDrawing || !currentStroke) return;

  const samples =
    typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : [event];

  for (const sample of samples) {
    const position = getBoardPosition(sample);

    const points = currentStroke.points;
    const previous = points[points.length - 1];

    const distance = Math.hypot(
      position.x - previous.x,
      position.y - previous.y
    );

    if (distance >= 0.35) {
      points.push(position);
    }
  }

  redrawCanvas();
}

// =====================================
// إنهاء الرسم
// =====================================

function finishDrawing() {
  isDrawing = false;
  isPanning = false;

  currentStroke = null;
  panStart = null;
  lastErasePosition = null;
}

// =====================================
// رسم الخط على Canvas
// =====================================

function drawStroke(context, stroke) {
  const points = stroke.points;

  if (!points || points.length === 0) return;

  context.save();

  context.globalCompositeOperation =
    stroke.tool === "eraser"
      ? "destination-out"
      : "source-over";

  context.globalAlpha =
    stroke.tool === "eraser"
      ? 1
      : (stroke.opacity ?? 1);

  context.strokeStyle =
    stroke.tool === "eraser"
      ? "#000000"
      : stroke.color;

  context.fillStyle =
    stroke.tool === "eraser"
      ? "#000000"
      : stroke.color;

  context.lineWidth = stroke.size;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (points.length === 1) {
    context.beginPath();

    context.arc(
      points[0].x,
      points[0].y,
      stroke.size / 2,
      0,
      Math.PI * 2
    );

    context.fill();
    context.restore();
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  if (stroke.smoothing) {
    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;

      context.quadraticCurveTo(
        current.x,
        current.y,
        midX,
        midY
      );
    }

    const last = points[points.length - 1];

    context.lineTo(last.x, last.y);
  } else {
    for (let i = 1; i < points.length; i++) {
      context.lineTo(points[i].x, points[i].y);
    }
  }

  context.stroke();
  context.restore();
}

// =====================================
// إعادة رسم السبورة
// =====================================

function redrawCanvas() {
  const ratio = window.devicePixelRatio || 1;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  ctx.clearRect(
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );

  ctx.save();

  ctx.translate(boardOffsetX, boardOffsetY);

  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }

  ctx.restore();
}

// =====================================
// أحداث الماوس واللمس والقلم
// =====================================

canvas.addEventListener("pointerdown", event => {
  if (activePointerId !== null) return;

  event.preventDefault();

  // إخفاء قائمة الإعدادات تلقائياً عند بدء استخدام السبورة
  settingsPanel.classList.remove("show");

  activePointerId = event.pointerId;

  canvas.setPointerCapture(event.pointerId);

  startDrawing(event);
});

canvas.addEventListener("pointermove", event => {
  if (event.pointerId !== activePointerId) return;

  event.preventDefault();

  continueDrawing(event);
});

function releaseDrawingPointer(event) {
  if (event.pointerId !== activePointerId) return;

  finishDrawing();

  activePointerId = null;
}

canvas.addEventListener("pointerup", releaseDrawingPointer);
canvas.addEventListener("pointercancel", releaseDrawingPointer);

canvas.addEventListener("lostpointercapture", () => {
  finishDrawing();
  activePointerId = null;
});

// =====================================
// الممحاة: حذف الخط بالكامل
// =====================================

function eraseWholeStroke(position) {
  const oldLength = strokes.length;

  strokes = strokes.filter(stroke => {
    const hitRadius =
      (eraserSize + stroke.size) / 2 + 2;

    return !stroke.points.some(point => {
      return Math.hypot(
        point.x - position.x,
        point.y - position.y
      ) <= hitRadius;
    });
  });

  if (strokes.length !== oldLength) {
    redoStack = [];
    redrawCanvas();
  }
}

// =====================================
// اختيار الأدوات وإظهار إعداداتها
// =====================================

const toolButtons = [
  ...document.querySelectorAll("[data-tool]")
];

function updateActiveTool() {
  toolButtons.forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tool === currentTool
    );
  });
}

function hideAllSettings() {
  Object.values(settingsSections).forEach(section => {
    section.hidden = true;
  });
}

function openSettings(type) {
  hideAllSettings();

  const titles = {
    pen: "إعدادات القلم",
    highlighter: "إعدادات الهايلايتر",
    eraser: "إعدادات الممحاة",
    background: "إعدادات الخلفية"
  };

  panelTitle.textContent = titles[type];

  settingsSections[type].hidden = false;

  settingsPanel.classList.add("show");
}

function selectTool(tool) {
  if (currentTool === tool) {
    if (
      settingsPanel.classList.contains("show") &&
      settingsSections[tool] &&
      !settingsSections[tool].hidden
    ) {
      settingsPanel.classList.remove("show");
    } else if (settingsSections[tool]) {
      openSettings(tool);
    }

    return;
  }

  currentTool = tool;

  updateActiveTool();

  if (settingsSections[tool]) {
    openSettings(tool);
  } else {
    settingsPanel.classList.remove("show");
  }
}

toolButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectTool(button.dataset.tool);
  });
});

// =====================================
// إعدادات الخلفية
// =====================================

document
  .getElementById("backgroundButton")
  .addEventListener("click", () => {
    if (
      settingsPanel.classList.contains("show") &&
      !settingsSections.background.hidden
    ) {
      settingsPanel.classList.remove("show");
    } else {
      openSettings("background");
    }
  });

document
  .getElementById("closePanel")
  .addEventListener("click", () => {
    settingsPanel.classList.remove("show");
  });

// =====================================
// اختيار الألوان
// =====================================

function setupPalette(paletteId, colorInput, onColorChange) {
  const palette = document.getElementById(paletteId);
  const input = document.getElementById(colorInput);

  palette.querySelectorAll(".color-option").forEach(button => {
    button.addEventListener("click", () => {
      palette
        .querySelectorAll(".color-option")
        .forEach(option => {
          option.classList.remove("selected");
        });

      button.classList.add("selected");

      const color = button.dataset.color;

      input.value = color;

      onColorChange(color);
    });
  });

  input.addEventListener("input", () => {
    palette
      .querySelectorAll(".color-option")
      .forEach(option => {
        option.classList.remove("selected");
      });

    onColorChange(input.value);
  });
}

setupPalette("penPalette", "penColor", color => {
  penColor = color;
});

setupPalette("highlighterPalette", "highlighterColor", color => {
  highlighterColor = color;
});

// =====================================
// التحكم في أحجام الأدوات
// =====================================

function setupRange(
  inputId,
  outputId,
  callback,
  suffix = ""
) {
  const input = document.getElementById(inputId);
  const output = document.getElementById(outputId);

  input.addEventListener("input", () => {
    output.textContent = input.value + suffix;

    callback(Number(input.value));
  });
}

setupRange("penSize", "penSizeValue", value => {
  penSize = value;
});

setupRange("highlighterSize", "highlighterSizeValue", value => {
  highlighterSize = value;
});

setupRange("highlightOpacity", "highlightOpacityValue", value => {
  highlightOpacity = value / 100;
}, "%");

setupRange("eraserSize", "eraserSizeValue", value => {
  eraserSize = value;
});

// =====================================
// تشغيل وإيقاف التنعيم
// =====================================

document
  .getElementById("penSmoothing")
  .addEventListener("change", event => {
    penSmoothing = event.target.checked;
  });

document
  .getElementById("highlighterSmoothing")
  .addEventListener("change", event => {
    highlighterSmoothing = event.target.checked;
  });

// =====================================
// اختيار نوع الممحاة
// =====================================

document
  .getElementById("eraserMode")
  .addEventListener("change", event => {
    eraserMode = event.target.value;
  });

// =====================================
// الخلفيات والألوان
// =====================================

const backgroundTypeInput =
  document.getElementById("backgroundType");

const pageColorInput =
  document.getElementById("pageColor");

const patternColorInput =
  document.getElementById("patternColor");

function updateBackground() {
  board.style.backgroundColor = pageColor;

  if (backgroundType === "dots") {
    board.style.backgroundImage =
      `radial-gradient(${patternColor} 1px, transparent 1px)`;

    board.style.backgroundSize = "22px 22px";
  }

  else if (backgroundType === "grid") {
    board.style.backgroundImage =
      `linear-gradient(to right, ${patternColor} 1px, transparent 1px), linear-gradient(to bottom, ${patternColor} 1px, transparent 1px)`;

    board.style.backgroundSize = "25px 25px";
  }

  else if (backgroundType === "squares") {
    board.style.backgroundImage =
      `linear-gradient(to right, ${patternColor} 1px, transparent 1px), linear-gradient(to bottom, ${patternColor} 1px, transparent 1px)`;

    board.style.backgroundSize = "50px 50px";
  }

  else if (backgroundType === "lines") {
    board.style.backgroundImage =
      `linear-gradient(to bottom, ${patternColor} 1px, transparent 1px)`;

    board.style.backgroundSize = "100% 28px";
  }

  else {
    board.style.backgroundImage = "none";
  }
}

backgroundTypeInput.addEventListener("change", event => {
  backgroundType = event.target.value;
  updateBackground();
});

pageColorInput.addEventListener("input", event => {
  pageColor = event.target.value;
  updateBackground();
});

patternColorInput.addEventListener("input", event => {
  patternColor = event.target.value;
  updateBackground();
});

// =====================================
// التراجع والإعادة
// =====================================

document
  .getElementById("undoButton")
  .addEventListener("click", () => {
    if (strokes.length === 0) return;

    redoStack.push(strokes.pop());

    redrawCanvas();
  });

document
  .getElementById("redoButton")
  .addEventListener("click", () => {
    if (redoStack.length === 0) return;

    strokes.push(redoStack.pop());

    redrawCanvas();
  });

// =====================================
// حفظ السبورة كصورة PNG
// =====================================

document
  .getElementById("saveButton")
  .addEventListener("click", () => {
    const exportCanvas = document.createElement("canvas");

    const ratio = window.devicePixelRatio || 1;

    exportCanvas.width = window.innerWidth * ratio;
    exportCanvas.height = window.innerHeight * ratio;

    const exportCtx = exportCanvas.getContext("2d");

    exportCtx.scale(ratio, ratio);

    exportCtx.fillStyle = pageColor;

    exportCtx.fillRect(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );

    exportCtx.save();

    exportCtx.translate(boardOffsetX, boardOffsetY);

    for (const stroke of strokes) {
      drawStroke(exportCtx, stroke);
    }

    exportCtx.restore();

    const link = document.createElement("a");

    link.download = "Infinity-Studio.png";

    link.href = exportCanvas.toDataURL("image/png");

    link.click();
  });

// =====================================
// مسح السبورة مع التأكيد
// =====================================

const confirmOverlay =
  document.getElementById("confirmOverlay");

document
  .getElementById("clearButton")
  .addEventListener("click", () => {
    confirmOverlay.classList.add("show");
  });

document
  .getElementById("cancelClear")
  .addEventListener("click", () => {
    confirmOverlay.classList.remove("show");
  });

document
  .getElementById("confirmClear")
  .addEventListener("click", () => {
    strokes = [];
    redoStack = [];

    boardOffsetX = 0;
    boardOffsetY = 0;

    redrawCanvas();

    confirmOverlay.classList.remove("show");
  });

// =====================================
// الوضع الليلي والنهاري
// =====================================

const themeButton = document.getElementById("themeButton");

themeButton.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const isDark =
    document.body.classList.contains("dark");

  themeButton.innerHTML = isDark
    ? '<i data-lucide="sun"></i>'
    : '<i data-lucide="moon"></i>';

  themeButton.title = isDark
    ? "الوضع النهاري"
    : "الوضع الليلي";

  if (window.lucide) {
    lucide.createIcons();
  }
});

// =====================================
// تحريك شريط الأدوات الرئيسي
// =====================================

let toolbarDragging = false;
let toolbarStart = null;

moveHandle.addEventListener("pointerdown", event => {
  event.preventDefault();

  toolbarDragging = true;

  const rect = toolbar.getBoundingClientRect();

  toolbarStart = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    left: rect.left,
    top: rect.top
  };

  moveHandle.setPointerCapture(event.pointerId);
});

moveHandle.addEventListener("pointermove", event => {
  if (!toolbarDragging || !toolbarStart) return;

  const dx = event.clientX - toolbarStart.pointerX;
  const dy = event.clientY - toolbarStart.pointerY;

  toolbar.style.left =
    `${toolbarStart.left + dx}px`;

  toolbar.style.top =
    `${toolbarStart.top + dy}px`;

  toolbar.style.transform = "none";
  toolbar.style.bottom = "auto";
});

function finishToolbarDrag() {
  if (!toolbarDragging) return;

  toolbarDragging = false;
  toolbarStart = null;

  const rect = toolbar.getBoundingClientRect();

  const distances = {
    left: rect.left,
    right: window.innerWidth - rect.right,
    top: rect.top,
    bottom: window.innerHeight - rect.bottom
  };

  const nearest = Object.entries(distances)
    .sort((a, b) => a[1] - b[1])[0][0];

  toolbar.classList.remove("vertical");

  toolbar.style.left = "";
  toolbar.style.top = "";
  toolbar.style.right = "";
  toolbar.style.bottom = "";
  toolbar.style.transform = "none";

  if (nearest === "left") {
    toolbar.style.left = "12px";
    toolbar.style.top = "50%";
    toolbar.style.transform = "translateY(-50%)";

    toolbar.classList.add("vertical");
  }

  else if (nearest === "right") {
    toolbar.style.right = "12px";
    toolbar.style.left = "auto";
    toolbar.style.top = "50%";
    toolbar.style.transform = "translateY(-50%)";

    toolbar.classList.add("vertical");
  }

  else if (nearest === "top") {
    toolbar.style.top = "12px";
    toolbar.style.left = "50%";
    toolbar.style.transform = "translateX(-50%)";
  }

  else {
    toolbar.style.bottom = "12px";
    toolbar.style.left = "50%";
    toolbar.style.top = "auto";
    toolbar.style.transform = "translateX(-50%)";
  }
}

moveHandle.addEventListener("pointerup", finishToolbarDrag);
moveHandle.addEventListener("pointercancel", finishToolbarDrag);

// =====================================
// تحريك شريط الأوامر السريعة
// =====================================

let quickDragging = false;
let quickStart = null;
let suppressQuickClick = false;

quickToolbar.addEventListener("pointerdown", event => {
  // لا نبدأ السحب عند الضغط على أحد الأزرار
  if (event.target.closest("button")) return;

  event.preventDefault();

  quickDragging = true;
  suppressQuickClick = false;

  const rect = quickToolbar.getBoundingClientRect();

  // تثبيت موضع الشريط قبل بدء السحب
  quickToolbar.style.position = "fixed";
  quickToolbar.style.left = `${rect.left}px`;
  quickToolbar.style.top = `${rect.top}px`;
  quickToolbar.style.right = "auto";
  quickToolbar.style.bottom = "auto";
  quickToolbar.style.transform = "none";

  quickStart = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    left: rect.left,
    top: rect.top
  };

  quickToolbar.setPointerCapture(event.pointerId);
});

quickToolbar.addEventListener("pointermove", event => {
  if (!quickDragging || !quickStart) return;

  const dx = event.clientX - quickStart.pointerX;
  const dy = event.clientY - quickStart.pointerY;

  if (Math.abs(dx) + Math.abs(dy) > 4) {
    suppressQuickClick = true;
  }

  const newLeft = quickStart.left + dx;
  const newTop = quickStart.top + dy;

  quickToolbar.style.left = `${newLeft}px`;
  quickToolbar.style.top = `${newTop}px`;
});

function finishQuickDrag() {
  quickDragging = false;
  quickStart = null;

  if (suppressQuickClick) {
    setTimeout(() => {
      suppressQuickClick = false;
    }, 100);
  }
}

quickToolbar.addEventListener("pointerup", finishQuickDrag);
quickToolbar.addEventListener("pointercancel", finishQuickDrag);

quickToolbar.querySelectorAll("button").forEach(button => {
  button.addEventListener("click", event => {
    if (suppressQuickClick) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
});

// =====================================
// تشغيل البرنامج
// =====================================

hideAllSettings();
updateActiveTool();
resizeCanvas();
updateBackground();

if (window.lucide) {
  lucide.createIcons();
}