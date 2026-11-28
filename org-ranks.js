/* ============================================================
   org-ranks.js  —  add-on for the organisation app (index.html)

   HOW TO INSTALL: save this file next to index.html and add ONE line just before </body>, after the main <script>:
       <script src="org-ranks.js"></script>
   Then replace sw.js with the new one (version org-v6) so phones pick up the update.

   What it changes (it re-uses the app's own helpers and replaces four views):
     * Overview: a rank progress card at the top (business this month, pay rank, next rank, months below target, recruiting status)
     * Team: no more "Recommend %"; shows each person's last-month business and months below target
     * Earnings: pay rank instead of "approved share"; own sales, team overrides and clawbacks are labelled
     * Add team member: new people join as Partner (when unlocked) or Support; no territory or percentage fields
   ============================================================ */
(function () {
  if (typeof viewOverview !== 'function' || typeof go !== 'function' || typeof dataFor !== 'function') return;

  function rank() { return (typeof BUNDLE !== 'undefined' && BUNDLE && BUNDLE.rank && BUNDLE.rank.success) ? BUNDLE.rank.rank : null; }
  function monthName(m) {
    if (!m) return '';
    var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[Number(m.slice(5)) - 1] + ' ' + m.slice(0, 4);
  }

  function rankCardHtml() {
    var r = rank();
    if (!r) return '';
    var h = '<div class="card" style="margin-top:12px"><div class="sec" style="margin-top:0">Your progress · ' + esc(monthName(r.month)) + '</div>' +
      '<div class="row"><div><div class="sub">Business counted this month</div><div style="font-size:24px;font-weight:800">' + fmtAmt(r.business) + '</div></div>' +
      '<div style="text-align:right"><div class="sub">Pay rank now</div><div class="name">' + esc(r.payTitle) + '</div><div class="sub">' + (r.payPct ? 'Team override ' + r.payPct + '%' : 'No team override yet') + '</div></div></div>';
    if (r.next) {
      var pct = r.next.target > 0 ? Math.max(0, Math.min(100, Math.round(r.business * 100 / r.next.target))) : 0;
      h += '<div style="margin-top:12px"><div class="row"><span class="sub">Next: ' + esc(r.next.title) + ' at ' + fmtAmt(r.next.target) + ' a month</span><span class="sub">' + fmtAmt(r.next.gap) + ' to go</span></div>' +
        '<div style="height:8px;border-radius:6px;background:var(--panel-2);margin-top:6px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:var(--gold)"></div></div></div>';
    } else {
      h += '<div class="sub" style="margin-top:10px">You are at the top rank. Keep your monthly business above ' + fmtAmt(r.heldTarget) + ' to stay there.</div>';
    }
    h += '<div style="margin-top:12px"><span class="tag">Your title: ' + esc(r.heldTitle) + '</span> ' +
      (r.canRecruit ? '<span class="tag ok">Adding team members is unlocked</span>' : '<span class="tag warn">Adding team members unlocks at the first rank</span>') + '</div>';
    if (r.goal) {
      h += '<div class="pitch" style="margin-top:10px">' + (r.goal.reached ? 'You have reached your goal position: ' + esc(r.goal.title) + '.' :
        'Your goal: ' + esc(r.goal.title) + ' needs ' + fmtAmt(r.goal.target) + ' of business in a month (your own plus your team\'s). You are ' + fmtAmt(r.goal.gap) + ' away this month.') + '</div>';
    }
    if (r.heldKey !== 'Partner' && r.monthsBelow > 0) {
      h += '<div class="pitch" style="margin-top:10px">Your business was below ' + fmtAmt(r.heldTarget) + ' for ' + r.monthsBelow + ' of ' + r.demoteAfter + ' months. If it stays below, your title moves down; any month at or above the target resets this.</div>';
    }
    if (r.monthsAtZero >= 3) {
      h += '<div class="pitch" style="margin-top:10px">No business has been counted for ' + r.monthsAtZero + ' months. Accounts with no business for a long period can be deactivated.</div>';
    }
    h += '<div class="sub" style="margin-top:10px">Business is counted when lenders pay us, using the lender-confirmed disbursed amount, for you and your whole team. It is final once the month is closed.</div></div>';
    return h;
  }

  /* ---------- Overview ---------- */
  viewOverview = function () {
    dataFor('mis').then(function (r) {
      if (!r.success) return fail(r.error || 'Could not load');
      var t = r.totals, h = rankCardHtml();
      h += '<div class="sub" style="margin-top:12px">Leads created in the last ' + r.months + ' months, for you and everyone in your team. Updated ' + new Date(r.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + '.</div>';
      h += '<div class="stats">' + box(t.leads, 'Leads') + box(t.needsVerification + t.pending, 'Waiting on documents') + box(t.sent, 'Sent to DSA') + box(t.disbursed, 'Disbursed') + box(inr(t.disbursedAmount), 'Disbursed amount') + '</div>';
      h += '<div class="stats">' + box(pct(t.sent + t.disbursed, t.leads), 'Reached DSA') + box(pct(t.disbursed, t.sent + t.disbursed), 'Disbursed of sent') + box(t.stalePending, 'Pending 3+ days') + box(t.hold, 'On hold') + box(t.dsaRejected + t.rejected, 'Rejected') + '</div>';
      if (r.earnings) h += '<div class="sec">Your earnings</div><div class="stats">' + box(inr(r.earnings.accrued), 'Earned, not yet in a statement') + box(inr(r.earnings.inStatement), 'In a statement, due') + box(inr(r.earnings.paid), 'Paid') + '</div>';
      if ((r.children || []).length) h += '<div class="sec">By team</div>' + r.children.map(function (c) { return '<div class="card"><div class="name">' + esc(c.name || c.code) + ' <span class="sub">' + esc(c.code) + '</span></div><div class="sub">' + c.leads + ' leads · ' + c.pending + ' waiting on documents · ' + c.sent + ' sent · ' + c.disbursed + ' disbursed (' + inr(c.amount) + ')</div></div>'; }).join('');
      var prods = Object.keys(r.byProduct || {});
      if (prods.length) h += '<div class="sec">By product</div><div class="card">' + prods.map(function (k) { var p = r.byProduct[k]; return '<div class="row"><span>' + esc(k) + '</span><span class="sub">' + p.leads + ' leads · ' + p.sent + ' sent · ' + p.disbursed + ' disbursed (' + inr(p.amount) + ')</span></div>'; }).join('') + '</div>';
      if ((r.byMonth || []).length) h += '<div class="sec">By month</div><div class="card">' + r.byMonth.map(function (m) { return '<div class="row"><span>' + esc(m.month) + '</span><span class="sub">' + m.leads + ' leads · ' + m.disbursed + ' disbursed (' + inr(m.amount) + ')</span></div>'; }).join('') + '</div>';
      if ((r.banks || []).length) h += '<div class="sec">Banks with disbursals</div><div class="card">' + r.banks.map(function (b) { return '<div class="row"><span>' + esc(b.bank) + '</span><span class="sub">' + b.n + ' · ' + inr(b.amount) + '</span></div>'; }).join('') + '</div>';
      if ((r.holdReasons || []).length) h += '<div class="sec">Why leads are on hold</div><div class="card">' + r.holdReasons.map(function (b) { return '<div class="row"><span>' + esc(b.reason) + '</span><span class="sub">' + b.n + '</span></div>'; }).join('') + '</div>';
      var fk = Object.keys(r.seatFill || {});
      if (fk.length) h += '<div class="sec">Your team by rank</div><div class="card">' + fk.map(function (k) { var f = r.seatFill[k]; return '<div class="row"><span>' + esc(k) + '</span><span class="sub">' + f.active + ' active' + (f.inactive ? ' · ' + f.inactive + ' inactive' : '') + '</span></div>'; }).join('') + '</div>';
      $('main').innerHTML = h;
    }).catch(fail);
  };

  /* ---------- Team ---------- */
  viewTeam = function () {
    dataFor('team').then(function (r) {
      if (!r.success) return fail(r.error || 'Could not load');
      CACHE.team = r.team;
      var support = ME.seat.role === 'Support';
      var h = '<div class="acts" style="margin-top:12px">' + (ME.canRecruit.length ? '<button class="btn btn-gold" id="addSeat">' + (ME.recruitUnlocked ? '+ Add team member' : '+ Add support staff') + '</button>' : '') + '</div>';
      if (!ME.recruitUnlocked && !support) h += '<div class="pitch">Adding partners and team members unlocks automatically when your monthly business reaches the first rank.</div>';
      var fk = Object.keys(r.fill || {});
      if (fk.length) h += '<div class="stats">' + fk.map(function (k) { var f = r.fill[k]; return box(f.active, k + ' (active)'); }).join('') + '</div>';
      if (r.pendingMoves) h += '<div class="sub">' + r.pendingMoves + ' move request(s) waiting for admin approval.</div>';
      h += (r.team.length ? r.team.map(function (s) {
        var tag = s.status === 'Active' ? '<span class="tag ok">Active</span>' : s.status === 'Vacant' ? '<span class="tag warn">Open</span>' : '<span class="tag bad">' + esc(s.status) + '</span>';
        return '<div class="card"><div class="row"><div><div class="name">' + esc(s.name || '(open position)') + ' ' + tag + '</div>' +
          '<div class="sub">' + esc(s.role) + ' · ' + esc(s.code) + ' · reports to ' + esc(s.parent) + '</div>' +
          (s.mobile ? '<div class="sub">' + esc(s.mobile) + (s.lastLogin ? ' · last login ' + fmtDate(s.lastLogin) : ' · never logged in') + '</div>' : '') +
          '<div class="sub">Last month\'s business ' + fmtAmt(s.business) + (s.monthsBelow ? ' · below target ' + s.monthsBelow + ' month(s)' : '') + '</div></div>' +
          '<div style="display:flex;flex-direction:column;gap:6px"><button class="btn btn-line btn-sm" data-mv="' + escA(s.code) + '">Move…</button></div></div></div>';
      }).join('') : '<div class="sub" style="padding:14px 0">Your team is empty.</div>');
      $('main').innerHTML = h;
      if ($('addSeat')) $('addSeat').onclick = openAddSeat;
    }).catch(fail);
  };

  openAddSeat = function () {
    var canPartner = ME.canRecruit.indexOf('Partner') !== -1;
    openSheet('<h3>Add ' + (canPartner ? 'team member' : 'support staff') + '</h3>' +
      '<div class="field"><label>Role</label><select id="asRole">' +
      (canPartner ? '<option value="Partner">Partner (brings customers, earns on own business)</option>' : '') +
      '<option value="Support">Support executive (helps with documents, no earnings)</option></select></div>' +
      '<div class="field"><label>Reports to</label><select id="asParent">' + seatOptions('') + '</select></div>' +
      '<div class="field"><label>Name</label><input id="asName"></div>' +
      '<div class="field"><label>Mobile (10 digits)</label><input id="asMobile" inputmode="numeric" maxlength="10"></div>' +
      '<div class="field"><label>E-mail (login PIN is sent here)</label><input id="asEmail" type="email"></div>' +
      '<div class="sub">Everyone starts as a Partner. Rank is earned from business each month.</div>' +
      '<div id="asErr"></div><button class="btn btn-gold btn-block" id="asSave">Create login</button>');
    $('asSave').onclick = function () {
      busy($('asSave'), 'Creating…', function () {
        return api('orgAddSeat', { role: $('asRole').value, parent: $('asParent').value, name: $('asName').value.trim(), memberMobile: $('asMobile').value.trim(), email: $('asEmail').value.trim() }).then(function (r) {
          if (!r.success) { $('asErr').innerHTML = '<div class="err">' + esc(r.error || 'Failed') + '</div>'; return; }
          toast(r.message || 'Created'); closeSheet(); refreshNow().then(function () { go('team'); });
        });
      }).catch(function (e) { toast(e.message, true); });
    };
  };

  /* ---------- Earnings ---------- */
  viewEarnings = function () {
    dataFor('earn').then(function (r) {
      if (!r.success) return fail(r.error || 'Could not load');
      var e = r.earnings, rk = r.rank || rank();
      var h = '<div class="sub" style="margin-top:12px">Your earnings are your share of the commission actually received from lenders. They are not a guaranteed amount. Your own sales are booked when we receive the payout; team overrides are added when the month is closed. Payout is on one fixed day each month. If anything looks different from what you expected, e-mail us the lead ID.</div>';
      h += '<div class="stats">' + box(rk ? esc(rk.payTitle) : '—', 'Pay rank this month') + box(inr(e.accrued), 'Earned, not yet in a statement') + box(inr(e.inStatement), 'In a statement, due') + box(inr(e.paid), 'Paid') + '</div>';
      h += '<div class="sec">Monthly statements</div>' + (e.statements.length ? e.statements.map(function (s) {
        return '<div class="card"><div class="row"><div><div class="name">' + esc(s['Month']) + (s['Status'] === 'Paid' ? ' <span class="tag ok">Paid</span>' : ' <span class="tag warn">Due</span>') + '</div><div class="sub">Base ' + inr(s['Base']) + (Number(s['GST']) ? ' · GST ' + inr(s['GST']) : '') + ' · TDS ' + inr(s['TDS']) + '</div>' +
          (s['Paid On'] ? '<div class="sub">Paid ' + fmtDate(s['Paid On']) + (s['Paid Ref'] ? ' · ref ' + esc(s['Paid Ref']) : '') + '</div>' : '') + '</div><div class="name">' + inr(s['Net Payable']) + '</div></div></div>';
      }).join('') : '<div class="sub">No statements yet.</div>');
      function kind(x) {
        if (x['Type'] === 'Clawback') return 'Clawback';
        if (x['Type'] === 'Override' || x['Role'] === 'Override') return 'Team override';
        return 'Own sale';
      }
      h += '<div class="sec">Recent entries</div>' + (e.entries.length ? e.entries.slice(0, 60).map(function (x) {
        return '<div class="card"><div class="row"><div><div class="name">' + kind(x) + ' · ' + esc(x['Lead ID']) + '</div><div class="sub">Base ' + inr(x['Base']) + (Number(x['GST']) ? ' · GST ' + inr(x['GST']) : '') + ' · TDS ' + inr(x['TDS']) + ' · ' + esc(x['Status']) + '</div></div><div class="name">' + inr(x['Net']) + '</div></div></div>';
      }).join('') : '<div class="sub">No entries yet.</div>');
      $('main').innerHTML = h;
    }).catch(fail);
  };

  // a way in for new people on the login screen
  var lv = document.getElementById('loginView');
  if (lv && !document.getElementById('joinLink')) {
    var jl = document.createElement('div'); jl.id = 'joinLink'; jl.className = 'sub'; jl.style.cssText = 'text-align:center;margin-top:14px';
    jl.innerHTML = 'New here? <a href="join.html" style="color:var(--gold)">See how it works and join</a>';
    lv.appendChild(jl);
  }

  // the app may already have drawn its first screen with the old views: draw the current tab again with the new ones
  if (typeof SHELL_BUILT !== 'undefined' && SHELL_BUILT && typeof TAB === 'string' && TAB) go(TAB, false, true);
})();
