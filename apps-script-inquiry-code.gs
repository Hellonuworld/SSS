/**
 * Still Steel Inquiry API
 * Paste this complete file into Google Apps Script Code.gs.
 *
 * Required Script Properties:
 * TURNSTILE_SECRET = your Cloudflare Turnstile Secret Key
 * ALLOWED_HOSTNAMES = www.still-steel.com,still-steel.com,hellonuworld.github.io
 */

const CONFIG = {
  SHEET_NAME: 'Inquiries',
  TURNSTILE_VERIFY_URL: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  MAX_PER_KEY_PER_HOUR: 8,
  HEADERS: [
    'Timestamp',
    'Name',
    'Company',
    'Email',
    'Phone / WhatsApp',
    'Material',
    'Grade',
    'Product Form',
    'Surface Finish',
    'Thickness',
    'Quantity / Destination',
    'Message',
    'Page URL',
    'Page Title',
    'Referrer',
    'Client IP',
    'User Agent',
    'Language',
    'Timezone',
    'Submitted At Local',
    'Source',
    'Turnstile Hostname'
  ]
};

function doGet() {
  return jsonResponse({
    ok: true,
    service: 'Still Steel Inquiry API'
  });
}

function doPost(e) {
  try {
    const payload = parseRequest(e);

    if (payload.website) {
      return jsonResponse({
        ok: false,
        error: 'Unable to submit your inquiry. Please try again later.'
      });
    }

    const validation = validateInquiry(payload);
    if (!validation.ok) {
      return jsonResponse({
        ok: false,
        error: validation.error
      });
    }

    const turnstileResult = verifyTurnstile(payload['cf-turnstile-response']);
    if (!turnstileResult.ok) {
      return jsonResponse({
        ok: false,
        error: turnstileResult.error
      });
    }

    enforceRateLimit(payload);
    saveInquiry(payload, turnstileResult);

    return jsonResponse({
      ok: true,
      message: 'Inquiry submitted successfully.'
    });
  } catch (err) {
    console.error('Inquiry submission failed: ' + err.message);
    return jsonResponse({
      ok: false,
      error: 'Unable to submit your inquiry. Please try again later.'
    });
  }
}

function parseRequest(e) {
  const data = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function (key) {
      data[key] = cleanText(e.parameter[key]);
    });
  }

  if (e && e.postData && e.postData.contents) {
    const type = e.postData.type || '';

    if (type.indexOf('application/json') !== -1) {
      const json = JSON.parse(e.postData.contents);
      Object.keys(json).forEach(function (key) {
        data[key] = cleanText(json[key]);
      });
    }
  }

  return data;
}

function validateInquiry(data) {
  if (!data.name || data.name.length < 2) {
    return {
      ok: false,
      error: 'Please enter your name.'
    };
  }

  if (!data.email || !isValidEmail(data.email)) {
    return {
      ok: false,
      error: 'Please enter a valid email address.'
    };
  }

  if (data.consent !== 'true') {
    return {
      ok: false,
      error: 'Please accept the privacy consent.'
    };
  }

  const material = normalizeMaterial(data.material || data.grade || '');
  if (!material) {
    return {
      ok: false,
      error: 'Please choose a material grade.'
    };
  }

  if (data.name.length > 80) {
    return {
      ok: false,
      error: 'Name is too long.'
    };
  }

  if ((data.company || '').length > 120) {
    return {
      ok: false,
      error: 'Company name is too long.'
    };
  }

  if ((data.phone || '').length > 60) {
    return {
      ok: false,
      error: 'Phone number is too long.'
    };
  }

  if ((data.message || '').length > 1500) {
    return {
      ok: false,
      error: 'Message is too long.'
    };
  }

  return {
    ok: true
  };
}

