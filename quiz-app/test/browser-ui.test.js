const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appHTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const previewHTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'preview', 'index.html'), 'utf8');
const scripts = [...appHTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length === 0) {
  throw new Error('public/index.html does not contain an inline app script');
}
const appScript = scripts[scripts.length - 1][1];
const previewScripts = [...previewHTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (previewScripts.length === 0) {
  throw new Error('public/preview/index.html does not contain an inline preview script');
}
const previewScript = previewScripts[previewScripts.length - 1][1];

function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function stripHTML(html) {
  return decodeHtmlEntities(String(html).replace(/<[^>]*>/g, ''));
}

function extractInputTag(id) {
  const match = appHTML.match(new RegExp(`<input[\\s\\S]*?id="${id}"[\\s\\S]*?>`));
  assert.ok(match, `expected input with id="${id}"`);
  return match[0];
}

function assertFooterInfoMarkup(html, imagePath) {
  assert.match(html, /<footer id="footer-copyright">[\s\S]*?<div class="footer-info">/);
  assert.match(html, /class="logo-container"/);
  assert.match(html, new RegExp(`class="footer-logo" src="${imagePath.replace(/\./g, '\\.').replace(/\//g, '\\/')}" alt="Go Conference 2026"`));
  assert.match(html, /Go Conference 2026/);
  assert.match(html, /href="https:\/\/reneefrench\.blogspot\.com\/"/);
  assert.match(html, /Renée French/);
  assert.match(html, /href="https:\/\/x\.com\/avocadoneko"/);
  assert.match(html, /Illustrations by/);
  assert.match(html, /avocadoneko/);
  assert.doesNotMatch(html, /© 2026 Go Conference Organizing Team/);
}

function assertHeaderConferenceLogo(html, imagePath) {
  const headerMatch = html.match(/<header class="header">([\s\S]*?)<\/header>/);
  assert.ok(headerMatch, 'expected header markup');
  assert.match(headerMatch[1], new RegExp(`class="header-conference-logo" src="${imagePath.replace(/\./g, '\\.').replace(/\//g, '\\/')}" alt="Go Conference 2026"`));
  assert.match(headerMatch[1], /class="header-product-mark">CodeLab<\/span>/);
  assert.match(headerMatch[1], /id="language-switch"/);
  assert.match(headerMatch[1], /id="language-toggle-btn"/);
  assert.match(headerMatch[1], /class="language-toggle-icon"/);
  assert.match(headerMatch[1], /id="language-menu"/);
  assert.match(headerMatch[1], /id="lang-ja-btn"/);
  assert.match(headerMatch[1], /id="lang-en-btn"/);
  assert.doesNotMatch(headerMatch[1], /<span class="accent">Go<\/span> Conference 2026 CodeLab/);
  return headerMatch[1];
}

const elementIDs = [
  'progress',
  'progress-subheader',
  'progress-meter',
  'progress-fill',
  'progress-mascot-anchor',
  'progress-mascot',
  'header-tagline',
  'language-switch',
  'language-toggle-btn',
  'language-toggle-label',
  'language-menu',
  'lang-ja-btn',
  'lang-en-btn',
  'progress-caption',
  'progress-summary-label',
  'error-msg',
  'home-card',
  'home-chip',
  'question-card',
  'result',
  'score-card',
  'celebration-layer',
  'home-lead',
  'question-text',
  'code-block',
  'choices',
  'result-badge',
  'correct-answer-text',
  'explanation',
  'answer-code-section',
  'answer-code-label',
  'answer-code-block',
  'play-link',
  'next-btn',
  'score-label',
  'score-value',
  'special-link-section',
  'special-link-copy',
  'special-link-cta',
  'challenge-complete-section',
  'challenge-complete-copy',
  'challenge-complete-link',
  'perfect-score-section',
  'perfect-time-title',
  'perfect-time-value',
  'perfect-score-note',
  'nickname-input',
  'submit-perfect-score-btn',
  'perfect-score-message',
  'challenge-btn',
  'restart-btn',
  'score-preview-btn',
  'start-btn',
  'preview-btn',
  'preview-entry',
  'unlock-note',
  'footer-copyright',
  'footer-attribution',
  'admin-keyword-overlay',
  'admin-keyword-input',
  'admin-keyword-message',
  'admin-keyword-close-btn',
  'admin-keyword-title',
  'admin-keyword-note',
  'open-admin-btn',
];

const sampleQuizzes = [
  {
    id: 'shared_q1',
    title: 'shared question',
    text: 'shared question',
    choices: ['A', 'B', 'C', 'D'],
    answer: 1,
    explanation: 'shared explanation',
  },
  {
    id: 'normal_q1',
    title: 'normal only question',
    text: 'normal question',
    mode: 'normal',
    choices: ['N1', 'N2', 'N3', 'N4'],
    answer: 2,
    explanation: 'normal explanation',
  },
  {
    id: 'extra_q1',
    title: 'extra only question',
    text: 'extra question',
    mode: 'extra',
    choices: ['E1', 'E2', 'E3', 'E4'],
    answer: 0,
    explanation: 'extra explanation',
  },
];

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.style = {
      display: '',
      setProperty(name, value) {
        this[name] = String(value);
      },
    };
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.href = '';
    this.className = '';
    this.type = '';
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    this._innerHTML = '';
    this._queryMap = new Map();
    this.classList = {
      add: (...names) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        names.forEach(name => classes.add(name));
        this.className = [...classes].join(' ');
      },
      remove: (...names) => {
        const namesToRemove = new Set(names);
        this.className = this.className
          .split(/\s+/)
          .filter(Boolean)
          .filter(name => !namesToRemove.has(name))
          .join(' ');
      },
      toggle: (name, force) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        const shouldHaveClass = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldHaveClass) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
        this.className = [...classes].join(' ');
        return shouldHaveClass;
      },
    };
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.textContent = stripHTML(value);
    if (value === '') {
      this.children = [];
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    if (!this._queryMap.has(selector)) {
      this._queryMap.set(selector, new FakeElement(`${this.id}-${selector}`));
    }
    return this._queryMap.get(selector);
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') {
      this.className = String(value);
    }
  }

  focus() {}

  trigger(type, overrides = {}) {
    if (this.listeners[type]) {
      this.listeners[type]({
        target: this,
        preventDefault() {},
        ...overrides,
      });
    }
  }
}

