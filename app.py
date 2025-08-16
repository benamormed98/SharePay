from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Any
from decimal import Decimal, ROUND_HALF_UP
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

def d(x) -> Decimal:
    return Decimal(str(x))

def round2(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

@dataclass
class Transaction:
    day: str
    description: str
    payer: str
    amount: Decimal              # total paid for the bill
    shares: Dict[str, Decimal]   # per-person consumed amounts

def compute_balances(people: List[str], transactions: List[Transaction]) -> Dict[str, Dict[str, Decimal]]:
    paid = {p: d(0) for p in people}
    consumed = {p: d(0) for p in people}

    for t in transactions:
        paid[t.payer] += d(t.amount)
        for p in people:
            consumed[p] += round2(d(t.shares.get(p, 0)))

    net = {p: round2(paid[p] - consumed[p]) for p in people}
    return {
        "paid": {k: round2(v) for k, v in paid.items()},
        "consumed": {k: round2(v) for k, v in consumed.items()},
        "net": net
    }

def settle_transfers(net: Dict[str, Decimal]) -> List[Dict[str, Any]]:
    creditors, debtors = [], []
    for person, bal in net.items():
        if bal > 0:
            creditors.append([person, bal])
        elif bal < 0:
            debtors.append([person, -bal])

    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)

    transfers = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        debtor, d_amt = debtors[i]
        creditor, c_amt = creditors[j]
        pay = round2(min(d_amt, c_amt))
        if pay > 0:
            transfers.append({"from": debtor, "to": creditor, "amount": float(pay)})
        d_amt = round2(d_amt - pay)
        c_amt = round2(c_amt - pay)
        debtors[i][1] = d_amt
        creditors[j][1] = c_amt
        if d_amt == 0:
            i += 1
        if c_amt == 0:
            j += 1
    return transfers

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/settle", methods=["POST"])
def api_settle():
    data = request.get_json(silent=True) or {}
    people = data.get("people", [])
    tx_raw = data.get("transactions", [])

    if not people:
        return jsonify({"error": "Please provide at least one person."}), 400

    transactions: List[Transaction] = []
    for idx, t in enumerate(tx_raw, start=1):
        try:
            payer = t["payer"]
            amount = round2(d(t["amount"]))
            shares_in = t.get("shares", {}) or {}
            shares = {p: round2(d(shares_in.get(p, 0))) for p in people}

            if payer not in people:
                return jsonify({"error": f"Row {idx}: payer '{payer}' is not in the people list."}), 400
            if amount <= 0:
                return jsonify({"error": f"Row {idx}: amount must be > 0."}), 400
            if any(v < 0 for v in shares.values()):
                return jsonify({"error": f"Row {idx}: shares must be ≥ 0."}), 400

            total_shares = round2(sum(shares.values(), d(0)))
            if total_shares != amount:
                return jsonify({"error": f"Row {idx}: sum of per-person shares ({float(total_shares):.2f}) "
                                         f"does not equal the total amount ({float(amount):.2f})."}), 400

            transactions.append(Transaction(
                day=t.get("day") or "",
                description=t.get("description") or "",
                payer=payer,
                amount=amount,
                shares=shares
            ))
        except Exception:
            return jsonify({"error": f"Row {idx}: invalid transaction format."}), 400

    balances = compute_balances(people, transactions)
    transfers = settle_transfers(balances["net"])

    def tofloat(m): return {k: float(v) for k, v in m.items()}

    return jsonify({
        "balances": {
            "paid": tofloat(balances["paid"]),
            "consumed": tofloat(balances["consumed"]),
            "net": tofloat(balances["net"])
        },
        "transfers": transfers
    })

if __name__ == "__main__":
    app.run(debug=True)
