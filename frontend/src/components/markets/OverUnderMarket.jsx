export default function OverUnderMarket({ market, onSelect, selected }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {market.lines.map(line => (
        <button key={line.name} onClick={() => onSelect(line.name, line.odds)} style={{
          flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer",
          border: selected === line.name ? "2px solid #1abc9c" : "1px solid #2d2b55",
          background: selected === line.name ? "rgba(26,188,156,0.15)" : "#1a1a2e",
          color: "#fff", fontWeight: 600, fontSize: 13,
        }}>
          <div>{line.name}</div>
          <div style={{ fontSize: 11, color: "#1abc9c", marginTop: 2 }}>@ {line.odds}</div>
        </button>
      ))}
    </div>
  )
}
