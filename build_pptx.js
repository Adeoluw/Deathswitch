const pptxgen = require("pptxgenjs");

const BG = "0B0F0E";       // near-black background
const CARD = "121A18";     // card background
const CARD2 = "1A2422";
const GREEN = "2ED573";    // accent green
const GREEN_DIM = "1B8A4A";
const RED = "FF3B5C";
const TEXT = "EAF5EF";
const MUTED = "8FA59C";
const PURPLE = "8B6BFF";
const GOLD = "FFB347";

let pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "DeathSwitch";
pres.title = "DeathSwitch — Frontend Overview";

function baseSlide() {
  let s = pres.addSlide();
  s.background = { color: BG };
  return s;
}

function header(s, title, subtitle) {
  s.addText(title, { x: 0.6, y: 0.35, w: 12, h: 0.7, fontSize: 30, bold: true, color: TEXT, fontFace: "Trebuchet MS", margin: 0 });
  if (subtitle) {
    s.addText(subtitle, { x: 0.6, y: 0.95, w: 12, h: 0.4, fontSize: 14, color: MUTED, fontFace: "Calibri", margin: 0 });
  }
}

function pill(s, text, x, y, w, color, textColor) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.32, rectRadius: 0.06, fill: { color }, line: { color: "FFFFFF", width: 0 } });
  s.addText(text, { x, y, w, h: 0.32, fontSize: 11, bold: true, color: textColor, align: "center", valign: "middle", margin: 0 });
}

// ---------------- Slide 1: Title ----------------
{
  let s = baseSlide();
  // EKG accent line motif
  s.addShape(pres.shapes.LINE, { x: 0, y: 3.6, w: 13.3, h: 0, line: { color: GREEN_DIM, width: 1, dashType: "dash" } });
  s.addText([
    { text: "DeathSwitch", options: { color: GREEN, bold: true } },
  ], { x: 0.8, y: 2.1, w: 11, h: 1, fontSize: 54, fontFace: "Trebuchet MS", margin: 0 });
  s.addText("On-Chain Crypto Inheritance — Frontend Walkthrough", {
    x: 0.8, y: 3.0, w: 11, h: 0.6, fontSize: 20, color: TEXT, fontFace: "Calibri", margin: 0,
  });
  s.addText("Mantle Sepolia Testnet  •  Dashboard, Beneficiaries, Assets, Deposits & Settings", {
    x: 0.8, y: 3.75, w: 11, h: 0.5, fontSize: 13, color: MUTED, fontFace: "Calibri", margin: 0,
  });
  // small heartbeat icon shapes
  for (let i = 0; i < 5; i++) {
    s.addShape(pres.shapes.OVAL, { x: 0.8 + i * 0.35, y: 4.6, w: 0.12, h: 0.12, fill: { color: GREEN, transparency: i * 15 } });
  }
}

// ---------------- Slide 2: Connect Screen ----------------
{
  let s = baseSlide();
  header(s, "Connect Screen", "First touchpoint — wallet-based authentication via SIWE (Sign-In With Ethereum)");

  // mockup card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.15, y: 1.6, w: 5, h: 3.4, rectRadius: 0.08, fill: { color: CARD }, line: { color: "23302C", width: 1 } });
  s.addText("DeathSwitch", { x: 4.15, y: 1.95, w: 5, h: 0.5, fontSize: 22, bold: true, color: GREEN, align: "center", margin: 0 });
  // EKG line
  s.addShape(pres.shapes.LINE, { x: 4.65, y: 2.7, w: 4, h: 0, line: { color: GREEN, width: 2 } });
  s.addText("Connect your wallet to access your DeathSwitch", { x: 4.4, y: 2.95, w: 4.5, h: 0.4, fontSize: 12, color: MUTED, align: "center", margin: 0 });
  pill(s, "MetaMask / Rabby / Any Wallet", 4.9, 3.55, 3.4, GREEN, "0B0F0E");
  s.addText("Don't have a wallet?  Download Rabby or MetaMask", { x: 4.4, y: 4.15, w: 4.5, h: 0.4, fontSize: 10, color: MUTED, align: "center", margin: 0 });

  // bullets
  s.addText([
    { text: "No passwords — auth is a wallet signature (SIWE) verified server-side into a JWT", options: { bullet: true, breakLine: true } },
    { text: "Detects MetaMask / Rabby / injected EIP-1193 providers automatically", options: { bullet: true, breakLine: true } },
    { text: "Auto-prompts a network switch to Mantle Sepolia (chain ID 5003)", options: { bullet: true } },
  ], { x: 0.6, y: 5.2, w: 12, h: 1.2, fontSize: 13, color: TEXT, fontFace: "Calibri", paraSpaceAfter: 4, margin: 0 });
}

