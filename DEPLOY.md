# Orbag platform — deploy in one day
# Follow these steps exactly. Each one takes 5–15 minutes.

## What you will have at the end
- A live URL (e.g. orbag.vercel.app) you can share with any buyer
- Every report saved automatically to a database
- A visual dashboard where you can see all submissions
- Your API key hidden safely on the server — never visible to users

---

## Step 1 — Create a Supabase database (10 minutes)

1. Go to supabase.com and click "Start your project"
2. Sign up with GitHub or email
3. Click "New project"
   - Name: orbag
   - Database password: choose something strong and SAVE IT
   - Region: West EU (Ireland) — closest to Netherlands
   - Click "Create new project" and wait ~2 minutes
4. Once ready, go to the left sidebar → "SQL Editor"
5. Paste the entire contents of supabase_setup.sql into the editor
6. Click "Run" — you should see "Success. No rows returned"
7. Now go to Settings (bottom left gear icon) → API
8. Copy and save TWO values:
   - "Project URL" → looks like https://xxxxxxxxxxxx.supabase.co
   - "anon public" key → long string starting with eyJ...
   You will need both in Step 3.

---

## Step 2 — Create a Vercel account (5 minutes)

1. Go to vercel.com and click "Sign Up"
2. Sign up with GitHub (easiest) — create a free GitHub account first if needed
3. Once in the Vercel dashboard, you are ready for Step 3

---

## Step 3 — Deploy the platform (10 minutes)

1. Go to vercel.com/new
2. Click "Browse" or drag the entire orbag-platform folder onto the page
   (the folder contains: index.html, vercel.json, api/generate.js, supabase_setup.sql)
3. Vercel detects it automatically — click "Deploy"
4. Wait ~1 minute for the first deploy to finish
5. You will get a URL like orbag-xxxx.vercel.app — this is your live site

---

## Step 4 — Add your secret keys (5 minutes)

This is the most important step — this is what keeps your API key hidden.

1. In Vercel, go to your project → Settings → Environment Variables
2. Add these three variables one by one:

   Name: ANTHROPIC_API_KEY
   Value: your Anthropic key (sk-ant-api03-...)
   Environment: Production, Preview, Development (tick all three)

   Name: SUPABASE_URL
   Value: your Supabase Project URL from Step 1 (https://xxxx.supabase.co)
   Environment: tick all three

   Name: SUPABASE_KEY
   Value: your Supabase anon public key from Step 1 (eyJ...)
   Environment: tick all three

3. Click Save for each one
4. Go to Deployments → click the three dots on the latest deploy → Redeploy
   (This restarts the server with your new keys)

---

## Step 5 — Test it (2 minutes)

1. Open your orbag-xxxx.vercel.app URL
2. Fill in the form and click Generate
3. Wait ~10 seconds for the report to appear
4. Go to supabase.com → your project → Table Editor → reports
5. You should see a new row with the submission — company, crop, verdict, everything

---

## Step 6 — Add a custom domain (optional, 10 minutes)

If you want orbag.nl instead of orbag-xxxx.vercel.app:
1. Buy the domain at transip.nl or versio.nl (~€10/year)
2. In Vercel → your project → Settings → Domains → Add domain
3. Follow the DNS instructions Vercel gives you
4. Takes 5–30 minutes to activate

---

## How to see your database (ongoing)

Go to supabase.com → your project → Table Editor → reports

You can:
- See every report that was generated
- Filter by company, crop, verdict
- Edit any row directly
- Export everything to CSV with one click
- See the full JSON input and output for any report

---

## How to make changes to the demo

To change text, add crops, or edit the form:
1. Open index.html in a text editor (Notepad works, VS Code is better)
2. Make your changes
3. Drag the updated orbag-platform folder back to vercel.com/new
4. Redeploy — takes 1 minute

To change what the AI generates:
1. Open api/generate.js in a text editor
2. Find the buildPrompt function
3. Edit the instructions — add Dutch benchmark prices, change the output format, etc.
4. Redeploy

---

## Cost

Vercel free tier: 100GB bandwidth/month, 100 deployments/month — more than enough
Supabase free tier: 500MB database, 50,000 rows — enough for hundreds of reports
Anthropic API: ~€0.01 per report (one cent) with claude-sonnet-4-6

Total monthly cost for the demo phase: €0 platform + a few cents per report

---

## If something goes wrong

1. Go to Vercel → your project → Deployments → click the latest → Functions
2. Click on api/generate.js → you can see error logs here
3. Most common issues:
   - ANTHROPIC_API_KEY not set → go back to Step 4
   - Supabase URL wrong → check for trailing slash (remove it)
   - "Model not found" → check api/generate.js has claude-sonnet-4-6
