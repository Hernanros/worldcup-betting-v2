export default function ExactCountMarket({ market, onSelect, selected }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {market.options.map(opt => (
        <button key={opt.value} onClick={() => onSelect(opt.value, opt.odds)} style={{
          padding: "8px 14px", borderRadius: 8, cursor: "pointer",
          border: selected === opt.value ? "2px solid #1abc9c" : "1px solid #2d2b55",
          background: selected === opt.value ? "rgba(26,188,156,0.15)" : "#1a1a2e",
          color: "#fff", fontWeight: 600, fontSize: 13,
        }}>
          <div>{opt.value}</div>
          <div style={{ fontSize: 11, color: "#1abc9c", marginTop: 2 }}>@ {opt.odds}</div>
        </button>
      ))}
    </div>
  )
}
