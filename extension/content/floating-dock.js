/**
 * Always-on floating logo dock UI (classic script).
 */
(function () {
  function html(logoUrl) {
    return `
      <div class="always-player" role="region" aria-label="Read It Out quick controls">
        <button type="button" class="always-logo-btn" aria-label="Open Read It Out controls" aria-expanded="false">
          <span class="dock-logo-mark" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </span>
        </button>
        <div class="always-controls" aria-label="Playback controls">
          <button type="button" class="always-control-btn always-play-btn" aria-label="Play current page">
            <svg class="always-icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <svg class="always-icon-stop" viewBox="0 0 24 24" aria-hidden="true" hidden><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>
          </button>
          <button type="button" class="always-speed-btn" aria-label="Change speed">1.0x</button>
          <button type="button" class="always-control-btn always-settings-btn" aria-label="Open settings">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a7.8 7.8 0 0 0-2.6-1.5L14 2h-4l-.4 2.5A7.8 7.8 0 0 0 7 6L4.6 5 2.6 8.5l2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.5 2.4-1a7.8 7.8 0 0 0 2.6 1.5L10 22h4l.4-2.5A7.8 7.8 0 0 0 17 18l2.4 1 2-3.5-2-1.5ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"/></svg>
          </button>
          <div class="always-timer" aria-live="off">
            <span class="always-timer-current">0:00</span>
          </div>
        </div>
      </div>
    `;
  }

  function collect(shadow) {
    return {
      dock: shadow.querySelector(".always-player"),
      dockLogoBtn: shadow.querySelector(".always-logo-btn"),
      dockControls: shadow.querySelector(".always-controls"),
      dockPlayBtn: shadow.querySelector(".always-play-btn"),
      dockSpeedBtn: shadow.querySelector(".always-speed-btn"),
      dockSettingsBtn: shadow.querySelector(".always-settings-btn"),
      dockIconPlay: shadow.querySelector(".always-icon-play"),
      dockIconStop: shadow.querySelector(".always-icon-stop"),
      dockTimerCurrent: shadow.querySelector(".always-timer-current"),
    };
  }

  function bind(ui, actions) {
    ui.dockLogoBtn.addEventListener("pointerdown", actions.stopEvent);
    ui.dockLogoBtn.addEventListener("mousedown", actions.stopEvent);
    ui.dockLogoBtn.addEventListener("click", (e) => {
      actions.stopEvent(e);
      actions.toggleDock();
    });

    ui.dockPlayBtn.addEventListener("pointerdown", actions.stopEvent);
    ui.dockPlayBtn.addEventListener("mousedown", actions.stopEvent);
    ui.dockPlayBtn.addEventListener("click", (e) => {
      actions.stopEvent(e);
      actions.togglePagePlayback();
    });

    ui.dockSpeedBtn.addEventListener("pointerdown", actions.stopEvent);
    ui.dockSpeedBtn.addEventListener("mousedown", actions.stopEvent);
    ui.dockSpeedBtn.addEventListener("click", (e) => {
      actions.stopEvent(e);
      actions.cycleDockPlaybackSpeed();
    });

    ui.dockSettingsBtn.addEventListener("pointerdown", actions.stopEvent);
    ui.dockSettingsBtn.addEventListener("mousedown", actions.stopEvent);
    ui.dockSettingsBtn.addEventListener("click", (e) => {
      actions.stopEvent(e);
      actions.openSettings();
    });
  }

  globalThis.ReadItOutFloatingDock = { html, collect, bind };
})();
