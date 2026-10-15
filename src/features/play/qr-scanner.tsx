"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { roomCodeFromQr } from "./room-code";
import { ErrorMessage } from "@/shared/ui/status";
export function QrScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null),
    active = useRef(true),
    dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    active.current = true;
    dialog.current?.showModal();
    return () => {
      active.current = false;
      controls.current?.stop();
    };
  }, []);
  function accept(value: string) {
    const code = roomCodeFromQr(value);
    if (!code) {
      setMessage("QR này không có mã phòng hợp lệ.");
      return;
    }
    controls.current?.stop();
    onCode(code);
    onClose();
  }
  async function camera() {
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage(
        "Bạn có thể dùng camera điện thoại để quét, hoặc chọn ảnh QR bên dưới.",
      );
      return;
    }
    setBusy(true);
    try {
      controls.current?.stop();
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const { DecodeHintType } = await import("@zxing/library");
      const reader = new BrowserQRCodeReader(
        new Map([[DecodeHintType.TRY_HARDER, true]]),
      );
      const control = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        video.current!,
        (result) => {
          if (result && active.current) accept(result.getText());
        },
      );
      if (active.current) controls.current = control;
      else control.stop();
    } catch {
      if (active.current)
        setMessage("Chưa mở được camera. Hãy cấp quyền hoặc chọn ảnh QR.");
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function image(file?: File) {
    if (!file) return;
    setMessage("");
    setBusy(true);
    controls.current?.stop();
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const { DecodeHintType } = await import("@zxing/library");
      let result;
      try {
        result = await new BrowserQRCodeReader(
          new Map([[DecodeHintType.TRY_HARDER, true]]),
        ).decodeFromImageUrl(url);
      } catch {
        result = await new BrowserQRCodeReader(
          new Map([[DecodeHintType.PURE_BARCODE, true]]),
        ).decodeFromImageUrl(url);
      }
      if (active.current) accept(result.getText());
    } catch {
      if (active.current)
        setMessage("Chưa đọc được mã QR trong ảnh. Thử ảnh rõ hơn.");
    } finally {
      URL.revokeObjectURL(url);
      if (active.current) setBusy(false);
    }
  }
  return (
    <dialog className="qr-dialog" ref={dialog} onCancel={onClose}>
      <div className="scanner-heading">
        <h2>Quét mã phòng</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng quét QR"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        aria-label="Camera quét QR"
      />
      <ErrorMessage message={message} />
      <button
        className="button primary"
        type="button"
        disabled={busy}
        onClick={camera}
      >
        <Camera size={17} />
        {busy ? "Đang đọc…" : "Mở camera"}
      </button>
      <label className="button secondary scanner-file">
        <ImagePlus size={17} /> Chọn ảnh QR
        <input
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Ảnh mã QR"
          disabled={busy}
          onChange={(e) => image(e.target.files?.[0])}
        />
      </label>
    </dialog>
  );
}
