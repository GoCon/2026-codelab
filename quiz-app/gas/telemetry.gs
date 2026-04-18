const LOG_SHEET_NAME = 'Logs';
const SUMMARY_SHEET_NAME = 'Summary';
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
  'question_index',
  'elapsed_seconds',
  'answered_at',
  'received_at',
];

const SUMMARY_HEADERS = [
  'question_id',
  'question_title',
  'total_answers',
  'correct_answers',
  'accuracy',
];

const PERFECT_SCORE_HEADERS = [
  'nickname',
  'elapsed_seconds',
  'completed_at',
  'mode',
  'session_id',
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
      const summarySheet = ensureSheet_(spreadsheet, SUMMARY_SHEET_NAME, SUMMARY_HEADERS);
      appendLogRow_(logSheet, payload);
      rebuildSummary_(logSheet, summarySheet);
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
  if (typeof payload.question_id !== 'string' || payload.question_id.trim() === '') {
    throw new Error('question_id is required');
  }
  payload.question_id = payload.question_id.trim();
  if (typeof payload.question_title !== 'string') {
    payload.question_title = '';
  }
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
  if (typeof payload.session_id !== 'string') {
    payload.session_id = '';
  }
  if (!isFiniteNumber_(payload.question_index)) {
    payload.question_index = '';
  }
  if (!isFiniteNumber_(payload.elapsed_seconds) || payload.elapsed_seconds < 0) {
    payload.elapsed_seconds = '';
  }
  if (typeof payload.answered_at !== 'string' || payload.answered_at.trim() === '') {
    payload.answered_at = new Date().toISOString();
  }

  return payload;
}

function parsePerfectScorePayload_(payload) {
  payload.event_type = 'perfect_score';
  if (typeof payload.nickname !== 'string' || payload.nickname.trim() === '') {
    throw new Error('nickname is required');
  }
  payload.nickname = payload.nickname.trim();
  if (payload.nickname.length > MAX_NICKNAME_LENGTH) {
    throw new Error(`nickname must be ${MAX_NICKNAME_LENGTH} characters or less`);
  }
  payload.mode = normalizeMode_(payload.mode);
  if (!isFiniteNumber_(payload.elapsed_seconds) || payload.elapsed_seconds < 0) {
    throw new Error('elapsed_seconds must be a non-negative number');
  }
  if (typeof payload.completed_at !== 'string' || payload.completed_at.trim() === '') {
    payload.completed_at = new Date().toISOString();
  }
  if (typeof payload.session_id !== 'string') {
    payload.session_id = '';
  }

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
    payload.question_index,
    payload.elapsed_seconds,
    payload.answered_at,
    new Date().toISOString(),
  ]);
}

function appendPerfectScoreRow_(sheet, payload) {
  sheet.appendRow([
    payload.nickname,
    payload.elapsed_seconds,
    payload.completed_at,
    payload.mode,
    payload.session_id,
    new Date().toISOString(),
  ]);
}

function rebuildSummary_(logSheet, summarySheet) {
  summarySheet.clearContents();
  summarySheet.getRange(1, 1, 1, SUMMARY_HEADERS.length).setValues([SUMMARY_HEADERS]);
  summarySheet.getRange(1, 1, 1, SUMMARY_HEADERS.length).setFontWeight('bold');
  summarySheet.setFrozenRows(1);

  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  const rows = logSheet.getRange(2, 1, lastRow - 1, LOG_HEADERS.length).getValues();
  const stats = new Map();

  rows.forEach(row => {
    const questionID = row[0];
    if (!questionID) {
      return;
    }

    const current = stats.get(questionID) || {
      title: '',
      total: 0,
      correct: 0,
    };

    current.title = row[1] || current.title;
    current.total += 1;
    if (row[5] === true) {
      current.correct += 1;
    }

    stats.set(questionID, current);
  });

  const summaryRows = Array.from(stats.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([questionID, stat]) => [
      questionID,
      stat.title,
      stat.total,
      stat.correct,
      stat.total === 0 ? 0 : stat.correct / stat.total,
    ]);

  if (summaryRows.length === 0) {
    return;
  }

  summarySheet.getRange(2, 1, summaryRows.length, SUMMARY_HEADERS.length).setValues(summaryRows);
  summarySheet.getRange(2, 5, summaryRows.length, 1).setNumberFormat('0.0%');
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
