# Expense Settler (Flask)

A tiny Flask app to track shared expenses with **dynamic people** and **per-person shares** per transaction.
The app computes balances and a minimal set of transfers to settle up.

## Quick start

```bash
python -m venv venv
# macOS/Linux:
source venv/bin/activate
# Windows (PowerShell):
# .\venv\Scripts\Activate.ps1

pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

## Notes
- Add/remove names anytime; rows update live (payer select + shares grid).
- Each transaction requires shares that sum exactly to the total amount (to cents).
- Click **Split equally** on any row to auto-fill equal shares with cent-accurate remainder.
