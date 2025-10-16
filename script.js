/* ============================================================
   ELEMENT REFERENCES
============================================================ */
const $ = id => document.getElementById(id); // ⚡ short helper

const player        = $("player");
const startBtn      = $("start");
const controls      = $("controls");
const rewind        = $("rewind");
const playpause     = $("playpause");
const playIcon      = $("play-icon");
const forward       = $("forward");
const progressBar   = $("progress-bar");
const progressSVG   = $("progress-svg");
const progressLine  = $("progress-line");
const progressPointer = $("progress-pointer");
const elapsedEl     = $("elapsed");
const durationEl    = $("duration");
const container     = $("scroll-container");
const wrapper       = $("panorama-wrapper");
const panorama      = $("panorama");
const buyBtn        = $("buy-btn");
const scBtn         = $("soundcloud-btn");
const lyricsBtn     = $("lyrics-btn");
const lyricsModal   = $("lyrics-modal");
const closeLyrics   = $("close-lyrics");
const zoomInBtn     = $("zoom-in");
const zoomOutBtn    = $("zoom-out");
const loadingMask   = $("loading-mask");
const footer        = $("footer");

/* ============================================================
   PANORAMA LOAD HANDLER
============================================================ */
function hideLoadingMask() {
  if (!loadingMask.classList.contains("fade-out")) {
    loadingMask.classList.add("fade-out");
    panorama.classList.add("active");
    // ✅ FIX: also remove the mask fully after fade
    setTimeout(() => loadingMask.remove(), 1200);
  }
}

if (panorama.decode) {
  panorama.decode().then(() => setTimeout(hideLoadingMask, 400))
    .catch(() => setTimeout(hideLoadingMask, 800));
} else {
  panorama.addEventListener("load", () => setTimeout(hideLoadingMask, 800), { once: true });
}
setTimeout(hideLoadingMask, 10000); // fallback

/* ============================================================
   STATE
============================================================ */
let zoomLevel = 1, minZoom = 1, maxZoom = 2.5;
let natW = 0, natH = 0;
let moveInterval = null;

/* ============================================================
   BEGIN EXPERIENCE
============================================================ */
startBtn.addEventListener("click", () => {
  player.muted = true;
  player.play().then(() => setTimeout(() => (player.muted = false), 500)).catch(() => {});

  startBtn.style.opacity = 0;
  setTimeout(() => footer?.classList.add("visible"), 1000);
  panorama.classList.add("active");

  // ✅ FIX: show footer only AFTER experience starts
  setTimeout(() => footer?.classList.add("visible"), 1000);

  [buyBtn, scBtn, lyricsBtn].forEach((btn, i) => {
    if (!btn) return;
    btn.style.opacity = 0;
    setTimeout(() => {
      btn.style.transition = "opacity 0.8s ease";
      btn.style.opacity = 1;
    }, 1300 + i * 300);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !player.paused)
      player.play().catch(() => {});
  });

  document.body.style.cursor = "grab";
});

/* ============================================================
   AUDIO CONTROLS
============================================================ */
const setPlayIcon = () => playIcon.innerHTML = `<polygon points="6,4 20,12 6,20" fill="white"/>`;
const setPauseIcon = () => playIcon.innerHTML = `<rect x="6" y="5" width="4" height="14" fill="white"/><rect x="14" y="5" width="4" height="14" fill="white"/>`;

playpause.addEventListener("click", () => player.paused ? player.play() : player.pause());
player.addEventListener("play", setPauseIcon);
player.addEventListener("pause", setPlayIcon);
rewind.addEventListener("click", () => (player.currentTime = Math.max(player.currentTime - 10, 0)));
forward.addEventListener("click", () => (player.currentTime = Math.min(player.currentTime + 10, player.duration || 0)));

/* ============================================================
   PROGRESS BAR + SCRUBBING
============================================================ */
const totalLength = progressLine.getTotalLength();
progressLine.style.strokeDasharray = totalLength;
progressLine.style.strokeDashoffset = totalLength;