// ---------------- Slide 3: Dashboard (Active) ----------------
{
  let s = baseSlide();
  header(s, "Dashboard — Active Switch", "Real-time heartbeat status, countdown, and beneficiary summary");

  // stat cards
  const stats = [
    { label: "STATUS", value: "ACTIVE", color: GREEN },
    { label: "ESCALATION STAGE", value: "0 / 4", color: GOLD },
    { label: "BENEFICIARIES", value: "2", color: PURPLE },
  ];
  stats.forEach((st, i) => {
    const x = 0.6 + i * 2.55;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.55, w: 2.35, h: 1.1, rectRadius: 0.08, fill: { color: CARD }, line: { color: "23302C", width: 1 } });
    s.addText(st.label, { x: x + 0.18, y: 1.65, w: 2, h: 0.3, fontSize: 9, color: MUTED, margin: 0 });
    s.addText(st.value, { x: x + 0.18, y: 1.95, w: 2, h: 0.5, fontSize: 22, bold: true, color: st.color, margin: 0 });
  });

  // check-in timer card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 2.85, w: 7.6, h: 1.9, rectRadius: 0.08, fill: { color: CARD }, line: { color: "23302C", width: 1 } });
  s.addText("CHECK-IN TIMER", { x: 0.8, y: 2.98, w: 4, h: 0.3, fontSize: 9, color: MUTED, margin: 0 });
  s.addText("4d 12h 36m", { x: 0.8, y: 3.25, w: 4, h: 0.6, fontSize: 32, bold: true, color: GREEN, margin: 0 });
  // EKG waveform line
  s.addShape(pres.shapes.LINE, { x: 0.8, y: 4.35, w: 7.2, h: 0, line: { color: GREEN, width: 2 } });
  // progress bar
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 4.5, w: 7.2, h: 0.12, rectRadius: 0.06, fill: { color: "23302C" } });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 4.5, w: 5.0, h: 0.12, rectRadius: 0.06, fill: { color: GREEN } });

  // beneficiaries summary card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.4, y: 1.55, w: 4.3, h: 3.2, rectRadius: 0.08, fill: { color: CARD }, line: { color: "23302C", width: 1 } });
  s.addText("BENEFICIARIES", { x: 8.6, y: 1.7, w: 3, h: 0.3, fontSize: 9, color: MUTED, margin: 0 });
  s.addText("Manage →", { x: 11.4, y: 1.7, w: 1.1, h: 0.3, fontSize: 10, color: GREEN, align: "right", margin: 0 });
  ["Son", "Wife"].forEach((name, i) => {
    const y = 2.15 + i * 1.2;
    s.addShape(pres.shapes.OVAL, { x: 8.6, y, w: 0.5, h: 0.5, fill: { color: GREEN_DIM } });
    s.addText(name.substring(0, 2).toUpperCase(), { x: 8.6, y, w: 0.5, h: 0.5, fontSize: 12, bold: true, color: TEXT, align: "center", valign: "middle", margin: 0 });
    s.addText(name, { x: 9.25, y: y + 0.02, w: 2, h: 0.3, fontSize: 13, bold: true, color: TEXT, margin: 0 });
    s.addText("50% allocation", { x: 9.25, y: y + 0.32, w: 3, h: 0.3, fontSize: 11, color: GREEN, margin: 0 });
  });

  // bullets
  s.addText([
    { text: "Live countdown to the next required check-in (heartbeat)", options: { bullet: true, breakLine: true } },
    { text: "EKG-style waveform animates while the switch is active", options: { bullet: true, breakLine: true } },
    { text: "One-click Check-In button resets the on-chain timer", options: { bullet: true } },
  ], { x: 0.6, y: 4.95, w: 12, h: 1.2, fontSize: 13, color: TEXT, fontFace: "Calibri", paraSpaceAfter: 4, margin: 0 });
}

