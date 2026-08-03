(function () {
  'use strict';

  var UETR_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var SHAPE_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  // --- validator -----------------------------------------------------------
  function judge(raw) {
    var v = raw.trim();
    if (!v) return null;

    if (v.length !== 36) {
      return { ok: false, msg: 'Not a UETR.',
        why: 'A UETR is exactly 36 characters. This one is ' + v.length + '.' };
    }
    if (!SHAPE_RE.test(v)) {
      return { ok: false, msg: 'Not a UETR.',
        why: 'Expected 8-4-4-4-12 hexadecimal characters separated by hyphens.' };
    }
    if (v[14] !== '4') {
      return { ok: false, msg: 'Not a valid UETR.',
        why: 'Swift requires a version 4 UUID. The 15th character must be 4; here it is "' + v[14] + '".' };
    }
    if ('89ab'.indexOf(v[19].toLowerCase()) === -1) {
      return { ok: false, msg: 'Not a valid UETR.',
        why: 'The 20th character must be 8, 9, a or b. Here it is "' + v[19] + '".' };
    }
    if (!UETR_RE.test(v)) {
      return { ok: true, soft: true, msg: 'Well formed, but written in upper case.',
        why: 'Swift specifies lower case. Advices printed in upper case do occur, so this alone is not a problem — but it is worth noticing on a document you did not issue.' };
    }
    return { ok: true, msg: 'Well formed.',
      why: 'The format is valid. That is all this tells you. A forged advice can carry a perfectly valid UETR — check it against the tracker of the bank named on your document.' };
  }

  var input = document.getElementById('uetr');
  var verdict = document.getElementById('verdict');

  if (input && verdict) {
    input.addEventListener('input', function () {
      var r = judge(input.value);
      if (!r) { verdict.className = 'verdict'; verdict.textContent = ''; return; }
      verdict.className = 'verdict ' + (r.ok ? 'ok' : 'bad');
      verdict.innerHTML = '';
      var head = document.createElement('span');
      head.textContent = r.msg;
      var why = document.createElement('span');
      why.className = 'why';
      why.textContent = r.why;
      verdict.appendChild(head);
      verdict.appendChild(why);
    });
  }

  // --- registry ------------------------------------------------------------
  function yesNo(v, yesText, noText, unknownText) {
    if (v === true)  return { cls: 'yes', text: yesText };
    if (v === false) return { cls: 'no',  text: noText };
    return { cls: 'unk', text: unknownText };
  }

  function cell(label, value) {
    return '<div><dt>' + label + '</dt><dd class="' + value.cls + '">' +
           value.text + '</dd></div>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderCard(t) {
    var pending = t.status === 'pending';
    var el = document.createElement('article');
    el.className = 'card' + (pending ? ' is-pending' : '');

    var stamp =
      '<dl class="stamp">' +
      cell('Account needed', yesNo(t.login_required, 'Yes', 'No', 'Not confirmed')) +
      cell('Third parties', yesNo(t.third_parties_permitted, 'Permitted', 'Not permitted', 'Not stated')) +
      cell('Last checked', { cls: t.last_verified ? '' : 'unk',
                             text: t.last_verified || 'Not yet' }) +
      '</dl>';

    el.innerHTML =
      '<div class="card-top">' +
        '<h3>' + esc(t.bank) + '</h3>' +
        '<span class="product">' + esc(t.product) + '</span>' +
      '</div>' +
      '<p class="bics">BIC ' + t.bic_prefixes.map(esc).join(' · ') + '</p>' +
      stamp +
      '<p class="coverage">' + esc(t.coverage) + '</p>' +
      (pending ? '<p class="pending-why">' + esc(t.pending_reason) + '</p>' : '') +
      '<a class="go" href="' + esc(t.url) + '" target="_blank" rel="noopener noreferrer">' +
        'Open ' + esc(t.bank) + ' tracker' +
      '</a>';

    return el;
  }

  function order(a, b) {
    var rank = { primary: 0, unconfirmed: 1 };
    var d = (rank[a.engine_weight] ?? 9) - (rank[b.engine_weight] ?? 9);
    if (d !== 0) return d;
    if (a.third_parties_permitted === true && b.third_parties_permitted !== true) return -1;
    if (b.third_parties_permitted === true && a.third_parties_permitted !== true) return 1;
    return a.bank.localeCompare(b.bank);
  }

  fetch('data/trackers.json?v=20260803a')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var reg = document.getElementById('registry');
      reg.innerHTML = '';
      data.trackers.slice().sort(order).forEach(function (t) {
        reg.appendChild(renderCard(t));
      });

      document.getElementById('portal-note').textContent = data.client_portal_note;
      var pl = document.getElementById('portals');
      data.client_portal_only.forEach(function (p) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="bank">' + esc(p.bank) + '</span>' +
                       '<span class="portal">' + esc(p.portal) + '</span>';
        pl.appendChild(li);
      });

      document.getElementById('excluded-note').textContent = data.not_bank_operated_note;
      var ex = document.getElementById('excluded');
      data.not_bank_operated.forEach(function (d) {
        var li = document.createElement('li');
        li.textContent = d;
        ex.appendChild(li);
      });

      document.getElementById('reg-date').textContent = data.registry_updated;
    })
    .catch(function () {
      document.getElementById('registry').innerHTML =
        '<p class="loading">The registry did not load. Reload the page, or write to ' +
        '<a href="mailto:Info@infiba.com">Info@infiba.com</a> if it stays down.</p>';
    });
})();
