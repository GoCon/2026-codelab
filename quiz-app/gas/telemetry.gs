const LOG_SHEET_NAME = 'Logs';
const SUMMARY_SHEET_NAME = 'Summary';

const LOG_HEADERS = [
  'question_id',
  'question_title',
  'mode',
  'selected_answer',
  'correct_answer',
  'is_correct',
  'session_id',
  'question_index',
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

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ensureSheet_(spreadsheet, LOG_SHEET_NAME, LOG_HEADERS);
    const summarySheet = ensureSheet_(spreadsheet, SUMMARY_SHEET_NAME, SUMMARY_HEADERS);

    appendLogRow_(logSheet, payload);
    rebuildSummary_(logSheet, summarySheet);

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
    message: 'POST telemetry JSON to this Apps Script web app URL.',
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
  if (typeof payload.question_id !== 'string' || payload.question_id.trim() === '') {
    throw new Error('question_id is required');
  }
  if (typeof payload.question_title !== 'string') {
    payload.question_title = '';
  }
  if (payload.mode !== 'challenge') {
    payload.mode = 'normal';
  }
  if (typeof payload.selected_answer !== 'number') {
    throw new Error('selected_answer must be a number');
  }
  if (typeof payload.correct_answer !== 'number') {
    throw new Error('correct_answer must be a number');
  }
  if (typeof payload.is_correct !== 'boolean') {
    throw new Error('is_correct must be a boolean');
  }
  if (typeof payload.session_id !== 'string') {
    payload.session_id = '';
  }
  if (typeof payload.question_index !== 'number') {
    payload.question_index = '';
  }
  if (typeof payload.answered_at !== 'string' || payload.answered_at.trim() === '') {
    payload.answered_at = new Date().toISOString();
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
    payload.answered_at,
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

function jsonResponse_(statusCode, body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