function createHarness(quizzes = sampleQuizzes) {
  const elements = new Map(elementIDs.map(id => [id, new FakeElement(id)]));
  elements.get('code-block').querySelector('code');
  elements.get('answer-code-block').querySelector('code');

  const beacons = [];
  const storage = new Map();
  const localStorage = new Map();
  const scrollCalls = [];
  const randomValues = [0.81, 0.14, 0.66, 0.29, 0.73, 0.42, 0.57, 0.33, 0.91, 0.18];
  let randomIndex = 0;
  const math = Object.create(Math);
  math.random = () => {
    const value = randomValues[randomIndex % randomValues.length];
    randomIndex += 1;
    return value;
  };

  const context = {
    console,
    Date,
    Math: math,
    Blob: class Blob {
      constructor(parts) {
        this.parts = parts;
      }
    },
    navigator: {
      sendBeacon(url, blob) {
        beacons.push({ url, body: String(blob.parts[0]) });
        return true;
      },
    },
    fetch() {
      throw new Error('fetch should not be called in browser-ui.test.js');
    },
    hljs: {
      highlightElement() {},
    },
  };

  context.document = {
    title: '',
    documentElement: {
      lang: 'ja',
    },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, new FakeElement(id));
      }
      return elements.get(id);
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    querySelectorAll(selector) {
      if (selector === '.choice-btn') {
        return elements.get('choices').children;
      }
      return [];
    },
  };

  context.window = {
    __QUIZ_APP_CONFIG__: {
      telemetryEndpoint: 'https://example.invalid/telemetry',
      previewUnlockCode: 'secret',
    },
    __QUIZ_DATA__: quizzes,
    localStorage: {
      getItem(key) {
        return localStorage.has(key) ? localStorage.get(key) : null;
      },
      setItem(key, value) {
        localStorage.set(key, String(value));
      },
      removeItem(key) {
        localStorage.delete(key);
      },
    },
    sessionStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
        },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    crypto: {
      randomUUID: (() => {
        let id = 0;
        return () => `uuid-${++id}`;
      })(),
    },
    location: {
      href: '',
      replace(value) {
        this.href = value;
      },
    },
    scrollTo(...args) {
      scrollCalls.push(args);
    },
    setTimeout(fn) {
      fn();
      return 0;
    },
  };

  context.globalThis = context;
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.navigator = context.navigator;
  context.window.fetch = context.fetch;
  context.window.Blob = context.Blob;
  context.window.hljs = context.hljs;
  context.window.Math = math;
  context.window.Date = Date;

  vm.createContext(context);
  vm.runInContext(appScript, context);

  function currentQuiz() {
    return quizzes.find(quiz => (
      quiz.text === elements.get('question-text').textContent ||
      quiz.text_en === elements.get('question-text').textContent
    ));
  }

  function choiceButtons() {
    return elements.get('choices').children;
  }

  function clickChoiceByText(choiceText) {
    const button = choiceButtons().find(child => child.textContent === choiceText);
    if (!button) {
      throw new Error(`choice button not found: ${choiceText}`);
    }
    button.trigger('click');
  }

  function answerCurrentQuestionCorrectly() {
    const quiz = currentQuiz();
    if (!quiz) {
      throw new Error('no quiz is currently rendered');
    }
    clickChoiceByText(quiz.choices[quiz.answer]);
  }

  function answerCurrentQuestionIncorrectly() {
    const quiz = currentQuiz();
    if (!quiz) {
      throw new Error('no quiz is currently rendered');
    }
    const wrongChoice = quiz.choices.find((choice, index) => index !== quiz.answer);
    clickChoiceByText(wrongChoice);
  }

  function parseBeaconPayloads() {
    return beacons.map(entry => JSON.parse(entry.body));
  }

  function runCurrentSessionCorrectly() {
    while (elements.get('score-card').style.display !== 'block') {
      answerCurrentQuestionCorrectly();
      elements.get('next-btn').trigger('click');
    }
  }

    return {
      beacons,
      elements,
      location: context.window.location,
      localStorage,
      scrollCalls,
      currentQuiz,
      choiceButtons,
      parseBeaconPayloads,
    clickStart() {
      elements.get('start-btn').trigger('click');
    },
    clickChallenge() {
      elements.get('challenge-btn').trigger('click');
    },
    openHiddenKeywordPopup() {
      for (let i = 0; i < 10; i += 1) {
        elements.get('footer-copyright').trigger('click');
      }
    },
    submitHiddenKeyword(keyword) {
      elements.get('admin-keyword-input').value = keyword;
      elements.get('open-admin-btn').trigger('click');
    },
    answerCurrentQuestionCorrectly,
    answerCurrentQuestionIncorrectly,
    runCurrentSessionCorrectly,
  };
}

