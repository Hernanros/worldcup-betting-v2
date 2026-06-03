import { useState } from "react"
export default function TextPickMarket({ market, onSelect, selected }) {
  const [value, setValue] = useState(selected || "")
  function handleConfirm() { if (value.trim()) onSelect(value.trim(), market.default_odds) }
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleConfirm()} placeholder="Player name e.g. Vinicius Jr" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: selected ? "2px solid #1abc9c" : "1px solid #2d2b55", background: "#0d1117", color: "#fff", fontSize: 13 }} />
      <button onClick={handleConfirm} style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", background: "#1abc9c", border: "none", color: "#fff", fontWeight: 700, fontSize: 13 }}>Pick</button>
    </div>
  )
}
