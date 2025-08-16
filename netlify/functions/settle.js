// netlify/functions/settle.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const data = JSON.parse(event.body || "{}");
    const people = data.people || [];
    const txs = data.transactions || [];

    if (!people.length) {
      return json(400, { error: "Please provide at least one person." });
    }

    // helpers
    const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

    // Validate + normalize
    const paid = Object.fromEntries(people.map(p => [p, 0]));
    const consumed = Object.fromEntries(people.map(p => [p, 0]));

    for (let i = 0; i < txs.length; i++) {
      const t = txs[i];
      const row = i + 1;

      const payer = t.payer;
      const amount = round2(t.amount);
      const sharesIn = t.shares || {};
      const shares = Object.fromEntries(people.map(p => [p, round2(sharesIn[p] || 0)]));

      if (!people.includes(payer)) return json(400, { error: `Row ${row}: payer '${payer}' is not in the people list.` });
      if (amount <= 0) return json(400, { error: `Row ${row}: amount must be > 0.` });
      if (Object.values(shares).some(v => v < 0)) return json(400, { error: `Row ${row}: shares must be ≥ 0.` });

      const totalShares = round2(Object.values(shares).reduce((a, b) => a + b, 0));
      if (totalShares !== amount) {
        return json(400, { error: `Row ${row}: sum of per-person shares (${totalShares.toFixed(2)}) does not equal the total amount (${amount.toFixed(2)}).` });
      }

      paid[payer] = round2(paid[payer] + amount);
      people.forEach(p => consumed[p] = round2(consumed[p] + shares[p]));
    }

    // net = paid - consumed
    const net = Object.fromEntries(people.map(p => [p, round2(paid[p] - consumed[p])]));

    // Greedy settlement
    const creditors = [];
    const debtors = [];
    for (const p of people) {
      const bal = net[p];
      if (bal > 0) creditors.push([p, bal]);
      else if (bal < 0) debtors.push([p, -bal]);
    }
    creditors.sort((a,b)=>b[1]-a[1]); debtors.sort((a,b)=>b[1]-a[1]);

    const transfers = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const [debtor, dAmt] = debtors[i];
      const [creditor, cAmt] = creditors[j];
      const pay = round2(Math.min(dAmt, cAmt));
      if (pay > 0) transfers.push({ from: debtor, to: creditor, amount: pay });
      const newD = round2(dAmt - pay);
      const newC = round2(cAmt - pay);
      debtors[i][1] = newD; creditors[j][1] = newC;
      if (newD === 0) i++;
      if (newC === 0) j++;
    }

    return json(200, {
      balances: { paid, consumed, net },
      transfers
    });
  } catch (err) {
    return json(500, { error: "Server error", detail: String(err) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
