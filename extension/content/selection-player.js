/**
 * Selected-text mini player UI (classic script).
 */
(function () {
  function html() {
    return `
      <div class="selection-player is-ready toolbar-panel" role="region" aria-label="Read It Out selection player">
        <span class="status-text sr-only" role="status" aria-live="polite">Ready</span>
        <div class="mini-waveform" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <button type="button" class="mini-play-btn" aria-label="Play selected text">
          <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          <svg class="icon-stop" viewBox="0 0 24 24" aria-hidden="true" hidden><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>
        </button>
        <button type="button" class="mini-speed-btn" aria-label="Change speed">1.0x</button>
        <button type="button" class="mini-close-btn" aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3z"/></svg>
        </button>
      </div>
    `;
  }

  function collect(shadow) {
    return {
      panel: shadow.querySelector(".toolbar-panel"),
      statusText: shadow.querySelector(".status-text"),
      playBtn: shadow.querySelector(".mini-play-btn"),
      speedCycleBtn: shadow.querySelector(".mini-speed-btn"),
      closeBtn: shadow.querySelector(".mini-close-btn"),
      iconPlay: shadow.querySelector(".icon-play"),
      iconStop: shadow.querySelector(".icon-stop"),
      timerCurrent: shadow.querySelector(".timer-current"),
      progressFill: shadow.querySelector(".progress-fill"),
    };
  }

  function on(control, eventName, handler) {
    control?.addEventListener(eventName, handler);
  }

  function bind(ui, actions) {
    on(ui.playBtn, "pointerdown", actions.stopEvent);
    on(ui.playBtn, "mousedown", actions.stopEvent);
    on(ui.playBtn, "click", (e) => {
      actions.stopEvent(e);
      actions.togglePlayPause();
    });

    on(ui.speedCycleBtn, "pointerdown", actions.stopEvent);
    on(ui.speedCycleBtn, "mousedown", actions.stopEvent);
    on(ui.speedCycleBtn, "click", (e) => {
      actions.stopEvent(e);
      actions.cycleSelectionPlaybackSpeed();
    });

    on(ui.closeBtn, "pointerdown", actions.stopEvent);
    on(ui.closeBtn, "mousedown", actions.stopEvent);
    on(ui.closeBtn, "click", (e) => {
      actions.stopEvent(e);
      actions.dismissSelection();
      actions.hideToolbar();
    });
  }

  globalThis.ReadItOutSelectionPlayer = { html, collect, bind };
})();
