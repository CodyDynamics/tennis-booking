/** Escape untrusted text for HTML email bodies. */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface MailLayoutOptions {
  title: string;
  /** Main HTML (trusted or pre-escaped fragments). */
  bodyHtml: string;
  /** Optional footer block (HTML). */
  footerHtml?: string;
}

/**
 * Shared wrapper for transactional emails: title + body + optional footer.
 */
export function renderMailLayout(opts: MailLayoutOptions): string {
  const footer =
    opts.footerHtml?.trim() ??
    `<p style="margin:0;color:#64748b;font-size:13px;">This message was sent by your tennis booking app.</p>`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td>
              <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${escapeHtml(opts.title)}</h1>
              <div style="color:#334155;font-size:15px;line-height:1.55;">${opts.bodyHtml}</div>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <div style="color:#64748b;font-size:13px;line-height:1.5;">${footer}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