// ---------------- Slide 4: Beneficiaries ----------------
{
  let s = baseSlide();
  header(s, "Beneficiaries", "Add wallets, set allocation percentages, and manage who inherits the assets");

  // Add form card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.55, w: 5.7, h: 3.6, rectRadius: 0.08, fill: { color: CARD }, line: { color: "23302C", width: 1 } });
  s.addText("ADD BENEFICIARY", { x: 0.85, y: 1.75, w: 4, h: 0.3, fontSize: 10, color: MUTED, margin: 0 });
  ["Wallet Address", "Label (e.g. \"Son\")", "Allocation %"].forEach((ph, i) => {
    const y = 2.2 + i * 0.65;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.85, y, w: 5.2, h: 0.45, rectRadius: 0.05, fill: { color: CARD2 }, line: { color: "2A3835", width: 1 } });
    s.addText(ph, { x: 1.05, y, w: 4.5, h: 0.45, fontSize: 11, color: MUTED, valign: "middle", margin: 0 });
  });
  pill(s, "+ Add Beneficiary", 0.85, 4.35, 5.2, GREEN, "0B0F0E");
  s.addText("100% allocated  ✓", { x: 0.85, y: 4.85, w: 5.2, h: 0.3, fontSize: 11, bold: true, color: GREEN, align: "center", margin: 0 });

  // current beneficiaries list
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.5, y: 1.55, w: 6.2, h: 3.6, rectRadius: 0.08, fill: { color: CARD }, line: { color: "23302C", width: 1 } });
  s.addText("CURRENT BENEFICIARIES", { x: 6.75, y: 1.75, w: 4, h: 0.3, fontSize: 10, color: MUTED, margin: 0 });
  [["Son", "0xAb12...e93F", "50%"], ["Wife", "0x44Cd...10B2", "50%"]].forEach((row, i) => {
    const y = 2.2 + i * 1.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.75, y, w: 5.7, h: 0.85, rectRadius: 0.06, fill: { color: CARD2 }, line: { color: "2A3835", width: 1 } });
    s.addShape(pres.shapes.OVAL, { x: 6.95, y: y + 0.18, w: 0.5, h: 0.5, fill: { color: GREEN_DIM } });
    s.addText(row[0].substring(0, 2).toUpperCase(), { x: 6.95, y: y + 0.18, w: 0.5, h: 0.5, fontSize: 11, bold: true, color: TEXT, align: "center", valign: "middle", margin: 0 });
    s.addText(row[0], { x: 7.6, y: y + 0.08, w: 2.5, h: 0.3, fontSize: 13, bold: true, color: TEXT, margin: 0 });
    s.addText(row[1], { x: 7.6, y: y + 0.4, w: 2.5, h: 0.3, fontSize: 10, color: MUTED, margin: 0 });
    s.addText(row[2], { x: 10, y: y + 0.08, w: 1, h: 0.3, fontSize: 16, bold: true, color: GREEN, align: "right", margin: 0 });
    pill(s, "Edit", 11.05, y + 0.45, 0.6, "2A3835", TEXT);
    pill(s, "Remove", 11.7, y + 0.45, 0.7, "3A1F26", RED);
  });
  s.addText("⚠ Force Remove By Address — danger-zone tool for stuck/invalid entries", { x: 6.75, y: 4.45, w: 5.7, h: 0.5, fontSize: 10, color: MUTED, italic: true, margin: 0 });

  s.addText([
    { text: "Allocation badge turns green only when basis points sum to exactly 100% — required for the contract's trigger() to succeed", options: { bullet: true } },
  ], { x: 0.6, y: 5.25, w: 12, h: 0.6, fontSize: 13, color: TEXT, fontFace: "Calibri", margin: 0 });
}

