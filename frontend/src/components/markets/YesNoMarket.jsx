export default function YesNoMarket({ market, onSelect, selected }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {market.options.map(opt => (
        <button key={opt.value} onClick={() => onSelect(opt.value, opt.odds)} style={{
          flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
          border: selected === opt.value ? "2px solid #1abc9c" : "1px solid #2d2b55",
          background: selected === opt.value ? "rgba(26,188,156,0.15)" : "#1a1a2e",
          color: "#fff", fontWeight: 700, fontSize: 15, textTransform: "uppercase",
        }}>
          <div>{opt.value}</div>
          <div style={{ fontSize: 11, color: "#1abc9c", marginTop: 2, textTransform: "none", fontWeight: 400 }}>@ {opt.odds}</div>
        </button>
      ))}
    </div>
  )
}
