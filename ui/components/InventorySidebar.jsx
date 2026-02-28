import { sidebarStyles } from "../styles.js";

export default function InventorySidebar({ inventory }) {
  return (
    <div style={sidebarStyles.container}>
      <h2 style={sidebarStyles.title}>◇ INVENTORY</h2>
      {inventory.length === 0 && (
        <div style={sidebarStyles.empty}>
          No items yet. Click objects in the room to interact.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {inventory.map((item, i) => (
          <div key={`${item.id}-${i}`} style={sidebarStyles.itemRow}>
            <div
              style={{
                ...sidebarStyles.itemColor,
                background: item.color,
              }}
            />
            <span style={{ fontSize: 12, color: "#ccc8da" }}>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
