const LOG_SHEET_NAME = 'Logs';
const SUMMARY_SHEET_NAME = 'Summary';
const ATTEMPTS_SHEET_NAME = 'Attempts';
const PERFECT_SCORE_SHEET_NAME = 'PerfectScores';
const MAX_NICKNAME_LENGTH = 40;

const LOG_HEADERS = [
  'question_id',
  'question_title',
  'mode',
  'selected_answer',
  'correct_answer',
  'is_correct',
  'session_id',
  'attempt_id',
  'question_index',
  'session_size',
  'elapsed_seconds',
  'question_elapsed_seconds',
  'answered_at',
  'received_at',
  'selected_display_index',
  'correct_display_index',
  'selected_choice_text',
  'correct_choice_text',
  'choice_order',
];

const LOG_COL = {
  QUESTION_ID: 0,
  QUESTION_TITLE: 1,
  MODE: 2,
  SELECTED_ANSWER: 3,
  CORRECT_ANSWER: 4,
  IS_CORRECT: 5,
  SESSION_ID: 6,
  ATTEMPT_ID: 7,
  QUESTION_INDEX: 8,
  SESSION_SIZE: 9,
  ELAPSED_SECONDS: 10,
  QUESTION_ELAPSED_SECONDS: 11,
  ANSWERED_AT: 12,
  RECEIVED_AT: 13,
  SELECTED_DISPLAY_INDEX: 14,
  CORRECT_DISPLAY_INDEX: 15,
  SELECTED_CHOICE_TEXT: 16,
  CORRECT_CHOICE_TEXT: 17,
  CHOICE_ORDER: 18,
};

const SUMMARY_HEADERS = [
  'question_id',
  'question_title',
  'first_answer_sessions',
  'first_correct_sessions',
  'first_accuracy',
  'avg_first_question_seconds',
  'avg_first_elapsed_seconds',
  'final_answer_sessions',
  'final_correct_sessions',
  'final_accuracy',
  'avg_final_question_seconds',
  'avg_final_elapsed_seconds',
];

const ATTEMPT_HEADERS = [
  'attempt_id',
  'session_id',
  'mode',
  'answers_submitted',
  'unique_questions',
  'expected_questions',
  'completed',
  'last_question_index',
  'total_elapsed_seconds',
  'avg_question_seconds',
  'first_answered_at',
  'last_answered_at',
];

const PERFECT_SCORE_HEADERS = [
  'nickname',
  'elapsed_seconds',
  'correct_count',
  'completed_at',
  'mode',
  'session_id',
  'attempt_id',
  'received_at',
];

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (payload.event_type === 'perfect_score') {
      const perfectScoreSheet = ensureSheet_(spreadsheet, PERFECT_SCORE_SHEET_NAME, PERFECT_SCORE_HEADERS);
      appendPerfectScoreRow_(perfectScoreSheet, payload);
    } else {
      const logSheet = ensureSheet_(spreadsheet, LOG_SHEET_NAME, LOG_HEADERS);
      appendLogRow_(logSheet, payload);

      const summarySheet = ensureSheet_(spreadsheet, SUMMARY_SHEET_NAME, SUMMARY_HEADERS);
      const attemptsSheet = ensureSheet_(spreadsheet, ATTEMPTS_SHEET_NAME, ATTEMPT_HEADERS);
      rebuildAnalytics_(logSheet, summarySheet, attemptsSheet);
    }

    return jsonResponse_(200, { ok: true });
  } catch (err) {
    return jsonResponse_(400, {
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}

function doGet() {
  return jsonResponse_(200, {
    ok: true,
    message: 'POST answer or perfect-score telemetry JSON to this Apps Script web app URL.',
  });
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('post body is required');
  }

  const raw = e.postData.contents.trim();
  if (!raw) {
    throw new Error('post body is empty');
  }

  const payload = JSON.parse(raw);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload must be a JSON object');
  }

  if (payload.event_type === 'perfect_score') {
    return parsePerfectScorePayload_(payload);
  }
  return parseAnswerPayload_(payload);
}