test('nickname and admin keyword fields use plain text inputs', () => {
  const nicknameTag = extractInputTag('nickname-input');
  assert.match(nicknameTag, /type="text"/);
  assert.match(nicknameTag, /autocomplete="off"/);
  assert.match(nicknameTag, /spellcheck="false"/);
  assert.match(nicknameTag, /data-1p-ignore="true"/);
  assert.match(nicknameTag, /data-lpignore="true"/);
  assert.match(nicknameTag, /data-bwignore="true"/);
  assert.match(nicknameTag, /data-form-type="other"/);
  assert.doesNotMatch(nicknameTag, /autocomplete="nickname"/);
  assert.doesNotMatch(nicknameTag, /class="[^"]*\bsecret-input\b/);

  const adminKeywordTag = extractInputTag('admin-keyword-input');
  assert.match(adminKeywordTag, /type="text"/);
  assert.doesNotMatch(adminKeywordTag, /class="[^"]*\bsecret-input\b/);

  assert.doesNotMatch(appHTML, /\.secret-input\b/);
});

test('top page footer uses the conference attribution block', () => {
  assertFooterInfoMarkup(appHTML, './assets/go-conference-2026-logo.svg');
});

test('preview page footer uses the conference attribution block', () => {
  assertFooterInfoMarkup(previewHTML, '../assets/go-conference-2026-logo.svg');
});

