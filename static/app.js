// ========== State ==========
let PEOPLE = [];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const $ = (sel) => document.querySelector(sel);

// ========== Utilities ==========
function uniq(arr){ return Array.from(new Set(arr)); }
function trimNonEmpty(s){ return s.trim(); }
function toCents(x){ return Math.round((parseFloat(x || "0") || 0) * 100); }
function fromCents(c){ return (c/100).toFixed(2); }

function renderPeopleChips(){
  const wrap = $("#peopleChips");
  wrap.innerHTML = "";
  PEOPLE.forEach(p => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `
      <span>${p}</span>
      <button type="button" title="Remove ${p}" aria-label="Remove ${p}">✕</button>
    `;
    chip.querySelector("button").addEventListener("click", () => {
      PEOPLE = PEOPLE.filter(x => x !== p);
      renderPeopleChips();
      syncRowsWithPeople();
      toggleSteps();
    });
    wrap.appendChild(chip);
  });
}

function createDaySelect(value){
  const sel = document.createElement("select");
  sel.className = "form-select form-select-sm";
  DAYS.forEach(d => {
    const o = document.createElement("option"); o.value = d; o.textContent = d;
    sel.appendChild(o);
  });
  if (value) sel.value = value;
  return sel;
}

function createPayerSelect(value){
  const sel = document.createElement("select");
  sel.className = "form-select form-select-sm payer-select";
  PEOPLE.forEach(p => {
    const o = document.createElement("option"); o.value = p; o.textContent = p;
    sel.appendChild(o);
  });
  if (value && PEOPLE.includes(value)) sel.value = value;
  return sel;
}

function createSharesEditor(existingShares = {}){
  const wrap = document.createElement("div");
  wrap.className = "shares-grid";
  PEOPLE.forEach(p => {
    const group = document.createElement("div");
    group.className = "input-group input-group-sm";
    group.innerHTML = `
      <span class="input-group-text">${p}</span>
      <input type="number" class="form-control share-input" data-person="${p}" min="0" step="0.01" placeholder="0.00">
      <span class="input-group-text">€</span>
    `;
    const inp = group.querySelector("input");
    if (existingShares[p] != null) inp.value = existingShares[p];
    wrap.appendChild(group);
  });
  return wrap;
}

function rowSumCents(sharesWrap){
  const inputs = sharesWrap.querySelectorAll(".share-input");
  return Array.from(inputs).reduce((acc, i) => acc + toCents(i.value), 0);
}

function addRow(prefill=null){
  const tr = document.createElement("tr");

  // Day
  const tdDay = document.createElement("td");
  const daySel = createDaySelect(prefill?.day);
  tdDay.appendChild(daySel);

  // Description
  const tdDesc = document.createElement("td");
  const desc = document.createElement("input");
  desc.className = "form-control form-control-sm";
  desc.placeholder = "e.g. Lunch, Coffee...";
  desc.value = prefill?.description || "";
  tdDesc.appendChild(desc);

  // Payer
  const tdPayer = document.createElement("td");
  const payerSel = createPayerSelect(prefill?.payer);
  tdPayer.appendChild(payerSel);

  // Amount
  const tdAmt = document.createElement("td");
  const amt = document.createElement("input");
  amt.type = "number"; amt.min = "0"; amt.step = "0.01";
  amt.className = "form-control form-control-sm amount-input";
  amt.placeholder = "0.00";
  amt.value = prefill?.amount ?? "";
  tdAmt.appendChild(amt);

  // Shares
  const tdShares = document.createElement("td");
  const sharesWrap = createSharesEditor(prefill?.shares || {});
  tdShares.appendChild(sharesWrap);

  // Controls row
  const ctrl = document.createElement("div");
  ctrl.className = "d-flex gap-2 align-items-center mt-2";
  ctrl.innerHTML = `
    <button type="button" class="btn btn-outline-secondary btn-sm eq-split">Split equally</button>
    <div class="small text-muted ms-auto sum-indicator">Sum: 0.00 €</div>
  `;
  tdShares.appendChild(ctrl);

  const updateSum = () => {
    const sum = rowSumCents(sharesWrap);
    ctrl.querySelector(".sum-indicator").textContent = `Sum: ${fromCents(sum)} €`;
    tr.classList.remove("row-error");
  };
  sharesWrap.addEventListener("input", updateSum);
  updateSum();

  ctrl.querySelector(".eq-split").addEventListener("click", () => {
    const totalCents = toCents(amt.value);
    if (!totalCents || PEOPLE.length === 0) return;
    const base = Math.floor(totalCents / PEOPLE.length);
    let remaining = totalCents - base * PEOPLE.length;
    const inputs = sharesWrap.querySelectorAll(".share-input");
    inputs.forEach((inp, idx) => {
      let c = base;
      if (idx === inputs.length - 1) c += remaining; // last gets remainder
      inp.value = fromCents(c);
    });
    updateSum();
  });

  // Delete row
  const tdDel = document.createElement("td");
  const delBtn = document.createElement("button");
  delBtn.className = "btn btn-outline-danger btn-sm";
  delBtn.textContent = "✕";
  delBtn.addEventListener("click", () => tr.remove());
  tdDel.appendChild(delBtn);

  tr.appendChild(tdDay);
  tr.appendChild(tdDesc);
  tr.appendChild(tdPayer);
  tr.appendChild(tdAmt);
  tr.appendChild(tdShares);
  tr.appendChild(tdDel);
  $("#txBody").appendChild(tr);
}