function verifyTurnstile(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');

  if (!secret) {
    throw new Error('Server configuration is incomplete: TURNSTILE_SECRET is missing.');
  }

  if (!token) {
    return {
      ok: false,
      error: 'Please complete the security verification.'
    };
  }

  const response = UrlFetchApp.fetch(CONFIG.TURNSTILE_VERIFY_URL, {
    method: 'post',
    payload: {
      secret: secret,
      response: token
    },
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());

  if (!result.success) {
    console.error('Turnstile failed: ' + JSON.stringify(result['error-codes'] || []));
    return {
      ok: false,
      error: 'Security verification failed. Please try again.'
    };
  }

  const allowedHostnames = getAllowedHostnames();

  if (allowedHostnames.length && result.hostname) {
    if (allowedHostnames.indexOf(result.hostname) === -1) {
      throw new Error('Turnstile hostname is not allowed: ' + result.hostname);
    }
  }

  if (result.action && result.action !== 'inquiry') {
    throw new Error('Turnstile action mismatch: ' + result.action);
  }

  return {
    ok: true,
    hostname: result.hostname || ''
  };
}

function enforceRateLimit(data) {
  const cache = CacheService.getScriptCache();
  const keySource = [
    data.email || '',
    data.phone || '',
    data.name || ''
  ].join('|').toLowerCase();

  const key = 'inquiry_rate_' + hashText(keySource);
  const current = Number(cache.get(key) || '0');

  if (current >= CONFIG.MAX_PER_KEY_PER_HOUR) {
    throw new Error('Rate limit exceeded.');
  }

  cache.put(key, String(current + 1), 60 * 60);
}

function saveInquiry(data, turnstileResult) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      throw new Error('No active spreadsheet found. Open Apps Script from the target Google Sheet.');
    }

    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    }

    ensureHeaders(sheet);

    const row = [
      new Date(),
      safeCell(data.name),
      safeCell(data.company),
      safeCell(data.email),
      safeCell(data.phone),
      safeCell(normalizeMaterial(data.material || data.grade || '')),
      safeCell(data.grade),
      safeCell(data.productForm),
      safeCell(data.finish),
      safeCell(data.thickness),
      safeCell(data.quantity),
      safeCell(data.message),
      safeCell(data.page),
      safeCell(data.pageTitle),
      safeCell(data.referrer),
      safeCell(data.clientIp),
      safeCell(data.userAgent),
      safeCell(data.language),
      safeCell(data.timezone),
      safeCell(data.submittedAtLocal),
      safeCell(data.source),
      safeCell(turnstileResult.hostname)
    ];

    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function ensureHeaders(sheet) {
  sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
  sheet.setFrozenRows(1);
}

function normalizeMaterial(value) {
  const text = String(value || '').toUpperCase();

  if (text.indexOf('304L') !== -1) return '304L';
  if (text.indexOf('201') !== -1) return '201';
  if (text.indexOf('304') !== -1) return '304';
  if (text.indexOf('316') !== -1) return '316';
  if (text.indexOf('409') !== -1) return '409';
  if (text.indexOf('430') !== -1) return '430';
  if (text.indexOf('OTHER') !== -1) return 'Other';

  return '';
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function safeCell(value) {
  const text = cleanText(value);

  if (/^[=+\-@]/.test(text)) {
    return "'" + text;
  }

  return text;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function getAllowedHostnames() {
  const raw = PropertiesService.getScriptProperties().getProperty('ALLOWED_HOSTNAMES') || '';

  return raw
    .split(',')
    .map(function (item) {
      return item.trim();
    })
    .filter(Boolean);
}

function hashText(text) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  );

  return digest
    .map(function (byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ('0' + value.toString(16)).slice(-2);
    })
    .join('');
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function testSpreadsheetConnection() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('No active spreadsheet found.');
  }

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  ensureHeaders(sheet);

  sheet.appendRow([
    new Date(),
    'Connection Test',
    'Still Steel',
    'test@example.com',
    '',
    '304',
    '304 / S30400',
    'Coil',
    '2B',
    '1.2 mm',
    'Test',
    'This is a test row from Apps Script.',
    'Apps Script',
    'Connection Test Page',
    '',
    '',
    '',
    '',
    '',
    '',
    'testSpreadsheetConnection',
    ''
  ]);

  return 'Spreadsheet connection test completed.';
}