function parseAnswerPayload_(payload) {
  payload.event_type = 'answer';
  payload.question_id = normalizeString_(payload.question_id);
  if (!payload.question_id) {
    throw new Error('question_id is required');
  }

  payload.question_title = normalizeString_(payload.question_title);
  payload.mode = normalizeMode_(payload.mode);

  if (!isFiniteNumber_(payload.selected_answer)) {
    throw new Error('selected_answer must be a number');
  }
  if (!isFiniteNumber_(payload.correct_answer)) {
    throw new Error('correct_answer must be a number');
  }
  if (typeof payload.is_correct !== 'boolean') {
    throw new Error('is_correct must be a boolean');
  }

  payload.session_id = normalizeString_(payload.session_id);
  payload.attempt_id = normalizeString_(payload.attempt_id);
  payload.question_index = normalizeNonNegativeNumber_(payload.question_index);
  payload.session_size = normalizePositiveNumber_(payload.session_size);
  payload.elapsed_seconds = normalizeNonNegativeNumber_(payload.elapsed_seconds);
  payload.question_elapsed_seconds = normalizeNonNegativeNumber_(payload.question_elapsed_seconds);
  payload.selected_display_index = normalizeNonNegativeNumber_(payload.selected_display_index);
  payload.correct_display_index = normalizeNonNegativeNumber_(payload.correct_display_index);
  payload.selected_choice_text = normalizeString_(payload.selected_choice_text);
  payload.correct_choice_text = normalizeString_(payload.correct_choice_text);
  payload.choice_order = normalizeIndexArray_(payload.choice_order);

  if (!payload.answered_at) {
    payload.answered_at = new Date().toISOString();
  } else {
    payload.answered_at = normalizeString_(payload.answered_at) || new Date().toISOString();
  }

  return payload;
}