test('top page header uses the conference logo with CodeLab label', () => {
  const headerMarkup = assertHeaderConferenceLogo(appHTML, './assets/go-conference-2026-logo.svg');
  assert.match(headerMarkup, /Go の知識を試してみよう！/);
});

test('preview page header uses the conference logo with CodeLab label', () => {
  assertHeaderConferenceLogo(previewHTML, '../assets/go-conference-2026-logo.svg');
});

test('preview page header does not render the right-side badge', () => {
  const headerMarkup = assertHeaderConferenceLogo(previewHTML, '../assets/go-conference-2026-logo.svg');
  assert.doesNotMatch(headerMarkup, /header-badge/);
  assert.doesNotMatch(headerMarkup, /<span[^>]*>\s*問題一覧\s*<\/span>/);
});

test('preview page inline script parses successfully', () => {
  assert.doesNotThrow(() => new vm.Script(previewScript));
});

test('language menu toggles from the globe button', () => {
  const app = createHarness();

  assert.equal(app.elements.get('language-toggle-btn').attributes['aria-expanded'], 'false');

  app.elements.get('language-toggle-btn').trigger('click');
  assert.equal(app.elements.get('language-toggle-btn').attributes['aria-expanded'], 'true');

  app.elements.get('language-toggle-btn').trigger('click');
  assert.equal(app.elements.get('language-toggle-btn').attributes['aria-expanded'], 'false');
});

test('language switch localizes the app UI and active quiz content', () => {
  const app = createHarness([
    {
      id: 'localized_q1',
      title: '日本語タイトル',
      title_en: 'English title',
      text: '日本語の問題文',
      text_en: 'English question text',
      choices: ['選択肢A', '選択肢B'],
      choices_en: ['Choice A', 'Choice B'],
      answer: 1,
      explanation: '日本語の解説',
      explanation_en: 'English explanation',
    },
  ]);

  assert.equal(app.elements.get('start-btn').textContent, 'クイズを始める');

  app.elements.get('language-toggle-btn').trigger('click');
  assert.equal(app.elements.get('language-toggle-btn').attributes['aria-expanded'], 'true');
  app.elements.get('lang-en-btn').trigger('click');
  assert.equal(app.elements.get('language-toggle-btn').attributes['aria-expanded'], 'false');
  assert.equal(app.elements.get('header-tagline').textContent, 'Test your Go knowledge!');
  assert.equal(app.elements.get('start-btn').textContent, 'Start quiz');
  assert.equal(app.localStorage.get('quiz-language'), 'en');

  app.clickStart();
  assert.equal(app.elements.get('question-text').textContent, 'English question text');
  assert.deepEqual(
    new Set(app.choiceButtons().map(button => button.textContent)),
    new Set(['Choice A', 'Choice B']),
  );

  const wrongButton = app.choiceButtons().find(button => button.textContent === 'Choice A');
  assert.ok(wrongButton, 'expected localized wrong choice button');
  wrongButton.trigger('click');

  assert.equal(app.elements.get('result-badge').textContent, 'Incorrect...');
  assert.equal(app.elements.get('correct-answer-text').textContent, 'The correct answer is "Choice B".');
  assert.equal(app.elements.get('explanation').innerHTML, 'English explanation');
});

