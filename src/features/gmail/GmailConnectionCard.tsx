import { useEffect, useState } from "react";
import {
  getGmailConnectionStatus,
  redirectToGoogleConsent,
  revokeGmailConnection,
  type GmailConnectionStatus,
} from "./gmailAuth";

interface Props {
  userId: string;
}

export function GmailConnectionCard({ userId }: Props) {
  const [status, setStatus] = useState<GmailConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getGmailConnectionStatus(userId)
      .then((s) => {
        console.log("[GmailConnectionCard] status result:", s);
        if (mounted) {
          setStatus(s);
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleConnect = () => {
    redirectToGoogleConsent();
  };

  const handleDisconnect = async () => {
    await revokeGmailConnection(userId);
    setStatus((prev) =>
      prev ? { ...prev, connected: false, status: "revoked" } : prev,
    );
  };

  const isConnected = status?.connected;
  const isExpiringSoon =
    isConnected &&
    status?.daysUntilExpiry !== null &&
    status !== null &&
    status.daysUntilExpiry !== null &&
    status.daysUntilExpiry <= 1;

  let subText = "利用通知の自動取得（GitHub Actions経由）";
  if (!loading && isConnected && status?.connectedAt) {
    const connectedDate = new Date(status.connectedAt).toLocaleDateString(
      "ja-JP",
    );
    subText = `連携中（連携日: ${connectedDate}）`;
  }

  return (
    <>
      <button
        className="spend-row"
        style={{ width: "100%", textAlign: "left", background: "none" }}
        onClick={isConnected ? undefined : handleConnect}
        disabled={loading}
      >
        <div className="icon">✉️</div>
        <div className="grow">
          <div className="name">Gmail連携</div>
          <div className="sub">{subText}</div>
        </div>
        {!isConnected && <span>›</span>}
      </button>

      {isExpiringSoon && (
        <div
          className="sub"
          style={{
            color: "var(--primary)",
            padding: "0 16px 8px",
          }}
        >
          連携の有効期限が近づいています。再連携してください。
        </div>
      )}

      {isConnected && (
        <div style={{ padding: "0 16px 12px", display: "flex", gap: 8 }}>
          <button
            className="secondary"
            style={{ flex: 1 }}
            onClick={handleConnect}
          >
            再連携する
          </button>
          <button
            className="secondary"
            style={{ flex: 1 }}
            onClick={handleDisconnect}
          >
            連携を解除
          </button>
        </div>
      )}
    </>
  );
}
