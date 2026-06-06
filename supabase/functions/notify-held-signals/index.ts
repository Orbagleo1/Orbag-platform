// Orbag Intelligence — held-signal email alert
// Reads the latest apply_intelligence_updates() run from intelligence_apply_log and,
// if any signals were held (guardrail-blocked outliers), emails an alert via Resend.
// Config via env: RESEND_API_KEY (secret, required to send), ALERT_TO, ALERT_FROM.
// Invoked daily at 04:50 UTC by pg_cron job 'orbag-intelligence-notify-daily'.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ALERT_TO = Deno.env.get('ALERT_TO') ?? 'leojansen@orbag.nl';
const ALERT_FROM = Deno.env.get('ALERT_FROM') ?? 'Orbag Intelligence <alerts@orbag.nl>';

const dbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (_req: Request) => {
  // 1) Latest apply run from the audit log
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/intelligence_apply_log?select=*&order=ran_at.desc&limit=1`,
    { headers: dbHeaders },
  );
  if (!r.ok) return json({ ok: false, error: `log query failed ${r.status}` }, 500);

  const rows: any[] = await r.json();
  const run = rows[0];
  if (!run) return json({ ok: true, skipped: 'no apply runs yet' });

  const held = Number(run.held ?? 0);
  if (held === 0) return json({ ok: true, held: 0, emailed: false, note: 'nothing held' });

  if (!RESEND_API_KEY) {
    return json({
      ok: false, held, emailed: false,
      error: 'RESEND_API_KEY not set — set it as a Supabase secret to enable email.',
    });
  }

  // 2) Build the alert email
  const details: any[] = Array.isArray(run.held_details) ? run.held_details : [];
  const rowsHtml = details.map((d) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${d.country ?? ''}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${d.signal_type ?? ''}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee"><code>${d.field_path ?? ''}</code></td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${d.current_value ?? ''} &rarr; <b>${d.suggested_value ?? ''}</b> (${d.delta_pct ?? ''}%)</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${d.reason ?? ''}</td>
    </tr>`).join('');

  const plural = held > 1 ? 's' : '';
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:680px;color:#0F1A14">
      <h2 style="color:#14302B">⚠ Orbag intelligence: ${held} signal${plural} held back</h2>
      <p>The automatic apply step (${run.ran_at}) did <b>not</b> apply ${held} signal${plural} because they hit a guardrail. Please review manually:</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead><tr style="text-align:left;color:#5A6862">
          <th style="padding:6px 10px">Country</th><th style="padding:6px 10px">Signal</th>
          <th style="padding:6px 10px">Benchmark</th><th style="padding:6px 10px">Proposed</th>
          <th style="padding:6px 10px">Reason</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="color:#5A6862;font-size:13px">To accept after review: set the signal to <code>approved</code> and run <code>select apply_intelligence_updates();</code>, or adjust the benchmark directly in <code>intelligence_benchmarks</code>.</p>
    </div>`;

  // 3) Send via Resend
  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: ALERT_FROM,
      to: [ALERT_TO],
      subject: `⚠ Orbag: ${held} intelligence signal${plural} held back`,
      html,
    }),
  });
  const sendBody = await send.text();
  if (!send.ok) {
    return json({ ok: false, held, emailed: false, resend_status: send.status, resend_body: sendBody });
  }
  return json({ ok: true, held, emailed: true, to: ALERT_TO });
});