test('backtick-wrapped quiz text renders as inline code', () => {
  assert.match(appHTML, /\.inline-code \{/);
  assert.match(previewHTML, /\.inline-code \{/);
  assert.match(previewHTML, /function formatInlineText/);
  assert.match(previewHTML, /modalExplanation\.innerHTML = formatInlineText\(getQuizExplanation\(selectedQuiz\), \{ linkifyUrls: true \}\);/);

  const app = createHarness([
    {
      id: 'inline_q1',
      title: 'inline title',
      text: '実行するコマンドは `go test ./...` です',
      choices: ['`go test ./...`', '`go build`'],
      answer: 1,
      explanation: '解説では `go build` を実行します。',
    },
  ]);

  app.clickStart();
  assert.equal(
    app.elements.get('question-text').innerHTML,
    '実行するコマンドは <code class="inline-code">go test ./...</code> です',
  );
  assert.equal(app.choiceButtons()[0].innerHTML, '<code class="inline-code">go test ./...</code>');

  app.choiceButtons()[0].trigger('click');
  assert.equal(
    app.elements.get('correct-answer-text').innerHTML,
    '正解は「<code class="inline-code">go build</code>」です。',
  );
  assert.equal(
    app.elements.get('explanation').innerHTML,
    '解説では <code class="inline-code">go build</code> を実行します。',
  );
});

test('progress is rendered as a reward-style subheader below the header', () => {
  const headerMatch = appHTML.match(/<header class="header">([\s\S]*?)<\/header>/);
  assert.ok(headerMatch, 'expected header markup');
  assert.doesNotMatch(headerMatch[1], /id="progress"/);
  assert.match(
    appHTML,
    /<div class="progress-subheader" id="progress-subheader">[\s\S]*?<div class="progress-reward" aria-live="polite">[\s\S]*?Answered[\s\S]*?id="progress-fill"[\s\S]*?id="progress-mascot-anchor"[\s\S]*?id="progress-mascot" src="\.\/assets\/progress-gopher\.png"[\s\S]*?<\/div>/,
  );
  assert.doesNotMatch(appHTML, /id="progress-star-/);
});

test('progress reward UI tracks answered questions in the current session', () => {
  const app = createHarness();

  app.clickStart();
  assert.equal(app.elements.get('progress').textContent, '0 / 2');
  assert.equal(app.elements.get('progress-fill').style.width, '0%');
  assert.equal(app.elements.get('progress-meter').attributes['aria-valuenow'], '0');
  assert.equal(app.elements.get('progress-mascot-anchor').style.left, '0%');

  app.answerCurrentQuestionCorrectly();
  assert.equal(app.elements.get('progress').textContent, '1 / 2');
  assert.equal(app.elements.get('progress-fill').style.width, '50%');
  assert.equal(app.elements.get('progress-meter').attributes['aria-valuenow'], '1');
  assert.equal(app.elements.get('progress-meter').attributes['aria-valuemax'], '2');
  assert.equal(app.elements.get('progress-mascot-anchor').style.left, '50%');

  app.elements.get('next-btn').trigger('click');
  app.answerCurrentQuestionCorrectly();
  assert.equal(app.elements.get('progress').textContent, '2 / 2');
  assert.equal(app.elements.get('progress-fill').style.width, '100%');
  assert.equal(app.elements.get('progress-meter').attributes['aria-valuenow'], '2');
  assert.equal(app.elements.get('progress-mascot-anchor').style.left, '100%');
});

test('next button scrolls to the top when navigating questions and score view', () => {
  const app = createHarness();

  app.clickStart();
  app.answerCurrentQuestionCorrectly();
  assert.equal(app.scrollCalls.length, 0);

  app.elements.get('next-btn').trigger('click');
  assert.equal(app.scrollCalls.length, 1);
  assert.equal(app.scrollCalls[0].length, 1);
  assert.equal(app.scrollCalls[0][0].top, 0);
  assert.equal(app.scrollCalls[0][0].left, 0);
  assert.equal(app.scrollCalls[0][0].behavior, 'auto');

  app.answerCurrentQuestionCorrectly();
  app.elements.get('next-btn').trigger('click');
  assert.equal(app.scrollCalls.length, 2);
  assert.equal(app.scrollCalls[1].length, 1);
  assert.equal(app.scrollCalls[1][0].top, 0);
  assert.equal(app.scrollCalls[1][0].left, 0);
  assert.equal(app.scrollCalls[1][0].behavior, 'auto');
});

test('multiline choices preserve line breaks in quiz data and choice button styling', () => {
  assert.match(appHTML, /\.choice-btn \{[\s\S]*?white-space: pre-wrap;/);
  assert.match(previewHTML, /\.choice-btn \{[\s\S]*?white-space: pre-wrap;/);

  const app = createHarness([
    {
      id: 'multiline_q1',
      title: 'multiline question',
      text: 'multiline question',
      choices: ['i=0 v=日\ni=1 v=本\ni=2 v=語', 'コンパイルエラー'],
      answer: 0,
      explanation: 'multiline explanation',
    },
  ]);

  app.clickStart();
  assert.equal(app.choiceButtons()[0].textContent, 'i=0 v=日\ni=1 v=本\ni=2 v=語');

  app.choiceButtons()[1].trigger('click');
  assert.equal(
    app.elements.get('correct-answer-text').textContent,
    '正解は「i=0 v=日\ni=1 v=本\ni=2 v=語」です。',
  );
});

test('hidden keyword unlock opens preview mode directly', () => {
  const app = createHarness();

  app.openHiddenKeywordPopup();
  app.submitHiddenKeyword('secret');

  assert.equal(app.location.href, './preview/');
  assert.equal(app.elements.get('preview-entry').style.display, 'block');
  assert.equal(app.elements.get('score-preview-btn').style.display, '');
  assert.doesNotMatch(appHTML, /\/admin\//);
});

test('normal mode excludes extra-only quizzes and keeps canonical telemetry after shuffling', () => {
  const app = createHarness();

  app.clickStart();
  app.runCurrentSessionCorrectly();

  const payloads = app.parseBeaconPayloads();
  assert.deepStrictEqual(
    payloads.map(payload => payload.question_id).sort(),
    ['normal_q1', 'shared_q1'],
  );

  const sharedPayload = payloads.find(payload => payload.question_id === 'shared_q1');
  assert.ok(sharedPayload, 'shared_q1 telemetry should exist');
  assert.equal(sharedPayload.mode, 'normal');
  assert.equal(sharedPayload.selected_answer, 1);
  assert.equal(sharedPayload.correct_answer, 1);
  assert.equal(sharedPayload.selected_choice_text, 'B');
  assert.equal(sharedPayload.correct_choice_text, 'B');
  assert.equal(sharedPayload.choice_order.length, 4);
  assert.notEqual(sharedPayload.choice_order.join(','), '0,1,2,3');
  assert.equal(
    sharedPayload.choice_order[sharedPayload.selected_display_index],
    sharedPayload.selected_answer,
  );
  assert.equal(
    sharedPayload.choice_order[sharedPayload.correct_display_index],
    sharedPayload.correct_answer,
  );
  assert.notEqual(app.elements.get('challenge-btn').style.display, 'none');
});

test('perfect score renders a fireworks-style celebration layer with more confetti', () => {
  const app = createHarness();

  app.clickStart();
  app.runCurrentSessionCorrectly();

  const celebrationLayer = app.elements.get('celebration-layer');
  assert.equal(celebrationLayer.children.length, 29);
  assert.ok(
    celebrationLayer.children.some(child => child.className.includes('celebration-burst')),
    'expected celebration bursts',
  );
  assert.ok(
    celebrationLayer.children.some(child => child.className.includes('celebration-confetti')),
    'expected celebration confetti',
  );
  assert.ok(
    celebrationLayer.children.some(child => child.className.includes('celebration-ring')),
    'expected celebration rings',
  );
});

test('extra mode only serves extra quizzes and still shows the correct answer after a shuffled wrong click', () => {
  const app = createHarness();

  app.clickStart();
  app.runCurrentSessionCorrectly();

  const beforeChallengeCount = app.beacons.length;
  app.clickChallenge();

  assert.equal(app.currentQuiz().id, 'extra_q1');

  app.answerCurrentQuestionIncorrectly();

  const extraPayload = app.parseBeaconPayloads().slice(beforeChallengeCount)[0];
  assert.equal(extraPayload.question_id, 'extra_q1');
  assert.equal(extraPayload.mode, 'extra');
  assert.equal(
    extraPayload.choice_order[extraPayload.selected_display_index],
    extraPayload.selected_answer,
  );
  assert.equal(
    extraPayload.choice_order[extraPayload.correct_display_index],
    extraPayload.correct_answer,
  );
  assert.equal(app.elements.get('correct-answer-text').textContent, '正解は「E1」です。');

  const buttons = app.choiceButtons();
  const hasClass = (button, className) => button.className.split(/\s+/).includes(className);
  assert.equal(buttons.filter(button => hasClass(button, 'correct')).length, 1);
  assert.equal(buttons.filter(button => hasClass(button, 'incorrect')).length, 1);
});