const formatTime = t => !isFinite(t) ? "0:00" : `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

function safeDuration() {
  if (isFinite(player.duration) && player.duration > 0) return player.duration;
  if (player.seekable?.length) {
    const end = player.seekable.end(player.seekable.length - 1);
    if (end && isFinite(end)) return end;
  }
  return 0;
}

player.addEventListener("timeupdate", () => {
  const d = safeDuration();
  elapsedEl.textContent = formatTime(player.currentTime);
  durationEl.textContent = formatTime(d);
  const progress = d ? player.currentTime / d : 0;
  progressLine.style.strokeDashoffset = totalLength * (1 - progress);
  progressPointer.setAttribute("cx", progress * 200);
});

// Click-to-seek
progressSVG.addEventListener("click", e => {
  const d = safeDuration(); if (!d) return;
  const rect = progressSVG.getBoundingClientRect();
  const p = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
  player.currentTime = p * d;
  progressPointer.setAttribute("cx", p * 200);
});

/* === Scrubbing === */
let isScrubbing = false, scrubProgress = 0, rafId = null;
const scrubTo = e => {
  const rect = progressSVG.getBoundingClientRect(), d = safeDuration();
  if (!d) return;
  const x = Math.max(0, Math.min((e.clientX || e.touches?.[0]?.clientX) - rect.left, rect.width));
  scrubProgress = x / rect.width;
};
const updateScrubVisual = () => {
  progressPointer.setAttribute("cx", scrubProgress * 200);
  progressLine.style.strokeDashoffset = totalLength * (1 - scrubProgress);
};
const applyScrubToPlayer = () => {
  const d = safeDuration(); if (d) player.currentTime = scrubProgress * d;
};
const scrubLoop = () => {
  updateScrubVisual();
  rafId = requestAnimationFrame(scrubLoop);
};

["mousedown", "touchstart"].forEach(evt =>
  progressSVG.addEventListener(evt, e => {
    isScrubbing = true;
    scrubTo(e);
    cancelAnimationFrame(rafId);
    scrubLoop();
    document.body.style.cursor = "grabbing";
  }, { passive: true })
);

["mousemove", "touchmove"].forEach(evt =>
  window.addEventListener(evt, e => { if (isScrubbing) scrubTo(e); }, { passive: true })
);

["mouseup", "touchend"].forEach(evt =>
  window.addEventListener(evt, () => {
    if (isScrubbing) {
      isScrubbing = false;
      cancelAnimationFrame(rafId);
      applyScrubToPlayer();
      document.body.style.cursor = "default";
    }
  })
);

/* ============================================================
   LYRICS MODAL
============================================================ */
if (lyricsBtn && lyricsModal && closeLyrics) {
  const close = () => {
    lyricsModal.classList.remove("active");
    setTimeout(() => lyricsModal.classList.add("hidden"), 300);
    document.body.style.overflow = "";
  };
  lyricsBtn.addEventListener("click", () => {
    lyricsModal.classList.remove("hidden");
    setTimeout(() => lyricsModal.classList.add("active"), 10);
    document.body.style.overflow = "hidden";
  });
  closeLyrics.addEventListener("click", close);
  document.addEventListener("keydown", e => e.key === "Escape" && lyricsModal.classList.contains("active") && close());
}

/* ============================================================
   PANORAMA SIZING + ZOOM
============================================================ */
function ensureNaturalSize(cb) {
  if (panorama.complete && panorama.naturalWidth) {
    natW = panorama.naturalWidth;
    natH = panorama.naturalHeight;
    cb?.();
  } else {
    panorama.addEventListener("load", () => {
      natW = panorama.naturalWidth;
      natH = panorama.naturalHeight;
      cb?.();
    }, { once: true });
  }
}
function setImageSizeFromZoom() {
  if (!natW || !natH) return;
  const imgW = natW * zoomLevel, imgH = natH * zoomLevel;
  panorama.style.width = wrapper.style.width = `${imgW}px`;
  panorama.style.height = wrapper.style.height = `${imgH}px`;
}
function computeCoverMinZoom() {
  const cW = container.clientWidth, cH = container.clientHeight;
  return Math.max(cW / natW, cH / natH);
}
function computeMaxZoom(minZ) { return minZ * 5; }
function fitAndCenterPanorama() {
  ensureNaturalSize(() => {
    minZoom = computeCoverMinZoom();
    maxZoom = computeMaxZoom(minZoom);
    zoomLevel = Math.min(minZoom * 1.02, maxZoom);
    setImageSizeFromZoom();
    container.scrollTo({
      left: (wrapper.scrollWidth - container.clientWidth) / 2,
      top: (wrapper.scrollHeight - container.clientHeight) / 2
    });
  });
}

/* ============================================================
   ZOOM CONTROLS + WHEEL
============================================================ */
function zoomAtPoint(factor, mouseX, mouseY) {
  const prevW = wrapper.offsetWidth, prevH = wrapper.offsetHeight;
  const scrollLeft = container.scrollLeft, scrollTop = container.scrollTop;
  const cursorRatioX = (scrollLeft + mouseX) / prevW;
  const cursorRatioY = (scrollTop + mouseY) / prevH;
  zoomLevel = Math.min(maxZoom, Math.max(minZoom, zoomLevel * factor));
  setImageSizeFromZoom();
  const newW = wrapper.offsetWidth, newH = wrapper.offsetHeight;
  container.scrollTo({
    left: cursorRatioX * newW - mouseX,
    top: cursorRatioY * newH - mouseY
  });
}

zoomInBtn.addEventListener("click", () => zoomAtPoint(1.1, container.clientWidth / 2, container.clientHeight / 2));
zoomOutBtn.addEventListener("click", () => zoomAtPoint(0.9, container.clientWidth / 2, container.clientHeight / 2));

/* ============================================================
   INERTIAL DRAG SCROLL
============================================================ */
function enableInertialDrag() {
  let isDragging = false, startX = 0, scrollStart = 0;
  let velocity = 0, lastX = 0, lastTime = 0, rafID = null;

  function momentum() {
    container.scrollLeft += velocity;
    velocity *= 0.95;
    if (Math.abs(velocity) > 0.5) rafID = requestAnimationFrame(momentum);
  }

  container.addEventListener("mousedown", e => {
    isDragging = true;
    startX = e.pageX;
    scrollStart = container.scrollLeft;
    lastX = e.pageX;
    lastTime = Date.now();
    cancelAnimationFrame(rafID);
    document.body.style.cursor = "grabbing";
  });

  ["mouseup", "mouseleave"].forEach(evt =>
    container.addEventListener(evt, () => {
      if (isDragging) momentum();
      isDragging = false;
      document.body.style.cursor = "grab";
    })
  );

  container.addEventListener("mousemove", e => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.pageX - startX;
    container.scrollLeft = scrollStart - dx;
    const now = Date.now();
    const delta = now - lastTime;
    if (delta > 0) velocity = (lastX - e.pageX) / delta * 20;
    lastX = e.pageX;
    lastTime = now;
  });

  container.addEventListener("wheel", e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomAtPoint(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
  }, { passive: false });
}
enableInertialDrag();

/* ============================================================
   INITIAL FIT
============================================================ */
window.addEventListener("load", () => ensureNaturalSize(() => setTimeout(fitAndCenterPanorama, 300)));

/* ============================================================
   JOYSTICK ARROWS (Hold to pan)
============================================================ */
function startMove(dir) {
  stopMove();
  moveInterval = setInterval(() => {
    const d = 20 * Math.sqrt(zoomLevel);
    if (dir === "left")  container.scrollLeft -= d;
    if (dir === "right") container.scrollLeft += d;
    if (dir === "up")    container.scrollTop  -= d;
    if (dir === "down")  container.scrollTop  += d;
  }, 16);
}
function stopMove() {
  clearInterval(moveInterval);
  moveInterval = null;
}
[["left","arrow-left"],["right","arrow-right"],["up","arrow-up"],["down","arrow-down"]]
  .forEach(([dir, id]) => {
    const btn = $(id);
    if (!btn) return;
    ["mousedown","touchstart"].forEach(evt => btn.addEventListener(evt, () => startMove(dir), { passive: true }));
    ["mouseup","mouseleave","touchend"].forEach(evt => btn.addEventListener(evt, stopMove));
  });

/* ============================================================
   RESIZE + ORIENTATION
============================================================ */
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (!natW || !natH) return;
    minZoom = computeCoverMinZoom();
    if (zoomLevel < minZoom) zoomLevel = minZoom;
    setImageSizeFromZoom();
    container.scrollTo({ left: (wrapper.scrollWidth - container.clientWidth) / 2 });
  }, 200);
});
window.addEventListener("orientationchange", fitAndCenterPanorama);

/* ============================================================
   TOUCH FIX
============================================================ */
document.querySelectorAll("button").forEach(btn => {
  ["touchend","mouseup"].forEach(evt => btn.addEventListener(evt, () => btn.blur()));
});