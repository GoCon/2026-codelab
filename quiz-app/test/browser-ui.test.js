const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appHTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const scripts = [...appHTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length === 0) {
  throw new Error('public/index.html does not contain an inline app script');
}
const appScript = scripts[scripts.length - 1][1];

function extractInputTag(id) {
  const match = appHTML.match(new RegExp(`<input[\\s\\S]*?id="${id}"[\\s\\S]*?>`));
  assert.ok(match, `expected input with id="${id}"`);
  return match[0];
}

const elementIDs = [
  'progress',
  'error-msg',
  'home-card',
  'question-card',
  'result',
  'score-card',
  'question-text',
  'code-block',
  'choices',
  'result-badge',
  'correct-answer-text',
  'explanation',
  'answer-code-section',
  'answer-code-block',
  'play-link',
  'next-btn',
  'score-value',
  'special-link-section',
  'challenge-complete-section',
  'perfect-score-section',
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
  'footer-copyright',
  'admin-keyword-overlay',
  'admin-keyword-input',
  'admin-keyword-message',
  'admin-keyword-close-btn',
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
    this.style = { display: '' };
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
    };
  }

  set innerHTML(value) {
    this._innerHTML = value;
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

  const quizByText = new Map(quizzes.map(quiz => [quiz.text, quiz]));

  function currentQuiz() {
    return quizByText.get(elements.get('question-text').textContent);
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
    currentQuiz,
    choiceButtons,
    parseBeaconPayloads,
    clickStart() {
      elements.get('start-btn').trigger('click');
    },
    clickChallenge() {
      elements.get('challenge-btn').trigger('click');
    },
    answerCurrentQuestionCorrectly,
    answerCurrentQuestionIncorrectly,
    runCurrentSessionCorrectly,
  };
}

test('nickname and admin keyword fields use plain text inputs', () => {
  const nicknameTag = extractInputTag('nickname-input');
  assert.match(nicknameTag, /type="text"/);
  assert.doesNotMatch(nicknameTag, /class="[^"]*\bsecret-input\b/);

  const adminKeywordTag = extractInputTag('admin-keyword-input');
  assert.match(adminKeywordTag, /type="text"/);
  assert.doesNotMatch(adminKeywordTag, /class="[^"]*\bsecret-input\b/);

  assert.doesNotMatch(appHTML, /\.secret-input\b/);
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