function parsePerfectScorePayload_(payload) {
  payload.event_type = 'perfect_score';
  payload.nickname = normalizeString_(payload.nickname);
  if (!payload.nickname) {
    throw new Error('nickname is required');
  }
  if (payload.nickname.length > MAX_NICKNAME_LENGTH) {
    throw new Error(`nickname must be ${MAX_NICKNAME_LENGTH} characters or less`);
  }

  payload.mode = normalizeMode_(payload.mode);
  payload.session_id = normalizeString_(payload.session_id);
  payload.attempt_id = normalizeString_(payload.attempt_id);
  payload.elapsed_seconds = normalizeNonNegativeNumber_(payload.elapsed_seconds);
  if (payload.elapsed_seconds === '') {
    throw new Error('elapsed_seconds must be a non-negative number');
  }
  payload.correct_count = normalizeNonNegativeNumber_(payload.correct_count);
  if (payload.correct_count === '') {
    throw new Error('correct_count must be a non-negative number');
  }

  payload.completed_at = normalizeString_(payload.completed_at) || new Date().toISOString();
  return payload;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaders = headers.some((header, index) => currentHeaders[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function appendLogRow_(sheet, payload) {
  sheet.appendRow([
    payload.question_id,
    payload.question_title,
    payload.mode,
    payload.selected_answer,
    payload.correct_answer,
    payload.is_correct,
    payload.session_id,
    payload.attempt_id,
    payload.question_index,
    payload.session_size,
    payload.elapsed_seconds,
    payload.question_elapsed_seconds,
    payload.answered_at,
    new Date().toISOString(),
    payload.selected_display_index,
    payload.correct_display_index,
    payload.selected_choice_text,
    payload.correct_choice_text,
    payload.choice_order.length > 0 ? JSON.stringify(payload.choice_order) : '',
  ]);
}

function appendPerfectScoreRow_(sheet, payload) {
  sheet.appendRow([
    payload.nickname,
    payload.elapsed_seconds,
    payload.correct_count,
    payload.completed_at,
    payload.mode,
    payload.session_id,
    payload.attempt_id,
    new Date().toISOString(),
  ]);
}

function rebuildAnalytics_(logSheet, summarySheet, attemptsSheet) {
  const rows = loadLogRows_(logSheet);

  const summaryRows = buildSummaryRows_(rows);
  rewriteSheet_(summarySheet, SUMMARY_HEADERS, summaryRows);
  if (summaryRows.length > 0) {
    summarySheet.getRange(2, 5, summaryRows.length, 1).setNumberFormat('0.0%');
    summarySheet.getRange(2, 6, summaryRows.length, 2).setNumberFormat('0.0');
    summarySheet.getRange(2, 10, summaryRows.length, 1).setNumberFormat('0.0%');
    summarySheet.getRange(2, 11, summaryRows.length, 2).setNumberFormat('0.0');
  }

  const attemptRows = buildAttemptRows_(rows);
  rewriteSheet_(attemptsSheet, ATTEMPT_HEADERS, attemptRows);
  if (attemptRows.length > 0) {
    attemptsSheet.getRange(2, 9, attemptRows.length, 2).setNumberFormat('0.0');
  }
}

function rewriteSheet_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  if (rows.length === 0) {
    return;
  }

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function loadLogRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, LOG_HEADERS.length).getValues();
}

function buildSummaryRows_(rows) {
  const stats = new Map();

  rows.forEach((row, rowIndex) => {
    const questionID = normalizeString_(row[LOG_COL.QUESTION_ID]);
    if (!questionID) {
      return;
    }

    const responderKey = getResponderKey_(row, rowIndex);
    let stat = stats.get(questionID);
    if (!stat) {
      stat = {
        title: '',
        firstByResponder: new Map(),
        finalByResponder: new Map(),
      };
      stats.set(questionID, stat);
    }

    const questionTitle = normalizeString_(row[LOG_COL.QUESTION_TITLE]);
    if (!stat.title && questionTitle) {
      stat.title = questionTitle;
    }

    const event = {
      isCorrect: row[LOG_COL.IS_CORRECT] === true,
      elapsedSeconds: normalizeNonNegativeNumber_(row[LOG_COL.ELAPSED_SECONDS]),
      questionElapsedSeconds: normalizeNonNegativeNumber_(row[LOG_COL.QUESTION_ELAPSED_SECONDS]),
    };

    if (!stat.firstByResponder.has(responderKey)) {
      stat.firstByResponder.set(responderKey, event);
    }
    stat.finalByResponder.set(responderKey, event);
  });

  return Array.from(stats.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([questionID, stat]) => {
      const firstEvents = Array.from(stat.firstByResponder.values());
      const finalEvents = Array.from(stat.finalByResponder.values());

      return [
        questionID,
        stat.title,
        firstEvents.length,
        countCorrect_(firstEvents),
        rate_(countCorrect_(firstEvents), firstEvents.length),
        averageNumbers_(firstEvents.map(event => event.questionElapsedSeconds)),
        averageNumbers_(firstEvents.map(event => event.elapsedSeconds)),
        finalEvents.length,
        countCorrect_(finalEvents),
        rate_(countCorrect_(finalEvents), finalEvents.length),
        averageNumbers_(finalEvents.map(event => event.questionElapsedSeconds)),
        averageNumbers_(finalEvents.map(event => event.elapsedSeconds)),
      ];
    });
}

function buildAttemptRows_(rows) {
  const attempts = new Map();

  rows.forEach((row, rowIndex) => {
    const attemptKey = getAttemptKey_(row, rowIndex);
    let attempt = attempts.get(attemptKey);
    if (!attempt) {
      attempt = {
        sessionID: '',
        mode: 'normal',
        answersSubmitted: 0,
        questionIDs: new Set(),
        expectedQuestions: '',
        lastQuestionIndex: '',
        totalElapsedSeconds: '',
        questionElapsedTotal: 0,
        questionElapsedCount: 0,
        firstAnsweredAt: '',
        lastAnsweredAt: '',
      };
      attempts.set(attemptKey, attempt);
    }

    const sessionID = normalizeString_(row[LOG_COL.SESSION_ID]);
    if (!attempt.sessionID && sessionID) {
      attempt.sessionID = sessionID;
    }

    attempt.mode = normalizeMode_(row[LOG_COL.MODE]);
    attempt.answersSubmitted += 1;

    const questionID = normalizeString_(row[LOG_COL.QUESTION_ID]);
    if (questionID) {
      attempt.questionIDs.add(questionID);
    }

    const sessionSize = normalizePositiveNumber_(row[LOG_COL.SESSION_SIZE]);
    if (sessionSize !== '') {
      attempt.expectedQuestions = sessionSize;
    }

    const questionIndex = normalizePositiveNumber_(row[LOG_COL.QUESTION_INDEX]);
    if (questionIndex !== '' && (attempt.lastQuestionIndex === '' || questionIndex > attempt.lastQuestionIndex)) {
      attempt.lastQuestionIndex = questionIndex;
    }

    const elapsedSeconds = normalizeNonNegativeNumber_(row[LOG_COL.ELAPSED_SECONDS]);
    if (elapsedSeconds !== '' && (attempt.totalElapsedSeconds === '' || elapsedSeconds > attempt.totalElapsedSeconds)) {
      attempt.totalElapsedSeconds = elapsedSeconds;
    }

    const questionElapsedSeconds = normalizeNonNegativeNumber_(row[LOG_COL.QUESTION_ELAPSED_SECONDS]);
    if (questionElapsedSeconds !== '') {
      attempt.questionElapsedTotal += questionElapsedSeconds;
      attempt.questionElapsedCount += 1;
    }

    const answeredAt = normalizeString_(row[LOG_COL.ANSWERED_AT]);
    if (answeredAt) {
      if (!attempt.firstAnsweredAt) {
        attempt.firstAnsweredAt = answeredAt;
      }
      attempt.lastAnsweredAt = answeredAt;
    }
  });

  return Array.from(attempts.entries())
    .sort((a, b) => compareAttemptRows_(a[1], b[1], a[0], b[0]))
    .map(([attemptID, attempt]) => {
      const uniqueQuestions = attempt.questionIDs.size;
      const expectedQuestions = attempt.expectedQuestions;
      const completed = expectedQuestions === '' ? '' : uniqueQuestions >= expectedQuestions;

      return [
        attemptID,
        attempt.sessionID,
        attempt.mode,
        attempt.answersSubmitted,
        uniqueQuestions,
        expectedQuestions,
        completed,
        attempt.lastQuestionIndex,
        attempt.totalElapsedSeconds,
        attempt.questionElapsedCount === 0 ? '' : attempt.questionElapsedTotal / attempt.questionElapsedCount,
        attempt.firstAnsweredAt,
        attempt.lastAnsweredAt,
      ];
    });
}

function getResponderKey_(row, rowIndex) {
  const sessionID = normalizeString_(row[LOG_COL.SESSION_ID]);
  if (sessionID) {
    return sessionID;
  }

  const attemptID = normalizeString_(row[LOG_COL.ATTEMPT_ID]);
  if (attemptID) {
    return attemptID;
  }

  return `legacy-row-${rowIndex}`;
}

function getAttemptKey_(row, rowIndex) {
  const attemptID = normalizeString_(row[LOG_COL.ATTEMPT_ID]);
  if (attemptID) {
    return attemptID;
  }

  const sessionID = normalizeString_(row[LOG_COL.SESSION_ID]);
  if (sessionID) {
    return sessionID;
  }

  return `legacy-attempt-${rowIndex}`;
}

function compareAttemptRows_(left, right, leftKey, rightKey) {
  if (left.firstAnsweredAt && right.firstAnsweredAt && left.firstAnsweredAt !== right.firstAnsweredAt) {
    return left.firstAnsweredAt.localeCompare(right.firstAnsweredAt);
  }
  if (left.firstAnsweredAt && !right.firstAnsweredAt) {
    return -1;
  }
  if (!left.firstAnsweredAt && right.firstAnsweredAt) {
    return 1;
  }
  return leftKey.localeCompare(rightKey);
}

function countCorrect_(events) {
  let total = 0;
  events.forEach(event => {
    if (event.isCorrect) {
      total += 1;
    }
  });
  return total;
}

function averageNumbers_(values) {
  let total = 0;
  let count = 0;

  values.forEach(value => {
    if (value !== '') {
      total += value;
      count += 1;
    }
  });

  if (count === 0) {
    return '';
  }

  return total / count;
}

function rate_(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
}

function normalizeString_(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNonNegativeNumber_(value) {
  if (!isFiniteNumber_(value) || value < 0) {
    return '';
  }
  return value;
}

function normalizePositiveNumber_(value) {
  if (!isFiniteNumber_(value) || value <= 0) {
    return '';
  }
  return value;
}

function normalizeIndexArray_(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('choice_order must be an array');
  }
  return value.map((item, index) => {
    const normalized = normalizeNonNegativeNumber_(item);
    if (normalized === '') {
      throw new Error(`choice_order[${index}] must be a non-negative number`);
    }
    return normalized;
  });
}

function isFiniteNumber_(value) {
  return typeof value === 'number' && isFinite(value);
}

function normalizeMode_(value) {
  if (value === 'extra' || value === 'challenge') {
    return 'extra';
  }
  return 'normal';
}

function jsonResponse_(statusCode, body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
