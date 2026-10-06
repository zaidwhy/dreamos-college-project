import { useEffect, useState } from "react";
import { fetchPrivacy, type PrivacyReport } from "../api";
import { errorText } from "../openFile";

export function PrivacyPanel() {
  const [report, setReport] = useState<PrivacyReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPrivacy().then(setReport).catch((err) => setError(errorText(err)));
  }, []);

  if (error) return <div className="panel-message bubble-error">{error}</div>;
  if (!report) return <div className="panel-message">Checking configuration...</div>;

  return (
    <div className="privacy-panel">
      <div className={`privacy-verdict ${report.local_only ? "privacy-ok" : "privacy-warn"}`}>
        <div className="privacy-headline">
          {report.local_only
            ? "Nothing leaves this computer"
            : "Warning: your data can leave this computer"}
        </div>
        <div className="card-snippet">
          {report.local_only
            ? "Every service DreamOS talks to runs on this machine (loopback address). Your files, questions and answers are not sent anywhere."
            : "At least one service is on another machine. Files or questions may be sent there."}
        </div>
      </div>

      <div className="section-label">Where DreamOS sends requests</div>
      <div className="card-grid">
        {report.endpoints.map((e) => (
          <div className="card" key={e.url}>
            <div className="card-title">{e.name}</div>
            <div className="card-meta">
              <span className={`pill ${e.is_loopback ? "pill-ok" : "pill-warn"}`}>
                {e.is_loopback ? "this computer only" : "another computer"}
              </span>
            </div>
            <div className="card-snippet">Used for: {e.used_for}.</div>
            <div className="card-path">{e.url}</div>
          </div>
        ))}
      </div>

      <div className="section-label section-gap">What is stored, and where</div>
      <ul className="plain-list">
        {report.stored_locally.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <div className="card-path">Vault: {report.vault_folder}</div>
      <div className="card-path">App data: {report.app_data_folder}</div>

      <div className="status-muted section-gap">{report.not_verified_by_this_report}</div>
    </div>
  );
}