function readTransactions(){
  const rows = Array.from($("#txBody").children);
  const txs = [];
  rows.forEach((tr, idx) => {
    const day = tr.children[0].querySelector("select").value;
    const description = tr.children[1].querySelector("input").value.trim();
    const payer = tr.children[2].querySelector("select").value;
    const amount = parseFloat(tr.children[3].querySelector("input").value || "0");
    const sharesWrap = tr.children[4].querySelector(".shares-grid");

    const shares = {};
    PEOPLE.forEach(p => {
      const inp = sharesWrap.querySelector(`.share-input[data-person="${p}"]`);
      shares[p] = inp ? parseFloat(inp.value || "0") : 0;
    });

    // Frontend strict validation: sum(shares) must equal amount (to cents)
    const sumCents = rowSumCents(sharesWrap);
    const amountCents = toCents(amount);
    if (amountCents !== sumCents) {
      tr.classList.add("row-error");
      throw new Error(`Row ${idx+1}: shares sum (${fromCents(sumCents)}) ≠ amount (${fromCents(amountCents)}).`);
    }
    if (amountCents <= 0) {
      tr.classList.add("row-error");
      throw new Error(`Row ${idx+1}: amount must be > 0.`);
    }

    txs.push({ day, description, payer, amount, shares });
  });
  return txs;
}

function renderBalancesTable(balances){
  const { paid, consumed, net } = balances;
  const people = Object.keys(paid);
  let html = `
    <div class="table-responsive">
      <table class="table table-sm">
        <thead class="table-light">
          <tr>
            <th>Person</th>
            <th class="text-end">Paid (€)</th>
            <th class="text-end">Consumed (€)</th>
            <th class="text-end">Net (€)</th>
          </tr>
        </thead>
        <tbody>
  `;
  people.forEach(p => {
    const n = net[p];
    const cls = n > 0 ? "text-success" : (n < 0 ? "text-danger" : "");
    html += `
      <tr>
        <td>${p}</td>
        <td class="text-end">${paid[p].toFixed(2)}</td>
        <td class="text-end">${consumed[p].toFixed(2)}</td>
        <td class="text-end ${cls}">${n.toFixed(2)}</td>
      </tr>
    `;
  });
  html += `</tbody></table></div>`;
  $("#balancesTable").innerHTML = html;
}

function renderTransfers(transfers){
  if (!transfers.length) {
    $("#transfersList").innerHTML = `<div class="text-muted">All settled. Nobody owes anything 🎉</div>`;
    return;
  }
  const list = document.createElement("div");
  transfers.forEach(t => {
    const row = document.createElement("div");
    row.className = "d-flex justify-content-between align-items-center border rounded p-2 mb-2";
    row.innerHTML = `
      <div><strong>${t.from}</strong> → <strong>${t.to}</strong></div>
      <div class="fw-semibold">${t.amount.toFixed(2)} €</div>
    `;
    list.appendChild(row);
  });
  $("#transfersList").innerHTML = "";
  $("#transfersList").appendChild(list);
}

function toggleSteps(){
  if (PEOPLE.length > 0) {
    $("#step-transactions").classList.remove("d-none");
    if ($("#txBody").children.length === 0) addRow();
  } else {
    $("#step-transactions").classList.add("d-none");
    $("#step-results").classList.add("d-none");
  }
}

