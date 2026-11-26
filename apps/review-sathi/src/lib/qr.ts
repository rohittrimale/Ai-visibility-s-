import QRCode from "qrcode";

/** QR code as an SVG string. High error correction so it still scans when printed small or slightly damaged. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "H", margin: 1, color: { dark: "#1c1917", light: "#ffffff" } });
}