// ---------------- Slide 5: Assets & Deposit ----------------
{
  let s = baseSlide();
  header(s, "Asset Portfolio & Deposits", "View on-chain holdings and add funds with the new Deposit flow");

  // total value card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.55, w: 7.6, h: 1.3, rectRadius: 0.08, fill: { color: "0E2A1C" }, line: { color: GREEN_DIM, width: 1 } });
  s.addText("TOTAL PORTFOLIO VALUE", { x: 0.85, y: 1.7, w: 4, h: 0.3, fontSize: 10, color: GREEN, margin: 0 });
  s.addText("$1,284.52", { x: 0.85, y: 2.0, w: 4, h: 0.7, fontSize: 30, bold: true, color: GREEN, margin: 0 });
  pill(s, "↓ Deposit", 6.4, 1.85, 1.6, GREEN, "0B0F0E");

  // holdings list
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 3.0, w: 7.6, h: 2.2, rectRadius: 0.08, fill: { color: CARD }, line: { color: "23302C", width: 1 } });
  s.addText("HOLDINGS", { x: 0.85, y: 3.15, w: 3, h: 0.3, fontSize: 10, color: MUTED, margin: 0 });
  [["MNT", "Mantle (native)", "842.10 MNT", "$924.83"],
   ["USDC", "USD Coin", "250.00 USDC", "$250.00"],
   ["wBTC", "Wrapped Bitcoin", "0.0015 wBTC", "$109.69"]].forEach((row, i) => {
    const y = 3.55 + i * 0.5;
    s.addText(row[0], { x: 0.85, y, w: 1.5, h: 0.3, fontSize: 13, bold: true, color: TEXT, margin: 0 });
    s.addText(row[1], { x: 0.85, y: y + 0.2, w: 2.5, h: 0.25, fontSize: 9, color: MUTED, margin: 0 });
    s.addText(row[2], { x: 5.4, y, w: 2.6, h: 0.3, fontSize: 13, bold: true, color: TEXT, align: "right", margin: 0 });
    s.addText(row[3], { x: 5.4, y: y + 0.2, w: 2.6, h: 0.25, fontSize: 9, color: MUTED, align: "right", margin: 0 });
  });

  // Deposit modal mockup
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.6, y: 1.55, w: 4.1, h: 3.65, rectRadius: 0.08, fill: { color: CARD }, line: { color: GREEN_DIM, width: 1.5 } });
  s.addText("⬇ Deposit Assets", { x: 8.85, y: 1.7, w: 3.6, h: 0.35, fontSize: 14, bold: true, color: TEXT, margin: 0 });
  pill(s, "MANTLE SEPOLIA TESTNET", 8.85, 2.1, 2.6, "3A2A12", GOLD);
  s.addText("ASSET", { x: 8.85, y: 2.55, w: 3.6, h: 0.25, fontSize: 9, color: MUTED, margin: 0 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.85, y: 2.8, w: 3.6, h: 0.4, rectRadius: 0.05, fill: { color: CARD2 }, line: { color: "2A3835", width: 1 } });
  s.addText("◆  MNT (native)", { x: 9.0, y: 2.8, w: 3.4, h: 0.4, fontSize: 11, color: TEXT, valign: "middle", margin: 0 });
  s.addText("AMOUNT", { x: 8.85, y: 3.35, w: 3.6, h: 0.25, fontSize: 9, color: MUTED, margin: 0 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.85, y: 3.6, w: 3.6, h: 0.4, rectRadius: 0.05, fill: { color: CARD2 }, line: { color: "2A3835", width: 1 } });
  s.addText("0.00", { x: 9.0, y: 3.6, w: 2.6, h: 0.4, fontSize: 11, color: MUTED, valign: "middle", margin: 0 });
  pill(s, "MAX", 11.85, 3.7, 0.5, "2A3835", GREEN);
  s.addText("Wallet balance: 1,000.00 MNT", { x: 8.85, y: 4.05, w: 3.6, h: 0.25, fontSize: 9, color: MUTED, margin: 0 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.85, y: 4.35, w: 3.6, h: 0.55, rectRadius: 0.05, fill: { color: GREEN } });
  s.addText("↓ Deposit", { x: 8.85, y: 4.35, w: 3.6, h: 0.55, fontSize: 13, bold: true, color: "0B0F0E", align: "center", valign: "middle", margin: 0 });

  s.addText([
    { text: "New: simple Deposit modal — pick an asset, enter an amount (or tap MAX), and confirm", options: { bullet: true, breakLine: true } },
    { text: "Handles native MNT (depositNative) and ERC-20 tokens (approve → depositERC20) automatically", options: { bullet: true, breakLine: true } },
    { text: "Clearly labeled \"Mantle Sepolia Testnet\" so users know which network they're on", options: { bullet: true } },
  ], { x: 0.6, y: 5.25, w: 12, h: 1.0, fontSize: 12, color: TEXT, fontFace: "Calibri", paraSpaceAfter: 3, margin: 0 });
}

