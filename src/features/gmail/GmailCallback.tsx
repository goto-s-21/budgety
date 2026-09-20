// src/features/gmail/GmailCallback.tsx
//
// Googleの同意画面から /auth/gmail/callback?code=... にリダイレクトされてきたときに
// 表示するコンポーネント。App.tsx側でURLパスを見てこれを表示する想定。
// (React Routerを使わないApp.tsxの構成に合わせたシンプルな実装)

import { useEffect, useState } from "react";
import { handleGmailOAuthCallback } from "./gmailAuth";

interface Props {
  userId: string;
  onDone: () => void; // 処理完了後、More画面などに戻すためのコールバック
}

export function GmailCallback({ userId, onDone }: Props) {
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");

    if (errorParam) {
      setStatus("error");
      setMessage("Googleの認可がキャンセルされました。");
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("認可コードが見つかりませんでした。");
      return;
    }

    handleGmailOAuthCallback(code, userId).then((result) => {
      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setMessage(result.message || "連携に失敗しました。");
      }
      // URLに残ったcodeパラメータを消しておく(再読み込み時の誤動作防止)
      window.history.replaceState({}, "", "/");
    });
  }, [userId]);

  return (
    <div className="login-screen">
      <div className="brand">
        <span>♥</span>Budgety
      </div>

      {status === "processing" && (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Gmail連携を処理しています...
        </p>
      )}

      {status === "success" && (
        <>
          <p style={{ color: "var(--text)", fontSize: 14 }}>
            Gmail連携が完了しました。
          </p>
          <button className="google-btn" onClick={onDone}>
            戻る
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <p style={{ color: "var(--primary)", fontSize: 14 }}>{message}</p>
          <button className="google-btn" onClick={onDone}>
            戻る
          </button>
        </>
      )}
    </div>
  );
}