/** Sync rows (payer select + shares editors) when PEOPLE changes. */
function syncRowsWithPeople(){
  const rows = Array.from($("#txBody").children);
  rows.forEach(tr => {
    const currentPayer = tr.querySelector(".payer-select")?.value;
    const sharesWrap = tr.querySelector(".shares-grid");
    const oldShares = {};
    sharesWrap?.querySelectorAll(".share-input").forEach(inp => {
      oldShares[inp.dataset.person] = inp.value;
    });

    const payerTd = tr.children[2];
    payerTd.innerHTML = "";
    const newPayerSel = createPayerSelect(currentPayer);
    if (!newPayerSel.value && PEOPLE.length) newPayerSel.value = PEOPLE[0];
    payerTd.appendChild(newPayerSel);

    const sharesTd = tr.children[4];
    sharesTd.innerHTML = "";
    const newShares = createSharesEditor(oldShares);
    sharesTd.appendChild(newShares);

    const ctrl = document.createElement("div");
    ctrl.className = "d-flex gap-2 align-items-center mt-2";
    ctrl.innerHTML = `
      <button type="button" class="btn btn-outline-secondary btn-sm eq-split">Split equally</button>
      <div class="small text-muted ms-auto sum-indicator">Sum: 0.00 €</div>
    `;
    sharesTd.appendChild(ctrl);

    const updateSum = () => {
      const sum = rowSumCents(newShares);
      ctrl.querySelector(".sum-indicator").textContent = `Sum: ${fromCents(sum)} €`;
      tr.classList.remove("row-error");
    };
    newShares.addEventListener("input", updateSum);
    updateSum();

    ctrl.querySelector(".eq-split").addEventListener("click", () => {
      const amountInput = tr.querySelector(".amount-input");
      const totalCents = toCents(amountInput.value);
      if (!totalCents || PEOPLE.length === 0) return;
      const base = Math.floor(totalCents / PEOPLE.length);
      let remaining = totalCents - base * PEOPLE.length;
      newShares.querySelectorAll(".share-input").forEach((inp, idx, arr) => {
        let c = base;
        if (idx === arr.length - 1) c += remaining;
        inp.value = fromCents(c);
      });
      updateSum();
    });
  });
}

// ========== Events ==========
document.addEventListener("DOMContentLoaded", () => {
  $("#addOneBtn").addEventListener("click", () => {
    const name = trimNonEmpty($("#oneNameInput").value || "");
    if (!name) return;
    PEOPLE = uniq([...PEOPLE, name]);
    $("#oneNameInput").value = "";
    renderPeopleChips(); syncRowsWithPeople(); toggleSteps();
  });

  $("#setNamesBtn").addEventListener("click", () => {
    const names = ($("#namesInput").value || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    PEOPLE = uniq(names);
    renderPeopleChips(); syncRowsWithPeople(); toggleSteps();
  });

  $("#addRowBtn").addEventListener("click", () => addRow());
  $("#sampleBtn").addEventListener("click", () => {
    if (PEOPLE.length === 0) {
      PEOPLE = ["Mohamed", "Jean", "Imen"];
      renderPeopleChips(); toggleSteps();
    }
    $("#txBody").innerHTML = "";
    // Example 1: totals and shares match exactly
    addRow({
      day: "Monday",
      description: "Lunch",
      payer: PEOPLE[0],
      amount: 35,
      shares: { [PEOPLE[0]]: 15, [PEOPLE[1]]: 12, [PEOPLE[2]]: 8 } // 15+12+8=35
    });
    // Example 2:
    addRow({
      day: "Monday",
      description: "Coffee",
      payer: PEOPLE[0],
      amount: 15,
      shares: { [PEOPLE[1]]: 7, [PEOPLE[2]]: 8 } // 7+8=15
    });
    syncRowsWithPeople();
  });

  $("#computeBtn").addEventListener("click", async () => {
    $("#validationAlert").classList.add("d-none");
    $("#validationAlert").textContent = "";

    if (PEOPLE.length === 0) {
      $("#validationAlert").classList.remove("d-none");
      $("#validationAlert").textContent = "Please add at least one person.";
      return;
    }

    let transactions;
    try {
      transactions = readTransactions();
    } catch (e) {
      $("#validationAlert").classList.remove("d-none");
      $("#validationAlert").textContent = e.message;
      return;
    }

    const payload = { people: PEOPLE, transactions };
    const res = await fetch("/.netlify/functions/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      $("#validationAlert").classList.remove("d-none");
      $("#validationAlert").textContent = data.error || "Failed to compute.";
      return;
    }
    renderBalancesTable(data.balances);
    renderTransfers(data.transfers);
    $("#step-results").classList.remove("d-none");
    $("#step-results").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