// ---------------- Slide 6: Settings ----------------
{
  let s = baseSlide();
  header(s, "Settings", "Configure heartbeat schedule, alert channels, and account options");

  // schedule card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.55, w: 6.0, h: 3.6, rectRadius: 0.08, fill: { color: CARD }, line: { color: "23302C", width: 1 } });
  s.addText("⏱  CHECK-IN SCHEDULE", { x: 0.85, y: 1.75, w: 4, h: 0.3, fontSize: 11, bold: true, color: GREEN, margin: 0 });
  s.addText("How often you must check in to prove you're alive. Missing the deadline starts the grace period.", { x: 0.85, y: 2.1, w: 5.5, h: 0.6, fontSize: 10, color: MUTED, margin: 0 });
  s.addText("CHECK-IN INTERVAL", { x: 0.85, y: 2.75, w: 3, h: 0.25, fontSize: 9, color: MUTED, margin: 0 });
  ["7 Days", "0 Hours", "0 Minutes"].forEach((v, i) => {
    const x = 0.85 + i * 1.85;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.0, w: 1.7, h: 0.45, rectRadius: 0.05, fill: { color: CARD2 }, line: { color: "2A3835", width: 1 } });
    s.addText(v, { x, y: 3.0, w: 1.7, h: 0.45, fontSize: 11, color: TEXT, align: "center", valign: "middle", margin: 0 });
  });
  s.addText("GRACE PERIOD", { x: 0.85, y: 3.6, w: 3, h: 0.25, fontSize: 9, color: MUTED, margin: 0 });
  ["3 Days", "0 Hours", "0 Minutes"].forEach((v, i) => {
    const x = 0.85 + i * 1.85;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.85, w: 1.7, h: 0.45, rectRadius: 0.05, fill: { color: CARD2 }, line: { color: "2A3835", width: 1 } });
    s.addText(v, { x, y: 3.85, w: 1.7, h: 0.45, fontSize: 11, color: TEXT, align: "center", valign: "middle", margin: 0 });
  });
  pill(s, "Update Schedule", 0.85, 4.5, 5.5, GREEN, "0B0F0E");

  // notifications + danger zone
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.9, y: 1.55, w: 5.8, h: 1.65, rectRadius: 0.08, fill: { color: CARD }, line: { color: "23302C", width: 1 } });
  s.addText("⚠  ALERT CHANNELS", { x: 7.15, y: 1.75, w: 4, h: 0.3, fontSize: 11, bold: true, color: GOLD, margin: 0 });
  s.addText("Email & phone number for overdue check-in escalation (Stages 1–3)", { x: 7.15, y: 2.1, w: 5.3, h: 0.4, fontSize: 10, color: MUTED, margin: 0 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.15, y: 2.6, w: 5.3, h: 0.4, rectRadius: 0.05, fill: { color: CARD2 }, line: { color: "2A3835", width: 1 } });
  s.addText("you@example.com", { x: 7.3, y: 2.6, w: 4, h: 0.4, fontSize: 10, color: MUTED, valign: "middle", margin: 0 });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.9, y: 3.35, w: 5.8, h: 1.8, rectRadius: 0.08, fill: { color: "2A1217" }, line: { color: RED, width: 1 } });
  s.addText("💀  DANGER ZONE", { x: 7.15, y: 3.55, w: 4, h: 0.3, fontSize: 11, bold: true, color: RED, margin: 0 });
  s.addText("Reset Switch & Redeploy — wipes your DB record so you can register a new contract", { x: 7.15, y: 3.9, w: 5.3, h: 0.5, fontSize: 10, color: MUTED, margin: 0 });
  pill(s, "💀 Reset Switch & Redeploy", 7.15, 4.5, 5.3, "4A1A22", RED);

  s.addText([
    { text: "Interval & grace period are set once at deployment (immutable on-chain) — shown here as Days/Hours/Minutes for clarity", options: { bullet: true, breakLine: true } },
    { text: "Notification settings drive the email/SMS/call escalation ladder before an on-chain trigger", options: { bullet: true } },
  ], { x: 0.6, y: 5.25, w: 12, h: 0.8, fontSize: 12, color: TEXT, fontFace: "Calibri", paraSpaceAfter: 3, margin: 0 });
}

