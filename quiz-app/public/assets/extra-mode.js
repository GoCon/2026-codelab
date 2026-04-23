(function (global) {
  function createExtraModeController(options) {
    if (!options || typeof options !== 'object') {
      throw new Error('extra mode controller options are required');
    }

    const closeLanguageMenu = requireOption(options, 'closeLanguageMenu');
    const getElapsedMilliseconds = requireOption(options, 'getElapsedMilliseconds');
    const hideError = requireOption(options, 'hideError');
    const scrollPageToTop = requireOption(options, 'scrollPageToTop');
    const getIsChallenge = requireOption(options, 'getIsChallenge');
    const onSequenceFinish = requireOption(options, 'onSequenceFinish');

    const overlay = document.getElementById('extra-mode-overlay');
    const downloadBtn = document.getElementById('extra-mode-download-btn');
    const commandText = document.getElementById('extra-mode-command-text');
    const bootOutput = document.getElementById('extra-mode-boot-output');
    const installLog = document.getElementById('extra-mode-install-log');
    const statusLine = document.getElementById('extra-mode-status-line');
    const clock = document.getElementById('extra-mode-clock');

    const command = '$ go mod download';
    const clockDefaultText = '00:00.000';
    const buildSuccessText = 'Build successful.';
    const bootText = [
      'extra mode bootstrap terminal ready',
      'staged command: $ go mod download',
      'hidden source: hidden.gocon.jp/extra/mode/...',
      '',
      'Press Enter to run the hidden installer.',
      'Type carefully. Panic is recoverable.',
    ].join('\n');
    const downloadLines = [
      'go: downloading github.com/gopher/brain-juice v1.0.0',
      'go: downloading golang.org/x/super-hard-mode v0.9.9',
      'go: downloading github.com/gocon/secret-weapon v2.0.1+incompatible',
      'go: downloading hidden.gocon.jp/extra/mode/runtime v0.0.7',
      'go: downloading hidden.gocon.jp/extra/mode/terminal v0.0.3',
      'go: found hidden.gocon.jp/extra/mode/runtime in hidden.gocon.jp/extra/mode/runtime v0.0.7',
      'go: found hidden.gocon.jp/extra/mode/terminal in hidden.gocon.jp/extra/mode/terminal v0.0.3',
    ];

    let introRunning = false;
    let installRunning = false;
    let sequenceToken = 0;
    let pendingStart = null;
    let clockFrameID = 0;

    function formatClock(elapsedMilliseconds) {
      const total = Math.max(0, elapsedMilliseconds);
      const minutes = String(Math.floor(total / 60000)).padStart(2, '0');
      const seconds = String(Math.floor((total % 60000) / 1000)).padStart(2, '0');
      const milliseconds = String(total % 1000).padStart(3, '0');
      return `${minutes}:${seconds}.${milliseconds}`;
    }

    function renderClock(now) {
      clock.textContent = formatClock(getElapsedMilliseconds(now));
    }

    function stopClock(resetDisplay) {
      const shouldReset = resetDisplay !== false;
      if (clockFrameID && typeof global.cancelAnimationFrame === 'function') {
        global.cancelAnimationFrame(clockFrameID);
      }
      clockFrameID = 0;
      if (shouldReset) {
        clock.textContent = clockDefaultText;
      }
    }

    function scheduleClockTick() {
      if (!getIsChallenge() || !document.body || !document.body.classList.contains('extra-mode-active')) {
        clockFrameID = 0;
        return;
      }
      renderClock();
      if (typeof global.requestAnimationFrame !== 'function') {
        clockFrameID = 0;
        return;
      }
      clockFrameID = global.requestAnimationFrame(() => {
        clockFrameID = 0;
        scheduleClockTick();
      });
    }

    function startClock() {
      stopClock(false);
      renderClock();
      if (typeof global.requestAnimationFrame !== 'function') {
        return;
      }
      clockFrameID = global.requestAnimationFrame(() => {
        clockFrameID = 0;
        scheduleClockTick();
      });
    }

    function freezeClockAtElapsedSeconds(elapsedSeconds) {
      clock.textContent = formatClock(Math.max(0, elapsedSeconds) * 1000);
      stopClock(false);
    }

    function pauseClock(now) {
      renderClock(now);
      stopClock(false);
    }

    function prefersReducedMotion() {
      try {
        return Boolean(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (_) {
        return false;
      }
    }

    function scheduleStep(token, callback, delay) {
      if (typeof global.setTimeout === 'function') {
        global.setTimeout(() => {
          if (token !== sequenceToken) {
            return;
          }
          callback();
        }, delay);
        return;
      }
      if (token === sequenceToken) {
        callback();
      }
    }

    function resetOverlay() {
      overlay.className = 'extra-mode-overlay';
      overlay.setAttribute('aria-hidden', 'true');
    }

    function cancelSequence() {
      sequenceToken += 1;
      introRunning = false;
      installRunning = false;
      pendingStart = null;
      if (document.body) {
        document.body.classList.remove('extra-mode-transition');
      }
      resetOverlay();
    }

    function setActive(value) {
      if (document.body) {
        document.body.classList.toggle('extra-mode-active', Boolean(value));
        if (!value) {
          document.body.classList.remove('extra-mode-transition');
        }
      }
      if (!value) {
        stopClock();
        cancelSequence();
      }
    }

    function typeCommand(token, text, index, onComplete) {
      if (token !== sequenceToken) {
        return;
      }
      if (!text) {
        onComplete();
        return;
      }
      commandText.textContent = text.slice(0, index + 1);
      if (index >= text.length - 1) {
        onComplete();
        return;
      }
      scheduleStep(token, () => {
        typeCommand(token, text, index + 1, onComplete);
      }, prefersReducedMotion() ? 0 : 56);
    }

    function appendInstallLine(line) {
      installLog.textContent = installLog.textContent
        ? `${installLog.textContent}\n${line}`
        : line;
    }

    function finishSequence(token) {
      if (token !== sequenceToken) {
        return;
      }
      overlay.classList.add('finishing');
      scheduleStep(token, () => {
        if (document.body) {
          document.body.classList.remove('extra-mode-transition');
        }
        resetOverlay();
        const nextStart = pendingStart;
        pendingStart = null;
        introRunning = false;
        installRunning = false;
        if (!nextStart) {
          return;
        }
        onSequenceFinish(nextStart);
        scrollPageToTop();
      }, prefersReducedMotion() ? 0 : 360);
    }

    function streamInstallLines(token, index) {
      const lineIndex = index === undefined ? 0 : index;
      if (token !== sequenceToken) {
        return;
      }
      appendInstallLine(downloadLines[lineIndex]);
      if (lineIndex >= downloadLines.length - 1) {
        statusLine.textContent = buildSuccessText;
        statusLine.className = 'extra-mode-status-line success';
        scheduleStep(token, () => {
          overlay.classList.add('hacking');
        }, prefersReducedMotion() ? 0 : 180);
        scheduleStep(token, () => {
          finishSequence(token);
        }, prefersReducedMotion() ? 0 : 720);
        return;
      }
      scheduleStep(token, () => {
        streamInstallLines(token, lineIndex + 1);
      }, prefersReducedMotion() ? 0 : 70);
    }

    function triggerInstall() {
      if (!introRunning || installRunning || !pendingStart) {
        return;
      }
      installRunning = true;
      downloadBtn.disabled = true;
      commandText.textContent = '';
      installLog.textContent = '';
      statusLine.textContent = '';
      statusLine.className = 'extra-mode-status-line';
      overlay.classList.add('installing', 'show-install-log');
      const token = sequenceToken;
      typeCommand(token, command, 0, () => {
        streamInstallLines(token);
      });
    }

    function beginBootSequence(token) {
      if (token !== sequenceToken) {
        return;
      }
      bootOutput.textContent = bootText;
      downloadBtn.disabled = false;
      overlay.classList.add('booting', 'boot-ready', 'show-output');
    }

    function startSequence(excludeIds, nextPastCorrect, forceChallenge) {
      if (introRunning) {
        return;
      }
      introRunning = true;
      sequenceToken += 1;
      const token = sequenceToken;
      pendingStart = {
        excludeIds,
        pastCorrect: nextPastCorrect,
        forceChallenge: Boolean(forceChallenge),
      };
      closeLanguageMenu();
      hideError();
      downloadBtn.disabled = true;
      commandText.textContent = '';
      bootOutput.textContent = '';
      installLog.textContent = '';
      statusLine.textContent = '';
      statusLine.className = 'extra-mode-status-line';
      overlay.className = 'extra-mode-overlay active booting';
      overlay.setAttribute('aria-hidden', 'false');
      beginBootSequence(token);
    }

    downloadBtn.addEventListener('click', triggerInstall);

    return {
      freezeClockAtElapsedSeconds,
      isRunning() {
        return introRunning;
      },
      pauseClock,
      setActive,
      startClock,
      startSequence(excludeIds, nextPastCorrect, forceChallenge) {
        startSequence(excludeIds, nextPastCorrect, forceChallenge);
      },
      stopClock,
    };
  }

  function requireOption(options, name) {
    if (typeof options[name] !== 'function') {
      throw new Error(`extra mode controller option "${name}" must be a function`);
    }
    return options[name];
  }

  global.createExtraModeController = createExtraModeController;
})(window);
