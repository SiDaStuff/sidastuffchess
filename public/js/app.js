// Main Application - Chess Game Review
class ChessReviewApp {
  constructor() {
    this.board = new ChessBoard('chess-board');
    this.engine = null;
    this.analyzer = new MoveAnalyzer();
    this.chess = new Chess();
	    this.engineSettings = {
	      source: 'browser',
	      module: 'full-single',
		      strength: 'depth14',
		      analysisLocation: 'netlify',
	    };
	    this.engineSettings.module = this._recommendedEngineModule();
    this.engineInitToken = 0;
    this.liveEvalToken = 0;
    this.failedBrowserModules = new Set();

    this.gameMoves = [];
    this.gameHeaders = {};
    this.originalGameMoves = [];
    this.initialFen = this.chess.fen();
	    this.currentMoveIndex = -1;
	    this.analysisResults = null;
	    this.liveMoveResults = [];
	    this.explorerReturnState = null;
	    this.isAnalyzing = false;
	    this.autoPlaying = false;
	    this.reviewPlaybackTimer = null;
	    this.liveEvalHistory = [];
    this.lastLiveEvalFen = '';
    this.gameStatus = null;
    this.currentEvalScore = 0;
    this.coachMode = {
      active: false,
      humanColor: 'w',
      elo: 1200,
	      skill: 'intermediate',
	      aiAdjust: true,
	      adjustStyle: 'better',
	      adjustedElo: 1200,
	      adjustment: 0,
	      performanceEma: 0,
	      mistakeRateEma: 0,
	      thinking: false,
      lastAdviceMoveIndex: null,
	      hintLevel: 0,
	      hintFen: '',
	      hintMove: '',
	    };

    this.board.setChessInstance(this.chess);
    this.board.interactive = true;
    this.board.onMove = (from, to) => this._handleBoardMove(from, to);
	    this.board.onFlip = () => {
	      this._syncPlayerNameplates();
	      this._updateEvalBar(this.currentEvalScore);
	      this._refreshMoveBadgePosition();
	    };

    this.elEvalGraph = document.getElementById('eval-graph');
    this.evalGraphCtx = this.elEvalGraph.getContext('2d');

    this.soundFiles = {
      start: '/sounds/start.mp3',
      move: '/sounds/move.mp3',
      capture: '/sounds/capture.mp3',
      castle: '/sounds/castle.mp3',
      check: '/sounds/check.mp3',
      promote: '/sounds/promote.mp3',
      end: '/sounds/end.mp3',
    };
    this.soundPool = {};
    this.soundPreloadPromise = null;

    this._bindElements();
    this._initEngineControls();
    this._bindEvents();
    this._syncPlayerNameplates();
    this._syncCoachVisibility();
    this._initEngine();
	    this._updateBoard();
	    this._updateLiveEvalPanel();
	    this._resetInsightPanel();
	    this._loadPublicStats();
	    window.addEventListener('resize', () => this._updateEvalBar(this.currentEvalScore), { passive: true });
  }

	  _bindElements() {
		    this.elMainMenu = document.getElementById('main-menu');
	    this.elPublicStats = document.getElementById('public-stats');
	    this.elStatsGamesAnalyzed = document.getElementById('stats-games-analyzed');
	    this.elStatsCoachGames = document.getElementById('stats-coach-games');
	    this.elStatsBrilliantMoves = document.getElementById('stats-brilliant-moves');
	    this.elBtnMenuImport = document.getElementById('btn-menu-import');
    this.elBtnMenuCoach = document.getElementById('btn-menu-coach');
    this.elBtnBackMenu = document.getElementById('btn-back-menu');
    this.elEngineChoiceModal = document.getElementById('engine-choice-modal');
    this.elEngineChoiceClose = document.getElementById('engine-choice-close');
	    this.elEngineChoiceModule = document.getElementById('engine-choice-module');
	    this.elEngineChoiceRecommendation = document.getElementById('engine-choice-recommendation');
	    this.elBtnEngineChoiceConfirm = document.getElementById('btn-engine-choice-confirm');
	    this.elEngineLoadingOverlay = document.getElementById('engine-loading-overlay');
	    this.elEngineLoadingText = document.getElementById('engine-loading-text');
	    this.elEngineLoadingFill = document.getElementById('engine-loading-fill');
	    this.elPromotionModal = document.getElementById('promotion-modal');
	    this.elPromotionOptions = document.getElementById('promotion-options');
    this.elBtnImport = document.getElementById('btn-import');
	    this.elBtnCoach = document.getElementById('btn-coach');
    this.elBtnSettings = document.getElementById('btn-settings');
    this.elBtnReview = document.getElementById('btn-review');
    this.elReviewBtnText = document.getElementById('review-btn-text');
    this.elBtnFlip = document.getElementById('btn-flip');
    this.elBtnFirst = document.getElementById('btn-first');
    this.elBtnPrev = document.getElementById('btn-prev');
    this.elBtnNext = document.getElementById('btn-next');
    this.elBtnLast = document.getElementById('btn-last');
    this.elBtnAuto = document.getElementById('btn-auto');
    this.elBtnReset = document.getElementById('btn-reset');
    this.elBtnAutoLabel = this.elBtnAuto.querySelector('.btn-label');
    this.elMoveList = document.getElementById('move-list');
    this.elEvalBarWhite = document.getElementById('eval-bar-white');
    this.elEvalBarBlack = document.getElementById('eval-bar-black');
    this.elEvalScore = document.getElementById('eval-score');
	    this.elEngineStatus = document.getElementById('engine-status');
	    this.elEngineLine = document.getElementById('engine-line');
	    this.elLiveEval = document.getElementById('live-eval');
	    this.elLiveEvalStatus = document.getElementById('live-eval-status');
	    this.elLiveEvalScore = document.getElementById('live-eval-score');
	    this.elLiveEvalLine = document.getElementById('live-eval-line');
	    this.elLiveEvalMeta = document.getElementById('live-eval-meta');
	    this.elCurrentMoveIndicator = document.getElementById('current-move-indicator');
    this.elEngineSource = document.getElementById('engine-source');
    this.elEngineModule = document.getElementById('engine-module');
    this.elEngineStrength = document.getElementById('engine-strength');
    this.elAnalysisLocation = document.getElementById('analysis-location');
    this.elEngineLoadProgress = document.getElementById('engine-load-progress');
    this.elEngineLoadProgressFill = document.getElementById('engine-load-progress-fill');
    this.elReviewSummary = document.getElementById('review-summary');
    this.elProgressBar = document.getElementById('review-progress');
    this.elProgressFill = document.getElementById('progress-fill');
    this.elMoveBadge = document.getElementById('move-badge');
    this.elBadgeIcon = document.getElementById('badge-icon');
    this.elBadgeText = document.getElementById('badge-text');
    this.elPlayerTop = document.getElementById('player-top');
    this.elPlayerBottom = document.getElementById('player-bottom');
    this.elOpeningInfo = document.getElementById('opening-info');
    this.elOpeningName = document.getElementById('opening-name');
    this.elGameStatus = document.getElementById('game-status');
    this.elGameStatusTitle = document.getElementById('game-status-title');
    this.elGameStatusReason = document.getElementById('game-status-reason');
    this.elGameStatusDetails = document.getElementById('game-status-details');

    this.elCapsWhite = document.getElementById('caps-white-val');
	    this.elCapsBlack = document.getElementById('caps-black-val');
	    this.elAcplWhite = document.getElementById('acpl-white-val');
	    this.elAcplBlack = document.getElementById('acpl-black-val');
	    this.elPhaseBreakdown = document.getElementById('phase-breakdown');
	    this.elReviewNarrative = document.getElementById('review-narrative');
	    this.elTrainingList = document.getElementById('training-list');
	    this.elOpeningDrift = document.getElementById('opening-drift');
	    this.elPatternList = document.getElementById('pattern-list');

	    this.elMoveInsights = document.getElementById('move-insights');
	    this.elInsightEmpty = document.getElementById('insight-empty');
	    this.elInsightContent = document.getElementById('insight-content');
    this.elInsightMove = document.getElementById('insight-move');
    this.elInsightClass = document.getElementById('insight-class');
    this.elInsightCpLoss = document.getElementById('insight-cploss');
	    this.elInsightSwing = document.getElementById('insight-swing');
	    this.elInsightBestMove = document.getElementById('insight-bestmove');
	    this.elInsightPhase = document.getElementById('insight-phase');
	    this.elInsightPlanTags = document.getElementById('insight-plan-tags');
	    this.elInsightThreatRow = document.getElementById('insight-threat-row');
	    this.elInsightThreat = document.getElementById('insight-threat');
	    this.elInsightEndgameRow = document.getElementById('insight-endgame-row');
	    this.elInsightEndgame = document.getElementById('insight-endgame');
	    this.elInsightCoach = document.getElementById('insight-coach');
	    this.elBtnLineExplorer = document.getElementById('btn-line-explorer');
	    this.elBtnReturnExplorer = document.getElementById('btn-return-explorer');
	    this.elInsightAlternatives = document.getElementById('insight-alternatives');

    this.elCoachCard = document.getElementById('coach-card');
    this.elCoachState = document.getElementById('coach-state');
    this.elCoachDialog = document.getElementById('coach-dialog');
    this.elCoachSkill = document.getElementById('coach-skill');
    this.elCoachElo = document.getElementById('coach-elo');
    this.elCoachColor = document.getElementById('coach-color');
    this.elBtnCoachStart = document.getElementById('btn-coach-start');
    this.elBtnCoachTakeback = document.getElementById('btn-coach-takeback');
    this.elBtnCoachHint = document.getElementById('btn-coach-hint');
    this.elCoachSetupModal = document.getElementById('coach-setup-modal');
	    this.elCoachSetupClose = document.getElementById('coach-setup-close');
	    this.elCoachSetupElo = document.getElementById('coach-setup-elo');
	    this.elCoachSetupAiAdjust = document.getElementById('coach-setup-ai-adjust');
	    this.elCoachSetupAdjustStyle = document.getElementById('coach-setup-adjust-style');
	    this.elBtnCoachSetupStart = document.getElementById('btn-coach-setup-start');

    this.elCriticalMoments = document.getElementById('critical-moments');
    this.elCriticalList = document.getElementById('critical-list');

    this.elPgnModal = document.getElementById('pgn-modal');
    this.elPgnInput = document.getElementById('pgn-input');
    this.elBtnPgnLoad = document.getElementById('btn-pgn-load');
    this.elModalClose = document.getElementById('modal-close');
    this.elSettingsModal = document.getElementById('settings-modal');
    this.elSettingsClose = document.getElementById('settings-close');
    this.elImportSource = document.getElementById('import-source');
    this.elImportUsername = document.getElementById('import-username');
    this.elImportLimit = document.getElementById('import-limit');
    this.elBtnImportUsername = document.getElementById('btn-import-username');
    this.elImportStatus = document.getElementById('import-status');
    this.elImportResults = document.getElementById('import-results');
  }

  _initEngineControls() {
    this.elEngineSource.value = this.engineSettings.source;
    this.elEngineStrength.value = this.engineSettings.strength;
    if (this.elAnalysisLocation) this.elAnalysisLocation.value = this.engineSettings.analysisLocation;
    this._populateEngineModules();
  }

	  _getReviewProfile() {
	    return getReviewProfileConfig(this.engineSettings.strength);
	  }

		  _showPopup(options = {}) {
			    const config = {
			      icon: options.icon || 'info',
			      title: options.title || '',
			      text: options.text || options.message || '',
			      html: options.html,
			      confirmButtonColor: '#202721',
			      confirmButtonText: options.confirmButtonText || 'OK',
			      showCancelButton: !!options.showCancelButton,
			      cancelButtonText: options.cancelButtonText || 'Cancel',
			      reverseButtons: options.reverseButtons ?? true,
			      allowOutsideClick: options.allowOutsideClick ?? true,
			      customClass: {
			        popup: 'app-popup',
			        confirmButton: 'app-popup-confirm',
			        cancelButton: 'app-popup-cancel',
			      },
			    };

	    if (window.Swal?.fire) {
	      return window.Swal.fire(config);
	    }

		    const confirmed = !config.showCancelButton || window.confirm([config.title, config.text || options.message || ''].filter(Boolean).join('\n'));
		    return Promise.resolve({ isConfirmed: confirmed, isDismissed: !confirmed });
		  }

	  _setButtonLabel(button, label) {
	    const target = button?.querySelector('.btn-label');
	    if (target) {
	      target.textContent = label;
	      return;
	    }
	    if (button) button.textContent = label;
	  }

