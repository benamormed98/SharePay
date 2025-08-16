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

## Deploying to Netlify

Netlify can host the static front end and run the Flask API as a serverless
function. A minimal deployment flow looks like this:

1. **Add Netlify function**
   - Create `netlify/functions/app.py` containing:

     ```python
     from serverless_wsgi import handle_request
     from app import app

     def handler(event, context):
         return handle_request(app, event, context)
     ```

2. **Update dependencies**
   - Append `serverless-wsgi` to `requirements.txt` so Netlify can wrap the
     Flask app.

3. **Configuration**
   - Add a `netlify.toml` file in the project root:

     ```toml
     [build]
       command = "pip install -r requirements.txt"
       functions = "netlify/functions"
       publish = "static"
     ```

4. **Deploy**
   - Sign in at [Netlify](https://www.netlify.com/) and create a *New site from
     Git* pointing to your fork of this repository.
   - Netlify will install dependencies and expose the Flask API at
     `/.netlify/functions/app` while serving the static assets from `static/`.