// ---------------- Slide 7: Triggered State ----------------
{
  let s = baseSlide();
  s.background = { color: "1A0610" };
  header(s, "Switch Triggered — Assets Distributed", "Full-screen alert + per-beneficiary confirmation badges");

  // skull banner
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.0, y: 1.5, w: 7.3, h: 2.1, rectRadius: 0.08, fill: { color: "2A0A14" }, line: { color: RED, width: 1.5 } });
  s.addText("💀", { x: 3.0, y: 1.6, w: 7.3, h: 0.6, fontSize: 28, align: "center", margin: 0 });
  s.addText("SWITCH TRIGGERED", { x: 3.0, y: 2.2, w: 7.3, h: 0.5, fontSize: 22, bold: true, color: RED, align: "center", margin: 0, charSpacing: 3 });
  s.addText("All assets have been distributed to your beneficiaries on-chain. The contract has executed and cannot be reversed.", {
    x: 3.3, y: 2.75, w: 6.7, h: 0.6, fontSize: 11, color: MUTED, align: "center", margin: 0,
  });
  pill(s, "View Contract ↗", 4.6, 3.35, 1.7, "2A2A2A", TEXT);
  pill(s, "Dismiss", 6.5, 3.35, 1.5, "2A2A2A", TEXT);

  // beneficiary badges
  ["Son — 50%", "Wife — 50%"].forEach((label, i) => {
    const x = 3.7 + i * 3.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.15, w: 2.7, h: 0.9, rectRadius: 0.06, fill: { color: "0E2A1C" }, line: { color: GREEN, width: 1 } });
    s.addText(label, { x: x + 0.15, y: 4.25, w: 2.4, h: 0.3, fontSize: 12, bold: true, color: TEXT, margin: 0 });
    s.addText("✅ ASSETS SENT", { x: x + 0.15, y: 4.55, w: 2.4, h: 0.35, fontSize: 11, bold: true, color: GREEN, margin: 0 });
  });

  s.addText([
    { text: "Status badge, EKG line, and progress bar all switch to a flatlined red state", options: { bullet: true, breakLine: true } },
    { text: "Each beneficiary row shows a green \"✅ ASSETS SENT\" confirmation once the contract executes", options: { bullet: true, breakLine: true } },
    { text: "Dashboard polls every 5 seconds, so the UI updates live — no manual refresh needed", options: { bullet: true } },
  ], { x: 0.6, y: 5.25, w: 12, h: 1.0, fontSize: 12, color: TEXT, fontFace: "Calibri", paraSpaceAfter: 3, margin: 0 });
}

pres.writeFile({ fileName: "DeathSwitch_Frontend_Overview.pptx" }).then(() => console.log("done"));