	  _formatPublicStat(value) {
	    const number = Math.max(0, Number(value) || 0);
	    if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`;
	    if (number >= 10000) return `${Math.round(number / 1000)}k`;
	    return number.toLocaleString();
	  }

		  _renderPublicStats(stats = {}) {
		    this.elPublicStats?.classList.remove('stats-loading');
		    if (this.elStatsGamesAnalyzed) this.elStatsGamesAnalyzed.textContent = this._formatPublicStat(stats.movesAnalyzed ?? stats.gamesAnalyzed);
		    if (this.elStatsCoachGames) this.elStatsCoachGames.textContent = this._formatPublicStat(stats.coachGamesPlayed);
		    if (this.elStatsBrilliantMoves) this.elStatsBrilliantMoves.textContent = this._formatPublicStat(stats.brilliantMoves);
		  }

	  async _loadPublicStats() {
	    this.elPublicStats?.classList.add('stats-loading');
	    try {
	      const response = await fetch('/.netlify/functions/public-stats', { cache: 'no-store' });
	      if (!response.ok) throw new Error(`Stats responded with ${response.status}`);
	      const data = await response.json();
	      this._renderPublicStats(data.stats || {});
		    } catch (_err) {
		      this._renderPublicStats({ movesAnalyzed: 0, coachGamesPlayed: 0, brilliantMoves: 0 });
		    }
		  }

			  _bindEvents() {
    this.elBtnMenuImport?.addEventListener('click', () => this._showEngineChoiceModal('import'));
    this.elBtnMenuCoach?.addEventListener('click', () => this._showEngineChoiceModal('coach'));
    this.elBtnBackMenu?.addEventListener('click', () => this._showMainMenu());
    this.elEngineChoiceClose?.addEventListener('click', () => this._hideEngineChoiceModal());
    this.elEngineChoiceModal?.addEventListener('click', (e) => {
      if (e.target === this.elEngineChoiceModal) this._hideEngineChoiceModal();
    });
	    this.elBtnEngineChoiceConfirm?.addEventListener('click', () => this._confirmEngineChoice());
	    this.elEngineChoiceModule?.addEventListener('change', () => {
	      const selected = this._selectedEngineModule(this.elEngineChoiceModule, this.engineSettings.module);
	      this.elEngineChoiceRecommendation.textContent = this._engineRecommendationText(selected);
	    });
	    this.elPromotionOptions?.addEventListener('click', (e) => {
	      const button = e.target.closest?.('[data-piece]');
	      if (button) this._finishPromotionChoice(button.dataset.piece);
	    });
    this.elBtnImport.addEventListener('click', () => this._showEngineChoiceModal('import'));
    this.elBtnSettings.addEventListener('click', () => this._showSettingsModal());
    this.elModalClose.addEventListener('click', () => this._hidePgnModal());
    this.elSettingsClose.addEventListener('click', () => this._hideSettingsModal());
    this.elPgnModal.addEventListener('click', (e) => {
      if (e.target === this.elPgnModal) this._hidePgnModal();
    });
    this.elSettingsModal.addEventListener('click', (e) => {
      if (e.target === this.elSettingsModal) this._hideSettingsModal();
    });
    this.elBtnPgnLoad.addEventListener('click', () => this._loadPgn());
    this.elBtnImportUsername.addEventListener('click', () => this._loadGamesByUsername());
    this.elImportSource.addEventListener('change', () => this._syncImportMode());

    this.elBtnCoach.addEventListener('click', () => this._showEngineChoiceModal('coach'));
    this.elBtnCoachStart.addEventListener('click', () => this._toggleCoachMode());
    this.elBtnCoachTakeback.addEventListener('click', () => this._coachTakeback());
    this.elBtnCoachHint?.addEventListener('click', () => this._handleCoachHint());
    this.elCoachSetupClose?.addEventListener('click', () => this._hideCoachSetupModal());
	    this.elCoachSetupModal?.addEventListener('click', (e) => {
	      if (e.target === this.elCoachSetupModal) this._hideCoachSetupModal();
	    });
	    this.elCoachSetupAiAdjust?.addEventListener('change', () => {
	      if (this.elCoachSetupAdjustStyle) {
	        this.elCoachSetupAdjustStyle.disabled = this.elCoachSetupAiAdjust.checked === false;
	      }
	    });
	    this.elBtnCoachSetupStart?.addEventListener('click', () => this._startCoachFromSetup());
	    this.elBtnReview.addEventListener('click', () => this._startReview());
	    this.elBtnLineExplorer?.addEventListener('click', () => this._exploreBestLineFromCurrentMove());
	    this.elBtnReturnExplorer?.addEventListener('click', () => this._returnFromLineExplorer());
	    this.elBtnReset.addEventListener('click', () => this._resetGame());
    this.elEngineSource.addEventListener('change', () => this._handleEngineSourceChange());
	    this.elEngineModule.addEventListener('change', () => this._handleEngineModuleChange());
    this.elEngineStrength.addEventListener('change', () => this._handleEngineStrengthChange());
    this.elAnalysisLocation?.addEventListener('change', () => {
      this.engineSettings.analysisLocation = this.elAnalysisLocation.value;
      this._renderIdleEngineInfo();
    });

    this.elBtnFlip.addEventListener('click', () => this.board.flip());
    this.elBtnFirst.addEventListener('click', () => this._goToMove(-1));
    this.elBtnPrev.addEventListener('click', () => this._goToMove(this.currentMoveIndex - 1));
    this.elBtnNext.addEventListener('click', () => this._goToMove(this.currentMoveIndex + 1));
    this.elBtnLast.addEventListener('click', () => this._goToMove(this.gameMoves.length - 1));
    this.elBtnAuto.addEventListener('click', () => this._toggleAutoPlay());

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this._goToMove(this.currentMoveIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this._goToMove(this.currentMoveIndex + 1);
          break;
        case 'Home':
          e.preventDefault();
          this._goToMove(-1);
          break;
        case 'End':
          e.preventDefault();
          this._goToMove(this.gameMoves.length - 1);
          break;
      }
	    });
	  }

	  _enterReviewMode() {
	    document.body.classList.remove('menu-active');
	    document.body.dataset.mode = 'review';
	    if (this.elLiveEval) this.elLiveEval.hidden = false;
	    if (this.coachMode.active) {
	      this.coachMode.active = false;
	      this.coachMode.thinking = false;
	      this.board.clearBestMoveArrow();
	      this._syncCoachControls();
	    }
	    this._syncActionButtons();
	    this._updateCurrentMoveIndicator();
	  }

  _enterCoachMode(options = null) {
    document.body.classList.remove('menu-active');
    document.body.dataset.mode = 'coach';
    if (this.elLiveEval) this.elLiveEval.hidden = false;
	    this.elReviewSummary.style.display = 'none';
	    this.elCriticalMoments.style.display = 'none';
	    this.elMoveBadge.style.display = 'none';
	    this._resetInsightPanel();
    if (options) this.pendingCoachSetup = options;
    if (this.engine?.ready && !this.isAnalyzing) {
      this._startCoachGame(this.pendingCoachSetup || options || {});
      this.pendingCoachSetup = null;
      return;
    }
    this.coachMode.active = true;
	    this._syncCoachVisibility();
	    this._setCoachDialog('Loading Stockfish. Coach will start when ready.', 'Loading');
	    this._updateLiveEvalPanel({
	      busy: true,
	      score: null,
	      line: 'Preparing coach.',
	      meta: 'The board will unlock when the engine is ready.',
	    });
    this._syncCoachControls();
    this._updateCurrentMoveIndicator();
  }

	  _showMainMenu() {
	    this.autoPlaying = false;
	    this._setButtonLabel(this.elBtnAuto, 'Auto');
	    this.liveEvalToken += 1;
	    this.explorerReturnState = null;
	    this.coachMode.active = false;
	    this.coachMode.thinking = false;
	    this.board.clearLoading();
	    this.board.clearBestMoveArrow();
	    this._syncCoachVisibility();
	    document.body.classList.add('menu-active');
	    delete document.body.dataset.mode;
	  }

  async _initEngine() {
    const initToken = ++this.engineInitToken;
    const moduleConfig = getEngineModuleConfig(this.engineSettings.source, this.engineSettings.module);
    let initialized = false;

    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }

	    this._setEngineControlsDisabled(true);
	    this._showEngineLoadingOverlay('Preparing engine settings...');
	    this.elEngineStatus.textContent = `${moduleConfig.engineLabel}: Loading`;
    this.elEngineStatus.classList.remove('ready');
    this._setEngineLoadProgress(5, 'Preparing engine settings...');
    this._renderIdleEngineInfo('Preparing engine settings...');
    this.board.setLoading(null, 'Loading engine');

    try {
      this._setEngineLoadProgress(15, 'Preloading sounds...');
      await this._preloadSounds((pct) => {
        if (initToken !== this.engineInitToken) return;
        this._setEngineLoadProgress(15 + Math.round(pct * 0.25), 'Preloading sounds...');
      });
      if (initToken !== this.engineInitToken) return;

      this._setEngineLoadProgress(42, 'Starting Stockfish...');
      const engine = createEngineController({
        source: this.engineSettings.source,
        module: this.engineSettings.module,
      });
      await engine.init();
      if (initToken !== this.engineInitToken) {
        engine.destroy();
        return;
      }

      this.engine = engine;
      this._setEngineLoadProgress(88, 'Stockfish ready...');
      this.elEngineStatus.textContent = `${moduleConfig.engineLabel}: Ready`;
      this.elEngineStatus.classList.add('ready');
      this._renderIdleEngineInfo();
	      this._requestLiveEvaluation(this.currentMoveIndex >= 0
	        ? 'Analyzing current position...'
	        : 'Analyzing original position...');
	      initialized = true;
	      this._setEngineLoadProgress(100, 'Ready');
	      if (document.body.dataset.mode === 'coach' && this.coachMode.active && this.gameHeaders.Event !== 'Coach') {
	        this._startCoachGame(this.pendingCoachSetup || {});
	        this.pendingCoachSetup = null;
	      }
    } catch (err) {
      if (initToken !== this.engineInitToken) return;

      const nextBrowserModule = this._nextBrowserModuleAfterFailure(this.engineSettings.module);
      if (this.engineSettings.source === 'browser' && nextBrowserModule) {
	        this.engineSettings.module = nextBrowserModule;
	        this._populateEngineModules();
	        this.elEngineStatus.textContent = 'Browser engine unavailable. Trying another Stockfish module...';
	        this._renderIdleEngineInfo('Switching browser engine...');
	        return this._initEngine();
      }

      this.elEngineStatus.textContent = `${moduleConfig.engineLabel}: Failed`;
      this.elEngineLine.textContent = err.message;
      this._setEngineLoadProgress(0, 'Engine failed');
      console.error('Engine init failed:', err);
    } finally {
	      if (initToken === this.engineInitToken) {
	        this.board.clearLoading();
	        this._hideEngineLoadingOverlay();
	        this._setEngineControlsDisabled(this.isAnalyzing);
	        this._syncActionButtons();
	      }
    }

    return initialized;
  }

	  _populateEngineModules() {
	    const modules = getEngineModules(this.engineSettings.source);
	    const recommended = this._recommendedEngineModule();
	    const nextModule = modules.some((entry) => entry.key === this.engineSettings.module && !(entry.requiresIsolation && !window.crossOriginIsolated))
	      ? this.engineSettings.module
	      : recommended;

	    this.engineSettings.module = nextModule;
	    this._renderEngineModuleRadios(this.elEngineModule, 'engine-module', modules, nextModule, recommended);
	  }

	  _selectedEngineModule(container, fallback = this.engineSettings.module) {
	    const checked = container?.querySelector('input[type="radio"]:checked');
	    return checked?.value || fallback;
	  }

	  _renderEngineModuleRadios(container, name, modules, selected, recommended) {
	    if (!container) return;
	    container.innerHTML = '';

	    modules.forEach((entry) => {
	      const unavailable = !!entry.requiresIsolation && !window.crossOriginIsolated;
	      const label = document.createElement('label');
	      label.className = `engine-radio-card${unavailable ? ' disabled' : ''}`;
	      const note = entry.key === recommended ? 'Recommended for this computer' : `${entry.threads || 1} thread${entry.threads === 1 ? '' : 's'}`;
	      label.innerHTML = `
	        <input type="radio" name="${name}" value="${entry.key}" ${entry.key === selected ? 'checked' : ''} ${unavailable ? 'disabled data-unavailable="true"' : ''}>
	        <span>
	          ${entry.label}
	          <small>${unavailable ? 'Needs cross-origin isolation' : note}</small>
	        </span>
	      `;
	      container.appendChild(label);
	    });
	  }

  _nextBrowserModuleAfterFailure(failedKey) {
    if (failedKey) this.failedBrowserModules.add(failedKey);
    const preferred = ['full-single', 'lite-single', 'full-multi', 'lite-multi', 'asm'];
    const available = getEngineModules('browser')
      .filter((entry) => !entry.requiresIsolation || window.crossOriginIsolated)
      .map((entry) => entry.key);
    return preferred.find((key) => available.includes(key) && !this.failedBrowserModules.has(key)) || null;
  }

  async _recoverLiveEngineFailure(err, { silent = false } = {}) {
    if (this.engineSettings.source !== 'browser') return false;
    const nextModule = this._nextBrowserModuleAfterFailure(this.engineSettings.module);
    if (!nextModule) return false;
	    this.engineSettings.module = nextModule;
	    this._populateEngineModules();
	    if (!silent) {
      this._updateLiveEvalPanel({
        busy: false,
        score: null,
        line: 'Stockfish crashed. Switching engine...',
        meta: err?.message || '',
      });
    }
    await this._initEngine();
    return true;
  }

	  _setEngineControlsDisabled(disabled) {
	    this.elEngineSource.disabled = disabled;
	    this.elEngineModule.querySelectorAll('input').forEach((input) => {
	      input.disabled = disabled || input.dataset.unavailable === 'true';
	    });
	    this.elEngineStrength.disabled = disabled;
	    if (this.elAnalysisLocation) this.elAnalysisLocation.disabled = disabled;
	  }

	  _setEngineLoadProgress(percent, message = '') {
	    if (!this.elEngineLoadProgress || !this.elEngineLoadProgressFill) return;
	    const pct = clamp(Math.round(percent || 0), 0, 100);
	    this.elEngineLoadProgress.classList.toggle('ready', pct >= 100);
	    this.elEngineLoadProgressFill.style.width = `${pct}%`;
	    this.elEngineLoadProgress.title = message || `${pct}%`;
	    if (this.elEngineLoadingFill) this.elEngineLoadingFill.style.width = `${pct}%`;
	    if (this.elEngineLoadingText) this.elEngineLoadingText.textContent = message || `${pct}%`;
	  }

		  _showEngineLoadingOverlay(message = 'Preparing Stockfish...') {
		    if (!this.elEngineLoadingOverlay) return;
		    if (document.body.classList.contains('menu-active')) {
		      if (this.elEngineLoadingText) this.elEngineLoadingText.textContent = message;
		      return;
		    }
		    this.elEngineLoadingOverlay.style.display = 'flex';
		    if (this.elEngineLoadingText) this.elEngineLoadingText.textContent = message;
		  }

	  _hideEngineLoadingOverlay() {
	    if (this.elEngineLoadingOverlay) this.elEngineLoadingOverlay.style.display = 'none';
	  }

  _preloadSounds(onProgress) {
    if (this.soundPreloadPromise) return this.soundPreloadPromise;
    const entries = Object.entries(this.soundFiles);
    let complete = 0;
    const report = () => {
      complete += 1;
      if (onProgress) onProgress(entries.length ? complete / entries.length : 1);
    };

    this.soundPreloadPromise = Promise.all(entries.map(([name, file]) => new Promise((resolve) => {
      const audio = new Audio(file);
      audio.preload = 'auto';
      let settled = false;
      let timer = null;
      const done = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        audio.removeEventListener('canplaythrough', done);
        audio.removeEventListener('loadeddata', done);
        audio.removeEventListener('error', done);
        this.soundPool[name] = audio;
        report();
        resolve();
      };
      audio.addEventListener('canplaythrough', done, { once: true });
      audio.addEventListener('loadeddata', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      timer = setTimeout(done, 2500);
      audio.load();
    }))).then(() => true);

    return this.soundPreloadPromise;
  }

	  _syncActionButtons() {
	    const engineReady = !!this.engine?.ready;
	    const serverReview = this.engineSettings.analysisLocation === 'netlify';
	    this.elBtnReview.disabled = this.isAnalyzing || this.gameMoves.length === 0 || (!serverReview && !engineReady);
    if (this.elBtnCoachStart) this.elBtnCoachStart.disabled = this.isAnalyzing || !engineReady;
    if (this.elBtnCoachTakeback) {
      this.elBtnCoachTakeback.disabled = !this.coachMode.active || this.gameMoves.length === 0;
    }
    if (this.elBtnReset) {
      this.elBtnReset.disabled = this.isAnalyzing || (this.gameMoves.length === 0 && this.currentMoveIndex === -1);
    }
  }

	  _renderIdleEngineInfo(message) {
	    const source = ENGINE_CATALOG[this.engineSettings.source]?.label || 'Engine';
	    const moduleConfig = getEngineModuleConfig(this.engineSettings.source, this.engineSettings.module);
	    const reviewProfile = this._getReviewProfile();
	    const location = this.engineSettings.analysisLocation === 'netlify' ? 'Server review' : 'Browser review';
	    this.elEngineLine.textContent = message || `${source} | ${moduleConfig.label} | ${reviewProfile.label} | ${location} | MultiPV ${reviewProfile.multiPv}`;
	  }

	  _renderPostReviewEvalPanel() {
	    const source = this.engineSettings.analysisLocation === 'netlify' ? 'Server review' : 'Browser review';
	    this._updateLiveEvalPanel({
	      busy: false,
	      score: this.analysisResults?.[0]?.evalBefore ?? this.currentEvalScore,
	      line: 'Review complete.',
	      meta: source,
	    });
	    this._renderIdleEngineInfo('Review complete. Select a move for details.');
	  }

  _setLiveEvalLoading(isLoading, label = 'Live eval') {
    if (!this.elLiveEvalStatus) return;
    this.elLiveEvalStatus.classList.toggle('busy', !!isLoading);
    this.elLiveEvalStatus.innerHTML = `<span class="live-status-dot${isLoading ? ' spinning' : ''}"></span><span>${label}</span>`;
  }

  _updateLiveEvalPanel({ busy, score, line, meta } = {}) {
    if (typeof busy === 'boolean') {
      this._setLiveEvalLoading(busy, busy ? 'Analyzing' : 'Live eval');
    }

    if (this.elLiveEvalScore) {
      this.elLiveEvalScore.textContent = typeof score === 'number'
        ? this.analyzer.formatScore(score)
        : '--';
    }

    if (this.elLiveEvalLine) {
      this.elLiveEvalLine.textContent = line || 'Make a move to see a live evaluation.';
    }

    if (this.elLiveEvalMeta) {
      this.elLiveEvalMeta.textContent = meta || '';
    }
  }

  _getGameEndReason() {
    if (!this.chess.game_over()) return null;
    if (this.chess.in_checkmate()) return 'Checkmate';
    if (this.chess.in_stalemate()) return 'Stalemate';
    if (this.chess.in_threefold_repetition()) return 'Threefold repetition';
    if (this.chess.insufficient_material()) return 'Insufficient material';

    const fenParts = this.chess.fen().split(' ');
    const halfmoveClock = parseInt(fenParts[4] || '0', 10);
    if (halfmoveClock >= 100) return '50-move rule';

    if (this.chess.in_draw()) return 'Draw';
    return 'Game over';
  }

  _updateGameStatus() {
    if (!this.elGameStatus) return;

    const reason = this._getGameEndReason();
    this.gameStatus = reason;

    if (!reason) {
      this.elGameStatus.style.display = 'none';
      this.elGameStatusTitle.textContent = '';
      this.elGameStatusReason.textContent = '';
      this.elGameStatusDetails.textContent = '';
      return;
    }

    const sideToMove = this.chess.turn() === 'w' ? 'White' : 'Black';
    let details = `${reason}.`;
    if (reason === 'Checkmate') {
      details = `${sideToMove} to move is checkmated.`;
    } else if (reason === 'Threefold repetition') {
      details = 'The same position has repeated three times.';
    } else if (reason === 'Insufficient material') {
      details = 'There is not enough material left to force mate.';
    } else if (reason === '50-move rule') {
      details = 'Fifty moves have passed without a pawn move or capture.';
    } else if (reason === 'Stalemate') {
      details = `${sideToMove} has no legal moves and is not in check.`;
    } else if (reason === 'Draw') {
      details = 'The position is drawn.';
    }

    this.elGameStatus.style.display = 'block';
    this.elGameStatusTitle.textContent = 'Game End';
    this.elGameStatusReason.textContent = reason;
    this.elGameStatusDetails.textContent = details;
  }

  _refreshCurrentMove() {
    const target = typeof this.currentMoveIndex === 'number' ? this.currentMoveIndex : -1;
    this.currentMoveIndex = -9999;
    this._goToMove(target >= -1 ? target : -1);
  }

	  _invalidateAnalysisResults(options = {}) {
    const { skipBoardRefresh = false } = options;
    if (!this.analysisResults) return;

	    this.analysisResults = null;
	    if (this.elReviewBtnText) this.elReviewBtnText.textContent = 'Start Review';
	    this.elReviewSummary.style.display = 'none';
	    this.elMoveBadge.style.display = 'none';
		    this.elCriticalMoments.style.display = 'none';
		    this.elCriticalList.innerHTML = '';
		    this._clearReviewExtras();
    this._resetInsightPanel();
    this.liveEvalHistory = [];
    this._updateLiveEvalPanel({
      busy: false,
      score: null,
      line: 'Live eval will resume on the next move.',
      meta: '',
    });
    this._renderMoveList();
    this._updateEvalBar(0);
    this._drawEvalGraph();
    this._renderIdleEngineInfo();
    this.board.clearBestMoveArrow();
    if (!skipBoardRefresh) {
      this._refreshCurrentMove();
    }
  }

  async _handleEngineSourceChange() {
    this.engineSettings.source = this.elEngineSource.value;
    this.failedBrowserModules.clear();
    this._populateEngineModules();
    const initialized = await this._initEngine();
    if (initialized) this._invalidateAnalysisResults();
  }

	  async _handleEngineModuleChange() {
	    const selected = this._selectedEngineModule(this.elEngineModule);
	    if (!selected || selected === this.engineSettings.module) return;
	    this.engineSettings.module = selected;
	    this.failedBrowserModules.clear();
	    const initialized = await this._initEngine();
	    if (initialized) this._invalidateAnalysisResults();
  }

  async _handleEngineStrengthChange() {
    this.engineSettings.strength = this.elEngineStrength.value;
    this._renderIdleEngineInfo();
    this._invalidateAnalysisResults();
  }

  _showPgnModal() {
    this.elPgnModal.style.display = 'flex';
    this._setImportStatus('');
    this._renderImportResults([]);
    this._syncImportMode();
    this.elPgnInput.focus();
  }

  _hidePgnModal() {
    this.elPgnModal.style.display = 'none';
  }

  _showSettingsModal() {
    this._syncSettingsModal();
    this.elSettingsModal.style.display = 'flex';
  }

  _hideSettingsModal() {
    this.elSettingsModal.style.display = 'none';
  }

  _recommendedEngineModule() {
    const cores = navigator.hardwareConcurrency || 2;
    const isolated = !!window.crossOriginIsolated;
    if (isolated && cores >= 4) return 'lite-multi';
    return 'lite-single';
  }

  _engineRecommendationText(moduleKey = this._recommendedEngineModule()) {
    const modules = getEngineModules(this.engineSettings.source);
    const recommended = modules.find((entry) => entry.key === this._recommendedEngineModule()) || modules[0];
    const selected = modules.find((entry) => entry.key === moduleKey) || recommended;
    const cores = navigator.hardwareConcurrency || 2;
    const isolated = window.crossOriginIsolated ? 'threaded engines are available' : 'single-threaded engines are safest';
    return `Recommended: ${recommended.label}. This computer reports ${cores} CPU threads, and ${isolated}. Selected: ${selected.label}.`;
  }

	  _showEngineChoiceModal(nextAction) {
	    this.pendingEngineAction = null;
	    this._continueAfterEngineChoice(nextAction);
	  }

  _hideEngineChoiceModal() {
    if (this.elEngineChoiceModal) this.elEngineChoiceModal.style.display = 'none';
    this.pendingEngineAction = null;
  }

  async _confirmEngineChoice() {
    const nextAction = this.pendingEngineAction;
    if (!nextAction) {
      this._hideEngineChoiceModal();
      return;
    }

	    const chosen = this._selectedEngineModule(this.elEngineChoiceModule, this.engineSettings.module);
    const changed = chosen && chosen !== this.engineSettings.module;
    this._hideEngineChoiceModal();

    if (changed) {
	      this.engineSettings.module = chosen;
	      this.failedBrowserModules.clear();
	      this._populateEngineModules();
	      await this._initEngine();
    }

    this._continueAfterEngineChoice(nextAction);
  }

  _continueAfterEngineChoice(nextAction) {
    if (nextAction === 'coach') {
      this._showCoachSetupModal();
      return;
    }

    this._enterReviewMode();
    this._showPgnModal();
  }

  _showCoachSetupModal() {
    if (!this.elCoachSetupModal) {
      this._enterCoachMode({
	        elo: 1200,
	        humanColor: 'w',
	        aiAdjust: true,
	        adjustStyle: 'better',
	      });
      return;
    }

    if (this.elCoachSetupElo) this.elCoachSetupElo.value = String(this.coachMode.elo || 1200);
    const color = this.coachMode.humanColor || 'w';
    const radio = this.elCoachSetupModal.querySelector(`input[name="coach-setup-color"][value="${color}"]`);
	    if (radio) radio.checked = true;
	    if (this.elCoachSetupAiAdjust) this.elCoachSetupAiAdjust.checked = this.coachMode.aiAdjust !== false;
	    if (this.elCoachSetupAdjustStyle) {
	      this.elCoachSetupAdjustStyle.value = this.coachMode.adjustStyle || 'better';
	      this.elCoachSetupAdjustStyle.disabled = this.elCoachSetupAiAdjust?.checked === false;
	    }
	    this.elCoachSetupModal.style.display = 'flex';
	    this.elCoachSetupElo?.focus();
	  }

	  _clearReviewExtras() {
	    if (this.elReviewNarrative) this.elReviewNarrative.innerHTML = '';
	    if (this.elTrainingList) this.elTrainingList.innerHTML = '';
	    if (this.elOpeningDrift) this.elOpeningDrift.innerHTML = '';
	    if (this.elPatternList) this.elPatternList.innerHTML = '';
	  }

  _hideCoachSetupModal() {
    if (this.elCoachSetupModal) this.elCoachSetupModal.style.display = 'none';
  }

  _readCoachSetup() {
    const rawElo = parseInt(this.elCoachSetupElo?.value || '1200', 10);
    const elo = clamp(Number.isFinite(rawElo) ? rawElo : 1200, 100, 2800);
    const colorChoice = this.elCoachSetupModal?.querySelector('input[name="coach-setup-color"]:checked')?.value || 'w';
    const humanColor = colorChoice === 'random'
      ? (Math.random() < 0.5 ? 'w' : 'b')
      : colorChoice;
	    return {
	      elo,
	      humanColor,
	      aiAdjust: this.elCoachSetupAiAdjust?.checked !== false,
	      adjustStyle: this.elCoachSetupAdjustStyle?.value === 'worse' ? 'worse' : 'better',
	    };
	  }

  _startCoachFromSetup() {
    const setup = this._readCoachSetup();
    this._hideCoachSetupModal();
    this._enterCoachMode(setup);
  }

  _syncSettingsModal() {
	    if (this.elEngineSource) this.elEngineSource.value = this.engineSettings.source;
	    if (this.elEngineModule) this._populateEngineModules();
    if (this.elEngineStrength) this.elEngineStrength.value = this.engineSettings.strength;
    if (this.elAnalysisLocation) this.elAnalysisLocation.value = this.engineSettings.analysisLocation;
  }

	  _playerLabel(color) {
	    const headers = this.gameHeaders || {};
	    const name = color === 'w' ? (headers.White || 'White') : (headers.Black || 'Black');
	    const elo = color === 'w' ? headers.WhiteElo : headers.BlackElo;
	    return name + (elo ? ` (${elo})` : '');
	  }

	  _playerColorFromHeaders(headers = this.gameHeaders || {}) {
	    const white = String(headers.White || '').trim().toLowerCase();
	    const black = String(headers.Black || '').trim().toLowerCase();
	    if (black === 'you' || black === 'player') return 'b';
	    if (white === 'you' || white === 'player') return 'w';
	    return null;
	  }

	  _syncPlayerNameplates() {
	    if (!this.elPlayerTop || !this.elPlayerBottom) return;
    const topColor = this.board.flipped ? 'w' : 'b';
    const bottomColor = this.board.flipped ? 'b' : 'w';
    this.elPlayerTop.dataset.color = topColor;
    this.elPlayerBottom.dataset.color = bottomColor;
	    this.elPlayerTop.querySelector('.player-name').textContent = this._playerLabel(topColor);
	    this.elPlayerBottom.querySelector('.player-name').textContent = this._playerLabel(bottomColor);
	  }

	  _currentMoveLabel(index = this.currentMoveIndex) {
	    if (index < 0 || !this.gameMoves[index]) return 'Start';
	    const moveNum = Math.floor(index / 2) + 1;
	    const prefix = index % 2 === 0 ? `${moveNum}.` : `${moveNum}...`;
	    return `${prefix} ${this.gameMoves[index]}`;
	  }

	  _updateCurrentMoveIndicator(index = this.currentMoveIndex) {
	    if (!this.elCurrentMoveIndicator) return;
	    this.elCurrentMoveIndicator.textContent = `Current: ${this._currentMoveLabel(index)}`;
	    this.elCurrentMoveIndicator.title = this._currentMoveLabel(index);
	  }

  _focusCoach() {
    if (!this.coachMode.active) {
      this._startCoachGame();
      return;
    }
    this.elCoachCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.elCoachCard?.classList.add('coach-focus');
    setTimeout(() => this.elCoachCard?.classList.remove('coach-focus'), 800);
  }

  _setCoachDialog(message, state = null) {
    if (this.elCoachDialog) this.elCoachDialog.textContent = message;
    if (this.elCoachState && state) this.elCoachState.textContent = state;
  }

  _syncCoachControls() {
    this._syncCoachVisibility();
    if (this.elBtnCoachStart) {
      this._setButtonLabel(this.elBtnCoachStart, this.coachMode.active ? 'Stop Coach' : 'Start Coach');
    }
    if (this.elBtnCoachTakeback) {
      this.elBtnCoachTakeback.disabled = !this.coachMode.active || this.gameMoves.length === 0 || this.coachMode.thinking;
    }
    if (this.elBtnCoachHint) {
      this.elBtnCoachHint.disabled = !this.coachMode.active
        || !this.engine?.ready
        || this.coachMode.thinking
        || this.chess.game_over()
        || !this._isCoachHumanTurn();
    }
  }

  _resetCoachHint() {
    this.coachMode.hintLevel = 0;
    this.coachMode.hintFen = '';
    this.coachMode.hintMove = '';
  }

  _toggleCoachMode() {
    if (this.coachMode.active) {
      this.coachMode.active = false;
      this.coachMode.thinking = false;
      this.board.clearBestMoveArrow();
      this._setCoachDialog('Coach paused. I shall wait here.', 'Paused');
      this._syncCoachControls();
      return;
    }
    this._startCoachGame();
  }

  async _startCoachGame(options = {}) {
	    if (!this.engine?.ready || this.isAnalyzing) return;
	    const humanColor = options.humanColor || this.elCoachColor?.value || 'w';
	    const elo = clamp(parseInt(options.elo ?? this.elCoachElo?.value ?? '1200', 10) || 1200, 100, 2800);
	    const aiAdjust = options.aiAdjust ?? this.coachMode.aiAdjust ?? true;
	    const adjustStyle = options.adjustStyle || this.coachMode.adjustStyle || 'better';
	    const adjustedElo = aiAdjust ? this._coachAdjustedBaseline(elo, adjustStyle) : elo;
	    const skill = this._coachSkillFromElo(adjustedElo);
    if (this.elCoachColor) this.elCoachColor.value = humanColor;
    if (this.elCoachElo) this.elCoachElo.value = String(elo);
    if (this.elCoachSkill) this.elCoachSkill.value = skill;

		    this.coachMode = {
	      active: true,
      humanColor,
	      elo,
	      skill,
	      aiAdjust,
	      adjustStyle,
		      adjustedElo,
	      adjustment: 0,
	      performanceEma: 0,
	      mistakeRateEma: 0,
	      thinking: false,
      lastAdviceMoveIndex: null,
	      hintLevel: 0,
	      hintFen: '',
	      hintMove: '',
		    };
			    this._loadGame([], {
	      Event: 'Coach',
	      White: humanColor === 'w' ? 'You' : 'Coach',
	      Black: humanColor === 'b' ? 'You' : 'Coach',
	      WhiteElo: humanColor === 'b' ? String(elo) : '',
	      BlackElo: humanColor === 'w' ? String(elo) : '',
	    });
	    this._setBoardOrientationForColor(humanColor);
	    this.coachMode.active = true;
	    const targetNote = aiAdjust
	      ? `AI Adjust ${adjustStyle === 'worse' ? 'below' : 'above'} your level`
	      : 'fixed strength';
	    this._setCoachDialog(`Coach set to ${this._effectiveCoachElo()} ELO (${targetNote}). Make your first move.`, 'Coaching');
    this._syncCoachVisibility();
    this._syncCoachControls();

    if (humanColor === 'b') {
      await this._makeCoachMove();
    }
  }

  _syncCoachVisibility() {
    if (!this.elCoachCard) return;
    this.elCoachCard.hidden = !this.coachMode.active;
  }

	  _classificationIconClass(classification, baseClass) {
	    const kind = classification?.iconType === 'material' ? 'material-symbols-outlined classification-google-icon' : 'classification-text-icon';
	    return `${baseClass} ${kind}`;
	  }

	  _hexToRgb(hex) {
	    const clean = String(hex || '').replace('#', '').trim();
	    if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
	    return {
	      r: parseInt(clean.slice(0, 2), 16),
	      g: parseInt(clean.slice(2, 4), 16),
	      b: parseInt(clean.slice(4, 6), 16),
	    };
	  }

	  _mixColor(hex, target = '#ffffff', amount = 0.72) {
	    const from = this._hexToRgb(hex);
	    const to = this._hexToRgb(target);
	    if (!from || !to) return hex || '';
	    const mix = (a, b) => Math.round(a + (b - a) * amount);
	    return `rgb(${mix(from.r, to.r)}, ${mix(from.g, to.g)}, ${mix(from.b, to.b)})`;
	  }

	  _moveHighlightsForResult(result) {
	    if (!result || result.isCoachMove || !result.moveUci || result.moveUci.length < 4) return [];
	    return [
	      {
	        square: result.moveUci.substring(0, 2),
	        type: 'highlight',
	        color: this._mixColor(result.classification?.color, '#ffffff', 0.72),
	        ringColor: result.classification?.color,
	      },
	      {
	        square: result.moveUci.substring(2, 4),
	        type: 'highlight',
	        color: this._mixColor(result.classification?.color, '#ffffff', 0.72),
	        ringColor: result.classification?.color,
	      },
	    ];
	  }

	  _setBoardOrientationForColor(color) {
	    const shouldFlip = color === 'b';
	    if (this.board.flipped !== shouldFlip) {
	      this.board.flip();
	    } else {
	      this._syncPlayerNameplates();
	    }
	  }

  _isCoachHumanTurn() {
    if (!this.coachMode.active) return true;
    return this.chess.turn() === this.coachMode.humanColor && !this.coachMode.thinking;
  }

	  _coachSkillFromElo(elo) {
	    if (elo < 900) return 'beginner';
	    if (elo < 1600) return 'intermediate';
	    if (elo < 2200) return 'advanced';
	    return 'expert';
	  }

		  _coachAdjustedBaseline(elo, adjustStyle = 'better') {
		    if (elo <= 150) return elo;
		    const offset = adjustStyle === 'worse' ? -350 : 125;
		    return clamp(elo + offset, 100, 2800);
		  }

			  _effectiveCoachElo() {
			    if (!this.coachMode.aiAdjust) return this.coachMode.elo;
			    const baseElo = this.coachMode.elo || 1200;
			    if (baseElo <= 150) return baseElo;
			    const style = this.coachMode.adjustStyle || 'better';
		    const adjusted = this.coachMode.adjustedElo || this._coachAdjustedBaseline(baseElo, style);
		    if (style === 'worse') {
			      return clamp(Math.min(adjusted, baseElo - 160), 100, 2800);
			    }
			    return clamp(Math.max(adjusted, baseElo + 60), 100, 2800);
			  }

	  _adjustCoachSkillFromResult(result) {
	    if (!this.coachMode.aiAdjust || !result?.classificationKey) return '';
	    const quality = {
	      BRILLIANT: 1.8,
	      GREAT: 1.45,
	      BEST: 1.2,
	      EXCELLENT: 0.85,
	      GOOD: 0.35,
	      BOOK: 0.25,
	      FORCED: 0.2,
	      INACCURACY: -0.45,
	      MISTAKE: -0.95,
	      MISS: -1.05,
	      BLUNDER: -1.3,
	    }[result.classificationKey] ?? 0;
	    const mistake = ['INACCURACY', 'MISTAKE', 'MISS', 'BLUNDER'].includes(result.classificationKey) ? 1 : 0;
	    const previousPerformance = this.coachMode.performanceEma || 0;
	    const previousMistakes = this.coachMode.mistakeRateEma || 0;
	    this.coachMode.performanceEma = previousPerformance * 0.82 + quality * 0.18;
	    this.coachMode.mistakeRateEma = previousMistakes * 0.86 + mistake * 0.14;
	    this.coachMode.adjustment = clamp(this.coachMode.performanceEma, -4, 4);

		    const targetPlayerElo = clamp(
		      this.coachMode.elo + (this.coachMode.performanceEma * 110) - (this.coachMode.mistakeRateEma * 80),
		      100,
		      2800
		    );
			    const style = this.coachMode.adjustStyle || 'better';
			    const offset = style === 'worse' ? -350 : 125;
			    const lowerBound = style === 'worse' ? 100 : (this.coachMode.elo || 1200) + 60;
			    const upperBound = style === 'worse' ? Math.max(100, (this.coachMode.elo || 1200) - 160) : 2800;
			    const targetCoachElo = clamp(targetPlayerElo + offset, lowerBound, upperBound);
			    const current = this.coachMode.adjustedElo || this._coachAdjustedBaseline(this.coachMode.elo || 1200, style);
			    this.coachMode.adjustedElo = clamp(Math.round(current * 0.85 + targetCoachElo * 0.15), 100, 2800);
	    this.coachMode.skill = this._coachSkillFromElo(this._effectiveCoachElo());
	    if (this.elCoachSkill) this.elCoachSkill.value = this.coachMode.skill;
	    return '';
	  }

		  _coachDepth() {
		    const effectiveElo = this._effectiveCoachElo();
		    const eloDepth = effectiveElo < 250 ? 1
		      : effectiveElo < 500 ? 2
		        : effectiveElo < 800 ? 3
		      : effectiveElo < 1000 ? 4
		        : effectiveElo < 1300 ? 5
		          : effectiveElo < 1600 ? 7
	            : effectiveElo < 1900 ? 9
	              : effectiveElo < 2200 ? 11
	                : effectiveElo < 2500 ? 13
	                  : 15;
	    return eloDepth;
	  }

		  _coachMultiPvCount() {
		    const effectiveElo = this._effectiveCoachElo();
		    if (effectiveElo < 300) return 10;
		    if (effectiveElo < 600) return 8;
		    if (effectiveElo < 900) return 6;
		    if (effectiveElo < 1400) return 5;
		    if (effectiveElo < 1900) return 4;
		    return 3;
		  }

		  _moveObjToUci(move) {
		    return move ? `${move.from}${move.to}${move.promotion || ''}` : '';
		  }

		  _randomLegalCoachLine() {
		    const legal = this.chess.moves({ verbose: true });
		    if (!legal.length) return null;
		    const move = legal[Math.floor(Math.random() * legal.length)];
		    return { move: this._moveObjToUci(move), cp: 0, pvUci: '', pvSan: '', depth: 0 };
		  }

	  _lineDropForSide(best, candidate, isWhiteToMove) {
	    if (!best || !candidate) return 0;
	    return isWhiteToMove
	      ? Math.max(0, best.cp - candidate.cp)
	      : Math.max(0, candidate.cp - best.cp);
	  }

		  _chooseCoachLine(lines, isWhiteToMove) {
		    const ordered = this.analyzer._orderLinesForSide(lines, isWhiteToMove);
		    const effectiveElo = this._effectiveCoachElo();
		    const legalFallback = () => this._randomLegalCoachLine() || ordered[0];
		    if (effectiveElo <= 150 && Math.random() < 0.82) return legalFallback();
		    if (effectiveElo < 350 && Math.random() < 0.58) return legalFallback();
		    if (ordered.length <= 1) return ordered[0] || legalFallback();
	
			    const previousHumanResult = this.liveMoveResults?.[this.currentMoveIndex];
			    const previousKey = previousHumanResult?.classificationKey || '';
			    const bestGap = this._lineDropForSide(ordered[0], ordered[1], isWhiteToMove);
			    const punishableMistake = ['BLUNDER', 'MISS', 'MISTAKE'].includes(previousKey) && bestGap >= 60;
			    const clearTactic = bestGap >= 170;
			    if (effectiveElo >= 1800 && (punishableMistake || clearTactic)) return ordered[0];
			    if (punishableMistake && Math.random() < clamp((effectiveElo - 700) / 1600, 0.25, 0.82)) return ordered[0];
			    if (clearTactic && Math.random() < clamp((effectiveElo - 900) / 1500, 0.18, 0.86)) return ordered[0];
			    if (effectiveElo >= 2200) return ordered[0];
	
			    const mistakeStyle = clamp(this.coachMode.mistakeRateEma || 0, 0, 1);
			    const worseMode = this.coachMode.aiAdjust !== false && this.coachMode.adjustStyle === 'worse';
			    const baseElo = this.coachMode.elo || effectiveElo;
			    const oneMoveBlunderChance = worseMode
			      ? clamp(0.1 + ((baseElo - effectiveElo) / 900) + ((baseElo - 1400) / 2200), 0.12, 0.52)
			      : 0;
			    if (oneMoveBlunderChance > 0 && Math.random() < oneMoveBlunderChance) {
			      return legalFallback();
			    }

			    const maxDrop = effectiveElo < 300 ? 900
			      : effectiveElo < 600 ? 520
			        : effectiveElo < 900 ? 300
			      : effectiveElo < 1300 ? 185
			        : effectiveElo < 1700 ? 125
			          : 60;
			    const styleDrop = maxDrop + Math.round(mistakeStyle * 55) + (worseMode ? 170 : 0);
			    const candidates = ordered
			      .slice(0, this._coachMultiPvCount())
			      .filter((line) => this._lineDropForSide(ordered[0], line, isWhiteToMove) <= styleDrop);
	
		    if (candidates.length <= 1) return ordered[0];
	
			    const bestChance = effectiveElo < 300 ? 0.05
			      : effectiveElo < 600 ? 0.12
			        : effectiveElo < 900 ? 0.24
			      : effectiveElo < 1300 ? 0.32
			        : effectiveElo < 1700 ? 0.56
			          : 0.86;
			    const adjustedBestChance = clamp(bestChance - mistakeStyle * 0.14 - (worseMode ? 0.18 : 0), 0.04, 0.92);
		    const roll = Math.random();
		    if (roll < adjustedBestChance) return candidates[0];
		    if (roll < adjustedBestChance + 0.35 && candidates[1]) return candidates[1];
		    return candidates[Math.min(candidates.length - 1, 2 + Math.floor(Math.random() * 2))] || candidates[2] || candidates[1] || candidates[0];
		  }

  async _makeCoachMove() {
    if (!this.coachMode.active || !this.engine?.ready || this.chess.game_over()) return;
    if (this.chess.turn() === this.coachMode.humanColor) return;

    this.coachMode.thinking = true;
    this.liveEvalToken += 1;
    this._syncCoachControls();
    this._setCoachDialog('I am thinking...', 'Thinking');
    this.board.setLoading(null, 'Coach thinking');

    try {
	      const fenBefore = this.chess.fen();
	      const depth = this._coachDepth();
	      const multi = await this.engine.evaluateMultiPV(fenBefore, depth, this._coachMultiPvCount());
      if (!this.coachMode.active || this.chess.fen() !== fenBefore) return;

      const isWhiteToMove = fenBefore.split(' ')[1] === 'w';
      const lines = (multi.lines || []).map((line) => {
        const pvTokens = (line.pv || '').split(/\s+/).filter(Boolean);
        return {
          move: pvTokens[0] || '',
          cp: this.analyzer.normalizeScore(line.score || 0, line.scoreType || 'cp', isWhiteToMove),
          pvUci: line.pv || '',
          pvSan: this.analyzer._lineToSan(fenBefore, line.pv || '', 6),
          depth: line.depth || depth,
        };
      }).filter((line) => line.move);

      const chosen = this._chooseCoachLine(lines, isWhiteToMove);
      if (!chosen?.move) return;

      const move = this.chess.move({
        from: chosen.move.slice(0, 2),
        to: chosen.move.slice(2, 4),
        promotion: chosen.move[4],
      });
      if (!move) return;

	      this.gameMoves.push(move.san);
	      this.currentMoveIndex = this.gameMoves.length - 1;
	      this._resetCoachHint();
	      this.board.setChessInstance(this.chess);
	      this._updateBoard();
	      this._updateCurrentMoveIndicator();
	      const previousHumanResult = this.liveMoveResults?.[this.currentMoveIndex - 1];
		      const feedbackHighlights = this._moveHighlightsForResult(previousHumanResult);
		      const coachMoveHighlights = [{ square: move.from, type: 'highlight' }, { square: move.to, type: 'highlight' }];
		      this.board.setHighlights([...feedbackHighlights, ...coachMoveHighlights]);
      this._renderMoveList();
      this._updateActiveMoveInList();
      this._updateGameStatus();
      this._playMoveSound(move, this.currentMoveIndex);
	      this._requestLiveEvaluation(`Coach played ${move.san}`, {
	        fenBefore,
	        fenAfter: this.chess.fen(),
	        moveObj: move,
	        moveIndex: this.currentMoveIndex,
	        isCoachMove: true,
	      });
	      if (!this._checkCoachGameOver()) {
	        this._setCoachDialog(`I played ${move.san}. Your move.`, 'Coaching');
	      }
    } catch (err) {
      console.error('Coach move failed:', err);
      this._setCoachDialog('The coach could not find a move. Try again in a moment.', 'Waiting');
    } finally {
      this.coachMode.thinking = false;
      this.board.clearLoading();
      this._syncCoachControls();
    }
  }

	  async _handleCoachHumanMove(move, liveResultPromise) {
	    if (!this.coachMode.active) return;
	    const result = await liveResultPromise.catch(() => null);
	    if (!this.coachMode.active) return;
	
		    const key = result?.classificationKey || '';
		    const adjustNote = this._adjustCoachSkillFromResult(result);
			    if (['BLUNDER', 'MISTAKE', 'MISS', 'INACCURACY'].includes(key)) {
			      const reply = result.opponentBestMoveSan || result.opponentBestMove || 'the tactic';
			      const queenNote = /queen/i.test(result.coachText || '') ? 'This leaves your queen vulnerable.' : 'This is the key moment.';
			      const replyNote = result.coachText?.includes(reply) ? '' : ` The coach response is ${reply}.`;
				      this._setCoachDialog(`${queenNote} ${result.coachText || ''}${replyNote} Use Take Back if you want another try.${adjustNote}`, key);
		      if (result.opponentBestMove) this.board.setBestMoveArrow(result.opponentBestMove, { color: '#CA3431' });
		      this.coachMode.lastAdviceMoveIndex = result.moveIndex;
			      if (['BLUNDER', 'MISTAKE'].includes(key)) {
			        const choice = await this._showCoachTakebackPrompt(result, reply);
			        if (!this.coachMode.active) return;
			        if (!choice) {
			          this._coachTakeback();
			          return;
			        }
			      }
			    } else if (key === 'BRILLIANT') {
			      this._setCoachDialog(`${move.san}!! Brilliant. Best move, hard to find, and tactically precise.${adjustNote}`, 'Brilliant');
	    } else if (key) {
	      this._setCoachDialog(`${result.classification.name}: ${move.san}. Keep going.${adjustNote}`, 'Coaching');
	    }
	
		    if (!this._checkCoachGameOver()) {
		      setTimeout(() => this._makeCoachMove(), 700);
		    }
		  }

		  async _showCoachTakebackPrompt(result, reply) {
		    const key = result?.classificationKey || 'MISTAKE';
		    const title = key === 'BLUNDER' ? 'Blunder on the board' : 'Mistake on the board';
		    const explanation = result?.coachText || `${result?.moveSan || 'That move'} gives the coach a clear reply.`;
		    const replyNote = explanation.includes(reply) ? '' : ` The coach can answer with ${reply}.`;
		    const response = await this._showPopup({
		      icon: key === 'BLUNDER' ? 'error' : 'warning',
		      title,
		      text: `${explanation}${replyNote}`,
		      confirmButtonText: 'Continue',
		      cancelButtonText: 'Take Back',
		      showCancelButton: true,
		      allowOutsideClick: false,
		    });
		    return !!response?.isConfirmed;
		  }

  _checkCoachGameOver() {
    if (!this.coachMode.active || !this.chess.game_over()) return false;

    let message = 'Game over.';
    const humanWon = this.chess.in_checkmate() && this.chess.turn() !== this.coachMode.humanColor;
    const coachWon = this.chess.in_checkmate() && this.chess.turn() === this.coachMode.humanColor;

	    if (humanWon) {
	      message = 'Checkmate. You beat the coach.';
	    } else if (coachWon) {
	      message = 'Checkmate. Coach wins this one.';
    } else if (this.chess.in_draw()) {
      message = 'Draw. Nice hold.';
    }

    this._setCoachDialog(message, 'Game Over');
    this._syncCoachControls();
    return true;
  }

  async _handleCoachHint() {
    if (!this.coachMode.active || this.coachMode.thinking || !this.engine?.ready || !this._isCoachHumanTurn()) return;

    const fen = this.chess.fen();
    if (this.coachMode.hintFen !== fen || !this.coachMode.hintMove) {
      this._resetCoachHint();
      this.coachMode.hintFen = fen;
      this.coachMode.thinking = true;
      this._syncCoachControls();
      this._setCoachDialog('Finding a hint...', 'Hint');
      this.board.setLoading(null, 'Hint');

      try {
        const depth = Math.min(12, Math.max(8, this._coachDepth()));
        const multi = await this.engine.evaluateMultiPV(fen, depth, 3);
        if (!this.coachMode.active || this.chess.fen() !== fen) return;
        const isWhiteToMove = fen.split(' ')[1] === 'w';
        const lines = (multi.lines || []).map((line) => {
          const pvTokens = (line.pv || '').split(/\s+/).filter(Boolean);
          return {
            move: pvTokens[0] || '',
            cp: this.analyzer.normalizeScore(line.score || 0, line.scoreType || 'cp', isWhiteToMove),
          };
        }).filter((line) => line.move);
        const best = this.analyzer._orderLinesForSide(lines, isWhiteToMove)[0];
        if (!best?.move) {
          this._setCoachDialog('No hint is available in this position.', 'Hint');
          return;
        }
        this.coachMode.hintMove = best.move;
      } catch (err) {
        console.error('Coach hint failed:', err);
        this._setCoachDialog('Hint failed. Try again in a moment.', 'Hint');
        return;
      } finally {
        this.coachMode.thinking = false;
        this.board.clearLoading();
        this._syncCoachControls();
      }
    }

    const move = this.coachMode.hintMove;
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const baseHighlights = (this.board.highlights || []).filter((h) => h.type !== 'best-from' && h.type !== 'best-to');

    if (this.coachMode.hintLevel === 0) {
      this.board.setHighlights([...baseHighlights, { square: from, type: 'best-from' }]);
      this.board.clearBestMoveArrow();
      this.coachMode.hintLevel = 1;
      this._setCoachDialog('Hint: move this piece. Press Hint again for the full move.', 'Hint');
      return;
    }

    this.board.setHighlights([...baseHighlights, { square: from, type: 'best-from' }, { square: to, type: 'best-to' }]);
    this.board.setBestMoveArrow(move, { color: '#346ea5' });
    this.coachMode.hintLevel = 2;
    this._setCoachDialog('Hint: follow the arrow.', 'Hint');
  }

  _coachTakeback() {
    if (!this.coachMode.active || this.coachMode.thinking || this.gameMoves.length === 0) return;
    const undoCount = this.chess.turn() === this.coachMode.humanColor ? 2 : 1;
    for (let i = 0; i < undoCount; i += 1) {
      const undone = this.chess.undo();
      if (!undone) break;
      this.gameMoves.pop();
      this.liveMoveResults.pop();
    }

	    this.currentMoveIndex = this.gameMoves.length - 1;
	    this.board.setChessInstance(this.chess);
	    this._updateBoard();
	    this._updateCurrentMoveIndicator();
    this.board.setHighlights([]);
    this.board.clearBestMoveArrow();
    this.elMoveBadge.style.display = 'none';
    this._renderMoveList();
    this._updateActiveMoveInList();
    this._updateGameStatus();
    this._requestLiveEvaluation('Try the position again.');
    this._setCoachDialog('Good. Try that position again.', 'Coaching');
    this._syncActionButtons();
    this._syncCoachControls();
  }

  _syncImportMode() {
    if (!this.elImportSource || !this.elBtnImportUsername) return;
    const isPgnMode = this.elImportSource.value === 'pgn';
    this.elBtnImportUsername.querySelector('.btn-label').textContent = isPgnMode ? 'Load PGN' : 'Load Username';
    this.elImportUsername.disabled = isPgnMode;
    this.elImportLimit.disabled = isPgnMode;
    this.elImportUsername.parentElement.style.opacity = isPgnMode ? '0.55' : '1';
    this.elImportLimit.parentElement.style.opacity = isPgnMode ? '0.55' : '1';
  }

  _loadPgn() {
    const pgn = this.elPgnInput.value.trim();
    if (!pgn) return;
    try {
      const games = this._splitPgnGames(pgn);
      if (games.length > 1) {
        const items = games.map((gameText, index) => {
          const game = this._gameSummaryFromPgn(gameText, {});
          return {
            pgn: gameText,
            headers: game,
            ...this._formatImportedGameLabel(game, 'pgn', index),
          };
        });
        this._setImportStatus(`Found ${items.length} games. Click one to load it.`, 'success');
        this._renderImportResults(this._sortImportedGamesByRecent(items));
        return;
      }
      this._loadPgnText(pgn);
      this._hidePgnModal();
	    } catch (err) {
	      this._showPopup({
	        icon: 'error',
	        title: 'Could not load PGN',
	        text: err.message,
	      });
	    }
	  }

  _loadPgnText(pgnText, headers = {}) {
    const chess = new Chess();
    const normalized = this._normalizePgnText(pgnText);
    const parsedHeaders = this._readPgnHeaders(normalized);
    let loaded = chess.load_pgn(normalized, { sloppy: true });

    if (!loaded) {
      const startFen = parsedHeaders.FEN || parsedHeaders.Fen || parsedHeaders.fen;
      if (startFen) chess.load(startFen);
      else chess.reset();

      const moves = this._parseMoveText(normalized);
      for (const move of moves) {
        if (!chess.move(move, { sloppy: true })) {
          throw new Error(`Could not parse PGN near move "${move}". Please check the format.`);
        }
      }
      loaded = moves.length > 0;
    }

    if (!loaded) {
      throw new Error('Could not parse PGN. Please check the format.');
    }

    this._loadGame(chess.history(), { ...parsedHeaders, ...chess.header(), ...headers });
  }

  _normalizePgnText(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .trim();
  }

  _readPgnHeaders(text) {
    const headers = {};
    const matches = String(text || '').matchAll(/^\s*\[([A-Za-z0-9_]+)\s+"([^"]*)"\]\s*$/gm);
    for (const match of matches) headers[match[1]] = match[2];
    return headers;
  }

  _parseMoveText(text) {
    let clean = this._normalizePgnText(text);
    clean = clean.replace(/^\s*\[[^\n]*\]\s*$/gm, ' ');
    clean = clean.replace(/\{[%a-zA-Z0-9_:-][^}]*\}/g, ' ');
    clean = clean.replace(/\{[^}]*\}/g, ' ');
    while (/\([^()]*\)/.test(clean)) clean = clean.replace(/\([^()]*\)/g, ' ');
    clean = clean.replace(/;[^\n]*/g, ' ');
    clean = clean.replace(/^%[^\n]*/gm, ' ');
    clean = clean.replace(/\$\d+/g, ' ');
    clean = clean.replace(/\d+\.(\.\.)?/g, ' ');
    clean = clean.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, ' ');
    clean = clean.replace(/[?!]+/g, '');
    return clean
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== '...');
  }

  _splitPgnGames(text) {
    const normalized = this._normalizePgnText(text);
    if (!normalized) return [];
    const games = normalized
      .trim()
      .split(/\n\s*\n(?=\s*\[[A-Za-z0-9_]+\s+")/g)
      .map((gameText) => gameText.trim())
      .filter(Boolean);
    return games.length ? games : [normalized];
  }

  _gameSummaryFromPgn(pgnText, fallback = {}) {
    const chess = new Chess();
    const normalized = this._normalizePgnText(pgnText);
    if (!chess.load_pgn(normalized, { sloppy: true })) {
      return {
        ...fallback,
        ...this._readPgnHeaders(normalized),
        pgn: normalized,
      };
    }

    return {
      ...fallback,
      ...chess.header(),
      pgn: normalized,
      moves: chess.history(),
    };
  }

  _formatImportedGameLabel(game, source, index) {
    const white = game.White || game.white || 'White';
    const black = game.Black || game.black || 'Black';
    const result = game.Result || game.result || '*';
    const opening = game.Opening || game.opening || game.ECO || game.eco || '';
    const date = game.Date || game.date || (game.EndTime ? new Date(Number(game.EndTime) * 1000).toISOString().slice(0, 10).replace(/-/g, '.') : '');
    const timeClass = game.TimeClass ? game.TimeClass[0].toUpperCase() + game.TimeClass.slice(1) : '';
    const timeControl = game.TimeControl || '';
    const siteLabel = source === 'chesscom' ? 'Chess.com' : 'Lichess';
    const title = `${white} vs ${black}`;
    const metaBits = [date, timeClass || timeControl, result, opening].filter(Boolean);

    return {
      title,
      subtitle: metaBits.join(' • ') || `${siteLabel} game ${index + 1}`,
      siteLabel,
    };
  }

  _setImportStatus(message, kind = 'idle') {
    if (!this.elImportStatus) return;
    this.elImportStatus.textContent = message || '';
    this.elImportStatus.className = `import-status ${kind}`.trim();
  }

  _renderImportResults(items) {
    if (!this.elImportResults) return;
    this.elImportResults.innerHTML = '';

    if (!items || items.length === 0) {
      return;
    }

    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'import-result';
      button.innerHTML = `
        <span class="import-result-title">${item.title}</span>
        <span class="import-result-subtitle">${item.subtitle}</span>
      `;
      button.addEventListener('click', () => {
        try {
          this._loadPgnText(item.pgn, item.headers || {});
          this._hidePgnModal();
	        } catch (err) {
	          this._showPopup({
	            icon: 'error',
	            title: 'Could not load PGN',
	            text: err.message,
	          });
	        }
	      });
      this.elImportResults.appendChild(button);
    }
  }

  async _loadGamesByUsername() {
    const username = (this.elImportUsername?.value || '').trim();
    const source = this.elImportSource?.value || 'pgn';
    const limit = parseInt(this.elImportLimit?.value || '10', 10);

    if (source === 'pgn') {
      this._loadPgn();
      return;
    }

    if (!username) {
      this._setImportStatus('Enter a username first.', 'error');
      return;
    }

    this._setImportStatus(`Loading ${source === 'chesscom' ? 'Chess.com' : 'Lichess'} games...`, 'loading');
    this.elBtnImportUsername.disabled = true;
    this._renderImportResults([]);

    try {
      const games = source === 'chesscom'
        ? await this._fetchChessComGames(username, limit)
        : await this._fetchLichessGames(username, limit);

      if (!games.length) {
        this._setImportStatus('No recent games were found for that user.', 'error');
        return;
      }

      this._setImportStatus(`Showing the last ${games.length} games for ${username}. Click one to load it.`, 'success');
      this._renderImportResults(games);
    } catch (err) {
      console.error('Username import failed:', err);
      this._setImportStatus(err.message || 'Could not load games for that user.', 'error');
    } finally {
      this.elBtnImportUsername.disabled = false;
    }
  }

  async _fetchLichessGames(username, limit = 10) {
    const proxied = await this._fetchRecentGamesViaServer('lichess', username, limit);
    if (proxied) return proxied;

    const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${limit}&moves=true&clocks=true&opening=true&finished=true&sort=dateDesc`;
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Lichess responded with ${response.status}`);
    }

    const text = await response.text();
    const games = this._splitPgnGames(text).map((pgnText, index) => {
      const game = this._gameSummaryFromPgn(pgnText, {});
      const summary = this._formatImportedGameLabel(game, 'lichess', index);
      return {
        pgn: pgnText,
        headers: game,
        ...summary,
      };
    });

    return this._sortImportedGamesByRecent(games).slice(0, limit);
  }

  async _fetchChessComGames(username, limit = 10) {
    const proxied = await this._fetchRecentGamesViaServer('chesscom', username, limit);
    if (proxied) return proxied;

    const archiveUrl = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`;
    const archiveResponse = await fetch(archiveUrl, { mode: 'cors' });
    if (!archiveResponse.ok) {
      throw new Error(`Chess.com responded with ${archiveResponse.status}`);
    }

    const archiveData = await archiveResponse.json();
    const archives = Array.isArray(archiveData.archives) ? archiveData.archives.slice().reverse() : [];
    const games = [];
    const monthGameLimit = Math.max(limit, 20);

    for (const monthUrl of archives) {
      if (games.length >= monthGameLimit) break;

      const monthResponse = await fetch(monthUrl, { mode: 'cors' });
      if (!monthResponse.ok) continue;

      const monthData = await monthResponse.json();
      const monthGames = Array.isArray(monthData.games) ? monthData.games : [];

      for (const chessComGame of monthGames) {
        if (!chessComGame?.pgn) continue;
        const game = this._gameSummaryFromPgn(chessComGame.pgn, {
          TimeControl: chessComGame.time_control,
          TimeClass: chessComGame.time_class,
          Rated: chessComGame.rated,
          EndTime: chessComGame.end_time,
          Url: chessComGame.url,
        });
        const summary = this._formatImportedGameLabel(game, 'chesscom', games.length);
        games.push({
          pgn: chessComGame.pgn,
          headers: game,
          ...summary,
        });
      }
    }

    return this._sortImportedGamesByRecent(games).slice(0, limit);
  }

  async _fetchRecentGamesViaServer(source, username, limit) {
    try {
      const params = new URLSearchParams({ source, username, limit: String(limit) });
      const response = await fetch(`/.netlify/functions/recent-games?${params.toString()}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (!Array.isArray(data.games)) return null;
      return this._sortImportedGamesByRecent(data.games.map((game, index) => ({
        ...game,
        headers: game.headers || game,
        ...this._formatImportedGameLabel(game.headers || game, source, index),
      }))).slice(0, limit);
    } catch (_err) {
      return null;
    }
  }

  _gameTimestamp(game) {
    const headers = game.headers || game || {};
    const numeric = Number(headers.EndTime || headers.end_time || headers.createdAt || headers.lastMoveAt || 0);
    if (numeric > 0) return numeric > 100000000000 ? numeric / 1000 : numeric;
    const date = headers.Date || headers.UTCDate || headers.date || '';
    const time = headers.UTCTime || headers.Time || headers.time || '00:00:00';
    const parsed = Date.parse(`${String(date).replace(/\./g, '-')}T${time}Z`);
    return Number.isFinite(parsed) ? parsed / 1000 : 0;
  }

  _sortImportedGamesByRecent(games) {
    return (games || []).slice().sort((a, b) => this._gameTimestamp(b) - this._gameTimestamp(a));
  }

	  _isPromotionMove(from, to) {
	    const piece = this.chess.get(from);
	    if (!piece || piece.type !== 'p') return undefined;
	    return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
	  }

	  _requestPromotionPiece() {
	    if (!this.elPromotionModal) return Promise.resolve('q');
	    this.elPromotionModal.style.display = 'flex';
	    this.elPromotionOptions?.querySelector('[data-piece="q"]')?.focus();
	    return new Promise((resolve) => {
	      this.pendingPromotionResolve = resolve;
	    });
	  }

	  _finishPromotionChoice(piece = 'q') {
	    const resolve = this.pendingPromotionResolve;
	    this.pendingPromotionResolve = null;
	    if (this.elPromotionModal) this.elPromotionModal.style.display = 'none';
	    if (resolve) resolve(['q', 'r', 'b', 'n'].includes(piece) ? piece : 'q');
	  }

	  async _handleBoardMove(from, to) {
	    if (this.isAnalyzing) return;
	    if (this.coachMode.active && !this._isCoachHumanTurn()) return;

	    const fenBefore = this.chess.fen();
	    const promotion = this._isPromotionMove(from, to) ? await this._requestPromotionPiece() : undefined;
	    const move = this.chess.move({ from, to, promotion }, { sloppy: true });
    if (!move) {
      this.board.setPositionFromFen(this.chess.fen());
      return;
    }

    if (this.currentMoveIndex < this.gameMoves.length - 1) {
      this.gameMoves = this.gameMoves.slice(0, this.currentMoveIndex + 1);
      this.liveMoveResults = this.liveMoveResults.slice(0, this.currentMoveIndex + 1);
    }

	    this.gameMoves.push(move.san);
	    this.currentMoveIndex = this.gameMoves.length - 1;
	    this._resetCoachHint();
	    this.board.setChessInstance(this.chess);
	    this._updateBoard();
	    this._updateCurrentMoveIndicator();
    this.board.setHighlights([{ square: move.from, type: 'highlight' }, { square: move.to, type: 'highlight' }]);
    this.board.clearBestMoveArrow();

    this._invalidateAnalysisResults({ skipBoardRefresh: true });
    this._renderMoveList();
    this._showOpeningInfo(this.analyzer.detectOpening(this.gameMoves));
    this._updateGameStatus();
    this._playMoveSound(move, this.currentMoveIndex);
    this._syncActionButtons();
    const liveResultPromise = this._requestLiveEvaluation(`Analyzing ${move.san}`, {
      fenBefore,
      fenAfter: this.chess.fen(),
      moveObj: move,
      moveIndex: this.currentMoveIndex,
    });
    if (this.coachMode.active) {
      this._handleCoachHumanMove(move, liveResultPromise);
    }
  }

  _buildLiveMoveResult({
    fenBefore,
    fenAfter,
    moveObj,
    moveIndex,
    scoreBefore,
    scoreAfter,
    lines,
    bestMove,
    bestMoveSan,
    opponentBestMove = '',
	    opponentBestMoveSan = '',
	    depth,
	    isCoachMove = false,
	  }) {
    const prevChess = new Chess(fenBefore);
    const nextChess = new Chess(fenAfter);
    const isWhitePlaying = fenBefore.split(' ')[1] === 'w';
    const playedUci = `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}`;
    const movePly = moveIndex + 1;
    const numLegalMoves = prevChess.moves({ verbose: true }).length;
    const sacResult = this.analyzer.checkSacrifice(new Chess(fenBefore), moveObj.san);
    const scoreBeforeEdge = isWhitePlaying ? scoreBefore : -scoreBefore;
    const scoreAfterEdge = isWhitePlaying ? scoreAfter : -scoreAfter;
    const playerEdgeBefore = scoreBeforeEdge;
    const playerEdgeAfter = scoreAfterEdge;
    const cpLoss = this.analyzer._cpLoss(scoreBefore, scoreAfter, isWhitePlaying);
    const secondLine = lines.length > 1 ? lines[1] : null;
    const gapToSecond = this.analyzer._gapToSecond(
      lines[0] ? lines[0].cp : scoreBefore,
      secondLine ? secondLine.cp : null,
      isWhitePlaying
    );
	    const isCheckmate = nextChess.in_checkmate();
	    const isBestMove = playedUci === bestMove;
	    const opponentJustBlundered = moveIndex > 0 && ['BLUNDER', 'MISTAKE'].includes(this.liveMoveResults[moveIndex - 1]?.classificationKey);
	    const phase = this.analyzer._phaseFromFen(fenBefore, movePly);
	    const playerRating = this.coachMode.active
	      ? this.coachMode.elo
	      : this.analyzer._ratingForColor(this.gameHeaders, isWhitePlaying);
	    const timeControl = this.gameHeaders?.TimeControl || this.gameHeaders?.Time || '';
	    const expectedLoss = this.analyzer.expectedPointLoss(playerEdgeBefore, playerEdgeAfter, playerRating);
		    const classification = this.analyzer.classifyMove({
	      movePly,
	      moveSan: moveObj.san,
	      moveUci: playedUci,
	      fenBefore,
	      numLegalMoves,
	      isCheckmate,
      isPieceSacrifice: sacResult.isPieceSacrifice,
      playerEdgeBefore,
      playerEdgeAfter,
      cpLoss,
      isBestMove,
      gapToSecond,
	      scoreBefore,
	      scoreAfter,
		      phase,
		      playerRating,
		      timeControl,
		      opponentJustBlundered,
		    });

	    const alternatives = lines.slice(0, this._getReviewProfile().multiPv).map((line, idx) => ({
	      rank: idx + 1,
      moveUci: line.move,
      moveSan: this.analyzer.uciToSan(fenBefore, line.move),
      eval: line.cp,
      evalText: this.analyzer.formatScore(line.cp),
      pvSan: line.pvSan,
    }));
	
	    const classificationKey = this.analyzer.getClassificationKey(classification);
	    const mateThreat = this.analyzer._mateThreat(fenAfter);
	    const planTags = this.analyzer._planTags({
	      fenBefore,
	      fenAfter,
	      moveObj,
	      phase,
	      classificationKey,
	      playerEdgeBefore,
	      playerEdgeAfter,
	    });
	    const endgameNotes = this.analyzer._endgameNotes(fenBefore, fenAfter, moveObj, phase);
	    const result = {
      move: moveObj.san,
      moveSan: moveObj.san,
      moveUci: playedUci,
      moveIndex,
      moveNumber: Math.floor(moveIndex / 2) + 1,
      isWhite: isWhitePlaying,
      classification,
      classificationKey,
      evalBefore: scoreBefore,
      evalAfter: scoreAfter,
	      swing: scoreAfter - scoreBefore,
	      cpLoss,
	      expectedLoss,
	      playerRating,
	      playerEdgeBefore,
	      playerEdgeAfter,
	      bestMove,
      bestMoveSan,
      opponentBestMove,
      opponentBestMoveSan,
      bestMovePv: '',
      bestMovePvSan: '',
      alternatives,
      depth,
	      fen: fenBefore,
	      fenAfter,
	      phase,
	      planTags,
	      mateThreat,
	      endgameNotes,
	      isCriticalMoment: expectedLoss >= 0.08 || cpLoss >= 120 || classificationKey === 'MISS' || classificationKey === 'BLUNDER',
	      severityScore: (expectedLoss * 2.2) + (cpLoss / 150) + (classificationKey === 'BLUNDER' ? 1.2 : classificationKey === 'MISTAKE' ? 0.9 : 0.2),
	      opponentJustBlundered,
	      isCoachMove,
	      coachText: this.analyzer._coachingText({
	        classification,
	        cpLoss,
	        expectedLoss,
	        bestMoveSan,
        bestMove: bestMove,
        opponentBestMove,
        opponentBestMoveSan,
        moveUci: playedUci,
        moveSan: moveObj.san,
        movePly,
        scoreBefore,
	        scoreAfter,
	        isWhite: isWhitePlaying,
	        playerRating,
	        opponentJustBlundered,
	        fenBefore,
        fenAfter,
      }),
    };

    this.liveMoveResults[moveIndex] = result;
    return result;
  }

  async _requestLiveEvaluation(message = 'Analyzing current position...', context = null) {
    if (!this.engine?.ready) {
      if (context?.isCoachMove) return;
      this.board.clearBestMoveArrow();
      this.board.clearLoading();
      this._updateLiveEvalPanel({
        busy: false,
        score: null,
        line: 'Engine is not ready yet.',
        meta: 'Live eval becomes available once the engine finishes loading.',
      });
      return;
    }

    const token = ++this.liveEvalToken;
    this.engine.interrupt?.();
	    const fen = this.chess.fen();
	    this.lastLiveEvalFen = fen;
	    const reviewProfile = this._getReviewProfile();
	    const depth = reviewProfile.depth;

    if (!context?.isCoachMove) {
      this._updateLiveEvalPanel({
        busy: true,
        score: null,
        line: message,
        meta: `Depth ${depth} | waiting for Stockfish...`,
      });
      this.board.setLoading(context?.moveObj?.to || null, context?.moveObj ? 'Analyzing move' : 'Analyzing');
    }

    try {
      if (context?.fenBefore && context?.moveObj) {
        const prevFen = context.fenBefore;
        const nextFen = context.fenAfter || fen;
        const prevChess = new Chess(prevFen);
        const nextChess = new Chess(nextFen);
        const isWhiteToMoveBefore = prevFen.split(' ')[1] === 'w';
        const multi = await this.engine.evaluateMultiPV(prevFen, depth, reviewProfile.multiPv);
        if (token !== this.liveEvalToken) return;

        const lines = (multi.lines || [])
          .map((line) => {
            const pvTokens = (line.pv || '').split(/\s+/).filter(Boolean);
            const move = pvTokens.length > 0 ? pvTokens[0] : '';
            return {
              cp: this.analyzer.normalizeScore(line.score || 0, line.scoreType || 'cp', isWhiteToMoveBefore),
              move,
              pvUci: line.pv || '',
              pvSan: this.analyzer._lineToSan(prevFen, line.pv || '', 8),
              depth: line.depth || 0,
            };
          })
          .filter((line) => !!line.move);

        const orderedLines = this.analyzer._orderLinesForSide(lines, isWhiteToMoveBefore);
        const best = orderedLines[0] || { cp: 0, move: '' };
        const bestMove = best.move || '';
        const bestMoveSan = bestMove ? this.analyzer.uciToSan(prevFen, bestMove) : '--';
        const bestScore = best.cp || 0;
        const nextEval = await this.engine.evaluate(nextFen, depth, Math.max(6000, reviewProfile.timeoutMs));
        if (token !== this.liveEvalToken) return;
        const scoreAfter = this.analyzer.normalizeScore(nextEval.score || 0, nextEval.scoreType || 'cp', nextFen.split(' ')[1] === 'w');
        const opponentBestMove = nextEval.bestMove || '';
	        const liveResult = this._buildLiveMoveResult({
	          fenBefore: prevFen,
	          fenAfter: nextFen,
	          moveObj: context.moveObj,
	          moveIndex: context.moveIndex ?? this.currentMoveIndex,
          scoreBefore: bestScore,
          scoreAfter,
          lines: orderedLines,
          bestMove,
          bestMoveSan,
	          opponentBestMove,
	          opponentBestMoveSan: opponentBestMove ? this.analyzer.uciToSan(nextFen, opponentBestMove) : '',
	          depth: nextEval.depth || depth,
	          isCoachMove: !!context.isCoachMove,
	        });
	
		        if (!liveResult.isCoachMove) {
		          this._applyBestMoveArrow(liveResult);
		          this.board.setHighlights(this._moveHighlightsForResult(liveResult));
		          this._showMoveBadge(liveResult.classification, context.moveObj.to);
		          this._renderMoveInsights(liveResult);
		          this._showEngineLine(liveResult);
	        }
	        this._updateEvalBar(scoreAfter);
        this.liveEvalHistory.push(scoreAfter);
        if (this.liveEvalHistory.length > 60) this.liveEvalHistory.shift();
        this._drawEvalGraph();
        if (!liveResult.isCoachMove) {
          this._updateLiveEvalPanel({
            busy: false,
            score: scoreAfter,
            line: `${liveResult.classification.name}: ${context.moveObj.san}`,
            meta: `Best: ${bestMoveSan || '--'} | Depth ${nextEval.depth || depth}`,
          });
          this.board.clearLoading();
        }
        this._renderMoveList();
        this._updateActiveMoveInList();
        this._updateGameStatus();
        return liveResult;
      }

      const result = await this.engine.evaluate(fen, depth, Math.max(6000, reviewProfile.timeoutMs));
      if (token !== this.liveEvalToken) return;

      const isWhiteToMove = fen.split(' ')[1] === 'w';
      const cp = this.analyzer.normalizeScore(result.score || 0, result.scoreType || 'cp', isWhiteToMove);
      const bestMoveSan = result.bestMove ? this.analyzer.uciToSan(fen, result.bestMove) : '--';

      this.board.clearBestMoveArrow();
      this.liveEvalHistory.push(cp);
      if (this.liveEvalHistory.length > 60) {
        this.liveEvalHistory.shift();
      }

      this._updateEvalBar(cp);
      this._drawEvalGraph();
      this._updateLiveEvalPanel({
        busy: false,
        score: cp,
        line: bestMoveSan && bestMoveSan !== '--'
          ? `Best move: ${bestMoveSan}`
          : 'Best move unavailable.',
        meta: result.depth ? `Depth ${result.depth}` : `Depth ${depth}`,
      });
      this.board.clearLoading();
      this._updateGameStatus();
      return result;
	    } catch (err) {
	      if (token !== this.liveEvalToken) return;
	      if (context?.isCoachMove) {
	        await this._recoverLiveEngineFailure(err, { silent: true });
	        return;
	      }
	      if (await this._recoverLiveEngineFailure(err)) {
	        return;
	      }
	      this.board.clearBestMoveArrow();
	      this.board.clearLoading();
      this._updateLiveEvalPanel({
        busy: false,
        score: null,
        line: 'Live eval failed for this position.',
        meta: err.message,
      });
    }
  }

  _resetGame() {
	    this.liveEvalToken += 1;
		    this.analysisResults = null;
		    this.explorerReturnState = null;
		    if (this.elReviewBtnText) this.elReviewBtnText.textContent = 'Start Review';
    this.liveMoveResults = [];
	    this.currentMoveIndex = -1;
	    this._resetCoachHint();
    this.gameMoves = this.originalGameMoves.slice();
    this.chess = new Chess(this.initialFen);
    this.board.setChessInstance(this.chess);
    this.board.selectedSquare = null;
    this.board.legalMoves = [];
    this.board.setHighlights([]);
    this.board.clearBestMoveArrow();

	    this.elReviewSummary.style.display = 'none';
	    this.elMoveBadge.style.display = 'none';
	    this.elCriticalMoments.style.display = 'none';
	    this.elCriticalList.innerHTML = '';
	    this._clearReviewExtras();
    this._resetInsightPanel();
    this._renderMoveList();
	    this._updateBoard();
	    this._updateCurrentMoveIndicator();
    this._syncPlayerNameplates();
    this._updateEvalBar(0);
    this.liveEvalHistory = [];
    this._drawEvalGraph();
    this._showOpeningInfo(this.analyzer.detectOpening(this.gameMoves));
    this._updateLiveEvalPanel({
      busy: false,
      score: null,
      line: 'Board reset to the original position.',
      meta: '',
    });
    this._updateGameStatus();
    this._renderIdleEngineInfo();
    this._syncActionButtons();
    this._requestLiveEvaluation('Analyzing original position...');
    this._playNamedSound('start');
  }

  _loadGame(moves, headers = {}) {
    const loadingCoachGame = headers.Event === 'Coach';
    if (!loadingCoachGame && this.coachMode.active) {
      this.coachMode.active = false;
      this.coachMode.thinking = false;
      this._setCoachDialog('Coach paused while this game is loaded.', 'Paused');
    }
    this._syncCoachVisibility();

	    this.originalGameMoves = moves.slice();
		    this.gameMoves = moves.slice();
		    this.currentMoveIndex = -1;
		    this.explorerReturnState = null;
	    this._resetCoachHint();
	    this.analysisResults = null;
	    if (this.elReviewBtnText) this.elReviewBtnText.textContent = 'Start Review';
    this.liveMoveResults = [];
    this.initialFen = headers.FEN || headers.Fen || headers.fen || new Chess().fen();
    this.chess = new Chess(this.initialFen);
    this.board.setChessInstance(this.chess);
    this.board.selectedSquare = null;
    this.board.legalMoves = [];
    this.board.clearBestMoveArrow();
	    this.gameHeaders = headers;
	    this.liveEvalHistory = [];
	    this.liveEvalToken += 1;
	
	    const playerColor = this._playerColorFromHeaders(headers);
	    if (playerColor) this._setBoardOrientationForColor(playerColor);
	    this._syncPlayerNameplates();

    this._syncActionButtons();

    this.elReviewSummary.style.display = 'none';
    this.elMoveBadge.style.display = 'none';
    this.elCriticalMoments.style.display = 'none';
    this.elCriticalList.innerHTML = '';
    this._renderIdleEngineInfo();
    this._resetInsightPanel();
    this._updateGameStatus();
    this._updateLiveEvalPanel({
      busy: false,
      score: null,
      line: 'Select a move or play from the board to begin live analysis.',
      meta: '',
    });

    const opening = this.analyzer.detectOpening(this.gameMoves);
    this._showOpeningInfo(opening);

	    this._updateBoard();
	    this._updateCurrentMoveIndicator();
    this._renderMoveList();
    this._updateEvalBar(0);
    this._drawEvalGraph();
    this._requestLiveEvaluation('Analyzing original position...');
    this._playNamedSound('start');
    this._syncCoachControls();
  }

  _goToMove(index) {
    if (index < -1) index = -1;
    if (index >= this.gameMoves.length) index = this.gameMoves.length - 1;
    if (index === this.currentMoveIndex) return;

    this.currentMoveIndex = index;
    this.chess = new Chess(this.initialFen);

    let lastMoveFrom = null;
    let lastMoveTo = null;
    let lastMoveObj = null;
    let lastFenBefore = null;

    for (let i = 0; i <= index; i++) {
      lastFenBefore = this.chess.fen();
      const move = this.chess.move(this.gameMoves[i], { sloppy: true });
      if (move) {
        lastMoveFrom = move.from;
        lastMoveTo = move.to;
        lastMoveObj = move;
      }
    }

    this.board.setChessInstance(this.chess);
    this._updateBoard();

	    const result = this.analysisResults?.[index] || this.liveMoveResults?.[index];
	    const feedbackResult = result?.isCoachMove
	      ? (this.analysisResults?.[index - 1] || this.liveMoveResults?.[index - 1])
	      : result;
	    const highlights = feedbackResult && index >= 0 && !feedbackResult.isCoachMove
	      ? this._moveHighlightsForResult(feedbackResult)
	      : [];
	    if (highlights.length === 0 && lastMoveFrom && lastMoveTo) {
	      highlights.push({ square: lastMoveFrom, type: 'highlight' });
	      highlights.push({ square: lastMoveTo, type: 'highlight' });
	    }
		    if (result && index >= 0 && !result.isCoachMove) {
		      if (result.bestMove && result.bestMove !== result.moveUci) {
		        highlights.push({ square: result.bestMove.substring(0, 2), type: 'best-from' });
	        highlights.push({ square: result.bestMove.substring(2, 4), type: 'best-to' });
	      }
    }

    this.board.setHighlights(highlights);

	    if (result && index >= 0) {
	      this._updateEvalBar(result.evalAfter);
	      this._drawEvalGraph();
	      if (!result.isCoachMove) {
	        this._applyBestMoveArrow(result, { allowOnQuiet: false });
	        this._showMoveBadge(result.classification, result.moveUci ? result.moveUci.substring(2, 4) : null);
	        this._renderMoveInsights(result);
	      }
	      this._showEngineLine(result);
	      this._playMoveSound(lastMoveObj, index);
    } else if (this.analysisResults && index === -1) {
      this._updateEvalBar(this.analysisResults.length > 0 ? this.analysisResults[0].evalBefore : 0);
      this._drawEvalGraph();
      this.elMoveBadge.style.display = 'none';
      this._renderIdleEngineInfo();
      this._resetInsightPanel();
      this.board.clearBestMoveArrow();
    } else {
      this.elMoveBadge.style.display = 'none';
      this._renderIdleEngineInfo();
      this._resetInsightPanel();
      this.board.clearBestMoveArrow();
      if (index >= 0) {
        this._playMoveSound(lastMoveObj, index);
      } else {
        this._updateLiveEvalPanel({
          busy: false,
          score: null,
          line: 'Original position loaded. Make a move to start live analysis.',
          meta: '',
        });
      }
      this._requestLiveEvaluation(
        index >= 0 ? `Analyzing move ${index + 1}` : 'Analyzing original position...',
        index >= 0 && lastMoveObj ? {
          fenBefore: lastFenBefore,
          fenAfter: this.chess.fen(),
          moveObj: lastMoveObj,
          moveIndex: index,
        } : null
      );
    }

	    this._updateGameStatus();
	    this._updateActiveMoveInList();
	    this._updateCurrentMoveIndicator();
	  }

  _drawEvalGraph() {
    const ctx = this.evalGraphCtx;
    const w = this.elEvalGraph.width;
    const h = this.elEvalGraph.height;
    ctx.clearRect(0, 0, w, h);

    const series = (this.analysisResults && this.analysisResults.length > 0)
      ? this.analysisResults.map((entry) => entry.evalAfter)
      : this.liveEvalHistory;

    if (!series || series.length === 0) return;

    let min = 9999;
    let max = -9999;
    for (const score of series) {
      min = Math.min(min, score);
      max = Math.max(max, score);
    }

    min = Math.max(min, -1000);
    max = Math.min(max, 1000);
    if (min === max) {
      min -= 1;
      max += 1;
    }

    ctx.strokeStyle = '#d1cabd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2;
    ctx.beginPath();

    if (series.length === 1) {
      const y = h - ((series[0] - min) / (max - min)) * h;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    } else {
      for (let i = 0; i < series.length; i++) {
        const y = h - ((series[i] - min) / (max - min)) * h;
        const x = (i / (series.length - 1)) * w;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    if (this.analysisResults && this.currentMoveIndex >= 0 && this.currentMoveIndex < this.analysisResults.length) {
      const x = this.analysisResults.length === 1
        ? w
        : (this.currentMoveIndex / (this.analysisResults.length - 1)) * w;
      ctx.strokeStyle = '#7a746a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    } else if (!this.analysisResults && this.liveEvalHistory.length > 0) {
      const x = this.liveEvalHistory.length === 1 ? w : w;
      ctx.strokeStyle = '#7a746a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  _playNamedSound(name) {
    const file = this.soundFiles[name];
    if (!file) return;
    const cached = this.soundPool[name];
    const audio = cached ? cached.cloneNode(true) : new Audio(file);
    audio.play().catch(() => {});
  }

  _playMoveSound(moveObj, index) {
    if (!moveObj) return;
    const flags = moveObj.flags || '';
    const isCastle = flags.includes('k') || flags.includes('q');
    const isCapture = flags.includes('c') || flags.includes('e');
    const isPromotion = !!moveObj.promotion;
    const isGameEnd = this.chess.game_over() && index === this.gameMoves.length - 1;
    const isCheckmate = this.chess.in_checkmate() && isGameEnd;
    const isCheck = /[+#]/.test(moveObj.san || '') || this.chess.in_check();

    if (isCheckmate) {
      this._playNamedSound('check');
      setTimeout(() => this._playNamedSound('end'), 140);
      return;
    }

    if (isGameEnd) {
      this._playNamedSound('end');
      return;
    }
    if (isCheck) {
      this._playNamedSound('check');
      return;
    }
    if (isPromotion) {
      this._playNamedSound('promote');
      return;
    }
    if (isCastle) {
      this._playNamedSound('castle');
      return;
    }
    if (isCapture) {
      this._playNamedSound('capture');
      return;
    }
    this._playNamedSound('move');
  }

  _updateBoard() {
    this.board.setPositionFromFen(this.chess.fen());
  }

	  _updateEvalBar(cpScore) {
	    this.currentEvalScore = typeof cpScore === 'number' ? cpScore : 0;
	    const whitePct = this.analyzer.evalBarPercent(cpScore);
	    const blackPct = 100 - whitePct;
	    const flipped = !!this.board?.flipped;
	    this.elEvalBarWhite.style.order = flipped ? '0' : '1';
	    this.elEvalBarBlack.style.order = flipped ? '1' : '0';
	    this.elEvalBarWhite.style.height = whitePct + '%';
	    this.elEvalBarWhite.style.width = '100%';
	    this.elEvalBarBlack.style.height = blackPct + '%';
	    this.elEvalBarBlack.style.width = '100%';
	    this.elEvalScore.textContent = this.analyzer.formatScore(cpScore);
	  }

  _showMoveBadge(classification, targetSquare, options = {}) {
    if (!classification) {
      this.elMoveBadge.style.display = 'none';
      return;
    }

    if (targetSquare) {
      const sqEl = this.board.container.querySelector(`[data-square="${targetSquare}"]`);
      if (sqEl) {
        const boardRect = this.board.container.parentElement.getBoundingClientRect();
        const sqRect = sqEl.getBoundingClientRect();
        const inset = Math.max(9, sqRect.width * 0.18);
        const left = sqRect.right - boardRect.left - inset;
        const top = sqRect.top - boardRect.top + inset;
        this.elMoveBadge.style.left = left + 'px';
        this.elMoveBadge.style.top = top + 'px';
        this.elMoveBadge.style.right = 'auto';
        this.elMoveBadge.style.transform = 'translate(-50%, -50%)';
      }
    }

	    this.elMoveBadge.style.display = 'flex';
	    const badgeRgb = this._hexToRgb(classification.color);
	    this.elMoveBadge.style.setProperty('--badge-color', classification.color);
	    if (badgeRgb) {
	      this.elMoveBadge.style.setProperty('--badge-rgb', `${badgeRgb.r}, ${badgeRgb.g}, ${badgeRgb.b}`);
	    }
	    this.elMoveBadge.style.background = classification.color;
	    this.elMoveBadge.style.color = '#fff';
    this.elMoveBadge.title = classification.name;
    this.elMoveBadge.setAttribute('aria-label', classification.name);
    this.elBadgeIcon.className = this._classificationIconClass(classification, 'badge-icon');
    this.elBadgeIcon.textContent = classification.icon;
    this.elBadgeText.textContent = '';

	    const key = this.analyzer.getClassificationKey(classification);
	    const hasImpactBadge = ['BRILLIANT', 'GREAT', 'BLUNDER'].includes(key);
	    this.elMoveBadge.classList.toggle('badge-impact', hasImpactBadge);
	    this.elMoveBadge.style.animation = 'none';
	    void this.elMoveBadge.offsetHeight;
	    this.elMoveBadge.style.animation = '';
	
		    if (!options.suppressFlash) {
		      this._flashBoard(classification);
		    }
		  }

	  _refreshMoveBadgePosition() {
	    const result = this.analysisResults?.[this.currentMoveIndex] || this.liveMoveResults?.[this.currentMoveIndex];
	    if (!result || result.isCoachMove || this.currentMoveIndex < 0) return;
    this._showMoveBadge(result.classification, result.moveUci ? result.moveUci.substring(2, 4) : null, { suppressFlash: true });
  }

  _applyBestMoveArrow(result, { allowOnQuiet = false } = {}) {
	    if (!result || result.isCoachMove || !result.bestMove) {
      this.board.clearBestMoveArrow();
      return;
    }

    const classificationKey = result.classificationKey || this.analyzer.getClassificationKey(result.classification);
    if (classificationKey === 'BEST' || classificationKey === 'GREAT' || classificationKey === 'BRILLIANT') {
      this.board.clearBestMoveArrow();
      return;
    }

    if (!allowOnQuiet && !result.classification) {
      this.board.clearBestMoveArrow();
      return;
    }

    this.board.setBestMoveArrow(result.bestMove);
  }

  _flashBoard(classification) {
    const existing = this.board.container.parentElement.querySelector('.board-flash');
    if (existing) existing.remove();

    let flashClass = null;
	    if (classification === MoveClassification.MISS) flashClass = 'flash-blunder';
    if (!flashClass) return;

    const flash = document.createElement('div');
    flash.className = `board-flash ${flashClass}`;
    this.board.container.parentElement.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
  }

	  _showEngineLine(result) {
	    if (!result) {
	      this._renderIdleEngineInfo();
	      return;
	    }

	    if (result.isCoachMove) {
	      this.elEngineLine.textContent = `Coach move: ${result.moveSan || result.move}`;
	      return;
	    }

    if (!result.alternatives || result.alternatives.length === 0) {
      if (result.bestMove !== result.moveUci) {
        this.elEngineLine.textContent = `Best: ${result.bestMoveSan} (${this.analyzer.formatScore(result.evalBefore)})`;
      } else {
        this.elEngineLine.textContent = 'Best move played.';
      }
      return;
    }

    const top = result.alternatives
      .slice(0, 3)
      .map((alt) => `${alt.rank}) ${alt.moveSan} ${alt.evalText}`)
      .join(' | ');

    if (result.bestMove !== result.moveUci) {
      this.elEngineLine.textContent = `Best: ${result.bestMoveSan}. Top lines: ${top}`;
    } else {
      this.elEngineLine.textContent = `Best move played. Top lines: ${top}`;
    }
  }

  _renderMoveList() {
    this.elMoveList.innerHTML = '';

    if (this.gameMoves.length === 0) {
      this.elMoveList.innerHTML = '<div class="move-list-empty">Import a PGN or load a sample game to begin.</div>';
      return;
    }

    for (let i = 0; i < this.gameMoves.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const row = document.createElement('div');
      row.className = 'move-row';

      const numEl = document.createElement('span');
      numEl.className = 'move-number';
      numEl.textContent = moveNum + '.';
      row.appendChild(numEl);

      row.appendChild(this._createMoveCell(i, this.gameMoves[i]));

      if (i + 1 < this.gameMoves.length) {
        row.appendChild(this._createMoveCell(i + 1, this.gameMoves[i + 1]));
      } else {
        row.appendChild(document.createElement('div'));
      }

      this.elMoveList.appendChild(row);
    }
  }

  _createMoveCell(index, moveSan) {
    const cell = document.createElement('div');
    cell.className = 'move-cell';
    cell.dataset.moveIndex = index;

    const result = this.analysisResults?.[index] || this.liveMoveResults?.[index];

		    const shownMoveBadges = new Set(['BRILLIANT', 'GREAT', 'MISS', 'MISTAKE', 'INACCURACY', 'BLUNDER']);
		    const classificationKey = result?.classificationKey || this.analyzer.getClassificationKey(result?.classification);
		    if (result && !result.isCoachMove && shownMoveBadges.has(classificationKey)) {
		      const cls = result.classification;
		      const icon = document.createElement('span');
      icon.className = this._classificationIconClass(cls, 'move-icon');
      icon.style.background = cls.color;
      icon.textContent = cls.icon;
      cell.appendChild(icon);
      cell.title = `${cls.name} | CP loss: ${Math.round(result.cpLoss || 0)}`;
    }

    const text = document.createElement('span');
    text.textContent = moveSan;
    cell.appendChild(text);

	    if (result && !result.isCoachMove) {
	      const evalEl = document.createElement('span');
      evalEl.className = 'move-eval';
      evalEl.textContent = this.analyzer.formatScore(result.evalAfter);
      cell.appendChild(evalEl);
    }

    cell.addEventListener('click', () => this._goToMove(index));

    if (index === this.currentMoveIndex) cell.classList.add('active');
    return cell;
  }

	  _updateActiveMoveInList() {
	    const cells = this.elMoveList.querySelectorAll('.move-cell');
    cells.forEach((cell) => {
      cell.classList.toggle('active', parseInt(cell.dataset.moveIndex, 10) === this.currentMoveIndex);
    });

    const active = this.elMoveList.querySelector('.move-cell.active');
    if (!active) return;

    const container = this.elMoveList;
    const activeTop = active.offsetTop;
    const activeHeight = active.offsetHeight;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    if (activeTop < scrollTop) {
      container.scrollTop = activeTop;
    } else if (activeTop + activeHeight > scrollTop + containerHeight) {
	      container.scrollTop = activeTop + activeHeight - containerHeight;
	    }
	  }

		  _previewReviewPosition(index) {
		    let target = index;
		    if (target < -1) target = -1;
		    if (target >= this.gameMoves.length) target = this.gameMoves.length - 1;

	    this.currentMoveIndex = target;
	    this.chess = new Chess(this.initialFen);

	    let lastMoveFrom = null;
	    let lastMoveTo = null;
	    for (let i = 0; i <= target; i += 1) {
	      const move = this.chess.move(this.gameMoves[i], { sloppy: true });
	      if (move) {
	        lastMoveFrom = move.from;
	        lastMoveTo = move.to;
	      }
	    }

	    this.board.setChessInstance(this.chess);
	    this._updateBoard();
	    this.board.setHighlights(lastMoveFrom && lastMoveTo
	      ? [{ square: lastMoveFrom, type: 'highlight' }, { square: lastMoveTo, type: 'highlight' }]
	      : []);
	    this.board.clearBestMoveArrow();
	    this.elMoveBadge.style.display = 'none';
		    this._updateActiveMoveInList();
		    this._updateCurrentMoveIndicator();
		  }

		  _startReviewPlayback(options = {}) {
		    this._stopReviewPlayback();
		    if (!this.gameMoves.length) return;

		    const start = clamp(options.start ?? 0, 0, this.gameMoves.length - 1);
		    const end = clamp(options.end ?? this.gameMoves.length - 1, start, this.gameMoves.length - 1);
		    const minDelay = options.minDelay ?? 170;
		    const maxDelay = options.maxDelay ?? 760;
		    const loop = options.loop !== false;
		    const current = Number.isInteger(this.currentMoveIndex) ? this.currentMoveIndex : start;
		    let index = clamp(options.initialIndex ?? (current >= start && current <= end ? current : start), start, end);
		    let direction = 1;

		    const tick = () => {
		      if (!this.isAnalyzing) {
		        this._stopReviewPlayback();
		        return;
		      }

		      this._previewReviewPosition(index);
		      const span = Math.max(1, end - start);
		      const progress = span === 1 ? 1 : (index - start) / span;
		      const ease = Math.sin(Math.PI * progress);
		      const delay = Math.round(maxDelay - ((maxDelay - minDelay) * ease));

		      if (start === end) {
		        index = start;
		      } else if (!loop) {
		        index = Math.min(end, index + 1);
		        if (index >= end) {
		          this.reviewPlaybackTimer = setTimeout(tick, maxDelay);
		          return;
		        }
		      } else {
		        index += direction;
		        if (index >= end) {
		          index = end;
		          direction = -1;
		        } else if (index <= start) {
		          index = start;
		          direction = 1;
		        }
		      }

		      this.reviewPlaybackTimer = setTimeout(tick, delay);
		    };

		    tick();
		  }

		  _stopReviewPlayback() {
		    if (!this.reviewPlaybackTimer) return;
		    clearTimeout(this.reviewPlaybackTimer);
		    this.reviewPlaybackTimer = null;
		  }

		  _sprintReviewPlaybackTo(targetIndex, options = {}) {
		    this._stopReviewPlayback();
		    if (!this.gameMoves.length || !this.isAnalyzing) return Promise.resolve();

		    const target = clamp(targetIndex, 0, this.gameMoves.length - 1);
		    const start = clamp(this.currentMoveIndex < 0 ? 0 : this.currentMoveIndex, 0, this.gameMoves.length - 1);
		    if (start === target) {
		      this._previewReviewPosition(target);
		      return Promise.resolve();
		    }

		    const direction = target > start ? 1 : -1;
		    const distance = Math.abs(target - start);
		    const minDelay = options.minDelay ?? 28;
		    const maxDelay = options.maxDelay ?? 150;
		    let step = 0;
		    let index = start;

		    return new Promise((resolve) => {
		      const tick = () => {
		        if (!this.isAnalyzing) {
		          this.reviewPlaybackTimer = null;
		          resolve();
		          return;
		        }

		        index += direction;
		        step += 1;
		        this._previewReviewPosition(index);

		        if (index === target) {
		          this.reviewPlaybackTimer = setTimeout(() => {
		            this.reviewPlaybackTimer = null;
		            resolve();
		          }, maxDelay);
		          return;
		        }

		        const progress = step / Math.max(1, distance);
		        const easeToMiddle = Math.sin(Math.PI * progress);
		        const delay = Math.round(maxDelay - ((maxDelay - minDelay) * easeToMiddle));
		        this.reviewPlaybackTimer = setTimeout(tick, delay);
		      };

		      this.reviewPlaybackTimer = setTimeout(tick, minDelay);
		    });
		  }
		
		  async _startReview() {
    const serverReview = this.engineSettings.analysisLocation === 'netlify';
    if (this.isAnalyzing || this.gameMoves.length === 0 || (!serverReview && !this.engine?.ready)) return;

    this.isAnalyzing = true;
    this.liveEvalToken += 1;
    this._syncActionButtons();
    this._setEngineControlsDisabled(true);
	    this.analyzer.setReviewProfile(this._getReviewProfile());
	    this.elReviewBtnText.textContent = 'Analyzing...';
	    this.elProgressBar.style.display = 'block';
	    this.elProgressFill.style.width = '0%';
	    this.board.setLoading(null, 'Reviewing game');
	    const updateReviewProgress = (current, total, message) => {
	      const pct = Math.round((current / Math.max(1, total - 1)) * 100);
	      this.elProgressFill.style.width = clamp(pct, 0, 100) + '%';
	      this.elReviewBtnText.textContent = message;
	      this._previewReviewPosition(current - 1);
	      this._updateLiveEvalPanel({
	        busy: true,
	        score: null,
	        line: message,
	        meta: `Reviewing ${this._currentMoveLabel(current - 1)}`,
	      });
	    };
	
		    try {
		      if (serverReview) {
		        try {
		          this.analysisResults = await this._analyzeGameOnServer();
			        } catch (serverErr) {
			          console.warn('Server analysis failed:', serverErr);
			          throw serverErr;
	        }
			      } else {
			        this.analysisResults = await this.analyzer.analyzeGame(
			          this.gameMoves,
		          this.engine,
		          updateReviewProgress,
			          { initialFen: this.initialFen, headers: this.gameHeaders }
			        );
	      }

		      this._showOpeningInfo(this.analysisResults.opening || this.analyzer.detectOpening(this.gameMoves));
	      this._showReviewSummary();
	      this._renderMoveList();
	      this._renderCriticalMoments();
	      this._renderPostReviewEvalPanel();
	      this._goToMove(0);
	    } catch (err) {
	      console.error('Analysis error:', err);
	      this._showPopup({
	        icon: 'error',
	        title: 'Analysis failed',
	        text: err.message,
	      });
		    } finally {
		      this.isAnalyzing = false;
		      this._stopReviewPlayback();
		      this._setEngineControlsDisabled(false);
		      this._syncActionButtons();
		      this.elReviewBtnText.textContent = this.analysisResults ? 'Re-analyze Game' : 'Start Review';
	      this.elProgressBar.style.display = 'none';
	      this.board.clearLoading();
	    }
  }

		  async _analyzeGameOnServer() {
			    const reviewProfile = this._getReviewProfile();
			    const positions = this.analyzer._positionsForMoves(this.gameMoves, this.initialFen);
				    if (positions.length > 4) {
			      return this._analyzeGameOnServerChunks(positions, reviewProfile);
			    }
		    this.elReviewBtnText.textContent = 'Sending to Server...';
	    this.elProgressFill.style.width = '12%';
	    const controller = new AbortController();
		    const timeout = setTimeout(() => controller.abort(), 45000);
	    let progress = 12;
		    const progressTimer = setInterval(() => {
		      progress = Math.min(progress + 3, 68);
		      this.elProgressFill.style.width = `${progress}%`;
		      this.elReviewBtnText.textContent = 'Server Reviewing...';
		      this._updateLiveEvalPanel({
		        busy: true,
		        score: null,
		        line: 'Server review is running.',
			        meta: 'Keeping the review on the server.',
			      });
		    }, 1200);
		    this._startReviewPlayback({
		      start: 0,
		      end: Math.max(0, this.gameMoves.length - 1),
		      minDelay: 160,
		      maxDelay: 820,
		    });
	
		    let data = null;
		    try {
		      for (let attempt = 0; attempt < 4; attempt += 1) {
		        let response;
		        try {
		          response = await fetch('/.netlify/functions/analyze', {
		            method: 'POST',
		            headers: { 'Content-Type': 'application/json' },
		            signal: controller.signal,
		            cache: 'no-store',
		            body: JSON.stringify({
		              moves: this.gameMoves,
		              headers: this.gameHeaders || {},
		              initialFen: this.initialFen,
			              profile: {
			                key: reviewProfile.key,
				              depth: 14,
			                multiPv: Math.min(reviewProfile.multiPv, 2),
			                timeoutMs: 6000,
			              },
			            }),
			          });
		        } catch (err) {
		          if (err.name === 'AbortError') {
		            throw new Error('Server review timed out.');
		          }
		          throw err;
		        }

		        const text = await response.text().catch(() => '');
		        try {
		          data = text ? JSON.parse(text) : null;
		        } catch (_err) {
		          data = null;
		        }

		        if (response.ok && Array.isArray(data?.results)) break;

		        const retryable = response.status >= 500 || response.status === 429 || data?.retryable;
		        const message = data?.error || text || `Server analysis failed with ${response.status}`;
		        if (!retryable || attempt === 3) throw new Error(message);

		        const waitMs = 500 + (attempt * attempt * 450);
		        this.elReviewBtnText.textContent = `Server retry ${attempt + 1}/3`;
		        this._updateLiveEvalPanel({
		          busy: true,
		          score: null,
		          line: 'Server review is retrying.',
		          meta: message,
		        });
		        await new Promise((resolve) => setTimeout(resolve, waitMs));
		      }
		    } finally {
		      clearInterval(progressTimer);
		      clearTimeout(timeout);
		    }

		    this.elProgressFill.style.width = '78%';
			    if (!Array.isArray(data?.results)) {
			      throw new Error(data?.error || 'Server analysis returned no results.');
			    }

    this.elProgressFill.style.width = '100%';
    const results = data.results.map((entry) => ({
      ...entry,
      classification: MoveClassification[entry.classificationKey] || MoveClassification.GOOD,
    }));
	    results.opening = data.opening || this.analyzer.detectOpening(this.gameMoves);
	    results.openingDrift = data.openingDrift || null;
	    results.trainingQueue = data.trainingQueue || [];
	    results.patternStats = data.patternStats || [];
	    results.reviewNarrative = data.reviewNarrative || [];
	    results.criticalMoments = (data.criticalMoments || []).map((entry) => ({
      ...entry,
      classification: MoveClassification[entry.classificationKey] || MoveClassification.GOOD,
    }));
    results.whiteAccuracy = data.whiteAccuracy;
    results.blackAccuracy = data.blackAccuracy;
    results.whiteAcpl = data.whiteAcpl;
    results.blackAcpl = data.blackAcpl;
    results.whiteCaps = data.whiteCaps;
	    results.blackCaps = data.blackCaps;
			    results.phaseSummary = data.phaseSummary;
			    if (data.publicStats) this._renderPublicStats(data.publicStats);
			    results.statsRecorded = Boolean(data.publicStats);
			    return results;
			  }

				  _isServerChunkResourceError(err) {
				    const message = String(err?.message || err || '');
				    return !!err?.retryable
				      || /413|429|500|502|503|504|busy|warming|retry|capped|timeout|timed out|outofmemory|out of memory|runtime\.outofmemory|signal:\s*killed|server review chunk/i.test(message);
				  }

				  async _fetchServerEvalChunk(positions, profile, chunkIndex, chunkCount, baseIndex = 0, statsReview = null) {
			    const controller = new AbortController();
				    const timeout = setTimeout(() => controller.abort(), 55000);
		    let response;
	    try {
	      response = await fetch('/.netlify/functions/analyze', {
	        method: 'POST',
	        headers: { 'Content-Type': 'application/json' },
	        signal: controller.signal,
		        body: JSON.stringify({
		          positions,
		          profile,
		          chunkStart: baseIndex,
		          statsReview,
		        }),
	      });
	    } catch (err) {
	      if (err.name === 'AbortError') {
	        throw new Error(`Server review chunk ${chunkIndex + 1}/${chunkCount} timed out.`);
	      }
	      throw err;
	    } finally {
	      clearTimeout(timeout);
	    }

	    const text = await response.text().catch(() => '');
	    let data = null;
		    try {
		      data = text ? JSON.parse(text) : null;
		    } catch (_err) {
		      data = null;
		    }
			    if (data?.retryable || data?.error) {
			      const error = new Error(data.error || `Server review chunk ${chunkIndex + 1}/${chunkCount} needs a retry.`);
				      error.status = response.status;
				      error.retryable = Boolean(data.retryable);
				      throw error;
				    }
				    if (!response.ok) {
				      const error = new Error(data?.error || text || `Server review chunk ${chunkIndex + 1}/${chunkCount} failed with ${response.status}.`);
			      error.status = response.status;
			      error.retryable = response.status >= 500 || response.status === 429;
			      throw error;
			    }
			    if (!Array.isArray(data?.evals)) {
			      throw new Error(`Server review chunk ${chunkIndex + 1}/${chunkCount} returned no evals.`);
			    }
			    if (data.publicStats) this._renderPublicStats(data.publicStats);
			    return data.evals;
			  }

					  async _fetchServerEvalChunkSafely(positions, profile, chunkIndex, chunkCount, baseIndex = 0, retryCount = 0, statsReview = null) {
					    try {
					      return await this._fetchServerEvalChunk(positions, profile, chunkIndex, chunkCount, baseIndex, statsReview);
					    } catch (err) {
					      const message = String(err?.message || err || '');
					      if (positions.length > 1 && /busy|warming|retrying shortly/i.test(message) && retryCount < 3) {
					        const waitMs = 500 + (retryCount * retryCount * 400);
					        this.elReviewBtnText.textContent = `Server retry ${retryCount + 1}/3`;
					        this._updateLiveEvalPanel({
					          busy: true,
					          score: null,
					          line: `Server worker is waiting for chunk ${chunkIndex + 1}/${chunkCount}.`,
					          meta: message,
					        });
					        await new Promise((resolve) => setTimeout(resolve, waitMs));
					        return this._fetchServerEvalChunkSafely(positions, profile, chunkIndex, chunkCount, baseIndex, retryCount + 1, statsReview);
					      }
					      if (positions.length <= 1 && this._isServerChunkResourceError(err) && retryCount < 4) {
				        const waitMs = 450 + (retryCount * retryCount * 350);
				        this.elReviewBtnText.textContent = `Server retry ${retryCount + 1}/4`;
				        this._updateLiveEvalPanel({
				          busy: true,
				          score: null,
				          line: `Server review is retrying chunk ${chunkIndex + 1}/${chunkCount}.`,
				          meta: err.message || `Waiting ${waitMs}ms before retrying.`,
				        });
				        await new Promise((resolve) => setTimeout(resolve, waitMs));
					        return this._fetchServerEvalChunkSafely(positions, profile, chunkIndex, chunkCount, baseIndex, retryCount + 1, statsReview);
				      }
					    if (positions.length <= 1 || !this._isServerChunkResourceError(err)) throw err;
				      const midpoint = Math.ceil(positions.length / 2);
		      this._updateLiveEvalPanel({
		        busy: true,
		        score: null,
		        line: `Server review chunk ${chunkIndex + 1}/${chunkCount} was too large. Splitting it...`,
		        meta: `Retrying positions ${baseIndex + 1}-${baseIndex + positions.length} in smaller pieces.`,
		      });
				      const lighterProfile = {
				        ...profile,
				        depth: 14,
				        multiPv: 1,
						        timeoutMs: 6000,
				      };
			      const first = await this._fetchServerEvalChunkSafely(
			        positions.slice(0, midpoint),
			        lighterProfile,
			        chunkIndex,
			        chunkCount,
			        baseIndex,
			        0,
			        statsReview
			      );
			      const second = await this._fetchServerEvalChunkSafely(
			        positions.slice(midpoint),
			        lighterProfile,
			        chunkIndex,
			        chunkCount,
			        baseIndex + midpoint,
			        0,
			        statsReview
			      );
		      return [...first, ...second];
		    }
		  }

			  async _analyzeGameOnServerChunks(positions, reviewProfile) {
			    const total = positions.length;
			    const chunkSize = total > 80 ? 6 : 8;
		    const chunks = [];
		    for (let i = 0; i < total; i += chunkSize) {
		      chunks.push({ start: i, positions: positions.slice(i, i + chunkSize) });
		    }

						    const serverProfile = {
						      key: reviewProfile.key,
						      depth: 14,
						      multiPv: 2,
							      timeoutMs: 6000,
						    };
						    const statsReview = {
						      reviewId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
						      moves: this.gameMoves.slice(),
						      headers: this.gameHeaders || {},
						      initialFen: this.initialFen,
						      totalPositions: total,
						    };

				    const evals = new Array(total);
				    let nextChunkIndex = 0;
				    let completedPositions = 0;
				    const concurrency = total > 80 ? 2 : 3;

				    const runChunk = async (workerIndex) => {
				      while (nextChunkIndex < chunks.length) {
				        const i = nextChunkIndex;
				        nextChunkIndex += 1;
				        const chunk = chunks[i];
				        const startMove = clamp(chunk.start, 0, Math.max(0, this.gameMoves.length - 1));
				        const endMove = clamp(chunk.start + chunk.positions.length - 1, startMove, Math.max(0, this.gameMoves.length - 1));
				        this.elReviewBtnText.textContent = `Server Reviewing ${completedPositions + 1}/${total}`;
				        this._updateLiveEvalPanel({
				          busy: true,
				          score: null,
				          line: `Server worker ${workerIndex + 1} analyzing chunk ${i + 1}/${chunks.length}`,
				          meta: `Moves ${startMove + 1}-${endMove + 1} | ${completedPositions}/${total} positions complete.`,
				        });
				        if (workerIndex === 0) {
				          this._startReviewPlayback({
				            start: startMove,
				            end: endMove,
				            initialIndex: i === 0 ? Math.max(0, this.currentMoveIndex) : startMove,
				            minDelay: total > 90 ? 80 : 110,
				            maxDelay: total > 90 ? 330 : 470,
				            loop: false,
				          });
				        }

				        const chunkEvals = await this._fetchServerEvalChunkSafely(
				          chunk.positions,
				          serverProfile,
				          i,
				          chunks.length,
				          chunk.start,
				          0,
				          statsReview
				        );
				        chunkEvals.forEach((entry, offset) => {
				          evals[chunk.start + offset] = entry;
				        });
				        completedPositions += chunkEvals.length;
				        const pct = 12 + Math.round((completedPositions / Math.max(1, total)) * 76);
				        this.elProgressFill.style.width = `${pct}%`;
				      }
				    };

				    await Promise.all(
				      Array.from({ length: Math.min(concurrency, chunks.length) }, (_entry, workerIndex) => runChunk(workerIndex))
				    );

		    if (evals.length !== positions.length || evals.some((entry) => !entry)) {
		      throw new Error('Server review returned an incomplete evaluation set.');
		    }

		    this.elProgressFill.style.width = '94%';
		    this.elReviewBtnText.textContent = 'Classifying moves...';
		    this._stopReviewPlayback();
		    if (this.gameMoves.length > 0) {
		      this._previewReviewPosition(this.gameMoves.length - 1);
		    }
		    const opening = this.analyzer.detectOpening(this.gameMoves);
	    const results = this.analyzer.resultsFromEvals(
	      this.gameMoves,
	      positions,
	      evals,
	      opening,
	      { initialFen: this.initialFen, headers: this.gameHeaders || {}, skipMateThreat: true }
	    );
	    this.elProgressFill.style.width = '100%';
	    return results;
	  }

	  _showOpeningInfo(opening) {
    if (!opening) {
      this.elOpeningInfo.style.display = 'none';
      this.elOpeningName.textContent = '';
      return;
    }

    this.elOpeningInfo.style.display = 'flex';
    this.elOpeningName.textContent = `${opening.name}${opening.eco ? ` (${opening.eco})` : ''}`;
  }

  _showReviewSummary() {
    if (!this.analysisResults) return;

    this.elReviewSummary.style.display = 'block';

    const headers = this.gameHeaders || {};
    const whiteName = headers.White || 'White';
    const blackName = headers.Black || 'Black';
    const whiteElo = headers.WhiteElo ? ` (${headers.WhiteElo})` : '';
    const blackElo = headers.BlackElo ? ` (${headers.BlackElo})` : '';

    const summaryWhiteH4 = this.elReviewSummary.querySelector('.summary-col:first-child h4');
    const summaryBlackH4 = this.elReviewSummary.querySelector('.summary-col:last-child h4');
    if (summaryWhiteH4) summaryWhiteH4.textContent = whiteName + whiteElo;
    if (summaryBlackH4) summaryBlackH4.textContent = blackName + blackElo;

    const whiteAcc = this.analysisResults.whiteAccuracy ?? this.analyzer.calculateAccuracy(this.analysisResults, 'white');
    const blackAcc = this.analysisResults.blackAccuracy ?? this.analyzer.calculateAccuracy(this.analysisResults, 'black');

    document.getElementById('accuracy-white-val').textContent = Math.round(whiteAcc);
    document.getElementById('accuracy-black-val').textContent = Math.round(blackAcc);

    const circumference = 2 * Math.PI * 45;
    document.getElementById('ring-white').style.strokeDashoffset = circumference * (1 - whiteAcc / 100);
    document.getElementById('ring-black').style.strokeDashoffset = circumference * (1 - blackAcc / 100);
    document.getElementById('ring-white').style.stroke = this._accuracyColor(whiteAcc);
    document.getElementById('ring-black').style.stroke = this._accuracyColor(blackAcc);

    const whiteCounts = this.analyzer.countClassifications(this.analysisResults, 'white');
    const blackCounts = this.analyzer.countClassifications(this.analysisResults, 'black');
    document.getElementById('summary-white').innerHTML = this._renderCounts(whiteCounts);
    document.getElementById('summary-black').innerHTML = this._renderCounts(blackCounts);

    this.elCapsWhite.textContent = Math.round(this.analysisResults.whiteCaps ?? this.analyzer.calculateCapsScore(this.analysisResults, 'white'));
    this.elCapsBlack.textContent = Math.round(this.analysisResults.blackCaps ?? this.analyzer.calculateCapsScore(this.analysisResults, 'black'));
    this.elAcplWhite.textContent = Math.round(this.analysisResults.whiteAcpl ?? this.analyzer.calculateAcpl(this.analysisResults, 'white'));
	    this.elAcplBlack.textContent = Math.round(this.analysisResults.blackAcpl ?? this.analyzer.calculateAcpl(this.analysisResults, 'black'));
	
	    this._renderReviewNarrative();
	    this._renderTrainingQueue();
	    this._renderOpeningDrift();
	    this._renderPatternStats();
	    this._renderPhaseBreakdown();
	  }

	  _renderReviewNarrative() {
	    if (!this.elReviewNarrative) return;
	    const lines = this.analysisResults?.reviewNarrative || [];
	    this.elReviewNarrative.innerHTML = lines.length
	      ? lines.map((line) => `<p>${line}</p>`).join('')
	      : '<p>Run review to see the main story of the game.</p>';
	  }

	  _renderTrainingQueue() {
	    if (!this.elTrainingList) return;
	    const items = this.analysisResults?.trainingQueue || [];
	    if (items.length === 0) {
	      this.elTrainingList.innerHTML = '<div class="empty-mini">No major retry positions found.</div>';
	      return;
	    }
	    this.elTrainingList.innerHTML = '';
	    items.slice(0, 6).forEach((item, index) => {
	      const button = document.createElement('button');
	      button.className = 'training-item';
	      button.type = 'button';
	      button.innerHTML = `
	        <span class="training-index">${index + 1}</span>
	        <span class="training-copy">
	          <strong>${item.prompt}</strong>
	          <small>Solution: ${item.solution || 'review best move'}</small>
	        </span>
	      `;
	      button.addEventListener('click', () => this._goToMove(item.moveIndex));
	      this.elTrainingList.appendChild(button);
	    });
	  }

	  _renderOpeningDrift() {
	    if (!this.elOpeningDrift) return;
	    const drift = this.analysisResults?.openingDrift;
	    if (!drift) {
	      this.elOpeningDrift.innerHTML = '<div class="empty-mini">No clear book drift detected.</div>';
	      return;
	    }
	    this.elOpeningDrift.innerHTML = `
	      <button class="drift-card" type="button">
	        <strong>${drift.moveLabel}</strong>
	        <span>${drift.text}</span>
	      </button>
	    `;
	    this.elOpeningDrift.querySelector('button')?.addEventListener('click', () => this._goToMove(drift.moveIndex));
	  }

	  _renderPatternStats() {
	    if (!this.elPatternList) return;
	    const patterns = this.analysisResults?.patternStats || [];
	    if (patterns.length === 0) {
	      this.elPatternList.innerHTML = '<div class="empty-mini">No recurring mistake pattern found.</div>';
	      return;
	    }
	    this.elPatternList.innerHTML = patterns.map((pattern) => `
	      <div class="pattern-item">
	        <span>${pattern.text}</span>
	        <strong>${pattern.count}x</strong>
	      </div>
	    `).join('');
	  }

  _renderPhaseBreakdown() {
    const phaseSummary = this.analysisResults?.phaseSummary;
    if (!phaseSummary) {
      this.elPhaseBreakdown.innerHTML = '';
      return;
    }

    const phases = ['Opening', 'Middlegame', 'Endgame'];
    const rows = phases.map((phase) => {
      const w = phaseSummary.white[phase] || { accuracy: 0, acpl: 0, moves: 0 };
      const b = phaseSummary.black[phase] || { accuracy: 0, acpl: 0, moves: 0 };
      return `<div class="phase-row">
        <span class="phase-name">${phase}</span>
        <span class="phase-cell">W ${w.accuracy}% / ${w.acpl} cp</span>
        <span class="phase-cell">B ${b.accuracy}% / ${b.acpl} cp</span>
      </div>`;
    }).join('');

    this.elPhaseBreakdown.innerHTML = `<div class="phase-title">Phase Accuracy / ACPL</div>${rows}`;
  }

  _accuracyColor(accuracy) {
    if (accuracy >= 90) return '#96BC4B';
    if (accuracy >= 70) return '#F7C631';
    if (accuracy >= 50) return '#E68A2E';
    return '#CA3431';
  }

  _renderCounts(counts) {
    const categories = [
      ['BRILLIANT', 'Brilliant'],
      ['GREAT', 'Great'],
      ['BEST', 'Best'],
      ['EXCELLENT', 'Excellent'],
      ['GOOD', 'Good'],
      ['BOOK', 'Book'],
      ['FORCED', 'Forced'],
      ['INACCURACY', 'Inaccuracy'],
      ['MISTAKE', 'Mistake'],
      ['BLUNDER', 'Blunder'],
      ['MISS', 'Miss'],
    ];

    return categories
      .filter(([key]) => counts[key] > 0)
      .map(([key, label]) => {
        const cls = MoveClassification[key];
        return `<div class="summary-count-row">
          <span class="${this._classificationIconClass(cls, 'dot')}" style="background:${cls.color}">${cls.icon}</span>
          <span class="label">${label}</span>
          <span class="count">${counts[key]}</span>
        </div>`;
      })
      .join('');
  }

  _renderCriticalMoments() {
    if (!this.analysisResults || !this.analysisResults.criticalMoments || this.analysisResults.criticalMoments.length === 0) {
      this.elCriticalMoments.style.display = 'none';
      this.elCriticalList.innerHTML = '';
      return;
    }

    const items = this.analysisResults.criticalMoments.map((moment) => {
      const btn = document.createElement('button');
      btn.className = 'critical-item';
      btn.type = 'button';
      btn.innerHTML = `
        <span class="${this._classificationIconClass(moment.classification, 'critical-badge')}" style="background:${moment.classification.color}">${moment.classification.icon}</span>
        <span class="critical-text">${moment.moveNumber}${moment.isWhite ? '. ' : '... '}${moment.moveSan}</span>
        <span class="critical-loss">${Math.round(moment.cpLoss)} cp</span>
      `;
      btn.addEventListener('click', () => this._goToMove(moment.moveIndex));
      return btn;
    });

    this.elCriticalList.innerHTML = '';
    items.forEach((btn) => this.elCriticalList.appendChild(btn));
    this.elCriticalMoments.style.display = 'block';
  }

	  _resetInsightPanel() {
	    if (this.elMoveInsights) this.elMoveInsights.hidden = !this.explorerReturnState;
	    this.elInsightEmpty.style.display = 'block';
    this.elInsightContent.style.display = 'none';
    this.elInsightMove.textContent = '';
    this.elInsightClass.textContent = '';
    this.elInsightCpLoss.textContent = '0';
    this.elInsightSwing.textContent = '0.0';
	    this.elInsightBestMove.textContent = '--';
	    this.elInsightPhase.textContent = '--';
	    if (this.elInsightPlanTags) this.elInsightPlanTags.innerHTML = '';
	    if (this.elInsightThreatRow) this.elInsightThreatRow.hidden = true;
	    if (this.elInsightThreat) this.elInsightThreat.textContent = '--';
	    if (this.elInsightEndgameRow) this.elInsightEndgameRow.hidden = true;
	    if (this.elInsightEndgame) this.elInsightEndgame.textContent = '--';
	    this.elInsightCoach.textContent = '';
	    if (this.elBtnLineExplorer) this.elBtnLineExplorer.disabled = true;
	    if (this.elBtnReturnExplorer) this.elBtnReturnExplorer.hidden = !this.explorerReturnState;
	    this.elInsightAlternatives.innerHTML = '';
	  }

  _renderMoveInsights(result) {
    if (!result) {
      this._resetInsightPanel();
      return;
    }

    if (result.isCoachMove) {
      return;
    }

    if (this.elMoveInsights) this.elMoveInsights.hidden = false;
    this.elInsightEmpty.style.display = 'none';
    this.elInsightContent.style.display = 'block';

    this.elInsightMove.textContent = `${result.moveNumber}${result.isWhite ? '. ' : '... '}${result.moveSan || result.move}`;
    this.elInsightClass.textContent = result.classification.name;
    this.elInsightClass.style.background = result.classification.color;
    this.elInsightClass.style.color = '#fff';

    this.elInsightCpLoss.textContent = Math.round(result.cpLoss || 0) + ' cp';
    this.elInsightSwing.textContent = this.analyzer.formatScore(result.swing || 0);
	    this.elInsightBestMove.textContent = result.bestMoveSan || '--';
	    this.elInsightPhase.textContent = result.phase || '--';
	    this.elInsightCoach.textContent = result.coachText || '';
	    if (this.elInsightPlanTags) {
	      const tags = result.planTags || [];
	      this.elInsightPlanTags.innerHTML = tags.length
	        ? tags.map((tag) => `<span class="insight-tag">${tag}</span>`).join('')
	        : '<span class="empty-mini">None</span>';
	    }
	    if (this.elInsightThreatRow && this.elInsightThreat) {
	      this.elInsightThreatRow.hidden = !result.mateThreat;
	      this.elInsightThreat.textContent = result.mateThreat?.text || '--';
	    }
	    if (this.elInsightEndgameRow && this.elInsightEndgame) {
	      const notes = result.endgameNotes || [];
	      this.elInsightEndgameRow.hidden = notes.length === 0;
	      this.elInsightEndgame.textContent = notes.join(' ');
	    }
	    if (this.elBtnLineExplorer) {
	      this.elBtnLineExplorer.disabled = !result.bestMove || result.bestMove === result.moveUci;
	      this.elBtnLineExplorer.dataset.moveIndex = String(result.moveIndex);
	    }
	    if (this.elBtnReturnExplorer) this.elBtnReturnExplorer.hidden = !this.explorerReturnState;

    if (!result.alternatives || result.alternatives.length === 0) {
      this.elInsightAlternatives.innerHTML = '';
      return;
    }

    const rows = result.alternatives.slice(0, 3).map((alt) => `
      <div class="alt-row">
        <span class="alt-rank">#${alt.rank}</span>
        <span class="alt-move">${alt.moveSan}</span>
        <span class="alt-eval">${alt.evalText}</span>
      </div>
    `).join('');

	    this.elInsightAlternatives.innerHTML = `<div class="alt-title">Top Engine Lines</div>${rows}`;
	  }

	  async _exploreBestLineFromCurrentMove() {
	    const index = Number(this.elBtnLineExplorer?.dataset.moveIndex ?? this.currentMoveIndex);
	    const result = this.analysisResults?.[index] || this.liveMoveResults?.[index];
	    if (!result?.bestMove || result.bestMove === result.moveUci || !result.fen) return;
	    if (!this.explorerReturnState) {
	      this.explorerReturnState = {
	        gameMoves: this.gameMoves.slice(),
	        originalGameMoves: this.originalGameMoves.slice(),
	        initialFen: this.initialFen,
	        gameHeaders: { ...(this.gameHeaders || {}) },
	        analysisResults: this.analysisResults,
	        liveMoveResults: this.liveMoveResults.slice(),
	        liveEvalHistory: this.liveEvalHistory.slice(),
	        currentMoveIndex: this.currentMoveIndex,
	        coachMode: { ...this.coachMode },
	        boardFlipped: this.board.flipped,
	      };
	    }

	    const branch = new Chess(result.fen);
	    const move = branch.move({
	      from: result.bestMove.slice(0, 2),
	      to: result.bestMove.slice(2, 4),
	      promotion: result.bestMove[4],
	    });
	    if (!move) return;

	    const prefix = this.gameMoves.slice(0, Math.max(0, index));
	    this.gameMoves = [...prefix, move.san];
	    this.chess = new Chess(this.initialFen);
	    for (const san of this.gameMoves) this.chess.move(san, { sloppy: true });
	    this.currentMoveIndex = this.gameMoves.length - 1;
	    this.analysisResults = null;
	    this.liveMoveResults = [];
	    this.liveEvalHistory = [];
	    if (this.elReviewBtnText) this.elReviewBtnText.textContent = 'Start Review';
	    this.elReviewSummary.style.display = 'none';
	    this.elCriticalMoments.style.display = 'none';
	    this.elCriticalList.innerHTML = '';
	    this._clearReviewExtras();
	    this._setCoachDialog('Best-line explorer loaded. Play your next move and the coach will answer.', 'Explorer');
	    this.coachMode.active = true;
	    this.coachMode.humanColor = this.chess.turn();
	    this.coachMode.thinking = false;
	    this._syncCoachVisibility();
	    this._syncCoachControls();
	    this.board.setChessInstance(this.chess);
	    this._updateBoard();
	    this._renderMoveList();
	    this._updateCurrentMoveIndicator();
	    this._updateGameStatus();
	    this.board.setHighlights([{ square: move.from, type: 'best-from' }, { square: move.to, type: 'best-to' }]);
	    this._requestLiveEvaluation(`Exploring ${move.san}`, {
	      fenBefore: result.fen,
	      fenAfter: this.chess.fen(),
	      moveObj: move,
	      moveIndex: this.currentMoveIndex,
	    });
	  }

	  _returnFromLineExplorer() {
	    const state = this.explorerReturnState;
	    if (!state) return;
	    this.liveEvalToken += 1;
	    this.explorerReturnState = null;
	    this.gameMoves = state.gameMoves.slice();
	    this.originalGameMoves = state.originalGameMoves.slice();
	    this.initialFen = state.initialFen;
	    this.gameHeaders = { ...(state.gameHeaders || {}) };
	    this.analysisResults = state.analysisResults;
	    this.liveMoveResults = state.liveMoveResults.slice();
	    this.liveEvalHistory = state.liveEvalHistory.slice();
	    this.coachMode = { ...state.coachMode, thinking: false };
	    this.chess = new Chess(this.initialFen);
	    for (const san of this.gameMoves.slice(0, state.currentMoveIndex + 1)) {
	      this.chess.move(san, { sloppy: true });
	    }
	    this.currentMoveIndex = state.currentMoveIndex;
	    if (this.board.flipped !== state.boardFlipped) this.board.flip();
	    this.board.setChessInstance(this.chess);
	    this._syncPlayerNameplates();
	    this._syncCoachVisibility();
	    this._syncCoachControls();
	    this._renderMoveList();
	    this._showOpeningInfo(this.analysisResults?.opening || this.analyzer.detectOpening(this.gameMoves));
	    if (this.analysisResults) {
	      this._showReviewSummary();
	      this._renderCriticalMoments();
	    }
	    const restoreIndex = this.currentMoveIndex;
	    this.currentMoveIndex = -9999;
	    this._goToMove(restoreIndex);
	    this._setCoachDialog('Returned to the original review.', 'Review');
	  }

	  _toggleAutoPlay() {
    if (this.autoPlaying) {
      this.autoPlaying = false;
      this._setButtonLabel(this.elBtnAuto, 'Auto');
      return;
    }

    this.autoPlaying = true;
    this._setButtonLabel(this.elBtnAuto, 'Stop');

    const step = () => {
      if (!this.autoPlaying) return;
      if (this.currentMoveIndex >= this.gameMoves.length - 1) {
        this.autoPlaying = false;
        this._setButtonLabel(this.elBtnAuto, 'Auto');
        return;
      }
      this._goToMove(this.currentMoveIndex + 1);
      setTimeout(step, 1100);
    };
    step();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ChessReviewApp();
});
